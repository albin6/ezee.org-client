import React from 'react';

export interface TextToken {
  type: 'text' | 'link';
  text: string;
  href?: string;
}

/**
 * Safely parses a text string into plain text and sanitized URLs.
 * Handles trailing punctuation and balanced parentheses gracefully.
 */
export function parseMessageText(text: string): TextToken[] {
  if (!text) return [];

  const tokens: TextToken[] = [];
  let lastIndex = 0;
  // Match URLs starting with http://, https://, or www.
  const regex = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    let rawUrl = match[0];

    // Push preceding text if any
    if (matchIndex > lastIndex) {
      tokens.push({
        type: 'text',
        text: text.slice(lastIndex, matchIndex),
      });
    }

    // Trim trailing punctuation from the matched URL (. , ! ? ; : ) ] })
    let trailingPunct = '';
    const punctuationChars = ['.', ',', '!', '?', ';', ':', ')', ']', '}'];

    while (rawUrl.length > 0 && punctuationChars.includes(rawUrl[rawUrl.length - 1])) {
      const lastChar = rawUrl[rawUrl.length - 1];
      if (lastChar === ')') {
        const openCount = (rawUrl.match(/\(/g) || []).length;
        const closeCount = (rawUrl.match(/\)/g) || []).length;
        if (openCount >= closeCount) {
          // Balanced or more open than closed, do not strip closing paren
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

      // Security check: Only allow http and https protocols
      try {
        const parsedUrl = new URL(href);
        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
          tokens.push({
            type: 'link',
            text: rawUrl,
            href,
          });
        } else {
          tokens.push({
            type: 'text',
            text: rawUrl,
          });
        }
      } catch {
        tokens.push({
          type: 'text',
          text: rawUrl,
        });
      }
    }

    if (trailingPunct.length > 0) {
      tokens.push({
        type: 'text',
        text: trailingPunct,
      });
    }

    lastIndex = matchIndex + match[0].length;
  }

  // Push remaining text if any
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
}

/**
 * Renders message content with auto-detected, clickable, sanitized blue links.
 * 100% XSS safe - does not use dangerouslySetInnerHTML.
 */
export const FormattedMessageContent: React.FC<FormattedMessageContentProps> = ({
  content,
  className = 'whitespace-pre-wrap break-words text-[15px] leading-snug',
  isMe = false,
}) => {
  if (!content) return null;

  const tokens = parseMessageText(content);

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
        return <React.Fragment key={index}>{token.text}</React.Fragment>;
      })}
    </span>
  );
};
