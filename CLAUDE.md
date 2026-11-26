# Boligberegner: project notes

Danish home-purchase cost calculator (ejerbolig and andelsbolig) plus the Housing Math Reel. Denmark only for now; the plan is to go global later.

- Repo: https://github.com/banabhai/Boligberegner (branch `main`)
- Live site (GitHub Pages, capital B): https://banabhai.github.io/Boligberegner/
- Reel: https://banabhai.github.io/Boligberegner/reel/

## Rules for every update

1. **Version every change.** Bump major.minor.patch in all of these places: the footer of `index.html` and `reel/index.html` ("Boligberegner version X.Y.Z"), the "Version X.Y.Z" line in `README.md`, a new dated entry at the top of `CHANGELOG.md`, and `reel/package.json` (then run `npm install --package-lock-only --ignore-scripts` in `reel/`).
2. **Push every update to GitHub** with a commit message that starts with "Release X.Y.Z:". The owner wants each update on GitHub and the version number reported back.
3. **Never add videos** to the repo (no .mp4, .mov, .webm and so on). Rendered reels stay local; `.gitignore` blocks `*.mp4`.
4. **Keep it secure.** Keep the Content Security Policy in both pages: same-site scripts, styles, fonts, images and manifest only; `connect-src 'none'`. No CDNs, analytics, cookies or third-party requests. Fonts are self-hosted in `fonts/`. Validate anything read from localStorage (see `clean()` in `assets/calculator.js`). Never insert user-typed text as HTML.
5. **Privacy.** Inputs stay on the device and are saved only if the user ticks "Remember my inputs on this device". If a change starts to collect or send any data, update the privacy notice in `README.md` first.
6. **Legal text.** Terms of use and the privacy notice live in `README.md` (anchors `#terms-of-use` and `#privacy-notice`, linked from both page footers). Update the "Last updated" dates when they change.
7. **Licence.** All rights reserved (`LICENSE`), the same as Heartbeat. Fonts are SIL OFL 1.1 (`fonts/OFL.txt`).

## Layout

| Path | Purpose |
| --- | --- |
| `index.html`, `assets/calculator.js`, `assets/calculator.css` | Calculator |
| `reel/index.html`, `reel/reel.js`, `reel/reel.css` | Interactive reel (canvas, 36 s, 1080×1920) |
| `reel/render.js` | Renders the reel to MP4 locally (Playwright + ffmpeg) |
| `assets/fonts.css`, `fonts/` | Self-hosted fonts |
| `icon.svg`, `icon-180.png`, `icon-512.png`, `manifest.webmanifest` | App icon and home-screen settings |

## Related

Heartbeat (https://github.com/banabhai/Heartbeat) is the owner's earlier GitHub Pages app and the model for these conventions.
