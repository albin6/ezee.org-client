import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageReactionDetailsModal } from '../MessageReactionDetailsModal';
import type { MessageReactionMember } from '../../api/ticket.service';

describe('MessageReactionDetailsModal Component', () => {
  const originalInnerWidth = window.innerWidth;

  const mockReactions: MessageReactionMember[] = [
    {
      messageId: 'msg-1',
      userId: 'user-alice',
      reaction: '👍',
      createdAt: '2026-10-14T09:00:00Z',
      user: {
        id: 'user-alice',
        name: 'Alice Smith',
        email: 'alice@ezee.org',
        designation: 'Senior Frontend Developer',
      },
    },
    {
      messageId: 'msg-1',
      userId: 'user-bob',
      reaction: '👍',
      createdAt: '2026-10-14T09:05:00Z',
      user: {
        id: 'user-bob',
        name: 'Bob Jones',
        email: 'bob@ezee.org',
        designation: 'Backend Architect',
      },
    },
    {
      messageId: 'msg-1',
      userId: 'user-charlie',
      reaction: '❤️',
      createdAt: '2026-10-14T09:10:00Z',
      user: {
        id: 'user-charlie',
        name: 'Charlie Brown',
        email: 'charlie@ezee.org',
        designation: 'Product Manager',
      },
    },
  ];

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    });

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    vi.clearAllMocks();
  });

  it('1. Renders desktop modal with reaction count, user profiles, and emojis', () => {
    render(
      <MessageReactionDetailsModal
        open={true}
        onClose={vi.fn()}
        messageId="msg-1"
        ticketId="ticket-100"
        reactions={mockReactions}
        currentUserId="user-alice"
      />
    );

    // Header count (WhatsApp style)
    expect(screen.getByText(/3 reactions/i)).toBeInTheDocument();

    // Member names
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

    // Designations
    expect(screen.getByText('Senior Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Backend Architect')).toBeInTheDocument();
    expect(screen.getByText('Product Manager')).toBeInTheDocument();

    // Badges
    expect(screen.getByTestId('reaction-details-modal')).toBeInTheDocument();
  });

  it('2. Shows "(You)" badge and remove button only for logged-in user', () => {
    const handleToggleReaction = vi.fn();

    render(
      <MessageReactionDetailsModal
        open={true}
        onClose={vi.fn()}
        messageId="msg-1"
        ticketId="ticket-100"
        reactions={mockReactions}
        currentUserId="user-alice"
        onToggleReaction={handleToggleReaction}
      />
    );

    // "(You)" label next to Alice
    expect(screen.getByText('You')).toBeInTheDocument();

    // Remove reaction button should exist for Alice's reaction
    const removeBtn = screen.getByTestId('remove-my-reaction-btn-👍');
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);
    expect(handleToggleReaction).toHaveBeenCalledWith('👍');

    // Should NOT have remove button for Charlie's heart reaction
    expect(screen.queryByTestId('remove-my-reaction-btn-❤️')).not.toBeInTheDocument();
  });

  it('3. Respects initialEmoji and filters members to clicked emoji tab', () => {
    render(
      <MessageReactionDetailsModal
        open={true}
        onClose={vi.fn()}
        messageId="msg-1"
        ticketId="ticket-100"
        initialEmoji="❤️"
        reactions={mockReactions}
        currentUserId="user-alice"
      />
    );

    // Initial emoji is ❤️, so only Charlie Brown should be displayed
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
  });

  it('4. Allows switching between emoji filter tabs (All, 👍, ❤️)', () => {
    render(
      <MessageReactionDetailsModal
        open={true}
        onClose={vi.fn()}
        messageId="msg-1"
        ticketId="ticket-100"
        initialEmoji="ALL"
        reactions={mockReactions}
        currentUserId="user-alice"
      />
    );

    // Initially "All" is active, all 3 users visible
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

    // Switch to 👍 tab
    const thumbsUpTab = screen.getByTestId('reaction-tab-👍');
    fireEvent.click(thumbsUpTab);

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();

    // Switch to ❤️ tab
    const heartTab = screen.getByTestId('reaction-tab-❤️');
    fireEvent.click(heartTab);

    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

    // Switch back to "All" tab
    const allTab = screen.getByTestId('reaction-tab-ALL');
    fireEvent.click(allTab);

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('5. Renders touch-friendly bottom sheet Drawer on mobile screens (< 768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 390, // Mobile viewport width
    });

    const handleClose = vi.fn();

    render(
      <MessageReactionDetailsModal
        open={true}
        onClose={handleClose}
        messageId="msg-1"
        ticketId="ticket-100"
        reactions={mockReactions}
        currentUserId="user-alice"
      />
    );

    // Mobile drawer should be rendered
    expect(screen.getByTestId('reaction-details-drawer')).toBeInTheDocument();
    expect(screen.queryByTestId('reaction-details-modal')).not.toBeInTheDocument();

    // Mobile close button
    const closeBtn = screen.getByTestId('close-reaction-details-btn-mobile');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('6. Handles empty state gracefully when there are no reactions', () => {
    render(
      <MessageReactionDetailsModal
        open={true}
        onClose={vi.fn()}
        messageId="msg-1"
        ticketId="ticket-100"
        reactions={[]}
        currentUserId="user-alice"
      />
    );

    expect(screen.getByTestId('reaction-details-empty')).toBeInTheDocument();
    expect(screen.getByText('No reactions on this message')).toBeInTheDocument();
  });

  it('7. Handles loading state with a spinner', () => {
    render(
      <MessageReactionDetailsModal
        open={true}
        onClose={vi.fn()}
        messageId="msg-1"
        ticketId="ticket-100"
        reactions={[]}
        loading={true}
      />
    );

    expect(screen.getByTestId('reaction-details-loading')).toBeInTheDocument();
  });
});
