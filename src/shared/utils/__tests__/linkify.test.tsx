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
});
