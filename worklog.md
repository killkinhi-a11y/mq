---
Task ID: 1
Agent: main
Task: Fix search tracks and track playback

Work Log:
- Investigated search and track playback code
- Found critical bug: `boolean is not defined` in Zustand store (duplicate type annotations as values)
- Fixed store by removing duplicate entries (lines 281-299)
- Added `loading.tsx` to `/play` route to reduce SSR memory pressure
- Discovered server crashes due to OOM from SC client_id extraction (downloads 3MB JS bundles)
- Rewrote `soundcloud.ts`: removed live extraction, added pre-cached client IDs with validation
- Rewrote `stream/route.ts`: consolidated duplicate client_id code, now imports from shared module
- Created missing `/api/music/genre` route (was returning 404 for genre filter)
- Set up auto-restart keeper for server stability

Stage Summary:
- Search API works: returns 30 tracks per query
- Genre API works: returns tracks by genre
- Stream resolution works: returns valid CDN URLs
- Server uses auto-restart loop for resilience
- Key files modified: soundcloud.ts, stream/route.ts, useAppStore.ts, genre/route.ts, play/loading.tsx
