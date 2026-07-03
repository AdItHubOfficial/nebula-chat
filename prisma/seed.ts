import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  Permission,
  DEFAULT_PERMISSIONS,
  ALL_PERMISSIONS,
} from '../shared/permissions';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'nebula123';

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`↷ Database already has ${existing} users — skipping seed. (run "npm run db:reset" to reseed)`);
    return;
  }

  console.log('🌱 Seeding Nebula Chat demo data…');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const usersData = [
    { username: 'nova', displayName: 'Nova', email: 'nova@nebula.chat', accentColor: '#8b5cf6', bannerColor: '#7c3aed', bio: 'Founder of Nebula HQ. Building the future of chat, one message at a time.', customStatus: '🚀 shipping features', presence: 'ONLINE' },
    { username: 'orbit', displayName: 'Orbit', email: 'orbit@nebula.chat', accentColor: '#ec4899', bannerColor: '#db2777', bio: 'Designer & pixel pusher.', customStatus: '🎨 in the zone', presence: 'ONLINE' },
    { username: 'pixel', displayName: 'Pixel', email: 'pixel@nebula.chat', accentColor: '#22d3ee', bannerColor: '#0891b2', bio: 'Game dev. Coffee-powered.', customStatus: '🎮 game night!', presence: 'IDLE' },
    { username: 'echo', displayName: 'Echo', email: 'echo@nebula.chat', accentColor: '#34d399', bannerColor: '#059669', bio: 'Audio engineer & synth nerd.', customStatus: '🎧 mixing', presence: 'DND' },
    { username: 'comet', displayName: 'Comet', email: 'comet@nebula.chat', accentColor: '#f59e0b', bannerColor: '#d97706', bio: 'Community wrangler.', customStatus: '', presence: 'ONLINE' },
    { username: 'luna', displayName: 'Luna', email: 'luna@nebula.chat', accentColor: '#a78bfa', bannerColor: '#7c3aed', bio: 'Moon enthusiast 🌙', customStatus: '💤 afk', presence: 'INVISIBLE' },
    { username: 'quark', displayName: 'Quark', email: 'quark@nebula.chat', accentColor: '#f472b6', bannerColor: '#be185d', bio: 'Physics + code.', customStatus: '', presence: 'OFFLINE' },
  ];

  const users: Record<string, { id: string }> = {};
  for (const u of usersData) {
    const created = await prisma.user.create({ data: { ...u, passwordHash } });
    users[u.username] = created;
  }
  console.log(`  ✓ ${usersData.length} users (login with any username, password "${DEMO_PASSWORD}")`);

  // --- Server: Nebula HQ -------------------------------------------------
  const hq = await prisma.server.create({
    data: {
      name: 'Nebula HQ',
      description: 'The official Nebula Chat community.',
      bannerColor: '#7c3aed',
      ownerId: users.nova.id,
    },
  });

  const everyoneRole = await prisma.role.create({
    data: { serverId: hq.id, name: '@everyone', color: '#a1a1aa', position: 0, permissions: DEFAULT_PERMISSIONS, isDefault: true },
  });
  const adminRole = await prisma.role.create({
    data: { serverId: hq.id, name: 'Admin', color: '#f43f5e', position: 3, permissions: ALL_PERMISSIONS, hoist: true },
  });
  const modRole = await prisma.role.create({
    data: {
      serverId: hq.id, name: 'Moderator', color: '#22d3ee', position: 2, hoist: true,
      permissions:
        DEFAULT_PERMISSIONS | Permission.MANAGE_MESSAGES | Permission.KICK_MEMBERS |
        Permission.TIMEOUT_MEMBERS | Permission.VIEW_AUDIT_LOG | Permission.MANAGE_CHANNELS,
    },
  });
  const memberRole = await prisma.role.create({
    data: { serverId: hq.id, name: 'Member', color: '#818cf8', position: 1, permissions: DEFAULT_PERMISSIONS },
  });

  async function addMember(serverId: string, userId: string, roleIds: string[], nickname?: string) {
    const member = await prisma.serverMember.create({ data: { serverId, userId, nickname } });
    for (const roleId of roleIds) {
      await prisma.memberRole.create({ data: { memberId: member.id, roleId } });
    }
    return member;
  }

  await addMember(hq.id, users.nova.id, [everyoneRole.id, adminRole.id]);
  await addMember(hq.id, users.orbit.id, [everyoneRole.id, modRole.id]);
  await addMember(hq.id, users.comet.id, [everyoneRole.id, modRole.id]);
  await addMember(hq.id, users.pixel.id, [everyoneRole.id, memberRole.id]);
  await addMember(hq.id, users.echo.id, [everyoneRole.id, memberRole.id]);
  await addMember(hq.id, users.luna.id, [everyoneRole.id, memberRole.id]);
  await addMember(hq.id, users.quark.id, [everyoneRole.id]);

  const infoCat = await prisma.category.create({ data: { serverId: hq.id, name: 'Information', position: 0 } });
  const textCat = await prisma.category.create({ data: { serverId: hq.id, name: 'Text Channels', position: 1 } });
  const voiceCat = await prisma.category.create({ data: { serverId: hq.id, name: 'Voice Channels', position: 2 } });

  const announcements = await prisma.channel.create({ data: { serverId: hq.id, categoryId: infoCat.id, name: 'announcements', type: 'ANNOUNCEMENT', topic: 'Official updates from the team', position: 0 } });
  await prisma.channel.create({ data: { serverId: hq.id, categoryId: infoCat.id, name: 'rules', type: 'TEXT', topic: 'Be excellent to each other', position: 1 } });
  const general = await prisma.channel.create({ data: { serverId: hq.id, categoryId: textCat.id, name: 'general', type: 'TEXT', topic: 'General chatter about anything and everything', position: 0 } });
  const memes = await prisma.channel.create({ data: { serverId: hq.id, categoryId: textCat.id, name: 'memes', type: 'TEXT', topic: 'Post your best 🐸', position: 1 } });
  const devTalk = await prisma.channel.create({ data: { serverId: hq.id, categoryId: textCat.id, name: 'dev-talk', type: 'TEXT', topic: 'Code, bugs, and architecture', position: 2 } });
  await prisma.channel.create({ data: { serverId: hq.id, categoryId: textCat.id, name: 'off-topic', type: 'TEXT', topic: 'Anything goes', position: 3 } });
  await prisma.channel.create({ data: { serverId: hq.id, categoryId: voiceCat.id, name: 'Lounge', type: 'VOICE', position: 0 } });
  await prisma.channel.create({ data: { serverId: hq.id, categoryId: voiceCat.id, name: 'Gaming', type: 'VOICE', position: 1 } });

  // Custom emoji
  await prisma.emoji.create({ data: { serverId: hq.id, name: 'nebula', url: '/nebula.svg' } });

  // --- Messages in #general ---------------------------------------------
  type Seed = { author: string; content: string; minsAgo: number };
  const generalMsgs: Seed[] = [
    { author: 'nova', content: 'Welcome to **Nebula HQ** 🌌 — the home base for everything we build here.', minsAgo: 240 },
    { author: 'nova', content: "This channel is for general chatter. Head over to <#dev-talk> if you want to nerd out about code.", minsAgo: 238 },
    { author: 'orbit', content: 'The new glassmorphism theme is *chefs kiss* 👨‍🍳💋', minsAgo: 210 },
    { author: 'pixel', content: 'Anyone up for a game later tonight? 🎮', minsAgo: 180 },
    { author: 'comet', content: 'Count me in!', minsAgo: 178 },
    { author: 'echo', content: "I'll bring the playlist 🎧", minsAgo: 176 },
    { author: 'orbit', content: 'Here is the little markdown cheat sheet:\n\n- **bold**, *italic*, ~~strike~~\n- `inline code`\n- > blockquotes\n- lists like this one', minsAgo: 120 },
    { author: 'pixel', content: 'And code blocks!\n```js\nfunction greet(name) {\n  return `hello, ${name}!`;\n}\nconsole.log(greet("nebula"));\n```', minsAgo: 118 },
    { author: 'nova', content: 'Perfect. Reactions, replies, threads, voice — it all works. Give it a try 👇', minsAgo: 60 },
    { author: 'luna', content: 'this is genuinely so smooth 🚀', minsAgo: 25 },
    { author: 'comet', content: 'The typing indicator is a nice touch 👀', minsAgo: 8 },
  ];

  const now = Date.now();
  let lastGeneralMsgId = '';
  const msgIds: Record<string, string> = {};
  for (const m of generalMsgs) {
    const msg = await prisma.message.create({
      data: {
        channelId: general.id,
        authorId: users[m.author].id,
        content: m.content,
        createdAt: new Date(now - m.minsAgo * 60_000),
      },
    });
    lastGeneralMsgId = msg.id;
    msgIds[m.content.slice(0, 12)] = msg.id;
  }

  // A reply + reactions on the welcome message
  const welcomeId = generalMsgs[0].content.slice(0, 12);
  await prisma.message.create({
    data: {
      channelId: general.id,
      authorId: users.comet.id,
      content: 'so hyped to be here 🎉',
      replyToId: msgIds[welcomeId],
      createdAt: new Date(now - 5 * 60_000),
    },
  });

  const reactionsSeed: Array<[string, string[]]> = [
    ['🚀', ['nova', 'orbit', 'pixel', 'comet']],
    ['❤️', ['luna', 'echo']],
    ['🎉', ['pixel']],
  ];
  for (const [emoji, reactors] of reactionsSeed) {
    for (const r of reactors) {
      await prisma.reaction.create({ data: { messageId: lastGeneralMsgId, userId: users[r].id, emoji } }).catch(() => {});
    }
  }

  // Pin one message
  await prisma.message.update({ where: { id: lastGeneralMsgId }, data: { pinned: true } });

  // Announcement
  await prisma.message.create({
    data: {
      channelId: announcements.id,
      authorId: users.nova.id,
      content: '# 🎉 Nebula Chat v1 is live!\n\nServers, channels, voice, DMs, reactions, threads — the whole galaxy. Thanks for being here.',
      pinned: true,
      createdAt: new Date(now - 300 * 60_000),
    },
  });

  // dev-talk messages
  await prisma.message.create({ data: { channelId: devTalk.id, authorId: users.pixel.id, content: 'Socket.IO rooms make realtime *so* much easier than raw WebSockets.', createdAt: new Date(now - 90 * 60_000) } });
  await prisma.message.create({ data: { channelId: devTalk.id, authorId: users.nova.id, content: 'Agreed. And Prisma + SQLite means zero-config local dev. `npm run dev` and you are off.', createdAt: new Date(now - 88 * 60_000) } });
  await prisma.message.create({ data: { channelId: memes.id, authorId: users.orbit.id, content: 'me: I\'ll just fix one bug\nalso me, 4 hours later: why is the universe like this 💀', createdAt: new Date(now - 45 * 60_000) } });

  // --- Server: Design Guild ---------------------------------------------
  const design = await prisma.server.create({
    data: { name: 'Design Guild', description: 'For designers who ship.', bannerColor: '#ec4899', ownerId: users.orbit.id },
  });
  const dEveryone = await prisma.role.create({ data: { serverId: design.id, name: '@everyone', permissions: DEFAULT_PERMISSIONS, isDefault: true } });
  const dAdmin = await prisma.role.create({ data: { serverId: design.id, name: 'Owner', color: '#ec4899', position: 1, hoist: true, permissions: ALL_PERMISSIONS } });
  await addMember(design.id, users.orbit.id, [dEveryone.id, dAdmin.id]);
  await addMember(design.id, users.nova.id, [dEveryone.id]);
  await addMember(design.id, users.luna.id, [dEveryone.id]);
  const dCat = await prisma.category.create({ data: { serverId: design.id, name: 'Studio', position: 0 } });
  const dGeneral = await prisma.channel.create({ data: { serverId: design.id, categoryId: dCat.id, name: 'general', type: 'TEXT', topic: 'Design talk', position: 0 } });
  await prisma.channel.create({ data: { serverId: design.id, categoryId: dCat.id, name: 'showcase', type: 'TEXT', topic: 'Show your work', position: 1 } });
  await prisma.channel.create({ data: { serverId: design.id, categoryId: dCat.id, name: 'Critique Room', type: 'VOICE', position: 2 } });
  await prisma.message.create({ data: { channelId: dGeneral.id, authorId: users.orbit.id, content: 'Welcome to the Design Guild ✨', createdAt: new Date(now - 30 * 60_000) } });

  // --- Server: Game Night ------------------------------------------------
  const game = await prisma.server.create({
    data: { name: 'Game Night', description: 'Weekly co-op chaos.', bannerColor: '#22d3ee', ownerId: users.pixel.id },
  });
  const gEveryone = await prisma.role.create({ data: { serverId: game.id, name: '@everyone', permissions: DEFAULT_PERMISSIONS, isDefault: true } });
  const gAdmin = await prisma.role.create({ data: { serverId: game.id, name: 'Host', color: '#22d3ee', position: 1, hoist: true, permissions: ALL_PERMISSIONS } });
  await addMember(game.id, users.pixel.id, [gEveryone.id, gAdmin.id]);
  await addMember(game.id, users.nova.id, [gEveryone.id]);
  await addMember(game.id, users.comet.id, [gEveryone.id]);
  await addMember(game.id, users.echo.id, [gEveryone.id]);
  const gCat = await prisma.category.create({ data: { serverId: game.id, name: 'Lobby', position: 0 } });
  const gGeneral = await prisma.channel.create({ data: { serverId: game.id, categoryId: gCat.id, name: 'general', type: 'TEXT', topic: 'GG', position: 0 } });
  await prisma.channel.create({ data: { serverId: game.id, categoryId: gCat.id, name: 'looking-for-group', type: 'TEXT', position: 1 } });
  await prisma.channel.create({ data: { serverId: game.id, categoryId: gCat.id, name: 'Squad Voice', type: 'VOICE', position: 2 } });
  await prisma.message.create({ data: { channelId: gGeneral.id, authorId: users.pixel.id, content: 'Game night starts at 8! Who\'s in? 🎮', createdAt: new Date(now - 15 * 60_000) } });

  // --- Friendships -------------------------------------------------------
  await prisma.friendship.create({ data: { requesterId: users.nova.id, addresseeId: users.orbit.id, status: 'ACCEPTED' } });
  await prisma.friendship.create({ data: { requesterId: users.nova.id, addresseeId: users.pixel.id, status: 'ACCEPTED' } });
  await prisma.friendship.create({ data: { requesterId: users.echo.id, addresseeId: users.nova.id, status: 'ACCEPTED' } });
  await prisma.friendship.create({ data: { requesterId: users.comet.id, addresseeId: users.nova.id, status: 'PENDING' } });
  await prisma.friendship.create({ data: { requesterId: users.nova.id, addresseeId: users.luna.id, status: 'PENDING' } });

  // --- A DM conversation between nova and orbit --------------------------
  const dm = await prisma.dMChannel.create({ data: { isGroup: false } });
  await prisma.dMParticipant.create({ data: { dmChannelId: dm.id, userId: users.nova.id } });
  await prisma.dMParticipant.create({ data: { dmChannelId: dm.id, userId: users.orbit.id } });
  await prisma.message.create({ data: { dmChannelId: dm.id, authorId: users.orbit.id, content: 'hey! did you see the new mockups?', createdAt: new Date(now - 20 * 60_000) } });
  await prisma.message.create({ data: { dmChannelId: dm.id, authorId: users.nova.id, content: 'just did — they look incredible 🔥', createdAt: new Date(now - 19 * 60_000) } });
  await prisma.message.create({ data: { dmChannelId: dm.id, authorId: users.orbit.id, content: 'ship it? 🚀', createdAt: new Date(now - 18 * 60_000) } });

  // Invite for Nebula HQ
  await prisma.invite.create({ data: { code: 'nebula-hq', serverId: hq.id, inviterId: users.nova.id } });

  console.log('✅ Seed complete!');
  console.log('   Servers: Nebula HQ, Design Guild, Game Night');
  console.log(`   Demo login → username: nova   password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
