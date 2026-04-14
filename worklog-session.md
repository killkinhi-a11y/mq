---
Task ID: 2
Agent: Main Agent + full-stack-developer subagent
Task: Fix 7 issues in MQ Player

Work Log:
- Fix 1: Rewrote PiPPlayer.tsx - removed AnimatePresence/framer-motion, simplified drag, CSS-only animation bars
- Fix 2: Created /api/users/search API, rewrote MessengerView for real DB users, removed bot auto-replies
- Fix 3: Changed MainView stat card from Popular to Friends (navigates to messenger)
- Fix 4: Added queue prop to TrackCard, passed from all parent components
- Fix 5: Added Similar button in PlayerBar, time text visible, auto-open similar panel
- Fix 6: Waveform visualization in PlayerBar, curved radial in FullTrackView, CSS bars in PiP
- Fix 7: Better recommendations - 24 fallback queries, prefer full tracks, 20 results

Stage Summary:
- All 7 fixes implemented, build successful, server running on 3000+81
