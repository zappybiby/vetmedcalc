# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the Svelte + TypeScript app.
  - `src/App.svelte` and `src/main.ts` are the entry points.
  - `src/lib/components/` holds UI components (tabs, calculators, panels).
  - `src/lib/viewmodels/` contains calculation and presentation logic used by components.
  - `src/lib/definitions/` is the source of truth for medication/fluid/syringe definitions.
  - `src/lib/helpers/` hosts reusable pure functions (unit conversions, mappings).
  - `src/lib/stores/` contains app state (e.g., patient).
- `public/` and `src/assets/` contain static assets.
- Build output is `dist/` (generated; do not commit).

## Build, Test, and Development Commands

- `npm ci`: clean install (matches CI/GitHub Pages workflow).
- `npm run dev`: start Vite dev server.
- `npm run build`: production build to `dist/`.
- `npm run preview`: serve the built app locally.
- `npm run check`: run `svelte-check` + TypeScript checks (use before PRs).

## Coding Style & Naming Conventions

- TypeScript is `strict` (see `tsconfig*.json`); keep functions typed and avoid `any`.
- Indentation: 2 spaces; follow existing formatting in `.ts` and `.svelte`.
- Prefer domain names that match the UI and definitions: `MedicationDef`, `DoseUnit`, `CRIViewModel`.
- Imports: use aliases when helpful: `@/…` for `src/`, `@defs/…` for `src/lib/definitions/`.

## Testing Guidelines

- No automated test runner is currently configured.
- Treat `npm run check` + a quick manual smoke test in `npm run dev` as the baseline.
- If you add a test framework, prefer colocated naming like `*.test.ts` for helper/viewmodel logic.

## Commit & Pull Request Guidelines

- Commits in history are short, imperative summaries (e.g., `fix cpr calc`, `update cri drug list`).
- PRs should include: what changed, why, and (for UI changes) a screenshot or short clip.
- For calculation changes, include an example input → expected output in the PR description.

## Deployment Notes

- GitHub Pages deploys from `main`/`master` via `.github/workflows/pages.yml`.
- The app is built with a subpath base (`base: '/vetmedcalc/'` in `vite.config.ts`); update this if the Pages path changes.
