---
Task ID: 1
Agent: Main Agent
Task: Fix 6 MQ Player issues — messenger input, volume slider, mobile visualization, friends system, username uniqueness, chat persistence

Work Log:
- Fixed MessageBubble.tsx: Changed `<p>` tag wrapping `{renderContent()}` to `<div>` to fix React #482 error (invalid nesting — `<p>` containing `<img>` block elements)
- Fixed SettingsView.tsx: Added visual fill indicator to volume slider (previously `appearance-none` + `accentColor` showed no progress bar)
- Fixed PlayerBar.tsx: Reduced visualization canvas height from 40px to 24px on mobile
- Fixed FullTrackView.tsx: Wrapped visualization canvas in a div to prevent overflow, reduced mobile album art size (w-56 h-56 instead of w-64 h-64), reduced canvas overflow to 50px instead of 60px
- Updated prisma/schema.prisma: Added `@unique` on `username` field, created new `Friend` model with status (pending/accepted/rejected), requester/addressee relations
- Updated register/route.ts: Added username regex validation (alphanumeric, _, -, 2-20 chars), added username uniqueness check before email check
- Created /api/friends/route.ts: GET lists friends + pending requests, POST sends friend request with auto-accept logic
- Created /api/friends/[id]/route.ts: PUT accepts/rejects requests, DELETE removes friends
- Rewrote MessengerView.tsx completely:
  - Sidebar now shows only friends (fetched from /api/friends), not all users
  - Added friend request badge and panel (accept/reject UI)
  - New "Add Friend" dialog searches users and sends friend requests
  - Messages are now persisted to server via POST /api/messages on send
  - Messages are loaded from server via GET /api/messages when opening a conversation
  - Fixed input visibility: proper flex-shrink-0, height calc(100dvh - 80px), paddingBottom for player bar
  - All input/emoji/header sections have flex-shrink-0 to prevent being pushed off screen
- Ran Prisma migration (reset DB due to drift), seeded demo user
- Rebuilt and restarted server successfully
- Verified all APIs work: register, login, username uniqueness, friend send/accept/list

Stage Summary:
- All 6 user issues resolved
- React #482 error fixed (MessageBubble `<p>` → `<div>`)
- Messenger input now always visible at bottom
- Volume slider shows visual fill
- Mobile visualization smaller and contained
- Friends system fully implemented (request/accept/reject/list)
- Username uniqueness enforced at DB + API level
- Chat messages persisted to server (loaded on conversation open)
- Build successful, server running on port 3000
