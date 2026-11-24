# Contributing

Thanks for your interest in improving Wardrobe Designer!

## Getting started

```bash
nvm use            # Node 20 (see .nvmrc)
npm install
npm run dev
```

## Workflow

1. Create a branch from `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Make your change in small, focused commits.
3. Run the same checks as CI before pushing:

   ```bash
   npm run check    # typecheck + lint + format check + unit tests
   npm run build
   ```

4. Open a pull request. Fill in the template and add screenshots for UI changes.

## Code guidelines

- **TypeScript strict.** No `any` in business logic; prefer explicit types for public functions.
- **Single source of truth.** All derived data (parts, doors, cutting list, drawing) is computed from the
  `Wardrobe` model by pure functions in `src/lib/`. Do not store derived values in the model.
- **Tests.** Every change to `src/lib/geometry.ts` or `src/lib/drawing.ts` needs unit tests (Vitest).
- **i18n.** Every user-visible string goes through `t('key')`. Add new keys to **all three** dictionaries:
  `src/i18n/ru.ts` (source), `en.ts`, `lt.ts`. The compiler fails if a key is missing.
- **Accessibility.** Interactive elements need a visible focus style and an accessible name (`aria-label` or text).
- **Formatting** is handled by Prettier (`npm run format`); linting by ESLint (`npm run lint`).

## Commit messages

Use short imperative subjects, optionally with a type prefix:

```
feat: add U-shaped corner wardrobe
fix: keep drawer fronts inside the section
docs: update data model in README
```

## Reporting bugs

Open an issue using the **Bug report** template. Attaching the project JSON
(**Download drawing → JSON**) makes bugs much easier to reproduce.
