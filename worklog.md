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
