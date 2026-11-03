# Faster assignment dialog — 3 November 2026

The assignment picker previously fetched the entire group and individual tracker datasets on every opening, then blocked the pupil list while downloading the selected worksheet HTML.

The pupil list now uses a minimal five-minute, per-credential session cache, shared across catalog navigation, plus an in-memory/in-flight cache to coalesce hover/focus and click requests. Only recipient identifiers, display names, group and plan titles are retained; parent keys, tasks, scores and Reports are discarded. No raw credentials are written to the roster cache. Fresh first-time loading still depends on Apps Script latency.

Worksheet sections load lazily only after choosing pages/exercises. Whole-worksheet assignments no longer fetch worksheet HTML. Closing/reopening or switching materials ignores stale asynchronous results. Submission and idempotency are unchanged.

Validated in a mobile-sized browser: reopen and navigation reuse the roster, expiry refreshes it, lazy section selection works and reuses its response, and private fields are absent from the cache. Catalog asset version bumped to v4.
