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
