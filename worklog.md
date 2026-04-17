---
Task ID: 1
Agent: main
Task: Remove "Каталог" button and fix VK playlist import

Work Log:
- Analyzed screenshot to identify "Каталог" button location (desktop NavBar + PlaylistView)
- Removed "Каталог" nav item from NavBar.tsx (removed Globe icon import and navItem entry)
- Removed "Каталог" button from PlaylistView.tsx (removed Globe icon import and button JSX)
- Investigated VK playlist import - VK requires authentication for all audio content
- Tested multiple approaches: direct fetch (302 to login), VK internal API (login redirect), VK embed (landing page), CORS proxies (Cloudflare block), oEmbed (404), VK API without token (error 15)
- Rewrote VK extraction to use VK API with user-provided access token
- Added `vkToken` parameter to backend API (`/api/music/import-playlist`)
- Added VK token input field in frontend import dialog (appears automatically when VK URL detected)
- Added "Как получить?" link to VK API explorer page
- Updated VK fallback error messages
- Fixed `start.sh` to kill existing servers on port 3000 before starting
- Rebuilt app, fixed stale server issue (old server was caching old responses)
- Verified API returns correct `needVkToken: true` response for VK URLs without token

Stage Summary:
- "Каталог" button removed from both desktop NavBar and PlaylistView
- VK import now properly requires and uses VK API token
- Backend correctly parses VK playlist URL (owner_id, playlist_id, access_hash)
- Frontend shows VK token input with step-by-step instructions when VK URL detected
- VK API method `audio.getPlaylistById` called with user's token to get tracks
- `start.sh` improved to prevent stale server issues
- All changes built and tested
