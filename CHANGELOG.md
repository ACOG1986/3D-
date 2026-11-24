# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Cutting list modes: **for ordering** (finished sizes) and **for cutting** (edge banding subtracted).
  The mode applies to the on-screen list, drawing sheet and exports; the cutting layout always uses cut sizes.
- ESLint, Prettier, EditorConfig, GitHub Actions CI, issue and pull request templates, contributing guide.
- English README with screenshots; Russian README moved to `docs/README.ru.md`.

## [0.2.0] - 2026-11-23

### Added

- Corner (L-shaped) wardrobe with a side wing on the left or right: 3D, front/top editors, plan view and a separate drawing sheet.
- HDF parts in the cutting layout on 2800×2070 sheets; improved guillotine packing with rotation of non-grain parts.
- Step-by-step "Create wardrobe" wizard, guided tour and plain-language help tips.

## [0.1.0] - 2026-11-23

### Added

- First MVP: wardrobe model and geometry, 3D view, interactive 2D front/top editors, drag & drop,
  A3 technical drawing (PDF/SVG/PNG), cutting list, hardware list, validation, undo/redo, autosave,
  projects in localStorage, JSON import/export, dark theme, RU/LT/EN localisation.
