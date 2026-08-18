export interface QuickReplyOption {
  label: string;
  isOpenEnded: boolean;
}

export interface ParsedQuickReplies {
  cleanContent: string;
  options: QuickReplyOption[];
}

export const OPEN_ENDED_PATTERNS = [
  /^something\s+else/i,
  /^other/i,
  /^none\s+of\s+(the\s+above|these)/i,
  /^(a\s+)?different/i,
  /^custom/i,
  /^not\s+sure/i,
  /^i('m|\s+am)\s+not\s+sure/i,
  /^tell\s+me\s+more/i,
];

export function parseQuickReplies(content: string): ParsedQuickReplies {
  const lines = content.split('\n');

  // Walk backwards from the end to find a trailing numbered or bulleted list
  let listStartIdx = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed === '') {
      // Allow blank lines between list and preceding content
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed)) {
      listStartIdx = i;
    } else {
      break;
    }
  }

  // Extract list items (skip blank lines within the range)
  const listLines = lines.slice(listStartIdx).filter((l) => l.trim() !== '');
  if (listLines.length < 2) {
    return { cleanContent: content, options: [] };
  }

  const options: QuickReplyOption[] = listLines.map((line) => {
    // Strip the list marker (numbered or bulleted)
    const label = line.trim().replace(/^\d+\.\s+/, '').replace(/^[-*]\s+/, '');
    const isOpenEnded = OPEN_ENDED_PATTERNS.some((p) => p.test(label));
    return { label, isOpenEnded };
  });

  // Build clean content: everything before the list, trimmed
  const cleanContent = lines.slice(0, listStartIdx).join('\n').trimEnd();

  return { cleanContent, options };
}

export function generateConversationId(): string {
  return `conv-${crypto.randomUUID()}`;
}
