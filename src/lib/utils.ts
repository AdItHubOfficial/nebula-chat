import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// Convert "#rrggbb" to an "r g b" triplet for CSS variables.
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return '139 92 246';
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

// Deterministic gradient for a user/server based on an id.
const GRADIENTS = [
  ['#8b5cf6', '#ec4899'],
  ['#22d3ee', '#3b82f6'],
  ['#34d399', '#10b981'],
  ['#f59e0b', '#ef4444'],
  ['#f472b6', '#a855f7'],
  ['#60a5fa', '#818cf8'],
  ['#fb7185', '#f43f5e'],
  ['#2dd4bf', '#0ea5e9'],
];

export function gradientFor(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length] as [string, string];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function abbreviateServer(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...args: never[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`;
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}
export function isVideo(mime: string): boolean {
  return mime.startsWith('video/');
}
export function isAudio(mime: string): boolean {
  return mime.startsWith('audio/');
}

export const PRESENCE_META: Record<string, { label: string; color: string }> = {
  ONLINE: { label: 'Online', color: 'rgb(var(--c-success))' },
  IDLE: { label: 'Idle', color: 'rgb(var(--c-idle))' },
  DND: { label: 'Do Not Disturb', color: 'rgb(var(--c-danger))' },
  INVISIBLE: { label: 'Invisible', color: 'rgb(var(--c-faint))' },
  OFFLINE: { label: 'Offline', color: 'rgb(var(--c-faint))' },
};
