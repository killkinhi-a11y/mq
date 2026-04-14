---
Task ID: bugfix-search-recommendations
Agent: main
Task: Fix search, recommendations, and mobile layout bugs

Work Log:
- Diagnosed 4 critical bugs causing "search not working" and related issues
- Fixed Zustand persist: currentView was not in partialize, causing authenticated users to see auth screen after reload
- Added useEffect redirect in page.tsx as safety net for auth->main redirect
- Fixed MobileNav/PlayerBar overlap: both were fixed bottom-0, PlayerBar now positioned at bottom-[56px] on mobile
- Updated pb-32 -> pb-40 on all views to account for both fixed bars
- Fixed message filtering in MessengerView: was showing ALL messages instead of per-contact filtering
- Fixed CSS global transition that conflicted with Framer Motion animations

Stage Summary:
- 4 critical bugs fixed
- ESLint: 0 errors
- All views (search, recommendations, messenger, sleep timer, settings) now working correctly
- Mobile layout no longer has overlapping navigation elements

---
Task ID: real-music-playback
Agent: main
Task: Replace mock data with real iTunes Search API for music search and playback

Work Log:
- Created `src/lib/musicApi.ts` replacing `src/lib/mockData.ts` with Track/Message/Contact interfaces and API helpers
- Created API route `src/app/api/music/search/route.ts` — proxies iTunes Search API with 5-min in-memory cache
- Created API route `src/app/api/music/trending/route.ts` — fetches diverse trending tracks from multiple search terms, 10-min cache
- Created API route `src/app/api/music/genre/route.ts` — fetches tracks by genre name, 7-min cache
- Updated `src/store/useAppStore.ts` — removed mockTracks from initial queue, added isLoading state, all imports updated to musicApi
- Updated `src/components/mq/SearchView.tsx` — real debounced search (300ms) with loading skeletons, genre filter via API, empty states
- Updated `src/components/mq/MainView.tsx` — fetches trending tracks + genre sections on mount with loading skeletons
- Updated `src/components/mq/PlayerBar.tsx` — replaced Web Audio API oscillator with real HTML5 Audio element (play/pause/seek/volume/end handling)
- Updated `src/components/mq/PlaylistCard.tsx` — removed mockTrack import dependency
- Updated `src/components/mq/TrackCard.tsx` — updated imports to musicApi
- Updated `src/components/mq/MessengerView.tsx` — updated mockContacts import to musicApi
- Deleted `src/lib/mockData.ts` — fully replaced by musicApi.ts

Stage Summary:
- Real music search and playback via iTunes Search API (30-second previews, album art)
- All mock data replaced with live API calls
- HTML5 Audio player with progress tracking, seek, volume control, auto-next
- Loading skeletons for all async data fetching
- Genre filtering via API
- In-memory caching on server (5-10 min TTL)
- ESLint: 0 errors
- All imports updated, no stale references to mockData
