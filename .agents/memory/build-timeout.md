---
name: Deployment build timeout
description: Root cause and fix for Cloud Run build kills during Metro bundle downloads
---

## Rule
The Replit Cloud Run deployment build has a ~2-minute total budget. Security scan (~56s) + pnpm install (~8s) leaves only ~60s for actual build commands. Sequential iOS (~23s) + Android (~40s) Metro bundle downloads = ~63s, which consistently exceeds the remaining window.

**Fix applied:** Parallelize iOS and Android bundle downloads with `Promise.all` in `artifacts/mobile/scripts/build.js`. Metro 0.80+ handles concurrent requests; parallel time is bounded by the slower platform (~40s) rather than their sum.

**Why:** Cloud Run doesn't expose a configurable build timeout. The only lever is reducing the work done within the fixed window.

**How to apply:** If builds start timing out again mid-Android bundle, check whether a new expensive sequential step was added to `downloadBundlesAndManifests` or `buildWebExport`. Also check security scan duration — if that grows, the buffer shrinks further.
