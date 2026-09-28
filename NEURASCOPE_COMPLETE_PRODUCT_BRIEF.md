# NEURASCOPE — COMPLETE PRODUCT BRIEF (forensic handoff)

Audited commit: `ecaf46dd7c7889550c8e2a20044f015d07bb493c` (`main`, repo `AdvayRoy/NEURASCOPE`).
Purpose: lossless ground-truth transfer of the finished product to a fresh creative session. This document describes what the product **is** and **does**. It contains no creative direction for any video.

Sections marked **[code-verified]** were read directly from the source at the audited commit. Sections marked **[browser-verified earlier]** were verified in a production build during the final build/QA runs at the same code (commits `50c2fc5` → `61573db`, merged unchanged into `ecaf46d`); the audit's own browser pass was cut short by a time cap (see §17).

---

## 1. The product at multiple levels

**One sentence.** NEURASCOPE is a synthetic attention laboratory that predicts *where* a short-form video will lose attention, *why*, and *what to change* — before it is published.

**One paragraph.** A creator gives NEURASCOPE a published TikTok/Instagram Reel URL and/or a local MP4. Oriane (a video-intelligence API) supplies the published content's transcript, keyframes, caption, hashtags and creator context; local decoding supplies measured visual/audio change. These are normalized into a `VideoOntology`, turned into a 10 Hz feature timeline, and fed to CORTEX — a deterministic, cohort-conditioned attention/hazard/survival model run over 10,000 seeded synthetic viewers in four behavioral cohorts. CORTEX produces predicted retention, hazard, attention, a synthetic EEG/reliability proxy, network-activation visualizations, and localized **Attention Fractures**. For each fracture, a Fracture Fingerprint drives a real Oriane retrieval of comparable published content (Corpus Evidence), an intervention is proposed, and **Simulate Patch** reruns the same seeded population on an edited feature timeline to show original vs counterfactual. A **Pre-flight Brief** compresses all of this into one creator decision. An **Ask NEURASCOPE** analyst explains the state deterministically (optionally re-phrased by an LLM).

**Product statement (exact copy):** "Test on synthetic attention before you spend real attention."

**Frozen scientific boundary (exact UI copy):** `Oriane observes · CORTEX predicts · platform analytics validate later`

**Nontechnical explanation.** Think of a wind tunnel for videos. Instead of publishing and hoping, you run the video past a simulated audience that behaves according to published attention research, see the exact seconds where they are modeled to drop off, see what real published videos on the same subject do at that point, and try a fix on the same simulated audience before you re-cut.

**Technical architecture (text diagram) [code-verified].**
```
INPUT → UNDERSTAND → SIMULATE → FRACTURE → DIAGNOSE → INTERVENE → RE-SIMULATE

URL / MP4 (src/components/InputScreen.tsx)
  → /api/oriane/resolve (server; Oriane POST /rest/contents/search, Bearer key server-only)
  → src/lib/oriane/adapter.ts + normalize.ts → VideoOntology (src/lib/ontology.ts)
  → local decode src/lib/media/extract.ts (visual change, cuts, audio RMS change) merged into ontology
  → src/lib/cortex/features.ts → FeatureTimeline + CortexDrivers @ 10 Hz
  → src/lib/cortex/population.ts (seed 20260926, 10,000 viewers, 4 cohorts)
  → src/lib/cortex/simulate.ts (attention → hazard → survival) in a Web Worker (cortex.worker.ts, client.ts)
  → fractures.ts / eeg.ts / networks.ts / interventions.ts → CortexRun (index.ts)
  → UI: Workspace.tsx {VideoPane, BrainCanvas, Timeline, Metrics, CohortRail+ReviewerStage, Inspector, PreflightBrief, EvidenceDrawer, AskBar}
  → per-fracture: fingerprint.ts → /api/oriane/comparables → comparables.ts → CorpusEvidence.tsx
  → Simulate Patch: runCounterfactual() same population → Counterfactual overlay
  → persist.ts (IndexedDB for media blob, localStorage for run/provenance) → refresh/restore
```

**Scientific explanation.** CORTEX is a mechanistic, literature-*informed* (not fitted) model: per-viewer attention state relaxes toward a driver-weighted target; disengagement hazard is a logistic function of attention deficit plus a decaying opening-window "hook" hazard; survival is the cumulative product of (1 − hazard); population retention is the mean survival. Every displayed number carries an evidence tier (A empirical / B literature / C model-derived / D heuristic). No CORTEX number is Tier A or B — literature calibrates directions and scales only.

**Creator/customer explanation.** "Where will this video lose people, why, and what should I change before I publish it?" — answered in the Pre-flight Brief: primary risk → why → observed in the video → real-world Oriane context → recommended change → simulated result.

---

## 2. Routes, files, components [code-verified]

Single-page Next.js app (App Router). Routes:
- `/` — `src/app/page.tsx` → `Lab.tsx` switches between `InputScreen`, `LoadingScreen`, `Workspace` based on store state.
- `/api/oriane/resolve` — URL → Oriane search → normalized ontology (server-only key, rate-limited, 30 s provider timeout, SSRF guard on URLs via `src/lib/oriane/url.ts`).
- `/api/oriane/comparables` — Fracture Fingerprint → Oriane visual/transcript retrieval → CorpusEvidence (bounded cache, dedupe, excludes source video).
- `/api/oriane/fixture` — serves the development fixture ontology (`src/lib/oriane/fixtures`).
- `/api/analyst` — optional LLM phrasing (Anthropic or OpenAI via env keys); 501 when no key; validates that context is a CORTEX analyst context; 500-char question limit; 32 KB body limit.
- `/api/status` — reports which providers are configured (booleans only).

Components: `InputScreen`, `LoadingScreen`, `Workspace`, `VideoPane`, `Timeline`, `Metrics`, `CohortRail`, `reviewers/ReviewerStage` (+`rig.ts`, `reviewerState.ts`, `reviewerBehavior.ts`, `CouplingOverlay.tsx`), `brain/BrainCanvas` (+`AudienceField`, `brainMaterial`, `loadBrain`), `NetworkLegend`, `Inspector`, `CorpusEvidence`, `PreflightBrief`, `EvidenceDrawer`, `Tier`, `AskBar`, `GlBoundary` (WebGL error boundary), `useKeyboard` (Escape order: evidence drawer → brief → fracture; space play/pause; arrow scrub).

State: `src/lib/state/store.ts` (Zustand-style `useLab`): `phase`, `ontology`, `media`, `run`, `time`, `playing`, `fractureId`, `counterfactuals`, `activeCf`, `cfPending`, `corpus`, `brief`, `evidence`, `cohortFilter`, `networkMode`, `context` (audience mix). `pipeline.ts`: `analyze()`, `simulatePatch()`, `newAnalysis()`.

Assets: `public/models/reviewers.glb` (original Blender-authored, script in `assets/`), brain mesh asset (Desikan–Killiany parcellation preprocessed with region IDs), `public/fixtures/*` demo clip.

---

## 3. User journey and every state

### 3.1 Landing / input (`InputScreen`) [code-verified; browser-verified earlier]
- Wordmark `NEURASCOPE`, subtitle `Synthetic Attention Laboratory`.
- Copy: `Drop a video file, or paste a published URL. Both can be combined.`
- URL field placeholder: `Paste a TikTok or Instagram Reel URL`.
- Drop zone for MP4; audience context selector (`Broad feed` / `Category audience` / `Warm / retargeted`).
- Dev fixture button available only when no key is configured / fixture mode; it is labelled `DEV FIXTURE`.
- Three input modes: URL only, MP4 only, URL + MP4 (canonical demo).

### 3.2 Loading (`LoadingScreen`) [code-verified]
Sequential status lines for: resolving source (Oriane), decoding media locally, building feature timeline, simulating 10,000 viewers, detecting fractures. Provider errors surface as generic messages (no provider internals leaked). Fallback order: live URL + MP4 → cached legitimate live analysis + MP4 → local MP4 → clearly labelled development fixture. No silent fake fallbacks.

### 3.3 Workspace (`Workspace`) [code-verified; browser-verified earlier at 1440×900]
Layout (left→right, top→bottom):
- **Header**: `NEURASCOPE`, provenance badge — exactly one of `ORIANE LIVE`, `LOCAL FILE · NO ORIANE RECORD`, `DEV FIXTURE · NOT ORIANE OUTPUT`; population/context readout; `Pre-flight brief` toggle button (orange-bordered when a fracture exists); `New analysis` button (title "New analysis") which resets store and persisted run and remounts reviewers.
- **VideoPane**: the source video (local MP4 or Oriane media), play/pause, scrubbing via timeline; `No media loaded` if absent. Playback never triggers provider calls.
- **BrainCanvas** (R3F): ivory anatomical brain, `AudienceField` particle field of synthetic viewers (10,000 points, exits fade), network activation coloring per `NetworkLegend` (`Functional networks`: Visual processing, Dorsal attention, Ventral attention / reorienting, Salience, Auditory / language, Semantic / narrative integration, Executive control / load — Yeo 2011 / Corbetta 2002 mapping, model-derived). Toggle `ALL VIEWERS` vs cohort filter.
- **Timeline**: `RETENTION` (survival R̂(t)), `HAZARD`, attention traces; orange fracture bands `F1…F5`; semantic event markers (open loop / payoff / CTA / product); dashed mint counterfactual trace when `activeCf` set; playhead scrub.
- **Metrics**: `SYNTHETIC EEG` strip (`ILLUSTRATIVE` badge): alpha, theta, reliability (`EEG proxy`) waveforms; live retention/hazard/attention readouts; `Survival` label.
- **CohortRail + Synthetic reviewers**: four cohort cards (`Cold Scroller`, `Intent Viewer`, `Visual-First Viewer`, `Category Enthusiast`) each with a live 3D reviewer in a shared canvas, cohort retention/hazard numbers, and the exact title tooltip: `Head orientation, gaze, eye aperture, blink rate, brow tension, posture and presence encode each cohort's modeled attention, hazard, orienting, load, fracture impact and survival at the current time. Breathing, blinks and small eye movements are a seeded idle layer. Lines from the brain are a CORTEX state projection: model coupling, not a biological signal. No emotion is recognised or measured.` `CouplingOverlay` draws lines brain→reviewers labelled as CORTEX state projection / model-state coupling.
- **Inspector** (right, opens on fracture click): `ATTENTION FRACTURE F#` + window; sections `Mechanism` (drivers with Tier badges), `Observed in source` (`Static before window`, `Words since last cut`, `New concepts in window`, `Open loop`, `Transcript`; or `No decoded visual or transcript channel for this window.`), `Evidence` (opens `EvidenceDrawer`), `Corpus evidence · Oriane` (`CorpusEvidence`), `Interventions · counterfactual reruns` with `SIMULATE PATCH` and copy `Run the simulation to rerun the same 10,000 synthetic viewers on the edited timeline.` / `Counterfactuals edit the feature timeline, not the video, and rerun CORTEX on the same seeded viewers. Model predictions, not guarantees.` Empty states: `No hazard change with an interpretable mechanism was found.`, `No intervention maps onto this mechanism with the channels available.` Fracture navigation: click bands, prev/next, keyboard.
- **AskBar** (bottom): `Ask NEURASCOPE` input; answers with actions (jump to time, select fracture); provider badge deterministic/anthropic/openai.
- **EvidenceDrawer**: per-source cards from `src/lib/evidence/sources.ts` with Tier letters and `TIER_DESCRIPTION`.

### 3.4 Pre-flight Brief (`PreflightBrief`) [code-verified; browser-verified earlier]
Fixed right drawer, 500 px, background `rgba(16,17,21,0.96)`. Header `Pre-flight brief`; subtitle copy: `Where this video is most likely to lose attention, why, what Oriane shows about comparable published content, and what the same synthetic audience predicts after the recommended edit.` Sections (titles exact): `Primary risk` (fracture id + window, `Elevated modeled disengagement`, `−x.x pts survival`), `Why CORTEX predicts it`, `Observed in the video`, `Real-world context · Oriane` (count of comparables, up to 2 benchmarks `this video` vs `corpus` median, `matched by visual similarity[ + spoken content]` derived from returned items, provenance badge, `Corpus evidence · not retention ground truth`), `Recommended change` (existing intervention instruction + `SIMULATE PATCH`), `After simulation` (`+x.x pts` `predicted survival at t s`, `End of video a% → b% · same seeded population · Tier C · model-derived, not a guaranteed uplift.`), link `Compare original vs counterfactual on the timeline →` (selects fracture, keeps counterfactual overlay). No-fracture state: `No high-confidence Attention Fracture detected in this run.` Primary risk = fracture with max `lossPts` (IDs are chronological, so primary may be F2).

### 3.5 Refresh/restore, reset [code-verified; browser-verified earlier]
Run + provenance persisted (localStorage), media blob (IndexedDB); refresh restores `ORIANE LIVE` legitimately. `New analysis` clears both.

---

## 4. CORTEX — exact specification [code-verified from `src/lib/cortex/*`]

- **Temporal resolution**: `SIM_HZ = 10` (dt = 0.1 s). **Population**: `DEFAULT_POPULATION = 10_000`. **Seed**: `DEFAULT_SEED = 20260926`, `mulberry32` PRNG; population is deterministic for a seed → counterfactuals rerun the *identical* viewers.
- **Inputs (FeatureTimeline)**: visual change, cuts, audio change (local decode or Oriane keyframes), transcript words/s, new concepts (stopword-filtered), semantic cues (`CUES.openLoop/payoff/cta` regex lexicons — Tier D), product/entity events, availability flags per channel (visual/transcript/audio).
- **Drivers (CortexDrivers)**: `novelty`, `salience`, `progression`, `load` (speech ref 3.4 w/s, concept ref 1.4), `habituation` (τ build 9 s, recovery 1.6 s), `payoffDistance` (saturates at 7 s open loop), `staticness` (visual change < 0.12 counts as static; saturates at 4 s), `productPulse`.
- **Cohorts** (`COHORTS`, all weights HEURISTIC/Tier D): Cold Scroller (`Low prior intent, fast swipe`, pDistracted .62, hook 1.0, capacity .62, relevance .35), Intent Viewer (`Goal-directed, tolerant of exposition`, .20/.35/.95/.90), Visual-First Viewer (`Attention tracks visual change`, .45/.75/.50/.50), Category Enthusiast (`High relevance, payoff-seeking`, .25/.45/.85/1.0). Driver weight vectors `w{novelty,salience,progression,load,fatigue,payoff,static}` per cohort as in `params.ts`. Audience mixes: Broad feed 46/14/28/12 %, Category 25/25/20/30, Warm 12/38/15/35. Viewer jitter lognormal σ 0.25. pDistracted draws a viewer's baseline from Madsen 2021 gaze-ISC distributions (attentive median .35 IQR .12; distracted .12/.18 — Tier B constants).
- **Attention dynamics**: target `attentionDrive = 0.9 + 2.2(base−.5) + 1.4·wN(novelty−.35) + 0.8·wS·salience + 1.2·wP·relevance·(progression−.35) − 2.0·wL·max(0, load−capacity) − 0.9·wF·habituation − 1.1·wPay·payoffDistance − 1.2·wSt·staticness + 1.2·productAffinity·productPulse`; state `a += (σ(drive) − a)·dt/0.7`.
- **Hazard**: `λ = 1.1·σ(−5.4 + 5.2(1−a) + 3.6·hook·e^(−t/1.1))` per second; `h = 1 − e^(−λ dt)`.
- **Survival/retention**: `S_i(t) = e^(−ΣΛ)`; `R̂(t) = mean_i S_i(t)`; concrete per-viewer exit times drawn (`exitU`) for the audience-field visualization. Outputs: retention/hazard/attention overall and per cohort, `exitTime`, `cohortCounts`.
- **Attention Fracture detection** (`FRACTURE`): hazard smoothed; baseline over preceding 3.0 s; excess ≥ 0.03 abs and ≥ 30 % rel; min duration 0.3 s; merge gap 0.5 s; min loss 0.4 pts; opening 2.0 s hook window excluded; max 5 fractures, sorted chronologically `F1..F5`. Fields: `lossPts` (survival pts lost beyond baseline), `severity`, `drivers` (delta ≥ 0.06, each with Tier + sources), `cohorts` (`lossShare`, `lift`), `observed` (staticSeconds, wordsSinceCut, newConcepts, openLoopSeconds, payoff status, transcript), `networks`.
- **Interventions/counterfactuals**: interventions edit the *feature timeline* (e.g. move payoff earlier, add cut, thin speech), never the video; `runCounterfactual` reruns the same seeded population; result `{evalAt, original, counterfactual, deltaPts, endOriginal, endCounterfactual}` — Tier C.
- **Synthetic EEG / reliability** (`eeg.ts`): alpha = 1 − attention; theta = load; reliability = D.median + (A.median − D.median)·attention on the gaze-ISC scale; waveforms are seeded synthesis for display. Tier C, never measured.
- **Networks** (`networks.ts`): seven functional networks; activation is a projection of drivers onto DK regions — model-derived visualization.

**Boundaries**: synthetic viewers ≠ people; CORTEX ≠ brain simulation, ≠ LLM; EEG proxy ≠ measured EEG; network activation is model-derived; coefficients/mixes/thresholds are not fitted retention parameters; no validated absolute retention accuracy is claimed.

---

## 5. Evidence hierarchy and literature [code-verified `src/lib/evidence/*`]
Tiers: A `empirical` (measured), B `literature` ("A published constant or effect direction, shown as published."), C `derived` ("Computed by CORTEX from video features; cited literature calibrates the mechanism but did not produce this number."), D `heuristic` ("Hand-set NEURASCOPE constant or rule, not fitted to data."). Sources and roles: BBBD 2026 (alpha↔attention direction), Ki et al. 2016 (attention modulates neural reliability), Madsen et al. 2021 PNAS (gaze-ISC constants), Cohen et al. 2017 (narrative engagement/ISC), Poulsen 2017 & Dmochowski 2014 (reliability predicts preference), Tong et al. 2020 (brain activity forecasts engagement; hook direction), Lang 2000 (limited capacity → load), Fisher & Weber 2020 (motivated relevance), DeepGaze III 2022 & Itti & Baldi 2009 (salience/surprise), Jensen & Tesche 2002 (frontal theta ↔ load), Yeo 2011 & Corbetta 2002 (network parcellation/attention systems). No participant-level BBBD recordings are used.

---

## 6. Oriane [code-verified `src/lib/oriane/*`, `src/app/api/oriane/*`]
- Base `https://connect.oriane.xyz`; `POST /rest/contents/search`; `POST /rest/assets`; `Authorization: Bearer` server-only; 30 s timeout; per-IP rate limit; bounded cache.
- **Ingestion**: published TikTok/Instagram URL → content record → transcript chunks, keyframes/frames, caption, hashtags, creator, audio context, aggregate metrics, request ID — preserved as returned; missing fields stay missing.
- **Fracture Fingerprint** (`fingerprint.ts`): window, top drivers, transcript around the window, caption/hashtags/platform, representative keyframe, structural observations.
- **Retrieval** (`comparables.ts`): visual-similarity search on the keyframe and transcript-text search; dedupe; exclude source; ≤ 6 comparables; `matchedBy: ["visual"|"transcript"]` per item; benchmarks only on measurable dimensions (first major transition timing, payoff timing, speech density, duration), ≤ 2 shown, `this video` vs corpus median.
- **Does not predict**: retention, attention, or causality. Views/likes/shares/comments/engagement/follower counts never enter CORTEX. UI label: `Corpus evidence · not retention ground truth. The reference median describes what comparable published content does; it is context, not the optimal edit.` Loading copy: `Retrieving published comparables for this fracture from Oriane…` / `Retrieving relevant published content from Oriane…`. Exactly one corpus request per fracture, none during playback.

---

## 7. Ask NEURASCOPE / analyst [code-verified `src/lib/analyst/analyst.ts`, `/api/analyst`]
Receives a structured context: run summary, current time, selected fracture (drivers, cohorts, observed), corpus summary, chosen intervention, counterfactual result. Deterministic answerer covers "why/where/what to change/EEG/evidence" intents and returns text + actions. If `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` present, the same context is sent with a system prompt that forbids inventing numbers/studies/brain claims and requires "the model predicts" phrasing and tier distinctions; otherwise 501 → deterministic only. The LLM never computes anything; CORTEX is the numeric model.

---

## 8. Synthetic reviewers [code-verified `src/components/reviewers/*`]
One GLB, one shared R3F canvas, scissored viewports, cloned rigs. Idle layer: seeded breathing/blinks/micro-saccades. Behavior layer from cohort CORTEX values: attention↑ → centered gaze/forward posture; attention↓ → gaze wander/head drift; hazard↑ → turn away; salience/novelty spike → orienting; load near capacity → brow tension; fracture → transient cohort-proportional reaction; survival↓ → reduced presence. Characters: Cold Scroller (dark casual, wavy hair), Intent Viewer (long simplified hair), Visual-First Viewer (cap/glasses), Category Enthusiast (Emirati man, white kandura, white ghutra, black agal). Copy: `Synthetic behavioral expression · CORTEX visualization · not measured emotion`.

---

## 9. Visual identity [code-verified `globals.css`, `layout.tsx`]
Colors: ink `#0b0c0e` / `#111316` / `#16191d`; lines `rgba(235,238,242,.08/.14)`; fg `#eceae4`, fg-2 `#a9adb3`, fg-3 `#6d727a`; signal blue `#8fb3ff`; fracture orange `#ff7a45`; counterfactual mint `#9be3c7`. Type: Geist Sans body, Geist Mono for labels/numerics (tracked uppercase 10–11 px labels; `.num` tabular). Hairline borders, `glass` translucent surfaces, compact instrumentation, no neon. Motion: controlled R3F, playhead-synced. Feel: dark, premium, laboratory-instrument restraint with a single orange accent for risk and mint for the counterfactual.

---

## 10. Commercial layer, origin, differentiators
For creators, brands, agencies, and media analysts; moves post-publish retention analytics upstream to pre-publish; a future calibration loop would compare CORTEX predictions to real platform retention curves to fit Tier D parameters (not done). Inspiration (not validation): the CoComelon "Distractatron" practice of testing children's attention against a distractor before release. Differentiators: mechanistic per-second explanation with evidence tiers; same-population counterfactuals; real Oriane corpus grounding per fracture; honest provenance badges and no silent fallbacks.

---

## 11. Replit
`.replit`: `run = "pnpm start"`; deployment build `corepack enable && pnpm install --frozen-lockfile && pnpm build`, run `pnpm start`; secrets as env vars (`ORIANE_API_KEY`, optional `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`). Replit hosts only; no computation semantics change.

---

## 17. Audit coverage and caveats
Code-verified at `ecaf46d`: all routes, all components, CORTEX params/simulate/fractures/eeg, evidence sources, analyst, persistence, `.replit`, UI copy strings. Browser states listed in §3 were verified in production builds during the final QA runs at identical code, not re-operated during this audit (time cap). Not directly verified in this audit: cached-live fallback in the browser; LLM analyst with a real provider key; MP4-only Oriane asset retrieval (not implemented — clip-only runs show `LOCAL FILE · NO ORIANE RECORD`).
