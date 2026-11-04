# ACTA Design Research & UX System

## Direction

**ACTA — Signal Workspace** is an operations-first AI coordination workspace. The interface should feel deliberate, calm, confident, and alive without becoming a marketing microsite. The central product story is the loop from meeting capture to AI understanding, human approval, and execution.

## Competition references studied

1. **Dropbox Brand — CSS Design Awards Website of the Year 2025** (Daybreak Studio, Canada). CSSDA's 2025 recap identifies Dropbox Brand as the overall Website of the Year winner and its Best UX Site. The case page describes the experience as animated, colorful, and scroll-led, and shows strong independent judge scores for UI, UX, and innovation. ACTA takes the principle of a distinct visual system with purposeful motion and details; it does not copy Dropbox's expressive campaign art direction.
   - https://www.cssdesignawards.com/blog/2025-website-of-the-year-winners/430/
   - https://www.cssdesignawards.com/woty2025/sites/dropbox-brand/

2. **Dropbox Brand Website — The Webby Awards 2025**. The official record lists it as a Webby Winner for Best User Experience and Best Responsive/Adaptive Design for Mobile, and as a nominee for Best Visual Design – Function. The Webby description of Best User Experience emphasizes innovative design and useful functionality; its responsive category explicitly evaluates adaptation to user device and screen. ACTA applies this through mobile-aware layouts, predictable patterns, keyboard navigation, and functional interaction states.
   - https://winners.webbyawards.com/2025/websites-and-mobile-sites/features-design/best-visual-design-function/333662/dropbox-brand-website

3. **Exat Typeface — CSS Design Awards Website of the Year 2025 Best UI Site** (Studio Size & RISE2 Studio). CSSDA's 2025 recap names Exat as the Best UI Site. ACTA takes this as a reminder that typography, hierarchy, spacing, and visual consistency need to be designed as a system—not assembled ad hoc per page. The requested typeface direction is implemented as Inter throughout the application.
   - https://www.cssdesignawards.com/blog/2025-website-of-the-year-winners/430/

## Principles translated into ACTA

- **One clear visual identity:** Inter typography, ink-green navigation, warm neutral canvas, bright signal-lime action accent, consistent rounded surfaces, and a restrained color vocabulary for statuses.
- **Purposeful hierarchy:** large page titles, short explanatory copy, data-first stats, and consistent page-level introduction patterns.
- **Product story as navigation:** the ACTA Loop brings Capture → Understand → Approve → Execute into the Overview, with links to the actual pages and dynamic counts sourced from the task state already loaded by the app.
- **Fast access for power users:** `Ctrl + K` / `⌘ + K` opens a searchable command palette. Arrow keys move through destinations, Enter opens the selected page, and Escape closes the palette.
- **Responsive by design:** compact navigation, reflowed cards and workflow steps, stacked forms, and mobile-safe task actions.
- **Motion with a purpose:** restrained page entrance, hover elevation, button press feedback, keyboard focus indication, and explicit loading spinners; `prefers-reduced-motion` is respected.
- **Preserve the application contract:** the UI update reuses existing pages, handlers, API calls, integrations, and database workflow. It does not change backend routes or credentials.

## Validation status

- JSX syntax transpilation using the installed TypeScript compiler: passed.
- Stylesheet tokenization using `tinycss2`: passed with 0 top-level parse errors.
- Production Vite build: not verified in this environment because dependency installation timed out. Run `npm install` and `npm run build` on the user's Windows machine before the competition demo.
- Live browser/API regression: not independently rerun in this environment. Previously verified backend functionality is retained in the supplied source, but it must be rechecked after installation in the actual environment.
