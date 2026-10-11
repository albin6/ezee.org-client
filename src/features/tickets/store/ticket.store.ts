import { create } from 'zustand';
import type { Ticket } from '../api/ticket.service';
import { ticketService } from '../api/ticket.service';
import { socketService } from '@/shared/services/socket.service';

const PRIORITY_WEIGHT: Record<string, number> = {
  CRITICAL: 5,
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function isStaleTicketEvent(existing: Ticket, incoming: Partial<Ticket>): boolean {
  if (!existing || !incoming) return false;
  if (typeof existing.version === 'number' && typeof incoming.version === 'number') {
    if (incoming.version < existing.version) return true;
    if (incoming.version > existing.version) return false;
  }
  if (existing.updatedAt && incoming.updatedAt) {
    const existingTime = new Date(existing.updatedAt).getTime();
    const incomingTime = new Date(incoming.updatedAt).getTime();
    if (!Number.isNaN(existingTime) && !Number.isNaN(incomingTime) && incomingTime < existingTime) {
      return true;
    }
  }
  return false;
}

export function doesTicketMatchListParams(
  ticket: Ticket,
  params: any,
  currentUserId?: string,
  myGroupMembers: any[] = []
): boolean {
  if (!ticket || !ticket.id) return false;
  const activeParams = params || {};

  const myGroup = Boolean(activeParams.myGroup);
  const myTickets = myGroup
    ? false
    : activeParams.myTickets !== undefined
    ? Boolean(activeParams.myTickets)
    : true;

  const creatorId = ticket.createdById || ticket.createdBy?.id;
  const assigneeIds: string[] = Array.isArray(ticket.assignees)
    ? ticket.assignees
        .map((a: any) => a?.userId || a?.user?.id)
        .filter((id: any): id is string => Boolean(id))
    : [];

  if (myGroup) {
    if (!Array.isArray(myGroupMembers) || myGroupMembers.length === 0) {
      return false;
    }
    const ticketTeamId = ticket.teamId || ticket.team?.id;
    const matchesGroupMember = myGroupMembers.some((member: any) => {
      if (!member?.id) return false;
      const isParticipant = creatorId === member.id || assigneeIds.includes(member.id);
      if (!isParticipant) return false;
      if (ticketTeamId && Array.isArray(member.teams) && member.teams.length > 0) {
        return member.teams.some((t: any) => t.id === ticketTeamId);
      }
      return true;
    });
    if (!matchesGroupMember) return false;
  } else if (myTickets && currentUserId) {
    const isMyTicket = creatorId === currentUserId || assigneeIds.includes(currentUserId);
    if (!isMyTicket) return false;
  }

  // Status filter (defaults to 'OPEN,IN_PROGRESS' when undefined)
  const statusFilter =
    activeParams.status !== undefined ? activeParams.status : 'OPEN,IN_PROGRESS';
  if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
    const allowedStatuses = Array.isArray(statusFilter)
      ? statusFilter.filter((s) => s && s !== 'ALL' && s !== 'all')
      : String(statusFilter)
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && s !== 'ALL' && s !== 'all');
    if (allowedStatuses.length > 0 && !allowedStatuses.includes(ticket.status)) {
      return false;
    }
  }

  // Priority filter
  if (activeParams.priority && ticket.priority !== activeParams.priority) {
    return false;
  }

  // Team filter
  const ticketTeamId = ticket.teamId || ticket.team?.id;
  if (activeParams.teamId && ticketTeamId !== activeParams.teamId) {
    return false;
  }

  // CreatedBy filter
  if (activeParams.createdById && creatorId !== activeParams.createdById) {
    return false;
  }

  // Assignee filter
  if (activeParams.assigneeId && !assigneeIds.includes(activeParams.assigneeId)) {
    return false;
  }

  // Date range filter
  if (activeParams.dateFrom && ticket.createdAt) {
    const fromTime = new Date(activeParams.dateFrom).getTime();
    const ticketTime = new Date(ticket.createdAt).getTime();
    if (!Number.isNaN(fromTime) && !Number.isNaN(ticketTime) && ticketTime < fromTime) {
      return false;
    }
  }
  if (activeParams.dateTo && ticket.createdAt) {
    const toTime = new Date(activeParams.dateTo).getTime();
    const ticketTime = new Date(ticket.createdAt).getTime();
    if (!Number.isNaN(toTime) && !Number.isNaN(ticketTime) && ticketTime > toTime) {
      return false;
    }
  }

  // Search filter
  if (activeParams.search && String(activeParams.search).trim().length > 0) {
    const query = String(activeParams.search).trim().toLowerCase();
    const haystack = `${ticket.id || ''} ${ticket.title || ''} ${ticket.description || ''}`.toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const directMatch = haystack.includes(query);
    const termMatch =
      terms.length > 1 &&
      (terms.every((t) => haystack.includes(t)) ||
        terms.some((t) => t.length >= 3 && haystack.includes(t)));
    if (!directMatch && !termMatch) {
      return false;
    }
  }

  return true;
}

export function sortTicketsList(tickets: Ticket[], params?: any): Ticket[] {
  const sortBy = params?.sortBy || 'priority';
  const sortOrder = params?.sortOrder || 'desc';

  return [...tickets].sort((a, b) => {
    if (sortBy === 'priority') {
      const weightA = PRIORITY_WEIGHT[a.priority] ?? 0;
      const weightB = PRIORITY_WEIGHT[b.priority] ?? 0;
      if (weightA !== weightB) {
        return sortOrder === 'asc' ? weightA - weightB : weightB - weightA;
      }
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    }

    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      const timeA = new Date((a as any)[sortBy] || a.createdAt || 0).getTime();
      const timeB = new Date((b as any)[sortBy] || b.createdAt || 0).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    }

    const valA = String((a as any)[sortBy] || '');
    const valB = String((b as any)[sortBy] || '');
    return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });
}

interface TicketState {
  tickets: Ticket[];
  total: number;
  loading: boolean;
  error: string | null;
  currentTicket: Ticket | null;
  activeListParams: any;
  myGroupMembers: any[];
  setActiveListParams: (params: any) => void;
  setMyGroupMembers: (members: any[]) => void;
  fetchTickets: (params?: any) => Promise<void>;
  fetchTicket: (id: string) => Promise<void>;
  createTicket: (payload: { 
    title: string; 
    description?: string; 
    teamId?: string; 
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
    assignees?: string[];
    firstMessage?: {
      content?: string;
      audioUrl?: string;
      attachments?: { fileUrl: string; fileName: string; fileType: string; fileSize: number }[];
    }
  }) => Promise<any>;
  updateStatus: (id: string, status: string, version?: number) => Promise<void>;
  addMessage: (id: string, content: string, statusChange?: 'CLOSED' | 'REOPENED', replyToId?: string, audioUrl?: string, attachments?: { fileUrl: string; fileName: string; fileType: string; fileSize: number }[]) => Promise<void>;
  toggleReaction: (ticketId: string, messageId: string, reaction: string) => Promise<void>;
  addAssignee: (ticketId: string, userId: string) => Promise<any>;
  editMessage: (ticketId: string, messageId: string, content: string) => Promise<any>;
  deleteMessage: (ticketId: string, messageId: string, type: 'me' | 'everyone') => Promise<any>;
  joinTicketRoom: (ticketId: string) => void;
  leaveTicketRoom: (ticketId: string) => void;
  handleTicketCreatedRealtime: (ticket: Ticket, currentUserId?: string) => void;
  handleTicketUpdatedRealtime: (ticket: Ticket, currentUserId?: string) => void;
  handleNewMessage: (message: any) => void;
  handleReactionUpdated: (data: { messageId: string, message: any }) => void;
  handleMessageEdited: (message: any) => void;
  handleMessageDeletedForEveryone: (data: { messageId: string; ticketId: string; message?: any }) => void;
  handleMessageDeletedForMe: (data: { messageId: string; ticketId: string }) => void;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  total: 0,
  loading: false,
  error: null,
  currentTicket: null,
  activeListParams: {
    page: 1,
    limit: 12,
    status: 'OPEN,IN_PROGRESS',
    sortBy: 'priority',
    sortOrder: 'desc',
    myTickets: true,
    myGroup: false,
  },
  myGroupMembers: [],

  setActiveListParams: (params) => {
    set({ activeListParams: params });
  },

  setMyGroupMembers: (members) => {
    set({ myGroupMembers: Array.isArray(members) ? members : [] });
  },

  fetchTickets: async (params) => {
    if (params !== undefined) {
      set({ loading: true, error: null, activeListParams: params });
    } else {
      set({ loading: true, error: null });
    }
    try {
      const response = await ticketService.getTickets(params);
      set({ tickets: response.data, total: response.total ?? response.data.length, loading: false });
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
      const res = await ticketService.createTicket(payload);
      set({ loading: false });
      return res.data;
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
      if (response.data) {
        get().handleTicketUpdatedRealtime(response.data);
      }
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

  addAssignee: async (ticketId: string, userId: string) => {
    try {
      set({ loading: true, error: null });
      const res = await ticketService.addAssignee(ticketId, userId);
      if (res && res.data) {
        set({ currentTicket: res.data, loading: false });
      } else {
        set({ loading: false });
      }
      return res?.data;
    } catch (error: any) {
      set({ error: error.message || 'Failed to add assignee', loading: false });
      throw error;
    }
  },

  editMessage: async (ticketId: string, messageId: string, content: string) => {
    try {
      const res = await ticketService.editMessage(ticketId, messageId, content);
      if (res && res.data) {
        get().handleMessageEdited(res.data);
      }
      return res?.data;
    } catch (error: any) {
      console.error('Failed to edit message', error);
      throw error;
    }
  },

  deleteMessage: async (ticketId: string, messageId: string, type: 'me' | 'everyone') => {
    try {
      const res = await ticketService.deleteMessage(ticketId, messageId, type);
      if (type === 'everyone') {
        get().handleMessageDeletedForEveryone({
          messageId,
          ticketId,
          message: res?.data?.message,
        });
      } else {
        get().handleMessageDeletedForMe({
          messageId,
          ticketId,
        });
      }
      return res?.data;
    } catch (error: any) {
      console.error('Failed to delete message', error);
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
    socket.off('MESSAGE_EDITED');
    socket.off('MESSAGE_DELETED_FOR_EVERYONE');
    socket.off('MESSAGE_DELETED_FOR_ME');

    socket.on('NEW_MESSAGE', (message: any) => {
      get().handleNewMessage(message);
    });

    socket.on('REACTION_UPDATED', (data: any) => {
      get().handleReactionUpdated(data);
    });

    socket.on('TICKET_UPDATED', (updatedTicket: any) => {
      const ct = get().currentTicket;
      if (ct && ct.id === updatedTicket?.id) {
        if (!isStaleTicketEvent(ct, updatedTicket)) {
          set({
            currentTicket: {
              ...ct,
              ...updatedTicket,
              messages: updatedTicket.messages !== undefined ? updatedTicket.messages : ct.messages,
            },
          });
        }
      }
      if (updatedTicket) {
        get().handleTicketUpdatedRealtime(updatedTicket);
      }
    });

    socket.on('AI_INSIGHTS_GENERATED', (data: any) => {
      const ct = get().currentTicket;
      if (ct && ct.id === data.ticketId) {
        set({ 
          currentTicket: { 
            ...ct, 
            aiSummary: data.aiSummary, 
            aiConfidence: data.aiConfidence,
            ...(data.autoRouted && { 
              priority: data.suggestedPriority,
              teamId: data.suggestedTeamId 
            })
          } 
        });
      }
    });

    socket.on('MESSAGE_EDITED', (message: any) => {
      get().handleMessageEdited(message);
    });

    socket.on('MESSAGE_DELETED_FOR_EVERYONE', (data: any) => {
      get().handleMessageDeletedForEveryone(data);
    });

    socket.on('MESSAGE_DELETED_FOR_ME', (data: any) => {
      get().handleMessageDeletedForMe(data);
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
      socket.off('MESSAGE_EDITED');
      socket.off('MESSAGE_DELETED_FOR_EVERYONE');
      socket.off('MESSAGE_DELETED_FOR_ME');
    }
  },

  handleTicketCreatedRealtime: (incomingTicket: Ticket, currentUserId?: string) => {
    if (!incomingTicket || !incomingTicket.id) return;

    const { tickets, total, activeListParams, myGroupMembers } = get();
    const matches = doesTicketMatchListParams(
      incomingTicket,
      activeListParams,
      currentUserId,
      myGroupMembers
    );

    const existingIndex = tickets.findIndex((t) => t.id === incomingTicket.id);

    if (existingIndex !== -1) {
      const existing = tickets[existingIndex];
      if (isStaleTicketEvent(existing, incomingTicket)) return;

      if (!matches) {
        const filtered = tickets.filter((t) => t.id !== incomingTicket.id);
        set({
          tickets: filtered,
          total: Math.max(0, total - 1),
        });
        return;
      }

      const merged = tickets.map((t, idx) =>
        idx === existingIndex ? { ...t, ...incomingTicket } : t
      );
      set({
        tickets: sortTicketsList(merged, activeListParams),
      });
      return;
    }

    if (!matches) return;

    const page = Number(activeListParams?.page) || 1;
    const limit = Number(activeListParams?.limit) || 12;

    if (page === 1) {
      const nextTickets = sortTicketsList([incomingTicket, ...tickets], activeListParams).slice(
        0,
        limit
      );
      set({
        tickets: nextTickets,
        total: total + 1,
      });
    } else {
      set({
        total: total + 1,
      });
    }
  },

  handleTicketUpdatedRealtime: (incomingTicket: Ticket, currentUserId?: string) => {
    if (!incomingTicket || !incomingTicket.id) return;

    const { tickets, total, activeListParams, myGroupMembers } = get();
    const existingIndex = tickets.findIndex((t) => t.id === incomingTicket.id);
    const mergedTicket =
      existingIndex !== -1
        ? { ...tickets[existingIndex], ...incomingTicket }
        : incomingTicket;

    if (existingIndex !== -1 && isStaleTicketEvent(tickets[existingIndex], incomingTicket)) {
      return;
    }

    const matches = doesTicketMatchListParams(
      mergedTicket,
      activeListParams,
      currentUserId,
      myGroupMembers
    );

    if (existingIndex !== -1) {
      if (!matches) {
        const filtered = tickets.filter((t) => t.id !== incomingTicket.id);
        set({
          tickets: filtered,
          total: Math.max(0, total - 1),
        });
        return;
      }

      const updatedList = tickets.map((t, idx) =>
        idx === existingIndex ? mergedTicket : t
      );
      set({
        tickets: sortTicketsList(updatedList, activeListParams),
      });
      return;
    }

    if (matches) {
      const page = Number(activeListParams?.page) || 1;
      const limit = Number(activeListParams?.limit) || 12;
      if (page === 1) {
        const nextTickets = sortTicketsList([mergedTicket, ...tickets], activeListParams).slice(
          0,
          limit
        );
        set({
          tickets: nextTickets,
          total: total + 1,
        });
      } else {
        set({
          total: total + 1,
        });
      }
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
  },

  handleMessageEdited: (updatedMessage: any) => {
    const ct = get().currentTicket;
    if (!ct || ct.id !== updatedMessage.ticketId) return;

    set({
      currentTicket: {
        ...ct,
        messages: ct.messages?.map((m) =>
          m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m
        ),
      },
    });
  },

  handleMessageDeletedForEveryone: ({ messageId, ticketId, message }: { messageId: string, ticketId: string, message?: any }) => {
    const ct = get().currentTicket;
    if (!ct || ct.id !== ticketId) return;

    set({
      currentTicket: {
        ...ct,
        messages: ct.messages?.map((m) => {
          if (m.id === messageId) {
            return {
              ...m,
              ...(message || {}),
              isDeleted: true,
              content: 'This message was deleted',
              audioUrl: undefined,
              attachments: [],
            };
          }
          return m;
        }),
      },
    });
  },

  handleMessageDeletedForMe: ({ messageId, ticketId }: { messageId: string, ticketId: string }) => {
    const ct = get().currentTicket;
    if (!ct || ct.id !== ticketId) return;

    set({
      currentTicket: {
        ...ct,
        messages: ct.messages?.filter((m) => m.id !== messageId),
      },
    });
  }
}));
