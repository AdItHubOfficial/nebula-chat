import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth';
import { prisma } from '../db';

// Augment Express Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (typeof req.query.token === 'string') return req.query.token;
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });

  req.userId = user.id;
  next();
}
