# MQ Player — Bug Fixes & Improvements Worklog

## Summary
Applied 7 fixes across 7 files to resolve chat persistence issues, volume display bugs, missing UI elements, button styling, mobile visualization sizing, phone notification controls, and static greeting text.

---

## FIX 1: loadMessages merge instead of replace
**File**: `src/store/useAppStore.ts` (line 385)
**Problem**: `loadMessages` did `set({ messages })` which wiped ALL messages when loading server messages for one contact, breaking chat persistence.
**Fix**: Changed to merge incoming messages with existing ones, deduplicating by message ID:
```typescript
loadMessages: (incoming) => set((s) => {
  const existingIds = new Set(s.messages.map(m => m.id));
  const newMsgs = incoming.filter(m => !existingIds.has(m.id));
  return { messages: [...s.messages, ...newMsgs] };
}),
```

## FIX 2: Volume percentage display rounding
**Files modified**:
- `src/store/useAppStore.ts` (line 286): `setVolume` now rounds: `set({ volume: Math.round(volume) })`
- `src/components/mq/SettingsView.tsx` (line 284): `{volume}%` → `{Math.round(volume)}%`
- `src/components/mq/FullTrackView.tsx` (line 366): `{volume}%` → `{Math.round(volume)}%`
- `src/components/mq/PlayerBar.tsx` (line 561): `{volume}%` → `{Math.round(volume)}%`
**Problem**: Volume showed decimals like 30.0999299% due to click-position calculations.
**Fix**: Store rounding in `setVolume` + display rounding as safety net.

## FIX 3: Profile customization link in mobile Settings
**File**: `src/components/mq/SettingsView.tsx`
**Changes**:
- Added `User` to lucide-react imports
- Added `setView` to store destructuring
- Added a styled "Настройки профиля" button between the Profile card and Themes section
- Button navigates to the profile view via `setView("profile")`

## FIX 4: "Play All" styled buttons
**Files modified**:
- `src/components/mq/MainView.tsx`: Added `Play` import; replaced 2 plain text buttons with `motion.button` styled with accent bg, Play icon
- `src/components/mq/SearchView.tsx`: Added `Play` import; replaced plain text button with styled `motion.button`
- `src/components/mq/HistoryView.tsx`: Replaced plain text button with styled `motion.button` (Play already imported)
**Before**: Plain `<button className="text-sm">` with accent color text
**After**: Styled `motion.button` with accent background, Play icon, rounded-lg, font-medium, scale tap animation

## FIX 5: Audio visualization mobile sizing
**Files modified**:
- `src/components/mq/PlayerBar.tsx` (lines 566-570): Canvas height increased from 24 to 28px (minHeight also updated)
- `src/components/mq/FullTrackView.tsx` (lines 281-285): Circular visualization overflow reduced from 50px to 40px (and offset from 25px to 20px) to prevent mobile overflow

## FIX 6: MediaSession API for phone notification controls
**File**: `src/components/mq/PlayerBar.tsx`
**Added**: A `useEffect` after the volume effect that:
- Sets `navigator.mediaSession.metadata` with track title, artist, album, and artwork
- Registers action handlers for play, pause, previoustrack, nexttrack
- Properly cleans up handlers on unmount
- Depends on `currentTrack.id`, `currentTrack.title`, `currentTrack.artist`

## FIX 7: Time-based greeting text
**File**: `src/components/mq/MainView.tsx`
**Changes**:
- Added `Play` to lucide-react imports (also needed for Fix 4)
- Added `getGreeting()` and `getGreetingSubtext()` helper functions
  - 5:00-11:59 → "Доброе утро!" / "Начните день с любимой музыки"
  - 12:00-16:59 → "Добрый день!" / "Откройте для себя музыку..."
  - 17:00-21:59 → "Добрый вечер!" / "Расслабьтесь под любимые треки"
  - 22:00-4:59 → "Доброй ночи!" / "Ночная музыка для уютного вечера"
- Replaced static "Добро пожаловать!" heading and subtext with dynamic greeting functions

---

## Files Changed (7 total)
1. `src/store/useAppStore.ts` — FIX 1, FIX 2
2. `src/components/mq/SettingsView.tsx` — FIX 2, FIX 3
3. `src/components/mq/FullTrackView.tsx` — FIX 2, FIX 5
4. `src/components/mq/PlayerBar.tsx` — FIX 2, FIX 5, FIX 6
5. `src/components/mq/MainView.tsx` — FIX 4, FIX 7
6. `src/components/mq/SearchView.tsx` — FIX 4
7. `src/components/mq/HistoryView.tsx` — FIX 4
---
Task ID: 1
Agent: Main
Task: Restore project from user-provided zip files (mq-player-source.zip + mq-player-website.zip)

Work Log:
- Extracted both zip files to /tmp for comparison
- Found 10 missing files in the server project (API routes: upload, upload/file, stories/like, stories/comment, stories, user/theme, auth/update-username, auth/username-check, import-playlist; component: StoriesView.tsx)
- Copied all src/, prisma/, public/ from source zip to project
- Preserved critical server fixes: proxyClientMaxBodySize in next.config.ts, maxDuration=600 on upload route
- Copied .env (DATABASE_URL) from website zip
- Fixed keep-alive-prod.sh to use standalone server
- Rebuilt project successfully (all 22 routes present)
- Restarted server and keep-alive, all health checks passing

Stage Summary:
- Project restored from user's local files with all missing API routes and components
- Server running stable on port 3000 (HTTP 307 on /, 200 on /play)
- All API routes responding correctly
- Key new features from user's version: PWA support, Outfit font, sleep timer, likes/dislikes, stories system, splash animation, theme switching, username management

---
Task ID: 2
Agent: Main
Task: Replace project with user's latest tar.gz files

Work Log:
- Received 3 tar.gz files from user: mq-player-source.tar.gz (127 files), mq-player-source-full.tar.gz (+.env), mq-player-project.tar.gz (125 files)
- source and full are identical except full has .env
- Replaced all src/, prisma/, public/, config files from user's tar
- Key differences in user's version: build v44, aurora blob visualization (not polyline/audio-reactive), resetCorsState in audioEngine, more robust upload validation
- Kept .env (DATABASE_URL) and patched keep-alive for standalone mode
- Rebuilt successfully with all 22 routes

Stage Summary:
- Project now fully matches user's local code (build v44)
- Visualization is aurora blobs (decorative, not audio-reactive) — user's preferred style
- Server running stable: / 307, /play 200, all API routes working
