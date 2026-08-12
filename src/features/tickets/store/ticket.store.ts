import { create } from 'zustand';
import type { Ticket } from '../api/ticket.service';
import { ticketService } from '../api/ticket.service';
import { socketService } from '@/shared/services/socket.service';

interface TicketState {
  tickets: Ticket[];
  total: number;
  loading: boolean;
  error: string | null;
  currentTicket: Ticket | null;
  fetchTickets: (params?: any) => Promise<void>;
  fetchTicket: (id: string) => Promise<void>;
  createTicket: (payload: { 
    title: string; 
    description?: string; 
    teamId: string; 
    assignees?: string[];
    firstMessage?: {
      content?: string;
      audioUrl?: string;
      attachments?: { fileUrl: string; fileName: string; fileType: string; fileSize: number }[];
    }
  }) => Promise<void>;
  updateStatus: (id: string, status: string, version?: number) => Promise<void>;
  addMessage: (id: string, content: string, statusChange?: 'CLOSED' | 'REOPENED', replyToId?: string, audioUrl?: string, attachments?: { fileUrl: string; fileName: string; fileType: string; fileSize: number }[]) => Promise<void>;
  toggleReaction: (ticketId: string, messageId: string, reaction: string) => Promise<void>;
  joinTicketRoom: (ticketId: string) => void;
  leaveTicketRoom: (ticketId: string) => void;
  handleNewMessage: (message: any) => void;
  handleReactionUpdated: (data: { messageId: string, message: any }) => void;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  total: 0,
  loading: false,
  error: null,
  currentTicket: null,

  fetchTickets: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await ticketService.getTickets(params);
      set({ tickets: response.data, total: response.total || response.data.length, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch tickets', loading: false });
    }
  },

  fetchTicket: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await ticketService.getTicket(id);
      set({ currentTicket: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch ticket', loading: false });
    }
  },

  createTicket: async (payload) => {
    set({ loading: true, error: null });
    try {
      await ticketService.createTicket(payload);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to create ticket', loading: false });
      throw error;
    }
  },

  updateStatus: async (id, status, version) => {
    set({ loading: true, error: null });
    try {
      const response = await ticketService.updateStatus(id, status, version);
      set({ currentTicket: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to update ticket status', loading: false });
      throw error;
    }
  },

  addMessage: async (id: string, content: string, statusChange?: 'CLOSED' | 'REOPENED', replyToId?: string, audioUrl?: string, attachments?: { fileUrl: string; fileName: string; fileType: string; fileSize: number }[]) => {
    try {
      set({ loading: true, error: null });
      const response = await ticketService.addMessage(id, content, statusChange, replyToId, audioUrl, attachments);
      // Let the socket handle real-time append if connected, but also update local state as fallback
      // Actually, response.data returns the full ticket in the API. 
      // But since we have websockets, NEW_MESSAGE will append it anyway.
      // To prevent duplicate UI issues, we can just let NEW_MESSAGE handle it, but for safety:
      set({ currentTicket: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to add message', loading: false });
      throw error;
    }
  },

  toggleReaction: async (ticketId: string, messageId: string, reaction: string) => {
    try {
      await ticketService.toggleReaction(ticketId, messageId, reaction);
      // UI update is handled via socket REACTION_UPDATED
    } catch (error: any) {
      console.error('Failed to toggle reaction', error);
      throw error;
    }
  },

  joinTicketRoom: (ticketId: string) => {
    const socket = socketService.connect();
    
    // We pass lastTimestamp to fetch any missed messages while disconnected
    const currentTicket = get().currentTicket;
    let lastTimestamp: string | undefined = undefined;
    
    if (currentTicket && currentTicket.id === ticketId && currentTicket.messages && currentTicket.messages.length > 0) {
      // Find latest message timestamp
      lastTimestamp = currentTicket.messages[currentTicket.messages.length - 1].createdAt;
    }

    socket.emit('joinTicket', { ticketId, lastTimestamp }, (response: any) => {
      if (response && response.status === 'success' && response.missedMessages) {
        const { currentTicket: ct } = get();
        if (ct && ct.id === ticketId) {
          const existingIds = new Set(ct.messages?.map(m => m.id) || []);
          const newMessages = response.missedMessages.filter((m: any) => !existingIds.has(m.id));
          
          if (newMessages.length > 0) {
            set({ 
              currentTicket: {
                ...ct,
                messages: [...(ct.messages || []), ...newMessages]
              }
            });
          }
        }
      }
    });

    // We only attach listeners once per room join to avoid duplicates
    socket.off('NEW_MESSAGE');
    socket.off('REACTION_UPDATED');
    socket.off('TICKET_UPDATED');
    socket.off('AI_INSIGHTS_GENERATED');

    socket.on('NEW_MESSAGE', (message: any) => {
      get().handleNewMessage(message);
    });

    socket.on('REACTION_UPDATED', (data: any) => {
      get().handleReactionUpdated(data);
    });

    socket.on('TICKET_UPDATED', (updatedTicket: any) => {
      const ct = get().currentTicket;
      if (ct && ct.id === updatedTicket.id) {
        set({ currentTicket: updatedTicket });
      }
    });

    socket.on('AI_INSIGHTS_GENERATED', (data: any) => {
      const ct = get().currentTicket;
      if (ct && ct.id === data.ticketId) {
        set({ 
          currentTicket: { 
            ...ct, 
            aiSummary: data.aiSummary, 
            aiConfidence: data.aiConfidence 
          } 
        });
      }
    });
  },

  leaveTicketRoom: (ticketId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('leaveTicket', { ticketId });
      socket.off('NEW_MESSAGE');
      socket.off('REACTION_UPDATED');
      socket.off('TICKET_UPDATED');
      socket.off('AI_INSIGHTS_GENERATED');
    }
  },

  handleNewMessage: (message: any) => {
    const ct = get().currentTicket;
    if (!ct || ct.id !== message.ticketId) return;

    const existingMsg = ct.messages?.find(m => m.id === message.id);
    if (!existingMsg) {
      set({
        currentTicket: {
          ...ct,
          messages: [...(ct.messages || []), message]
        }
      });
    }
  },

  handleReactionUpdated: ({ messageId, message }) => {
    const ct = get().currentTicket;
    if (!ct) return;

    set({
      currentTicket: {
        ...ct,
        messages: ct.messages?.map(m => (m.id === messageId ? message : m))
      }
    });
  }
}));
