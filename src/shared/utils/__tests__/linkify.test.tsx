import { describe, it, expect } from 'vitest';
import { parseMessageText, FormattedMessageContent } from '../linkify';
import { render, screen } from '@testing-library/react';

describe('linkify utility', () => {
  it('parses text without URLs as a single text token', () => {
    const tokens = parseMessageText('Hello world, no links here!');
    expect(tokens).toEqual([
      { type: 'text', text: 'Hello world, no links here!' }
    ]);
  });

  it('detects a simple https link', () => {
    const tokens = parseMessageText('Check this https://example.com please');
    expect(tokens).toEqual([
      { type: 'text', text: 'Check this ' },
      { type: 'link', text: 'https://example.com', href: 'https://example.com' },
      { type: 'text', text: ' please' },
    ]);
  });

  it('detects a simple http link', () => {
    const tokens = parseMessageText('Visit http://my-site.org today');
    expect(tokens).toEqual([
      { type: 'text', text: 'Visit ' },
      { type: 'link', text: 'http://my-site.org', href: 'http://my-site.org' },
      { type: 'text', text: ' today' },
    ]);
  });

  it('detects www. links and prefixes https:// in href', () => {
    const tokens = parseMessageText('Go to www.google.com right now');
    expect(tokens).toEqual([
      { type: 'text', text: 'Go to ' },
      { type: 'link', text: 'www.google.com', href: 'https://www.google.com' },
      { type: 'text', text: ' right now' },
    ]);
  });

  it('correctly handles trailing punctuation without breaking the link', () => {
    const tokens = parseMessageText('Please check https://example.com.');
    expect(tokens).toEqual([
      { type: 'text', text: 'Please check ' },
      { type: 'link', text: 'https://example.com', href: 'https://example.com' },
      { type: 'text', text: '.' },
    ]);
  });

  it('handles multiple links with query parameters and special characters', () => {
    const text = 'Compare https://api.site.com/v1/search?q=test%20query&page=2 with https://other.org/path#section-1';
    const tokens = parseMessageText(text);

    expect(tokens.filter(t => t.type === 'link')).toHaveLength(2);
    expect(tokens[1].href).toBe('https://api.site.com/v1/search?q=test%20query&page=2');
    expect(tokens[3].href).toBe('https://other.org/path#section-1');
  });

  it('preserves parentheses in URLs such as Wikipedia', () => {
    const text = 'Read https://en.wikipedia.org/wiki/React_(software) for details.';
    const tokens = parseMessageText(text);

    const linkToken = tokens.find(t => t.type === 'link');
    expect(linkToken?.text).toBe('https://en.wikipedia.org/wiki/React_(software)');
    expect(tokens[tokens.length - 1].text).toBe(' for details.');
  });

  it('renders clickable link in React with target="_blank" and rel="noopener noreferrer"', () => {
    render(<FormattedMessageContent content="Click https://docs.ezee.org for docs" />);

    const link = screen.getByRole('link', { name: 'https://docs.ezee.org' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://docs.ezee.org');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.className).toContain('text-blue-600');
    expect(link.className).toContain('underline');
  });

  describe('mentions parsing and rendering', () => {
    it('parses multi-word mentions when mentions metadata is provided', () => {
      const mentions = [
        { userId: 'u1', name: 'Albin Aji' },
        { userId: 'u2', name: 'Sarah Connor' },
      ];
      const text = 'Hello @Albin Aji and @Sarah Connor please review';
      const tokens = parseMessageText(text, mentions);

      expect(tokens).toEqual([
        { type: 'text', text: 'Hello ' },
        { type: 'mention', text: '@Albin Aji', userId: 'u1' },
        { type: 'text', text: ' and ' },
        { type: 'mention', text: '@Sarah Connor', userId: 'u2' },
        { type: 'text', text: ' please review' },
      ]);
    });

    it('correctly handles mentions followed by trailing punctuation', () => {
      const mentions = [{ userId: 'u1', name: 'Albin Aji' }];
      const text = 'Hey @Albin Aji, can you check this?';
      const tokens = parseMessageText(text, mentions);

      expect(tokens).toEqual([
        { type: 'text', text: 'Hey ' },
        { type: 'mention', text: '@Albin Aji', userId: 'u1' },
        { type: 'text', text: ', can you check this?' },
      ]);
    });

    it('parses fallback single-word mentions when mentions parameter is omitted', () => {
      const text = 'Welcome @John to the ticket';
      const tokens = parseMessageText(text);

      expect(tokens).toEqual([
        { type: 'text', text: 'Welcome ' },
        { type: 'mention', text: '@John' },
        { type: 'text', text: ' to the ticket' },
      ]);
    });

    it('does not treat email addresses as mentions', () => {
      const text = 'Send email to contact@ezee.org for support';
      const tokens = parseMessageText(text);

      expect(tokens).toEqual([
        { type: 'text', text: 'Send email to contact@ezee.org for support' },
      ]);
    });

    it('parses mixed text with both mentions and URLs seamlessly', () => {
      const mentions = [{ userId: 'u1', name: 'Albin Aji' }];
      const text = 'Hi @Albin Aji please visit https://ezee.org for details';
      const tokens = parseMessageText(text, mentions);

      expect(tokens).toEqual([
        { type: 'text', text: 'Hi ' },
        { type: 'mention', text: '@Albin Aji', userId: 'u1' },
        { type: 'text', text: ' please visit ' },
        { type: 'link', text: 'https://ezee.org', href: 'https://ezee.org' },
        { type: 'text', text: ' for details' },
      ]);
    });

    it('renders mention with WhatsApp light green styling in FormattedMessageContent', () => {
      const mentions = [{ userId: 'u1', name: 'Albin Aji' }];
      const { container } = render(
        <FormattedMessageContent
          content="Great job @Albin Aji on this"
          mentions={mentions}
        />
      );

      const mentionSpan = container.querySelector('[data-testid="message-mention"]');
      expect(mentionSpan).toBeInTheDocument();
      expect(mentionSpan?.textContent).toBe('@Albin Aji');
      expect(mentionSpan?.className).toContain('bg-[#dcf8c6]');
      expect(mentionSpan?.className).toContain('text-[#075e54]');
    });

    it('renders mention with WhatsApp sender styling when isMe is true', () => {
      const mentions = [{ userId: 'u1', name: 'Albin Aji' }];
      const { container } = render(
        <FormattedMessageContent
          content="Assigned to @Albin Aji"
          mentions={mentions}
          isMe={true}
        />
      );

      const mentionSpan = container.querySelector('[data-testid="message-mention"]');
      expect(mentionSpan).toBeInTheDocument();
      expect(mentionSpan?.className).toContain('bg-[#cbf3b6]');
      expect(mentionSpan?.className).toContain('text-[#075e54]');
    });

    it('highlights multi-word user names even when mentions array is empty [] by resolving knownUsers', () => {
      const knownUsers = [{ id: 'exec-3', name: 'Executive User 3' }];
      const text = 'hello @Executive User 3 please note this';
      const tokens = parseMessageText(text, [], knownUsers);

      expect(tokens).toEqual([
        { type: 'text', text: 'hello ' },
        { type: 'mention', text: '@Executive User 3', userId: 'exec-3' },
        { type: 'text', text: ' please note this' },
      ]);

      const { container } = render(
        <FormattedMessageContent
          content={text}
          mentions={[]}
          knownUsers={knownUsers}
        />
      );

      const mentionSpan = container.querySelector('[data-testid="message-mention"]');
      expect(mentionSpan).toBeInTheDocument();
      expect(mentionSpan?.textContent).toBe('@Executive User 3');
      expect(mentionSpan?.className).toContain('text-[#075e54]');
    });

    it('supports fallback tokenization when mentions is empty [] and no knownUsers provided', () => {
      const text = 'hello @Bob please check';
      const tokens = parseMessageText(text, []);

      expect(tokens).toEqual([
        { type: 'text', text: 'hello ' },
        { type: 'mention', text: '@Bob' },
        { type: 'text', text: ' please check' },
      ]);
    });
  });
});
