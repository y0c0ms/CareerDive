AppNotas – Notes, Sharing, Offline-first (Electron + Web + API)

AppNotas is a full-stack notes app with:
- Desktop (Electron)
- Web PWA (Vite + React + TS)
- API (Express + Prisma + PostgreSQL)

Key features
- Personal notes: create, edit, color, and delete (soft delete)
- Dates & calendar: optional due dates; calendar week/month views on web
- Sharing: share a note with specific collaborators by email; collaborators see shared notes; owners can revoke sharing
- Offline-first: local IndexedDB cache (web) and queued mutations that sync when online
- Installable web app: PWA with service worker and manifest

Security & privacy
- Passwords: Argon2id hashing
- Authentication: short-lived JWT access tokens, opaque refresh tokens per device; rotation on refresh
- Authorization: all notes routes require Bearer token; shared access is enforced in the DB
- Storage: PostgreSQL (Neon) via Prisma ORM; no raw SQL
- CORS: API restricted to the deployed PWA origin
- Rate limiting and Helmet are enabled on API

Monorepo layout
- `CleanAppNotas-Final/` – legacy Electron UI and assets
- `server/` – Express API, Prisma schema, sync+sharing routes
- `web/` – Vite + React PWA (Dexie for IndexedDB, ky for HTTP, Workbox PWA)

Development quickstart
- API
  - cd server && npm i
  - Set env: DATABASE_URL, DIRECT_URL, JWT_SECRET
  - npx prisma generate && npx prisma migrate deploy
  - npm run build && npm start
- Web PWA
  - cd web && npm i
  - Set env: VITE_API_BASE=https://your-api/v1
  - npm run dev

Deploy
- API: Render Web Service (Node 18+)
  - Env: DATABASE_URL, DIRECT_URL, JWT_SECRET, CORS_ORIGIN=https://your-web
- DB: Neon (Postgres)
- Web: Render Static Site
  - Root: web; Build: npm ci && npm run build; Publish: dist
  - Env: VITE_API_BASE=https://your-api/v1

PWA caveats
- After deploys, hard refresh to update service worker.
- For SPA routes, add `_redirects` with `/* /index.html 200` on the static host.

License
- MIT


