# Stop playback on worksheet page changes — 05.11.2026

Reported on as3/Unit 8/test: Track 8 continued after navigation. Inventory identified 141 source materials containing native audio, detached new Audio players or speechSynthesis. Most use .page; three older Academy Stars worksheets replace #stage; two also have classwork/homework tabs.

Added an idempotent guard in assets/ws-extras.js. It compares visible .page/.tab-panel identities and the active stage-navigation tab (with stage-child fallback). On page/tab changes it pauses audio/video, including tracked detached Audio players, and cancels speaking/pending speech synthesis. It also pauses on pagehide/hidden document. It preserves the playhead and does not auto-resume on return. Ordinary answering/scrolling does not stop playback. The wrapped native play retains its arguments and return value.

build.mjs injects ws-extras.js v4 across non-presentation materials, refreshing existing references. No per-worksheet navigation, grading or submission code was replaced. Native media/speech are covered; external iframe players and live microphone recording are outside this change.

Validation: browser navigation audit passed all 141 materials. Initial pass: 137; targeted pass: four EGE demos using goToPage without nextPage. Covered next/back, detached audio, speech, same-page selection and unrelated DOM updates. Media/speech are simulated for this broad audit. Real AS3 Unit 8 Track 8 MP3 also passed in Edge desktop and touch/mobile: Next, Back and dots paused it; gap typing and MCQ choice kept it playing. All external requests were blocked during QA; no real email or tracker submissions were sent.

Tests: docs/tests/worksheet-audio-navigation.cjs and worksheet-audio-real.cjs. Evidence: ANGLE Memory/output/audio-navigation-audit-complete.json and audio-navigation-inventory.json. git diff --check passed.

Final node build.mjs passed: 318 teacher-catalog materials.
