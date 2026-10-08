import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailsPage } from '../TicketDetailsPage';
import { useTicketStore } from '../../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ticketService } from '../../api/ticket.service';

vi.mock('../../api/ticket.service', () => ({
  ticketService: {
    getTicket: vi.fn(),
    getUsersMentionLookup: vi.fn().mockResolvedValue([]),
    uploadAudio: vi.fn().mockResolvedValue({ url: 'https://cloudinary.com/audio.webm', duration: 12 }),
    uploadAttachment: vi.fn().mockImplementation((file: File) => 
      Promise.resolve({
        id: 'att-' + Math.random().toString(36).substring(7),
        fileName: file.name,
        fileUrl: 'https://cloudinary.com/' + file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
      })
    ),
  }
}));

vi.mock('@/shared/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock('@/shared/services/socket.service', () => ({
  socketService: {
    connect: vi.fn().mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    }),
  }
}));

// Mock URL.createObjectURL and revokeObjectURL
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
} else {
  vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
} else {
  vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
}

describe('TicketDetailsPage - Media Attachments & Link Handling', () => {
  const mockAddMessage = vi.fn().mockResolvedValue(undefined);
  const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);

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

    Element.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();

    useAuthStore.setState({
      user: {
        type: 'user',
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User One',
      } as any,
      isAuthenticated: true,
      accessToken: 'test-token',
    });

    useTicketStore.setState({
      currentTicket: {
        id: 'ticket-attach-1',
        title: 'Issue with Payment Gateway',
        description: 'Check details at https://stripe.com/docs',
        status: 'OPEN',
        priority: 'HIGH',
        createdById: 'user-1',
        createdBy: { id: 'user-1', name: 'User One', email: 'user1@example.com' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        assignees: [],
        messages: [
          {
            id: 'msg-1',
            ticketId: 'ticket-attach-1',
            userId: 'user-2',
            user: { id: 'user-2', name: 'Support Rep', email: 'rep@example.com' },
            content: 'Hello, please visit https://example.com/portal or check www.support.org for details.',
            createdAt: new Date().toISOString(),
            isDeleted: false,
            isEdited: false,
            attachments: [
              {
                id: 'att-existing-1',
                messageId: 'msg-1',
                fileName: 'sample_spec.pdf',
                fileUrl: 'https://cloudinary.com/sample_spec.pdf',
                fileSize: 1024 * 500, // 500 KB
                fileType: 'application/pdf',
                createdAt: new Date().toISOString(),
              },
              {
                id: 'att-existing-2',
                messageId: 'msg-1',
                fileName: 'notes.docx',
                fileUrl: 'https://cloudinary.com/notes.docx',
                fileSize: 1024 * 120, // 120 KB
                fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                createdAt: new Date().toISOString(),
              }
            ],
          }
        ],
      } as any,
      loading: false,
      error: null,
      fetchTicket: vi.fn().mockResolvedValue(undefined),
      updateStatus: mockUpdateStatus,
      addMessage: mockAddMessage,
      joinTicketRoom: vi.fn(),
      leaveTicketRoom: vi.fn(),
      handleNewMessage: vi.fn(),
      handleReactionUpdated: vi.fn(),
    } as any);
  });

  it('renders clickable links in message text safely with target="_blank"', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-attach-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Link 1: https://example.com/portal
    const link1 = await screen.findByRole('link', { name: 'https://example.com/portal' });
    expect(link1).toBeInTheDocument();
    expect(link1).toHaveAttribute('href', 'https://example.com/portal');
    expect(link1).toHaveAttribute('target', '_blank');
    expect(link1).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link1.className).toContain('text-blue-600');

    // Link 2: www.support.org (auto prefixed with https://)
    const link2 = screen.getByRole('link', { name: 'www.support.org' });
    expect(link2).toBeInTheDocument();
    expect(link2).toHaveAttribute('href', 'https://www.support.org');
    expect(link2).toHaveAttribute('target', '_blank');
  });

  it('renders existing attachments in messages (PDF and DOCX cards with download)', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-attach-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // PDF attachment card
    const pdfCard = await screen.findByText('sample_spec.pdf');
    expect(pdfCard).toBeInTheDocument();
    expect(screen.getByText(/500.*KB.*PDF/i)).toBeInTheDocument();

    // DOCX attachment card
    const docxCard = screen.getByText('notes.docx');
    expect(docxCard).toBeInTheDocument();
    expect(screen.getByText(/120.*KB.*DOCX/i)).toBeInTheDocument();
  });

  it('allows recording audio, stopping to preview, and discarding recording', async () => {
    const mockTracks = [{ stop: vi.fn() }];
    const mockStream = { getTracks: () => mockTracks };
    class MockMediaRecorder {
      state = 'inactive';
      start = vi.fn().mockImplementation(() => { this.state = 'recording'; });
      pause = vi.fn().mockImplementation(() => { this.state = 'paused'; });
      resume = vi.fn().mockImplementation(() => { this.state = 'recording'; });
      stop = vi.fn().mockImplementation(() => {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      });
      mimeType = 'audio/webm';
      stream = mockStream;
      onstop: any = null;
      ondataavailable: any = null;
    }
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      configurable: true,
    });
    window.MediaRecorder = MockMediaRecorder as any;

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-attach-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Click mic to start recording
    const micButton = await screen.findByTitle(/Record voice message/i);
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText(/Recording\.\.\./i)).toBeInTheDocument();
    });

    // Stop button transitions recording to preview
    const stopToPreviewBtn = screen.getByTitle('Stop recording');
    expect(stopToPreviewBtn).toBeInTheDocument();
    fireEvent.click(stopToPreviewBtn);

    // Audio preview player is shown with play button and discard button
    await waitFor(() => {
      expect(screen.getByTitle('Discard audio')).toBeInTheDocument();
    });

    // Discard the audio preview
    const discardBtn = screen.getByTitle('Discard audio');
    fireEvent.click(discardBtn);

    // Returned to regular composer textarea
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type a message or @name to mention\/assign\.\.\./i)).toBeInTheDocument();
    });
  });

  it('allows selecting document files, previewing them in composer, and removing individually', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-attach-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const pdfFile = new File(['%PDF-1.4 dummy content'], 'invoice.pdf', { type: 'application/pdf' });
    const docFile = new File(['dummy doc content'], 'specification.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    fireEvent.change(fileInput, { target: { files: [pdfFile, docFile] } });

    // Both files should show up in composer preview list
    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
      expect(screen.getByText('specification.docx')).toBeInTheDocument();
    });

    // Remove invoice.pdf
    const removeButtons = screen.getAllByTitle('Remove invoice.pdf');
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);

    // invoice.pdf should be removed, but specification.docx remains
    await waitFor(() => {
      expect(screen.queryByText('invoice.pdf')).not.toBeInTheDocument();
      expect(screen.getByText('specification.docx')).toBeInTheDocument();
    });
  });

  it('rejects dangerous executable files (.exe, .bat, .sh) on the frontend', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-attach-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dangerousFile = new File(['malicious'], 'trojan.exe', { type: 'application/x-msdownload' });

    fireEvent.change(fileInput, { target: { files: [dangerousFile] } });

    // File should NOT be added to preview
    await waitFor(() => {
      expect(screen.queryByText('trojan.exe')).not.toBeInTheDocument();
    });
  });

  it('rejects files exceeding the 25MB limit', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-attach-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Mock a 26MB file
    const oversizedFile = new File(['a'], 'giant_file.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 26 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    // File should NOT be added to preview
    await waitFor(() => {
      expect(screen.queryByText('giant_file.pdf')).not.toBeInTheDocument();
    });
  });

  it('uploads attachments and sends message with fallback text when message body is empty', async () => {
    render(
      <MemoryRouter initialEntries={['/tickets/ticket-attach-1']}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testDoc = new File(['test report'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [testDoc] } });

    await waitFor(() => {
      expect(screen.getByText('report.pdf')).toBeInTheDocument();
    });

    const sendBtn = screen.getByTitle('Send message (Enter)');
    expect(sendBtn).toBeInTheDocument();
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(ticketService.uploadAttachment).toHaveBeenCalledWith(
        testDoc,
        'ticket-attach-1',
        expect.any(Function)
      );
      expect(mockAddMessage).toHaveBeenCalledWith(
        'ticket-attach-1',
        '📁 report.pdf',
        undefined,
        undefined,
        undefined,
        [expect.objectContaining({ fileName: 'report.pdf' })]
      );
    });
  });
});
