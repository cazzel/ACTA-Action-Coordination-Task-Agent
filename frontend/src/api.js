const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export function apiUrl(path) {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function saveAuthSession(data) {
  if (data?.access_token) sessionStorage.setItem("acta_access_token", data.access_token);
  if (data?.refresh_token) sessionStorage.setItem("acta_refresh_token", data.refresh_token);
  if (data?.membership?.company?.name) sessionStorage.setItem("acta_company_name", data.membership.company.name);
  if (data?.user?.email) sessionStorage.setItem("acta_user_email", data.user.email);
  if (data?.membership?.company_id) sessionStorage.setItem("acta_company_id", data.membership.company_id);
  if (data?.membership?.role) sessionStorage.setItem("acta_role", data.membership.role);
}

export function clearAuthSession() {
  ["acta_access_token", "acta_refresh_token", "acta_company_name", "acta_user_email", "acta_company_id", "acta_role"].forEach((key) => sessionStorage.removeItem(key));
}

async function refreshAuthSession() {
  const refreshToken = sessionStorage.getItem("acta_refresh_token");
  if (!refreshToken) return false;
  try {
    const response = await fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    saveAuthSession(data);
    return Boolean(data.access_token);
  } catch {
    return false;
  }
}

export async function apiFetch(input, init = {}) {
  const url = typeof input === "string" ? apiUrl(input) : input.url;
  const requestInput = typeof input === "string" ? url : input;
  const makeRequest = () => {
    const headers = new Headers(init.headers || {});
    const token = sessionStorage.getItem("acta_access_token");
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return fetch(requestInput, { ...init, headers, credentials: "include" });
  };
  let response = await makeRequest();
  const isAuthEndpoint = String(url).includes("/api/auth/");
  if (response.status === 401 && !isAuthEndpoint && await refreshAuthSession()) response = await makeRequest();
  return response;
}

export async function demoFetch(path, init = {}) {
  const token = sessionStorage.getItem("acta_demo_token");
  const headers = new Headers(init.headers || {});
  if (token) headers.set("X-ACTA-DEMO-TOKEN", token);
  return fetch(apiUrl(path), { ...init, headers, credentials: "omit" });
}

export { API_BASE_URL };
