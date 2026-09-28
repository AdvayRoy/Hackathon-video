# NEURASCOPE Launch Film — Production State (Phase 0: prep only)

Status: environment + pipeline verified. **No creative decisions made.** Waiting on:
1. raw screen recording  → drop into `00_raw/` (never modified; sha256 recorded by ingest)
2. `NEURASCOPE_COMPLETE_PRODUCT_BRIEF.md` → canonical source of truth; read fully before any edit decision

## Environment (verified)
- macOS 25.5 arm64 VM, Apple M4 Pro (virtual) 12 cores, 16 GB RAM, ~45 GB free. **No GPU compute** (no CUDA; VideoToolbox HW encode works).
- Node 24.20, npm 10.8, pnpm 12.4; Python 3.9.6 (system; numpy/PIL/cv2 not verified — install into a venv only if needed)
- ffmpeg/ffprobe 9.0.1 (Homebrew). Encoders: libx264, libx265, h264/hevc_videotoolbox, prores_ks (422 HQ/4444), prores_videotoolbox, libvpx-vp9, aac, libopus, png/apng/gif.
  Filters available: zoompan, minterpolate, tblend, tmix, scdet, freezeframes, setpts, tpad. **Missing: `drawtext` (no libfreetype build) → all text is rendered in HyperFrames, never ffmpeg.**
- ImageMagick: not installed (not needed; PIL/ffmpeg cover it). Docker: absent (irrelevant; local render works).
- Chrome: `Google Chrome.app` + HyperFrames' own chrome-headless-shell 152 at `~/.cache/hyperframes/chrome/...` (works; `hyperframes doctor` reports a spurious timeout on its --version probe, ignore).
- whisper-cli present (transcription of any VO / mic audio in the recording).
- Fonts: system fonts only (SF, Helvetica Neue, Menlo, Futura, Didot, Georgia, Arial Unicode). Inter/Geist etc. must be vendored (OFL) into `03_assets/fonts/` if chosen.
- Voice gen: Fish Audio API key is available as env var `Fish_audio_api_key` (use for VO if the brief calls for narration; do NOT print it).

## HyperFrames — what it actually is (important correction)
HyperFrames (`hyperframes` v0.8.79 CLI, global at /opt/homebrew/bin) is **not a generative video model**. It is an HTML→video framework: compositions are HTML files with `data-start/data-duration` timing, GSAP paused-timeline animation, framework-owned `<video>` seeking, rendered deterministically frame-by-frame in headless Chrome and encoded by ffmpeg. It gives us: exact-timing motion graphics, real-product screen recording as a `<video>` element with seek-safe punch-ins/pans (CSS transforms on an inner wrapper), masks/crops, blur, typography, sub-compositions, audio tracks with automation, Studio preview, registry blocks (~400: glitch, grain, shimmer, charts, terminal windows, transitions).
Consequence: there is no "image conditioning / generated connective tissue" in the diffusion sense. Connective tissue = authored motion (GSAP/WebGL/CSS/Three.js) over the *real* footage — which is exactly what "preserve reality" wants. No product UI can be hallucinated by the tool.
Skills installed locally at `~/.agents/skills/hyperframes*`, `media-use`. Workflow route for this deliverable: `/product-launch-video` or `/general-video` (decide after brief).

## Pipeline tests (all passed unless noted) → `05_renders/tests/`
- `scripts/ffmpeg_pipeline_test.sh`: H.264 (libx264 crf16), ProRes 422 HQ, HEVC VideoToolbox, 9:16 center-crop reframe, minterpolate 60→120 fps, setpts speed change, tpad freeze. OK.
  - Caveat: ffmpeg `zoompan` produced a wrong output duration (513 s from a 4 s source) — **do not use ffmpeg zoompan; do all zooms/pans as GSAP transforms in HyperFrames** (also gives motion-blur-free, seek-safe, sub-pixel moves).
- HyperFrames smoke composition `04_hyperframes/neurascope-film/index.html`: title card (blur-in) → real `<video>` clip with `data-media-start` trim + 2.5 s GSAP punch-in; `npm run check` passes; rendered to `05_renders/tests/hf_smoke.mp4` (see render log line in this file's Log section).
  - Lint rules learned: time the `<video>` itself (needs `id`, `data-start`, `data-duration`, `muted`), never both the wrapper and the video; animate the inner wrapper for camera moves; Studio prefers each scene as a sub-composition (`compositions/*.html` via `data-composition-src`).

## Workspace layout
```
00_raw/            original recording, byte-for-byte (gitignored)
01_analysis/       probe json, sha256, pts pacing, scene/scdet logs, frames/ (1/2s @240p), proxies/ (480p), contact_sheets/ (6x8 tiles, 1 frame/5s → tile k of sheet n = (48n+k)*5 s)
02_audio/          extracted wav, level + silence reports
03_assets/         fonts/ brand/ generated/
04_hyperframes/neurascope-film/   HyperFrames project (index.html, compositions/, assets/ — put proxies/clips here or symlink)
05_renders/        tests/ final/
06_tmp/            scratch
scripts/ingest.sh  <recording>  → full forensic ingest (idempotent, non-destructive)
scripts/ffmpeg_pipeline_test.sh → re-verify encode leg
```

## Footage report / source map
**Recording not yet supplied.** On arrival run `scripts/ingest.sh 00_raw/<file>` then fill `01_analysis/SOURCE_MAP.md` (timestamped `mm:ss–mm:ss → observed UI state`, dead time, loading, cursor, notifications, browser chrome, crop-safe regions for 16:9 and 9:16, chat readability). Do not interpret product meaning beyond what is visible until the brief arrives.

## Blockers
- None technical. Waiting on: raw recording + product brief.
- Soft: no GPU → keep WebGL/Three.js effects modest; render time is CPU-bound (smoke render timing in Log). Long final renders should be split per sub-composition and stitched with ffmpeg concat (lossless).

## Log
- 2026-09-27 hf_smoke render: 1920x1080 @30fps, 120 frames, 12.9 s wall (4 workers, ~9 fps render throughput → budget ~3.5 s render per 1 s of 30fps output; 60fps doubles it). Output H.264 4.1 MB. Set `fps`/quality in hyperframes.json or `render --fps 60` for final.
- ffmpeg_pipeline_test: encode leg OK (h264/prores/hevc-vt/9x16/minterpolate); zoompan flagged unreliable.

---

## Phase 1–3 (post-brief): source map → creative direction → composition → master

- Brief read in full: `NEURASCOPE_COMPLETE_PRODUCT_BRIEF.md` (canonical).
- Source map: `01_analysis/SOURCE_MAP.md` (every range of the 145.8 s recording, incl. artifacts to avoid: record widget <12.4 s, mic popup 70–72.3 s, tab overview 100.4–102 s, toolbar >144 s).
- Creative direction: `CREATIVE_DIRECTION.md` (78 s, 16:9, interface-as-hero, brief-verbatim copy, no VO).
- Composition: `04_hyperframes/neurascope-film/index.html` — 14 timed `<video>` shots of the untouched raw recording (`assets/raw.mp4`, copy of `00_raw`), GSAP camera moves on untimed `.cam` wrappers, Geist Sans/Mono (bundled woff2 + license), 15 overlay scenes, dip-to-ink transitions, one paused root timeline. `npm run check` → 0 errors.
- Sound: original deterministic score `scripts/score.mjs` → `02_audio/score.wav` (78 s, −18.3 dB mean, −3.1 dB peak, seed 20260926); SFX from the media-use bundled Pixabay set (click-soft / whoosh-short / ping / impact-bass-1).
- Smoke test moved to `04_hyperframes/neurascope-film/smoke/`.
- Render: `npm run render` → `05_renders/final/NEURASCOPE_launch_1080p.mp4` (delivery quality, PNG frame extraction for UI fidelity).
- Regenerate everything: `node scripts/score.mjs | ffmpeg -f f32le -ar 48000 -ac 2 -i - 02_audio/score.wav && cp 02_audio/score.wav 04_hyperframes/neurascope-film/assets/ && cp 00_raw/neurascope_raw.mp4 04_hyperframes/neurascope-film/assets/raw.mp4 && (cd 04_hyperframes/neurascope-film && npm run check && npm run render)`.
