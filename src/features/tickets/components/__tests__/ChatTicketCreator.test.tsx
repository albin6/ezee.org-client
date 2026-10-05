import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatTicketCreator } from '../ChatTicketCreator';
import { ticketService } from '../../api/ticket.service';
import { teamService } from '@/features/teams/api/team.service';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getUsersMentionLookup: vi.fn(),
    createTicket: vi.fn(),
    uploadAudio: vi.fn(),
    uploadAttachment: vi.fn(),
  }
}));

vi.mock('@/features/teams/api/team.service', () => ({
  teamService: {
    getTeams: vi.fn(),
  }
}));

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

  localStorage.clear();

  vi.mocked(ticketService.getUsersMentionLookup).mockResolvedValue([
    {
      id: 'user-uuid-1',
      name: 'Alice Dev',
      email: 'alice@example.com',
      designation: 'Engineer',
      teamId: 'team-dev-id',
      teamName: 'Dev Team'
    },
    {
      id: 'user-uuid-2',
      name: 'Bob Lead',
      email: 'bob@example.com',
      designation: 'DevOps Lead',
      teamId: 'team-ops-id',
      teamName: 'Ops Team'
    }
  ]);

  vi.mocked(teamService.getTeams).mockResolvedValue({
    data: [
      { id: 'team-dev-id', name: 'Dev Team', status: 'ACTIVE', createdAt: '', updatedAt: '' },
      { id: 'team-ops-id', name: 'Ops Team', status: 'ACTIVE', createdAt: '', updatedAt: '' }
    ],
    meta: {
      total: 2,
      page: 1,
      limit: 100
    }
  });
});

describe('ChatTicketCreator Component', () => {
  it('renders the chat creator view with structure instructions', async () => {
    render(
      <BrowserRouter>
        <ChatTicketCreator />
      </BrowserRouter>
    );

    await waitFor(() => expect(ticketService.getUsersMentionLookup).toHaveBeenCalled());
    expect(screen.getByText(/Quick Ticket Creation/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i)).toBeInTheDocument();
  });

  it('real-time parses first line as Title and remaining lines as Description', async () => {
    render(
      <BrowserRouter>
        <ChatTicketCreator />
      </BrowserRouter>
    );

    await waitFor(() => expect(ticketService.getUsersMentionLookup).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i);

    fireEvent.change(textarea, {
      target: {
        value: 'Fix critical database lockup\nThis happens during nightly aggregation.\n@Alice Dev'
      }
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Fix critical database lockup/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/This happens during nightly aggregation/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('detects tagged assignee from @mention and auto-routes team', async () => {
    render(
      <BrowserRouter>
        <ChatTicketCreator />
      </BrowserRouter>
    );

    await waitFor(() => expect(ticketService.getUsersMentionLookup).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i);

    fireEvent.change(textarea, {
      target: {
        value: 'Deployment failure\nPipeline crashed on step 3.\n@Bob Lead'
      }
    });

    await waitFor(() => {
      // Bob Lead chip & mention
      expect(screen.getAllByText(/Bob Lead/i).length).toBeGreaterThanOrEqual(1);
      // Target team pill in header
      expect(screen.getAllByText(/Ops Team/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('directly starts 6-second undo buffer on Send click without any confirmation modal', async () => {
    render(
      <BrowserRouter>
        <ChatTicketCreator />
      </BrowserRouter>
    );

    await waitFor(() => expect(ticketService.getUsersMentionLookup).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i);

    fireEvent.change(textarea, {
      target: {
        value: 'Urgent server issue\nServer CPU at 100%\n@Alice Dev'
      }
    });

    await waitFor(() => {
      expect(screen.getByTitle(/Send Ticket \(Enter\)/i)).toBeInTheDocument();
    });

    // Click Send Button
    const sendBtn = screen.getByTitle(/Send Ticket \(Enter\)/i);
    fireEvent.click(sendBtn);

    // Should NOT show any confirmation modal
    expect(screen.queryByText(/Create Ticket Now\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/You pressed Enter to create this ticket/i)).not.toBeInTheDocument();

    // Directly shows the 6-second undo banner with Countdown, Undo, and Send Now
    await waitFor(() => {
      expect(screen.getByText(/Creating Ticket in 6s\.\.\./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Undo \(Cancel\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Now/i })).toBeInTheDocument();
    });
  });

  it('cancels sending when Undo (Cancel) button is clicked', async () => {
    render(
      <BrowserRouter>
        <ChatTicketCreator />
      </BrowserRouter>
    );

    await waitFor(() => expect(ticketService.getUsersMentionLookup).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i);

    fireEvent.change(textarea, {
      target: {
        value: 'Urgent server issue\nServer CPU at 100%\n@Alice Dev'
      }
    });

    await waitFor(() => {
      expect(screen.getByTitle(/Send Ticket \(Enter\)/i)).toBeInTheDocument();
    });

    // Trigger send
    const sendBtn = screen.getByTitle(/Send Ticket \(Enter\)/i);
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/Creating Ticket in 6s\.\.\./i)).toBeInTheDocument();
    });

    // Click Undo
    const undoBtn = screen.getByRole('button', { name: /Undo \(Cancel\)/i });
    fireEvent.click(undoBtn);

    // Buffer should be cancelled and input restored
    await waitFor(() => {
      expect(screen.queryByText(/Creating Ticket in/i)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i)).toBeInTheDocument();
    });
  });

  it('immediately creates ticket when Send Now is clicked', async () => {
    vi.mocked(ticketService.createTicket).mockResolvedValue({ data: { id: 'ticket-999' } } as any);

    render(
      <BrowserRouter>
        <ChatTicketCreator />
      </BrowserRouter>
    );

    await waitFor(() => expect(ticketService.getUsersMentionLookup).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i);

    fireEvent.change(textarea, {
      target: {
        value: 'Urgent server issue\nServer CPU at 100%\n@Alice Dev'
      }
    });

    await waitFor(() => {
      expect(screen.getByTitle(/Send Ticket \(Enter\)/i)).toBeInTheDocument();
    });

    // Trigger send
    const sendBtn = screen.getByTitle(/Send Ticket \(Enter\)/i);
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Send Now/i })).toBeInTheDocument();
    });

    // Click Send Now
    const sendNowBtn = screen.getByRole('button', { name: /Send Now/i });
    fireEvent.click(sendNowBtn);

    await waitFor(() => {
      expect(ticketService.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Urgent server issue',
          description: expect.stringContaining('Server CPU at 100%'),
        })
      );
    });
  });

  it('renders textarea with 24px initial height and auto-growing capacity', async () => {
    render(
      <BrowserRouter>
        <ChatTicketCreator />
      </BrowserRouter>
    );

    await waitFor(() => expect(ticketService.getUsersMentionLookup).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(/Type title on line 1, description below, @name to assign.../i) as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.rows).toBe(1);
    expect(textarea.className).toContain('h-[24px]');
    expect(textarea.className).toContain('min-h-[24px]');
    expect(textarea.style.height).toBe('24px');
    expect(textarea.style.minHeight).toBe('24px');
  });
});
