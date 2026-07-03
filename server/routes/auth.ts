import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { hashPassword, verifyPassword, signToken } from '../lib/auth';
import { toPublicUser } from '../lib/serialize';
import { asyncHandler, HttpError } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(24)
    .regex(/^[a-z0-9_.]+$/i, 'Username may only contain letters, numbers, _ and .'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  displayName: z.string().min(1).max(32).optional(),
});

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, email, password, displayName } = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] },
    });
    if (existing) {
      throw new HttpError(409, existing.email === email.toLowerCase() ? 'Email already in use' : 'Username already taken');
    }

    const passwordHash = await hashPassword(password);
    const palette = ['#8b5cf6', '#ec4899', '#22d3ee', '#34d399', '#f59e0b', '#f472b6', '#818cf8'];
    const accent = palette[Math.floor(Math.random() * palette.length)];

    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        displayName: displayName?.trim() || username,
        passwordHash,
        accentColor: accent,
        bannerColor: accent,
      },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: toPublicUser(user) });
  }),
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { login, password } = loginSchema.parse(req.body);
    const identifier = login.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });
    if (!user) throw new HttpError(401, 'Invalid credentials');

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'Invalid credentials');

    const token = signToken(user.id);
    res.json({ token, user: toPublicUser(user) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json({ user: toPublicUser(user) });
  }),
);

export default router;
