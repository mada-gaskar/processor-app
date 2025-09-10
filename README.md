# Processor 

Modern process tracking desktop app built with Electron, Vite and React.

[![CI](https://github.com/mada-gaskar/processor-app/actions/workflows/ci.yml/badge.svg)](https://github.com/mada-gaskar/processor-app/actions/workflows/ci.yml)
[![Release](https://github.com/mada-gaskar/processor-app/actions/workflows/release.yml/badge.svg)](https://github.com/mada-gaskar/processor-app/actions/workflows/release.yml)
[![GitHub stars](https://img.shields.io/github/stars/mada-gaskar/processor-app)](https://github.com/mada-gaskar/processor-app/stargazers)

## Overview
- DASHBOARD with processes and steps
- Drag-and-drop step reordering and status tracking
- Backup download and Upload/Merge (supports legacy JSON migration)
- Dark/Light theme
- Electron (desktop) + browser preview via Vite

## Install (Desktop)
Go to Releases and download the latest Windows installer or portable zip.
- Latest: https://github.com/mada-gaskar/processor-app/releases/latest

## Development
Prereqs: Node 20+, Git, Windows (for packaging with electron-packager/electron-builder)

- Install deps: `npm ci`
- Run in dev (Electron + Vite): `npm run dev`
- Lint: `npm run lint`
- Test: `npm test`
- Build installer (electron-builder): `npm run build`
- Build portable zip (electron-packager): `npm run pack:win`

Notes:
- Build output goes to the `release/` folder (ignored by Git).
- Code signing is disabled by default in scripts for CI convenience.

## CI/CD
- CI runs lint, tests, and a build on each push/PR to main.
- To create a draft Release automatically with Windows artifacts:
  1) Bump version in package.json if needed
  2) Create a tag like `v0.1.0` and push it
  3) GitHub Actions will build on Windows, upload `.exe` and `.zip`, and create a draft release

Example:
```
git tag v0.1.0 -m "Initial release"
git push origin v0.1.0
```

## Backups & Data
- Use the sidebar buttons: Download Backup and Upload/Merge Backup
- Legacy single-profile JSON exports are auto-migrated on import
- Desktop app data is stored locally in your OS user-data directory (not committed to Git)

## License
TBD
