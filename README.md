# 🌌 Nebula Chat

An original, self-hosted, real-time communication platform inspired by modern chat apps —
servers, channels, voice rooms, DMs, roles, reactions, threads-style replies, and more.
Runs **entirely on localhost** with a single command.

> Not affiliated with, and containing no assets/branding/code from, any existing chat product.

---

## ✨ Features

**Accounts** — register / login (JWT + bcrypt), profile editing, avatar upload, custom status, bio, presence (Online / Idle / Do Not Disturb / Invisible).

**Servers** — create / delete / join via invite links, server settings, icon upload, roles & granular permissions, member management (kick / ban / timeout), audit log, custom emoji.

**Channels** — text, voice & announcement channels, categories, private & NSFW flags, pinned messages, drag-to-resize sidebars.

**Realtime chat** — instant messaging over Socket.IO, typing indicators, read receipts, edits, deletes, replies, mentions, emoji reactions, Markdown + code blocks, image/video/file attachments, drag-&-drop upload, slash commands (`/shrug`, `/spoiler`, `/me`, …), infinite scroll & optimistic sends.

**Voice** — WebRTC mesh voice rooms with mute, deafen, per-user volume sliders, live speaking indicators, and join/leave sounds.

**Friends & DMs** — friend requests (accept / decline / block), 1:1 and group direct messages.

**Polish** — glassmorphism dark **and** light themes, 7 accent presets, animated sidebar & transitions (Framer Motion), quick switcher (`Ctrl/Cmd + K`), context menus, profile popovers, message search with filters, desktop notifications, synthesized sound effects, skeleton loaders, and persisted UI state (theme, sidebar sizes, last server/channel, drafts).

---

## 🚀 Quick start

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

`npm install` generates the Prisma client. `npm run dev` automatically creates the SQLite
database, seeds demo data, and starts both the API/Socket.IO server (**:4000**) and the Vite
client (**:5173**).

### Demo accounts

Log in with any of these usernames — password is **`nebula123`** for all:

`nova` · `orbit` · `pixel` · `echo` · `comet` · `luna` · `quark`

`nova` owns the **Nebula HQ** server (with the demo content). Try the invite code
**`nebula-hq`** from *Join a Server*.

---

## 🧱 Tech stack

| Layer      | Tech                                                             |
| ---------- | --------------------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite, TailwindCSS, Framer Motion, Zustand, React Router |
| Backend    | Node.js, Express, Socket.IO                                     |
| Database   | SQLite via Prisma ORM                                           |
| Realtime   | Socket.IO (messages, presence, typing, reactions)              |
| Voice      | WebRTC (peer mesh, Socket.IO signaling)                        |
| Uploads    | Local disk via Multer (`/uploads`)                             |

---

## 📁 Project structure

```
nebula-chat/
├── prisma/
│   ├── schema.prisma        # data model (users, servers, channels, messages, …)
│   └── seed.ts              # demo users / servers / channels / messages
├── shared/                  # types, permission bitfield, socket events, emoji set
│   ├── types.ts
│   ├── permissions.ts
│   ├── events.ts
│   └── emoji.ts
├── server/                  # Express + Socket.IO backend
│   ├── index.ts             # app entry (HTTP + realtime + static)
│   ├── config.ts  db.ts
│   ├── lib/                 # auth, serializers, presence, permissions, broadcast
│   ├── middleware/          # auth, rate limiting, error handling
│   ├── routes/              # auth, users, servers, channels, messages, friends, dms, invites, search, uploads
│   └── socket/              # realtime handlers + WebRTC voice signaling
└── src/                     # React frontend
    ├── components/          # ui, layout, chat, dm, voice, modals, overlays
    ├── pages/               # AuthPage, InvitePage, AppLayout, ServerLayout, DMLayout
    ├── hooks/               # useActiveIds, usePermissions
    ├── services/            # realtime (socket ↔ stores wiring)
    ├── store/               # Zustand stores (auth, ui, server, message, dm, friend, voice, …)
    ├── lib/                 # api client, socket, markdown, sounds, voice, time, utils
    ├── types/  styles/
    └── main.tsx  App.tsx
```

---

## 🛠️ Scripts

| Script              | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Seed DB (idempotent) + run server & client together     |
| `npm run build`     | Production build of the client                          |
| `npm run typecheck` | Strict TypeScript check across the whole project        |
| `npm run db:reset`  | Wipe & reseed the SQLite database                       |

---

## 🔒 Security notes

Passwords are hashed with bcrypt; API auth uses JWT bearer tokens; all input is validated with
Zod; endpoints are rate-limited; rendered Markdown is sanitized with DOMPurify (XSS-safe). Because
auth uses `Authorization` headers (not cookies), CSRF is not applicable. The dev `JWT_SECRET` in
`.env` should be changed for any non-local deployment.
