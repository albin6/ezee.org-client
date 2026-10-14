import React from 'react';

export interface TextToken {
  type: 'text' | 'link' | 'mention';
  text: string;
  href?: string;
  userId?: string;
}

interface SpanCandidate {
  start: number;
  end: number;
  token: TextToken;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safely parses a text string into plain text, sanitized URLs, and user mentions.
 * Handles trailing punctuation, balanced parentheses, and multi-word mention names gracefully.
 */
export function parseMessageText(
  text: string,
  mentions?: { userId: string; name: string }[]
): TextToken[] {
  if (!text) return [];

  const candidates: SpanCandidate[] = [];

  // 1. Identify URL spans
  const urlRegex = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    let rawUrl = match[0];

    // Trim trailing punctuation from the matched URL (. , ! ? ; : ) ] })
    let trailingPunct = '';
    const punctuationChars = ['.', ',', '!', '?', ';', ':', ')', ']', '}'];

    while (rawUrl.length > 0 && punctuationChars.includes(rawUrl[rawUrl.length - 1])) {
      const lastChar = rawUrl[rawUrl.length - 1];
      if (lastChar === ')') {
        const openCount = (rawUrl.match(/\(/g) || []).length;
        const closeCount = (rawUrl.match(/\)/g) || []).length;
        if (openCount >= closeCount) {
          break;
        }
      }
      trailingPunct = lastChar + trailingPunct;
      rawUrl = rawUrl.slice(0, -1);
    }

    if (rawUrl.length > 0) {
      let href = rawUrl;
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        href = `https://${href}`;
      }

      try {
        const parsedUrl = new URL(href);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
          candidates.push({
            start: matchIndex,
            end: matchIndex + rawUrl.length,
            token: {
              type: 'link',
              text: rawUrl,
              href,
            },
          });
        }
      } catch {
        // Ignore invalid URL
      }
    }
  }

  // 2. Identify Mention spans
  if (mentions && mentions.length > 0) {
    // Sort names longest first so partial substrings don't preempt longer names
    const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length);
    for (const m of sorted) {
      if (!m.name) continue;
      const escaped = escapeRegExp(m.name.trim());
      // Match @Name preceded by start of string, whitespace, or (
      const mentionRegex = new RegExp(`(?:^|[\\s(])(@${escaped})(?=[.,!?;:]?(?:\\s|$|[)]))`, 'gi');
      let mMatch: RegExpExecArray | null;
      while ((mMatch = mentionRegex.exec(text)) !== null) {
        const fullMatch = mMatch[0];
        const atMention = mMatch[1];
        const atOffset = fullMatch.indexOf(atMention);
        const start = mMatch.index + atOffset;
        const end = start + atMention.length;
        candidates.push({
          start,
          end,
          token: {
            type: 'mention',
            text: text.slice(start, end),
            userId: m.userId,
          },
        });
      }
    }
  } else if (mentions === undefined) {
    // Fallback for previews/tests: match standard single or double word @Mention
    const fallbackRegex = /(?:^|[\s(])(@[a-zA-Z0-9._-]+)(?=[.,!?;:]?(?:\s|$|[)]))/gi;
    let fMatch: RegExpExecArray | null;
    while ((fMatch = fallbackRegex.exec(text)) !== null) {
      const fullMatch = fMatch[0];
      const atMention = fMatch[1];
      const atOffset = fullMatch.indexOf(atMention);
      const start = fMatch.index + atOffset;
      const end = start + atMention.length;
      candidates.push({
        start,
        end,
        token: {
          type: 'mention',
          text: text.slice(start, end),
        },
      });
    }
  }

  // 3. Sort candidate spans and resolve collisions
  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const activeSpans: SpanCandidate[] = [];
  let currentEnd = 0;
  for (const span of candidates) {
    if (span.start >= currentEnd) {
      activeSpans.push(span);
      currentEnd = span.end;
    }
  }

  // 4. Assemble final token list
  const tokens: TextToken[] = [];
  let lastIndex = 0;

  for (const span of activeSpans) {
    if (span.start > lastIndex) {
      tokens.push({
        type: 'text',
        text: text.slice(lastIndex, span.start),
      });
    }
    tokens.push(span.token);
    lastIndex = span.end;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      text: text.slice(lastIndex),
    });
  }

  return tokens;
}

interface FormattedMessageContentProps {
  content: string;
  className?: string;
  isMe?: boolean;
  mentions?: { userId: string; name: string }[];
}

/**
 * Renders message content with auto-detected, clickable, sanitized blue links
 * and WhatsApp-style light green highlighted user mentions.
 * 100% XSS safe - does not use dangerouslySetInnerHTML.
 */
export const FormattedMessageContent: React.FC<FormattedMessageContentProps> = ({
  content,
  className = 'whitespace-pre-wrap break-words text-[15px] leading-snug',
  isMe = false,
  mentions,
}) => {
  if (!content) return null;

  const tokens = parseMessageText(content, mentions);

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type === 'link' && token.href) {
          return (
            <a
              key={index}
              href={token.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`underline underline-offset-2 break-all font-medium transition-colors ${
                isMe ? 'text-blue-700 hover:text-blue-900' : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              {token.text}
            </a>
          );
        }

        if (token.type === 'mention') {
          return (
            <span
              key={index}
              data-testid="message-mention"
              data-user-id={token.userId}
              className={`inline rounded px-1.5 py-0.5 font-medium align-baseline transition-colors ${
                isMe
                  ? 'text-[#075e54] bg-[#cbf3b6] dark:text-emerald-200 dark:bg-emerald-900/60'
                  : 'text-[#075e54] bg-[#dcf8c6] dark:text-emerald-300 dark:bg-emerald-900/40'
              }`}
            >
              {token.text}
            </span>
          );
        }

        return <React.Fragment key={index}>{token.text}</React.Fragment>;
      })}
    </span>
  );
};
