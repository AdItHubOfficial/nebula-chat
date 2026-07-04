import type { Socket } from 'socket.io-client';
import { SocketEvents } from '@shared/events';
import type { Message, PublicUser, ServerDetail, Member, Channel, Category, DMChannelDTO } from '@shared/types';
import type { VoiceParticipant } from '@/types';
import { connectSocket, getSocket, emit } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useServerStore } from '@/store/serverStore';
import { useMessageStore } from '@/store/messageStore';
import { useDMStore } from '@/store/dmStore';
import { useFriendStore } from '@/store/friendStore';
import { useVoiceStore } from '@/store/voiceStore';
import { toast } from '@/store/toastStore';
import { useUIStore } from '@/store/uiStore';
import { sounds } from '@/lib/sounds';

function mentionsMe(content: string, me: PublicUser): boolean {
  const lower = content.toLowerCase();
  return lower.includes(`@${me.username.toLowerCase()}`) || lower.includes('@everyone') || lower.includes(`@${me.displayName.toLowerCase()}`);
}

function notify(title: string, body: string) {
  const { settings } = useUIStore.getState();
  if (!settings.desktopNotifications) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  try {
    new Notification(title, { body, icon: '/nebula.svg' });
  } catch {
    /* ignore */
  }
}

// Call notifications are important, so they show regardless of the general
// desktop-notification toggle (as long as the browser permission is granted).
function notifyCall(callerName: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification('📞 Incoming call', {
      body: `${callerName} is calling you`,
      icon: '/nebula.svg',
      requireInteraction: true,
      tag: 'nebula-call',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

let bound = false;

export function initRealtime(): () => void {
  const token = useAuthStore.getState().token;
  if (!token) return () => {};
  const socket: Socket = connectSocket(token);
  // Bind listeners only once per session (survives StrictMode double-mount).
  if (bound) return () => {};
  bound = true;

  const server = useServerStore.getState;
  const messages = useMessageStore.getState;
  const dms = useDMStore.getState;
  const friends = useFriendStore.getState;

  socket.on('connect_error', (err: Error) => {
    if (err.message === 'Unauthorized') {
      toast.error('Session expired', 'Please sign in again.');
      useAuthStore.getState().logout();
    }
  });

  socket.on(SocketEvents.PRESENCE_UPDATE, ({ user }: { user: PublicUser }) => {
    server().presenceUpdate(user);
    dms().presenceUpdate(user);
    friends().presenceUpdate(user);
    const me = useAuthStore.getState().user;
    if (me && user.id === me.id) useAuthStore.getState().patchUser(user);
  });

  socket.on(SocketEvents.MESSAGE_NEW, ({ message, nonce }: { message: Message; nonce?: string }) => {
    const me = useAuthStore.getState().user;
    messages().receiveMessage(message, nonce);
    if (message.dmChannelId) dms().updateLastMessage(message.dmChannelId, message);

    if (me && message.authorId !== me.id) {
      const key = message.channelId ?? message.dmChannelId ?? '';
      const mention = message.dmChannelId ? true : mentionsMe(message.content, me);
      messages().addUnread(key, mention);
      const isActive = messages().activeKey === key && document.hasFocus();
      if (!isActive) {
        const { settings } = useUIStore.getState();
        if (mention && settings.mentionSounds) sounds.play('mention');
        else if (settings.soundsEnabled) sounds.play('message');
        const label = message.dmChannelId ? message.author.displayName : `${message.author.displayName}`;
        notify(label, message.content.slice(0, 140) || 'Sent an attachment');
      }
    }
  });

  socket.on(SocketEvents.MESSAGE_UPDATED, ({ message }: { message: Message }) => messages().updateMessage(message));

  socket.on(SocketEvents.MESSAGE_DELETED, ({ messageId, channelId, dmChannelId }: { messageId: string; channelId?: string | null; dmChannelId?: string | null }) =>
    messages().deleteMessage(messageId, channelId, dmChannelId),
  );

  socket.on(SocketEvents.MESSAGE_PINNED, ({ messageId, pinned, channelId }: { messageId: string; pinned: boolean; channelId: string }) =>
    messages().setPinned(messageId, pinned, channelId),
  );

  socket.on(SocketEvents.REACTION_UPDATED, ({ messageId, emoji, userId, add }: { messageId: string; emoji: string; userId: string; add: boolean }) =>
    messages().applyReaction(messageId, emoji, userId, add),
  );

  socket.on(SocketEvents.TYPING_UPDATE, ({ channelId, userId, displayName }: { channelId: string; userId: string; displayName: string }) => {
    const me = useAuthStore.getState().user;
    if (me && userId !== me.id) messages().setTyping(channelId, userId, displayName);
  });

  socket.on(SocketEvents.READ_UPDATED, (payload: { channelId?: string; dmChannelId?: string; userId?: string; at?: string }) => {
    if (payload.dmChannelId && payload.userId && payload.at) {
      messages().setDmReceipt(payload.dmChannelId, payload.userId, payload.at);
    } else {
      const key = payload.channelId ?? payload.dmChannelId;
      if (key) messages().markRead(key);
    }
  });

  socket.on(SocketEvents.SERVER_UPDATED, (payload: { server?: ServerDetail; serverId?: string }) => {
    if (payload.server) server().applyServerDetail(payload.server);
    else if (payload.serverId) void server().loadServer(payload.serverId);
  });

  socket.on(SocketEvents.SERVER_DELETED, ({ serverId }: { serverId: string }) => {
    server().removeServer(serverId);
    window.dispatchEvent(new CustomEvent('nebula:server-removed', { detail: { serverId } }));
  });

  socket.on(SocketEvents.MEMBER_JOINED, ({ member }: { member: Member }) => server().memberJoined(member));
  socket.on(SocketEvents.MEMBER_LEFT, ({ serverId, userId }: { serverId: string; userId: string }) => server().memberLeft(serverId, userId));
  socket.on(SocketEvents.MEMBER_UPDATED, ({ member }: { member: Member }) => server().memberUpdated(member));

  socket.on(SocketEvents.CHANNEL_CREATED, ({ channel }: { channel: Channel }) => server().channelCreated(channel));
  socket.on(SocketEvents.CHANNEL_UPDATED, (payload: { channel?: Channel; category?: Category }) => {
    if (payload.channel) server().channelUpdated(payload.channel);
    else if (payload.category) void server().loadServer(payload.category.serverId);
  });
  socket.on(SocketEvents.CHANNEL_DELETED, ({ serverId, channelId }: { serverId: string; channelId: string }) => {
    server().channelDeleted(serverId, channelId);
    window.dispatchEvent(new CustomEvent('nebula:channel-removed', { detail: { serverId, channelId } }));
  });

  socket.on(SocketEvents.FRIEND_UPDATE, () => void friends().load());
  socket.on(SocketEvents.DM_CREATED, ({ dm }: { dm: DMChannelDTO }) => dms().upsertDM(dm));

  socket.on(SocketEvents.VOICE_STATE, ({ channelId, participants }: { channelId: string; participants: VoiceParticipant[] }) => {
    const prev = useServerStore.getState().voiceStates[channelId] ?? [];
    server().setVoiceState(channelId, participants);
    // Ring (and notify) when a DM call starts and we're not already in it.
    const me = useAuthStore.getState().user;
    const isDMCall = dms().dms.some((d) => d.id === channelId);
    if (!isDMCall || !me) return;
    const iAmIn = participants.some((p) => p.userId === me.id);
    const justStarted = prev.length === 0 && participants.length > 0;
    const vs = useVoiceStore.getState();
    if (!iAmIn && justStarted) {
      const caller = participants.find((p) => p.userId !== me.id) ?? participants[0];
      vs.setIncomingCall({ dmId: channelId, callerId: caller.userId, callerName: caller.displayName });
      notifyCall(caller.displayName);
    } else if ((iAmIn || participants.length === 0) && vs.incomingCall?.dmId === channelId) {
      // Answered here, or the caller hung up before we picked up → stop ringing.
      vs.clearIncomingCall();
    }
  });
  socket.on(SocketEvents.VOICE_SPEAKING, ({ channelId, userId, speaking }: { channelId: string; userId: string; speaking: boolean }) =>
    server().setSpeaking(channelId, userId, speaking),
  );

  // Listeners persist for the session; teardownRealtime() clears them on logout.
  return () => {};
}

export function teardownRealtime() {
  bound = false;
}

// Channel subscription helpers (typing indicators).
export function subscribeChannel(channelId: string) {
  emit(SocketEvents.SUBSCRIBE_CHANNEL, { channelId });
}
export function unsubscribeChannel(channelId: string) {
  emit(SocketEvents.UNSUBSCRIBE_CHANNEL, { channelId });
}
export function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}
export { getSocket };
