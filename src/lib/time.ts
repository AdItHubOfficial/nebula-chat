import { format, isToday, isYesterday, differenceInMinutes, differenceInSeconds } from 'date-fns';

export function messageTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

export function fullTimestamp(iso: string): string {
  return format(new Date(iso), 'PPpp');
}

// Discord-style timestamp for the first message of a group.
export function groupTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
  return format(d, "MM/dd/yyyy h:mm a");
}

export function dateSeparator(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d, yyyy');
}

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  const secs = differenceInSeconds(new Date(), d);
  if (secs < 60) return 'just now';
  const mins = differenceInMinutes(new Date(), d);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return format(d, 'MMM d');
}

export function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// Whether two consecutive messages should be visually grouped.
export function shouldGroup(prevIso: string, nextIso: string, sameAuthor: boolean): boolean {
  if (!sameAuthor) return false;
  return Math.abs(differenceInMinutes(new Date(nextIso), new Date(prevIso))) < 6;
}
