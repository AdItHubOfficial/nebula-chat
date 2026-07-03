import { useLocation } from 'react-router-dom';

export interface ActiveIds {
  isDM: boolean;
  serverId: string | null;
  channelId: string | null;
  dmId: string | null;
}

// Derive the active server/channel/dm from the URL (routes live under /channels/*).
export function useActiveIds(): ActiveIds {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean); // e.g. ['channels','@me','id']
  const first = parts[1];
  if (!first || first === '@me') {
    return { isDM: true, serverId: null, channelId: null, dmId: parts[2] ?? null };
  }
  return { isDM: false, serverId: first, channelId: parts[2] ?? null, dmId: null };
}
