import { create } from 'zustand';
import type { Ticket } from '../api/ticket.service';
import { ticketService } from '../api/ticket.service';

interface TicketState {
  tickets: Ticket[];
  total: number;
  loading: boolean;
  error: string | null;
  currentTicket: Ticket | null;
  fetchTickets: (params: any) => Promise<void>;
  fetchTicket: (id: string) => Promise<void>;
  createTicket: (payload: any) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
  addMessage: (id: string, content: string) => Promise<void>;
}

export const useTicketStore = create<TicketState>((set) => ({
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

  updateStatus: async (id, status) => {
    set({ loading: true, error: null });
    try {
      const response = await ticketService.updateStatus(id, status);
      set({ currentTicket: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to update ticket status', loading: false });
      throw error;
    }
  },

  addMessage: async (id, content) => {
    set({ loading: true, error: null });
    try {
      const response = await ticketService.addMessage(id, content);
      set({ currentTicket: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to add message', loading: false });
      throw error;
    }
  }
}));
