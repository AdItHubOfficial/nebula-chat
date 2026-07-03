import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import { config } from './config';
import { setIo } from './socket/io';
import { setupSocket } from './socket';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errors';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import serverRoutes from './routes/servers';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import friendRoutes from './routes/friends';
import dmRoutes from './routes/dms';
import inviteRoutes from './routes/invites';
import searchRoutes from './routes/search';
import uploadRoutes from './routes/uploads';

// Ensure the uploads directory exists.
fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();
const httpServer = http.createServer(app);

const io = new IOServer(httpServer, {
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 5e6,
});
setIo(io);
setupSocket(io);

// Basic hardening headers (lightweight, framework-free).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Serve uploaded files.
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', index: false }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Nebula Chat', time: new Date().toISOString() }));

// API routes.
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api', channelRoutes);
app.use('/api', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/dms', dmRoutes);
app.use('/api', inviteRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/uploads', uploadRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built client.
const distDir = path.resolve(config.rootDir, 'dist');
if (config.isProd && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use(errorHandler);

httpServer.listen(config.port, () => {
  console.log(`\n  🌌  Nebula Chat server ready`);
  console.log(`      API + realtime → http://localhost:${config.port}`);
  if (!config.isProd) console.log(`      Client (Vite)  → ${config.clientOrigin}\n`);
});
