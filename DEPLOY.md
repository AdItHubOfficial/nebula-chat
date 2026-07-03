# Deploying Nebula Chat to Render.com

Nebula Chat runs as **one web service** in production: the Express server serves the
built React app **and** the REST API **and** the Socket.IO realtime connection on a
single port. No separate frontend host needed.

---

## 1. Put the code on GitHub

Render deploys from a Git repo. From the `nebula-chat` folder:

```bash
git init
git add .
git commit -m "Nebula Chat"
git branch -M main
# create an empty repo on github.com first, then:
git remote add origin https://github.com/<you>/nebula-chat.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `dist`, the SQLite file, and uploads, so
only source is pushed.

---

## 2. Create the service on Render

### Option A — Blueprint (easiest, uses `render.yaml`)
1. Go to **https://dashboard.render.com** → **New +** → **Blueprint**.
2. Connect your GitHub and pick the `nebula-chat` repo.
3. Render reads `render.yaml`, creates the web service, and auto-generates `JWT_SECRET`.
4. Click **Apply** and wait for the first build (~2–4 min).

### Option B — Manual Web Service
1. **New +** → **Web Service** → pick the repo.
2. Set:
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. Add environment variables:
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | *(click "Generate" or paste a long random string)* |
   | `DATABASE_URL` | `file:./dev.db` |
4. **Create Web Service**.

When it's live you'll get a URL like `https://nebula-chat-xxxx.onrender.com`.
Log in with the demo accounts (`nova` … `quark`, password `nebula123`) or register.

---

## 3. Important notes

### Data persistence (free tier resets)
Render's **free** plan has an **ephemeral disk** — the SQLite database and uploaded
files are **wiped on every deploy/restart**. The demo data re-seeds automatically, so
the app always works, but user-created servers/messages/uploads won't survive a restart.

**To keep data**, upgrade to a paid instance and add a disk (steps are in the commented
block at the bottom of `render.yaml`):
- change `plan: free` → `plan: starter`
- add a disk mounted at `/var/data`
- set `DATABASE_URL=file:/var/data/dev.db` and `UPLOAD_DIR=/var/data/uploads`

For a **free** persistent option, switch Prisma to Render's free **PostgreSQL**
(change the `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`
to the Render Postgres connection string). Ask and I can convert it for you.

### Cold starts
Free web services **spin down after ~15 min of inactivity**; the next visit takes
~30 seconds to wake. Paid instances stay warm.

### Voice / video calls across the internet
Calls use WebRTC peer-to-peer with a public **STUN** server, which works on the same
network and most home networks. Some restrictive/corporate NATs also need a **TURN**
server to relay media. For reliable calls between any two people on the internet, add a
TURN service (e.g. a free Metered/Twilio TURN) and drop its credentials into
`RTC_CONFIG` in `src/lib/voice.ts`.

---

## How it works in production
- `npm run build` → Vite builds the React app into `dist/`.
- `npm start` → `prisma db push` (create tables) + seed + start the server with
  `NODE_ENV=production`.
- In production the server (`server/index.ts`) serves `dist/` for all non-API routes,
  so React Router deep links work on refresh, and `/api` + `/socket.io` are same-origin.
- The server binds Render's `PORT` automatically.
