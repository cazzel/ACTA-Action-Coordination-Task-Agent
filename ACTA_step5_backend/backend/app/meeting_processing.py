"""Extract documents and transcribe supported recordings for meeting analysis."""
from __future__ import annotations

import logging
import mimetypes
import os
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import httpx
from typing import Literal
from uuid import UUID

from dotenv import load_dotenv

# Load optional provider credentials from the backend .env without overwriting
# environment variables supplied by a deployment environment.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

MEETING_FILES_BUCKET = "acta-meeting-files"
MAX_TRANSCRIPT_CHARS = 12_000
TEXT_EXTENSIONS = {".txt", ".pdf", ".docx", ".pptx"}
AUDIO_VIDEO_EXTENSIONS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4", ".mov"}
TRANSCRIBEABLE_AUDIO_EXTENSIONS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4"}


class TranscriptionSetupError(Exception):
    """Raised when a speech-to-text provider has not been configured."""


class TranscriptionRequestError(Exception):
    """Raised when the speech-to-text API rejects or cannot process a file."""


def _transcription_config() -> tuple[str, str, str] | None:
    """Return provider, API key and model; auto-select a configured provider."""
    provider = os.getenv("ACTA_TRANSCRIPTION_PROVIDER", "").strip().lower()
    if not provider:
        if os.getenv("GROQ_API_KEY", "").strip():
            provider = "groq"
        elif os.getenv("OPENAI_API_KEY", "").strip():
            provider = "openai"
        else:
            return None

    providers = {
        "groq": {
            "key": os.getenv("GROQ_API_KEY", "").strip(),
            "model": "whisper-large-v3-turbo",
            "url": "https://api.groq.com/openai/v1/audio/transcriptions",
        },
        "openai": {
            "key": os.getenv("OPENAI_API_KEY", "").strip(),
            "model": "gpt-transcribe",
            "url": "https://api.openai.com/v1/audio/transcriptions",
        },
    }
    if provider not in providers:
        raise TranscriptionSetupError(
            "Unknown ACTA_TRANSCRIPTION_PROVIDER. Use 'groq' or 'openai'."
        )
    config = providers[provider]
    if not config["key"]:
        raise TranscriptionSetupError(
            f"The {provider.title()} transcription provider is selected, but its API key is missing. "
            + ("Add GROQ_API_KEY to the backend .env file." if provider == "groq" else "Add OPENAI_API_KEY to the backend .env file.")
        )
    model = os.getenv("ACTA_TRANSCRIPTION_MODEL", "").strip() or config["model"]
    return provider, str(config["key"]), model


def _transcribe_audio(filename: str, extension: str, file_bytes: bytes) -> str:
    """Transcribe a stored audio/video container via a configured speech-to-text API."""
    if extension not in TRANSCRIBEABLE_AUDIO_EXTENSIONS:
        raise TranscriptionRequestError(
            f"The {extension or 'unknown'} format is not supported for automatic transcription. "
            "Export the recording as MP3, M4A, WAV, OGG, WEBM, or MP4 and upload it again."
        )
    if len(file_bytes) > 25 * 1024 * 1024:
        raise TranscriptionRequestError(
            "This recording is larger than the transcription provider's 25 MB request limit."
        )

    config = _transcription_config()
    if config is None:
        raise TranscriptionSetupError(
            "Automatic transcription is not configured. Add GROQ_API_KEY or OPENAI_API_KEY to the backend .env file, "
            "then restart the backend. The OpenRouter key used for the AI agent does not replace a transcription API key."
        )

    provider, api_key, default_model = config
    endpoint = (
        "https://api.groq.com/openai/v1/audio/transcriptions"
        if provider == "groq"
        else "https://api.openai.com/v1/audio/transcriptions"
    )
    model = os.getenv("ACTA_TRANSCRIPTION_MODEL", "").strip() or default_model
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    try:
        response = httpx.post(
            endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": model, "response_format": "json"},
            files={"file": (Path(filename).name, file_bytes, content_type)},
            timeout=httpx.Timeout(180.0, connect=20.0),
        )
    except httpx.TimeoutException as exc:
        raise TranscriptionRequestError(
            "The transcription service timed out. Try a shorter recording or retry later."
        ) from exc
    except httpx.HTTPError as exc:
        logger.warning("Transcription request failed due to network error (%s)", type(exc).__name__)
        raise TranscriptionRequestError(
            "ACTA could not reach the transcription service. Check the internet connection and retry."
        ) from exc

    if not response.is_success:
        if response.status_code in (401, 403):
            detail = f"The {provider.title()} transcription API key was rejected. Check the key and provider configuration."
        elif response.status_code == 429:
            detail = "The transcription provider rate limit or account quota was reached. Check the provider dashboard and retry later."
        elif response.status_code in (413, 415, 422):
            detail = "The transcription provider rejected this file format or file size. Try MP3, M4A, WAV, OGG, WEBM, or MP4."
        else:
            detail = f"The transcription provider returned HTTP {response.status_code}. Check its status and model availability."
        logger.warning("Transcription API returned HTTP %s for %s", response.status_code, filename)
        raise TranscriptionRequestError(detail)

    try:
        payload = response.json()
    except ValueError as exc:
        raise TranscriptionRequestError("The transcription provider returned an unreadable response.") from exc

    transcript = str(payload.get("text") or "").strip() if isinstance(payload, dict) else ""
    if len(transcript) < 3:
        raise TranscriptionRequestError(
            "The transcription service did not detect enough speech in this recording."
        )
    return transcript


class MeetingAnalysisUpdate(BaseModel):
    transcript_text: str = Field(min_length=20, max_length=MAX_TRANSCRIPT_CHARS)
    summary: str = Field(min_length=1, max_length=12_000)
    status: Literal["ready", "processing", "failed"] = "ready"


def _extract_text(extension: str, file_bytes: bytes) -> str:
    """Extract selectable text for supported document types."""
    if extension == ".txt":
        return file_bytes.decode("utf-8-sig", errors="replace").strip()

    if extension == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(file_bytes))
        return "\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()

    if extension == ".docx":
        from docx import Document

        document = Document(BytesIO(file_bytes))
        chunks = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
        for table in document.tables:
            for row in table.rows:
                cell_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cell_text:
                    chunks.append(" | ".join(cell_text))
        return "\n".join(chunks).strip()

    if extension == ".pptx":
        from pptx import Presentation

        presentation = Presentation(BytesIO(file_bytes))
        chunks: list[str] = []
        for slide_number, slide in enumerate(presentation.slides, start=1):
            slide_chunks: list[str] = []
            for shape in slide.shapes:
                if getattr(shape, "has_text_frame", False) and shape.text.strip():
                    slide_chunks.append(shape.text.strip())
                if getattr(shape, "has_table", False):
                    for row in shape.table.rows:
                        cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if cells:
                            slide_chunks.append(" | ".join(cells))
            if slide_chunks:
                chunks.append(f"Slide {slide_number}\n" + "\n".join(slide_chunks))
        return "\n\n".join(chunks).strip()

    return ""


def build_meeting_processing_router() -> APIRouter:
    router = APIRouter()

    @router.post("/api/meetings/{meeting_id}/extract-text")
    def extract_meeting_text(meeting_id: UUID):
        """Extract text from all supported files attached to one meeting."""
        client = get_supabase_client()
        meeting_id_value = str(meeting_id)

        try:
            meeting_rows = (
                client.table("meetings")
                .select("id, company_id, title")
                .eq("id", meeting_id_value)
                .limit(1)
                .execute()
                .data or []
            )
            if not meeting_rows:
                raise HTTPException(status_code=404, detail="Meeting not found.")

            file_rows = (
                client.table("meeting_files")
                .select("id, original_file_name, storage_bucket, storage_path, file_kind")
                .eq("meeting_id", meeting_id_value)
                .order("created_at")
                .execute()
                .data or []
            )
            if not file_rows:
                raise HTTPException(status_code=400, detail="This meeting has no uploaded files yet.")

            transcript_parts: list[str] = []
            processed_files: list[str] = []
            skipped_files: list[dict[str, str]] = []
            remaining_chars = MAX_TRANSCRIPT_CHARS
            truncated = False

            transcribed_files: list[str] = []
            for file_row in file_rows:
                name = str(file_row.get("original_file_name") or "Meeting file")
                extension = Path(name).suffix.lower()

                is_audio = extension in AUDIO_VIDEO_EXTENSIONS
                if not is_audio and extension not in TEXT_EXTENSIONS:
                    skipped_files.append({
                        "file_name": name,
                        "reason": "This file format is not supported for text extraction yet.",
                    })
                    continue

                if extension == ".mov":
                    skipped_files.append({
                        "file_name": name,
                        "reason": "Automatic transcription does not currently accept MOV files. Export as MP4, MP3, M4A, WAV, OGG, or WEBM and upload again.",
                    })
                    continue

                storage_path = file_row.get("storage_path")
                if not storage_path:
                    skipped_files.append({"file_name": name, "reason": "Storage path is missing."})
                    continue

                try:
                    downloaded = client.storage.from_(file_row.get("storage_bucket") or MEETING_FILES_BUCKET).download(storage_path)
                    if isinstance(downloaded, bytes):
                        file_bytes = downloaded
                    elif hasattr(downloaded, "content"):
                        file_bytes = downloaded.content
                    else:
                        file_bytes = bytes(downloaded)

                    if is_audio:
                        extracted = _transcribe_audio(name, extension, file_bytes)
                    else:
                        extracted = _extract_text(extension, file_bytes)
                except ImportError as exc:
                    package_map = {
                        ".pdf": "pypdf",
                        ".docx": "python-docx",
                        ".pptx": "python-pptx",
                    }
                    package = package_map.get(extension, "required document parser")
                    raise HTTPException(
                        status_code=503,
                        detail=f"Missing package '{package}'. Install the meeting-processing dependencies in the backend environment, then retry.",
                    ) from exc
                except TranscriptionSetupError as exc:
                    logger.info("Audio transcription skipped for %s: provider is not configured", name)
                    skipped_files.append({"file_name": name, "reason": str(exc)})
                    continue
                except TranscriptionRequestError as exc:
                    logger.warning("Audio transcription could not process %s: %s", name, str(exc))
                    skipped_files.append({"file_name": name, "reason": str(exc)})
                    continue
                except HTTPException:
                    raise
                except Exception as exc:
                    logger.warning("Could not extract meeting file %s (%s)", name, type(exc).__name__)
                    skipped_files.append({"file_name": name, "reason": "Could not read this file; check that it is valid and accessible."})
                    continue

                extracted = extracted.strip()
                if not extracted:
                    skipped_files.append({
                        "file_name": name,
                        "reason": "No selectable text was found; scanned PDFs may need OCR.",
                    })
                    continue

                source_label = " — automatic transcription" if is_audio else ""
                prefix = f"[Source file: {name}{source_label}]\n"
                chunk = prefix + extracted + "\n\n"
                if len(chunk) > remaining_chars:
                    chunk = chunk[:remaining_chars]
                    truncated = True
                if chunk.strip():
                    transcript_parts.append(chunk)
                    processed_files.append(name)
                    if is_audio:
                        transcribed_files.append(name)
                    remaining_chars -= len(chunk)
                if remaining_chars <= 0:
                    truncated = True
                    break

            transcript_text = "\n".join(transcript_parts).strip()
            if len(transcript_text) < 20:
                audio_skips = [
                    item for item in skipped_files
                    if Path(item["file_name"]).suffix.lower() in AUDIO_VIDEO_EXTENSIONS
                ]
                if audio_skips and len(audio_skips) == len(skipped_files):
                    reasons = " ".join(dict.fromkeys(item["reason"] for item in audio_skips))
                    detail = (
                        "ACTA could not produce a transcript from the uploaded audio/video files. "
                        + reasons
                        + " You can also upload a TXT/PDF/DOCX/PPTX transcript."
                    )
                else:
                    detail = (
                        "ACTA could not extract enough readable text from this meeting's files. "
                        "Check whether the documents contain selectable text; scanned PDFs and legacy PPT files are not supported yet."
                    )
                raise HTTPException(status_code=422, detail=detail)

            client.table("meetings").update({
                "transcript_text": transcript_text,
                "status": "processing",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", meeting_id_value).execute()

            return {
                "message": "Meeting text extracted and saved. AI analysis can now run.",
                "meeting_id": meeting_id_value,
                "transcript_text": transcript_text,
                "files_processed": len(processed_files),
                "processed_files": processed_files,
                "transcribed_files": transcribed_files,
                "skipped_files": skipped_files,
                "truncated": truncated,
                "max_transcript_chars": MAX_TRANSCRIPT_CHARS,
            }

        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to extract text for meeting %s", meeting_id_value)
            raise HTTPException(
                status_code=503,
                detail="Could not read the meeting materials from Supabase. Check backend logs and Storage permissions.",
            ) from exc

    @router.patch("/api/meetings/{meeting_id}/analysis")
    def save_meeting_analysis(meeting_id: UUID, payload: MeetingAnalysisUpdate):
        """Persist the transcript, AI summary and processing status."""
        client = get_supabase_client()
        meeting_id_value = str(meeting_id)

        try:
            existing = (
                client.table("meetings")
                .select("id")
                .eq("id", meeting_id_value)
                .limit(1)
                .execute()
                .data or []
            )
            if not existing:
                raise HTTPException(status_code=404, detail="Meeting not found.")

            response = (
                client.table("meetings")
                .update({
                    "transcript_text": payload.transcript_text.strip(),
                    "summary": payload.summary.strip(),
                    "status": payload.status,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", meeting_id_value)
                .execute()
            )
            rows = response.data or []
            return {
                "message": "Meeting analysis saved successfully.",
                "data": rows[0] if rows else {"id": meeting_id_value, "status": payload.status},
            }
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to save analysis for meeting %s", meeting_id_value)
            raise HTTPException(
                status_code=503,
                detail="Could not save the meeting analysis to Supabase.",
            ) from exc

    return router
