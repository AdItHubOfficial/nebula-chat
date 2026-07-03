import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ALL_EMOJIS } from '@shared/emoji';

marked.setOptions({ gfm: true, breaks: true });

// Open links safely in a new tab.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

const MENTION_RE = /(^|[\s(])@([a-zA-Z0-9_.]{2,32})/g;

// Render chat markdown to sanitized HTML with @mention highlighting.
export function renderMarkdown(input: string): string {
  const tokenized = input.replace(MENTION_RE, (_m, pre, name) => `${pre}@${name}`);
  const html = marked.parse(tokenized, { async: false }) as string;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 's', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'span', 'hr'],
    ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
  });
  return clean.replace(/@([a-zA-Z0-9_.]{2,32})/g, (_m, name) => `<span class="mention" data-mention="${name}">@${name}</span>`);
}

const emojiSet = new Set(ALL_EMOJIS);

// A short message made purely of emoji renders larger.
export function isJumbo(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  const chars = [...trimmed].filter((c) => c.trim().length > 0);
  if (chars.length === 0 || chars.length > 8) return false;
  // Use Intl segmenter-free heuristic: check codepoints against emoji set / emoji ranges.
  const graphemes = trimmed.match(/\p{Extended_Pictographic}(️)?/gu);
  if (!graphemes) return false;
  const stripped = trimmed.replace(/\p{Extended_Pictographic}(️)?/gu, '').trim();
  return stripped.length === 0 && graphemes.length <= 8;
}

export function extractMentions(content: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE);
  while ((m = re.exec(content))) names.add(m[2].toLowerCase());
  return [...names];
}

export function isCustomEmojiName(name: string): boolean {
  return emojiSet.has(name);
}
