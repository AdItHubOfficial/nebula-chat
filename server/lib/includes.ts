import type { Prisma } from '@prisma/client';

// Reusable Prisma include fragments so serialization always has the right data.

export const messageInclude = {
  author: true,
  attachments: true,
  reactions: true,
  replyTo: { include: { author: true } },
} satisfies Prisma.MessageInclude;

export const memberInclude = {
  user: true,
  roles: true,
} satisfies Prisma.ServerMemberInclude;

export const serverInclude = {
  categories: { orderBy: { position: 'asc' } },
  channels: { orderBy: { position: 'asc' } },
  roles: { orderBy: { position: 'desc' } },
  _count: { select: { members: true } },
} satisfies Prisma.ServerInclude;
