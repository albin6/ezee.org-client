import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Space, Divider, Typography, Avatar, Select, Modal, Popover, Image, Drawer, Input, message as antMessage } from 'antd';
import {
  UserOutlined,
  SendOutlined,
  MoreOutlined,
  ReloadOutlined,
  SmileOutlined,
  CloseOutlined,
  EnterOutlined,
  AudioOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  EditOutlined,
  PaperClipOutlined,
  FileOutlined,
  DownloadOutlined,
  ArrowDownOutlined,
  DownOutlined,
  UpOutlined,
  UserAddOutlined,
  PictureOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  CustomerServiceOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/components/PageContainer';
import { useTicketStore } from '../store/ticket.store';
import { ticketService, type MentionUser } from '../api/ticket.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { VoiceMessagePlayer } from '../components/VoiceMessagePlayer';
import { TicketAssigneesSection } from '../components/TicketAssigneesSection';
import { FormattedMessageContent } from '@/shared/utils/linkify';
import { compressImage } from '@/shared/utils/imageCompressor';
import { AudioPreviewPlayer } from '../components/AudioPreviewPlayer';
import { AttachmentPreviewList, formatFileSize } from '../components/AttachmentPreviewList';
import { computeTicketEscalationTiming, canUserExtendTicketEscalation } from '../utils/escalation-time.util';
import { MessageReactionDetailsModal } from '../components/MessageReactionDetailsModal';
import EmojiPicker from 'emoji-picker-react';

const { Title, Text, Paragraph } = Typography;

const AIInsightsPanel = React.memo(({ summary, confidence }: { summary: string; confidence?: number }) => {
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 shrink-0 flex items-start gap-3">
      <div className="text-purple-600 mt-1">
        <span role="img" aria-label="ai" className="text-xl">✨</span>
      </div>
      <div>
        <Text strong className="text-purple-800 block text-base mb-1">AI Triage Summary</Text>
        <Text className="text-purple-700">{summary}</Text>
        {confidence && (
          <div className="mt-2">
            <Text type="secondary" className="text-xs">Confidence: {(confidence * 100).toFixed(0)}%</Text>
          </div>
        )}
      </div>
    </div>
  );
});

export const TicketDetailsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    currentTicket: ticket,
    loading,
    holidayDates,
    fetchTicket,
    fetchHolidayDates,
    extendEscalationTime,
    addMessage,
    updateStatus,
    joinTicketRoom,
    leaveTicketRoom,
    toggleReaction,
    addAssignee,
    editMessage,
    deleteMessage,
  } = useTicketStore();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const [message, setMessage] = useState('');
  const [showResolvePrompt, setShowResolvePrompt] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string, name: string, content: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Escalation Time Extension State
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState<number>(60);
  const [extendReason, setExtendReason] = useState<string>('');
  const [isExtendingEscalation, setIsExtendingEscalation] = useState(false);

  // Message Edit & Delete State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [deletingMessage, setDeletingMessage] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // 10-second tick interval to dynamically refresh 7-minute eligibility and escalation countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof fetchHolidayDates === 'function') {
      fetchHolidayDates();
    }
  }, [fetchHolidayDates]);

  const isWithin7Minutes = useCallback((createdAt: string) => {
    if (!createdAt) return false;
    const createdAtMs = new Date(createdAt).getTime();
    return currentTime - createdAtMs <= 7 * 60 * 1000;
  }, [currentTime]);

  const handleStartEdit = (msg: any) => {
    if (!isWithin7Minutes(msg.createdAt)) {
      antMessage.warning('The 7-minute window to edit this message has expired.');
      return;
    }
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (msgId: string, createdAt: string) => {
    if (!id) return;
    if (!editingContent.trim()) {
      antMessage.warning('Message content cannot be empty.');
      return;
    }
    if (!isWithin7Minutes(createdAt)) {
      antMessage.error('The 7-minute window to edit this message has expired.');
      setEditingMessageId(null);
      return;
    }

    try {
      setIsSavingEdit(true);
      await editMessage(id, msgId, editingContent.trim());
      antMessage.success('Message updated');
      setEditingMessageId(null);
      setEditingContent('');
    } catch (err: any) {
      antMessage.error(err.response?.data?.message || err.message || 'Failed to edit message');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async (type: 'me' | 'everyone') => {
    if (!id || !deletingMessage) return;

    if (!isWithin7Minutes(deletingMessage.createdAt)) {
      antMessage.error('The 7-minute window to delete this message has expired.');
      setDeletingMessage(null);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteMessage(id, deletingMessage.id, type);
      antMessage.success(type === 'everyone' ? 'Message deleted for everyone' : 'Message deleted for you');
      setDeletingMessage(null);
    } catch (err: any) {
      antMessage.error(err.response?.data?.message || err.message || 'Failed to delete message');
    } finally {
      setIsDeleting(false);
    }
  };

  // Mention & Assignee Autocomplete State
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);
  const [isAddingAssignee, setIsAddingAssignee] = useState(false);
  const [trackedMentions, setTrackedMentions] = useState<{ userId: string; name: string }[]>([]);
  const [pendingAssignees, setPendingAssignees] = useState<MentionUser[]>([]);

  const escapeRegExp = useCallback((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), []);

  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const justSelectedMentionRef = useRef(false);

  // Helper to automatically focus the message input field
  const focusInput = useCallback(() => {
    const rawArea = textareaRef.current;
    if (rawArea) {
      rawArea.focus();
    }
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }, []);

  // WhatsApp-like auto-resizing: compact 24px initial height, smoothly expands as content grows up to 140px
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const minHeight = 24;
    const maxHeight = 140;

    const currentVal = textarea.value;

    // When there is no user content, lock strictly to initial height (24px)
    // so placeholder text wrapping doesn't artificially stretch the empty input
    if (!currentVal) {
      textarea.style.height = `${minHeight}px`;
      textarea.style.overflowY = 'hidden';
      return;
    }

    // Reset height temporarily to compute accurate scrollHeight of user content
    textarea.style.height = 'auto';

    const scrollHeight = textarea.scrollHeight;
    const targetHeight = Math.max(minHeight, Math.min(scrollHeight, maxHeight));

    textarea.style.height = `${targetHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  useEffect(() => {
    window.addEventListener('resize', adjustTextareaHeight);
    return () => window.removeEventListener('resize', adjustTextareaHeight);
  }, [adjustTextareaHeight]);

  // Auto-focus input on page load / ticket load
  useEffect(() => {
    if (!loading && ticket) {
      focusInput();
    }
  }, [loading, ticket?.id, focusInput]);

  // Pre-load mentionable users on mount
  useEffect(() => {
    ticketService.getUsersMentionLookup()
      .then((users) => setMentionUsers(users || []))
      .catch((err) => console.error('Failed to load mention users', err));
  }, []);

  // Dismiss mention dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionDropdownRef.current &&
        !mentionDropdownRef.current.contains(e.target as Node)
      ) {
        setMentionDropdownOpen(false);
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string, type: string } | null>(null);
  const [pdfViewMode, setPdfViewMode] = useState<'document' | 'image'>('document');
  
  // Scroll State
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [openReactionPopoverId, setOpenReactionPopoverId] = useState<string | null>(null);
  const [reactionDetailsModal, setReactionDetailsModal] = useState<{
    open: boolean;
    messageId: string | null;
    initialEmoji?: string | null;
    fetchedReactions?: any[];
    loading?: boolean;
  }>({
    open: false,
    messageId: null,
    initialEmoji: null,
    fetchedReactions: [],
    loading: false,
  });

  const handleOpenReactionDetails = async (messageId: string, emoji?: string) => {
    setReactionDetailsModal({
      open: true,
      messageId,
      initialEmoji: emoji || null,
      fetchedReactions: [],
      loading: false,
    });

    const currentMsg = ticket?.messages?.find((m: any) => m.id === messageId);
    const needsFetch = !currentMsg?.reactions || currentMsg.reactions.some((r: any) => !r.user?.name);

    if (id && needsFetch) {
      setReactionDetailsModal((prev) => ({ ...prev, loading: true }));
      try {
        const reactionsData = await ticketService.getMessageReactions(id, messageId);
        setReactionDetailsModal((prev) => ({
          ...prev,
          fetchedReactions: reactionsData || [],
          loading: false,
        }));
      } catch (err) {
        setReactionDetailsModal((prev) => ({ ...prev, loading: false }));
      }
    }
  };

  const activeReactionMessage = useMemo(() => {
    if (!reactionDetailsModal.messageId) return null;
    return ticket?.messages?.find((m: any) => m.id === reactionDetailsModal.messageId) || null;
  }, [ticket?.messages, reactionDetailsModal.messageId]);

  const activeModalReactions = useMemo(() => {
    if (reactionDetailsModal.fetchedReactions && reactionDetailsModal.fetchedReactions.length > 0) {
      return reactionDetailsModal.fetchedReactions;
    }
    return activeReactionMessage?.reactions || [];
  }, [reactionDetailsModal.fetchedReactions, activeReactionMessage?.reactions]);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const isLongDescription = Boolean(
    ticket?.description && 
    (ticket.description.length > 120 || ticket.description.split('\n').length > 3)
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  useEffect(() => {
    if (id) {
      fetchTicket(id);
      joinTicketRoom(id);
    }
    return () => {
      if (id) leaveTicketRoom(id);
    };
  }, [id, fetchTicket, joinTicketRoom, leaveTicketRoom]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
    setHasUnreadMessages(false);
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Check if we are near the bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
    
    if (isNearBottom) {
      setShowScrollButton(false);
      setHasUnreadMessages(false);
    } else {
      setShowScrollButton(true);
    }
  };

  // Keep track of previous messages length to detect new messages
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    if (!ticket?.messages) return;
    
    const container = scrollContainerRef.current;
    const isInitialLoad = prevMessagesLengthRef.current === 0;
    const isNewMessage = ticket.messages.length > prevMessagesLengthRef.current;
    
    if (isInitialLoad) {
      // Always scroll to bottom on initial load without smooth animation for instant feel
      messagesEndRef.current?.scrollIntoView();
    } else if (isNewMessage) {
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
        const lastMessage = ticket.messages[ticket.messages.length - 1];
        const isMyMessage = lastMessage?.user?.id === (user as any)?.id || lastMessage?.user?.id === (user as any)?.sub;
        
        // Auto scroll if user is near bottom, OR if the user just sent the message
        if (isNearBottom || isMyMessage) {
          setTimeout(scrollToBottom, 100);
        } else {
          setHasUnreadMessages(true);
        }
      }
    }
    
    prevMessagesLengthRef.current = ticket.messages.length;
  }, [ticket?.messages, user]);

  const handleSendMessage = async () => {
    const trimmed = message.trim();
    if ((!trimmed && !audioBlob && attachments.length === 0) || !id || isSending || isUploadingAttachments) return;

    // 1. Process pending non-participant assignees (selected from suggestions or typed in message)
    const nonParticipantPending = pendingAssignees.filter((u) => {
      const pattern = new RegExp(`@${escapeRegExp(u.name)}\\b`, 'i');
      return pattern.test(trimmed) && !isParticipant(u.id);
    });

    // Check if the entire message is strictly a standalone user handle/command (e.g. "@Bob" or "@Bob Assignee")
    const standaloneMentionMatch =
      !audioBlob &&
      attachments.length === 0 &&
      trimmed.match(/^@([a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+){0,2})$/);

    let standaloneAssigneeUser: MentionUser | null = null;
    let standaloneMatchedParticipant: MentionUser | null = null;

    if (standaloneMentionMatch) {
      const queryName = standaloneMentionMatch[1].trim().toLowerCase();
      const matchedUser =
        mentionUsers.find(
          (u) =>
            u.name.toLowerCase() === queryName ||
            u.email.toLowerCase() === queryName
        ) ||
        mentionUsers.find((u) => u.name.toLowerCase().startsWith(queryName));

      if (matchedUser) {
        if (!isParticipant(matchedUser.id)) {
          standaloneAssigneeUser = matchedUser;
        } else {
          standaloneMatchedParticipant = matchedUser;
        }
      }
    }

    const assigneesToAdd: MentionUser[] = [];
    if (standaloneAssigneeUser) {
      assigneesToAdd.push(standaloneAssigneeUser);
    }
    for (const u of nonParticipantPending) {
      if (!assigneesToAdd.some((a) => a.id === u.id)) {
        assigneesToAdd.push(u);
      }
    }

    // Also detect any non-participant user mentioned anywhere in message text
    for (const u of mentionUsers) {
      const pattern = new RegExp(`(?:^|[\\s(])@${escapeRegExp(u.name)}(?=[.,!?;:]?(?:\\s|$|[)]))`, 'i');
      if (pattern.test(trimmed) && !isParticipant(u.id)) {
        if (!assigneesToAdd.some((a) => a.id === u.id)) {
          assigneesToAdd.push(u);
        }
      }
    }

    if (assigneesToAdd.length > 0) {
      if (!canAddAssignee) {
        antMessage.warning('Only ticket creator or current assignees can add new assignees');
        // Preserve author's input on authorization failure
        setMentionDropdownOpen(false);
        setMentionQuery(null);
        focusInput();
        return;
      }

      if (ticket?.id) {
        try {
          setIsAddingAssignee(true);
          for (const targetUser of assigneesToAdd) {
            await addAssignee(ticket.id, targetUser.id);
            antMessage.success(`Added ${targetUser.name} as an assignee`);
          }
        } catch (err: any) {
          console.error('Failed to add assignee:', err);
          antMessage.error(err?.response?.data?.message || err?.message || 'Failed to add assignee');
          // If the system fails to add the user as an assignee, display error notification,
          // do not send the message, and preserve the author's input.
          setIsAddingAssignee(false);
          focusInput();
          return;
        } finally {
          setIsAddingAssignee(false);
        }
      }
    }

    // If user explicitly typed a standalone @name that does not exist in the system and no pending assignees
    if (standaloneMentionMatch && !standaloneAssigneeUser && !standaloneMatchedParticipant && pendingAssignees.length === 0) {
      antMessage.error(`User "${standaloneMentionMatch[1].trim()}" not found`);
      focusInput();
      return;
    }

    // 2. Identify active mentions (for both existing participants and newly added assignees) to persist with the message
    const allMentionCandidates = [...trackedMentions];
    for (const u of assigneesToAdd) {
      if (!allMentionCandidates.some((m) => m.userId === u.id)) {
        allMentionCandidates.push({ userId: u.id, name: u.name });
      }
    }
    for (const u of mentionUsers) {
      const pattern = new RegExp(`(?:^|[\\s(])@${escapeRegExp(u.name)}(?=[.,!?;:]?(?:\\s|$|[)]))`, 'i');
      if (pattern.test(trimmed) && !allMentionCandidates.some((m) => m.userId === u.id)) {
        allMentionCandidates.push({ userId: u.id, name: u.name });
      }
    }
    const finalMentions = allMentionCandidates.filter((m) => {
      const pattern = new RegExp(`@${escapeRegExp(m.name)}`, 'i');
      return pattern.test(trimmed);
    });

    const authUser: any = user;
    const authUserId = authUser?.id || authUser?.sub;
    const isCreator = ticket?.createdBy?.id === authUserId;
    const isAdmin = authUser?.role?.name === 'Super Admin' || authUser?.type === 'super_admin';

    if (ticket?.status === 'RESOLVED' && (isCreator || isAdmin)) {
      setShowResolvePrompt(true);
      return;
    }

    setIsSending(true);
    setUploadProgress(0);
    try {
      let finalAudioUrl = undefined;
      let finalAttachments: any[] = [];
      
      if (attachments.length > 0) {
        setIsUploadingAttachments(true);
        setUploadProgress(10);
        let completed = 0;
        const uploadPromises = attachments.map(async (file) => {
          const res = await ticketService.uploadAttachment(file, id, (percent) => {
            const currentItemWeight = percent / attachments.length;
            const completedWeight = (completed / attachments.length) * 100;
            setUploadProgress(Math.min(95, Math.round(completedWeight + currentItemWeight)));
          });
          completed++;
          setUploadProgress(Math.min(95, Math.round((completed / attachments.length) * 100)));
          return res;
        });
        finalAttachments = await Promise.all(uploadPromises);
        setUploadProgress(100);
        setIsUploadingAttachments(false);
      }

      if (audioBlob) {
        const { url } = await ticketService.uploadAudio(audioBlob, id, (percent) => {
          setUploadProgress(percent);
        });
        finalAudioUrl = url;
      }
      const finalMessage = message.trim() || (attachments.length > 0 ? (attachments.length === 1 ? `📁 ${attachments[0].name}` : `📁 ${attachments.length} attachments`) : '🎤 Voice Message');
      if (finalMentions.length > 0) {
        await addMessage(
          id,
          finalMessage,
          undefined,
          replyingTo?.id,
          finalAudioUrl,
          finalAttachments,
          finalMentions
        );
      } else {
        await addMessage(
          id,
          finalMessage,
          undefined,
          replyingTo?.id,
          finalAudioUrl,
          finalAttachments
        );
      }
      setMessage('');
      setTrackedMentions([]);
      setPendingAssignees([]);
      setReplyingTo(null);
      setAttachments([]);
      cancelRecording();
      setUploadProgress(0);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      antMessage.error(err?.response?.data?.message || err?.message || 'Failed to send message');
      setIsUploadingAttachments(false);
      setUploadProgress(0);
    } finally {
      setIsSending(false);
      focusInput();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options.mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options.mimeType = 'audio/mp4';
        }
      }
      options.audioBitsPerSecond = 64000;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      antMessage.error('Unable to access microphone. Please check permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecordingToPreview = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);
    mediaRecorderRef.current.stop();
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);

    const blob: Blob = await new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return resolve(new Blob([]));

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: recorder.mimeType || 'audio/webm' 
        });
        recorder.stream.getTracks().forEach(track => track.stop());
        resolve(audioBlob);
      };

      recorder.stop();
    });

    if (blob && blob.size > 0 && id) {
      setIsSending(true);
      setUploadProgress(10);
      try {
        const { url } = await ticketService.uploadAudio(blob, id, (percent) => {
          setUploadProgress(percent);
        });
        const finalMessage = message.trim() || '🎤 Voice Message';
        let finalAttachments: any[] = [];
        if (attachments.length > 0) {
          setIsUploadingAttachments(true);
          finalAttachments = await Promise.all(attachments.map(f => ticketService.uploadAttachment(f, id)));
          setIsUploadingAttachments(false);
        }
        await addMessage(id, finalMessage, undefined, replyingTo?.id, url, finalAttachments);
        setMessage('');
        setReplyingTo(null);
        setAttachments([]);
        setAudioBlob(null);
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
        setRecordingDuration(0);
        audioChunksRef.current = [];
        setUploadProgress(0);
      } catch (err: any) {
        console.error('Failed to send voice message:', err);
        antMessage.error(err?.message || 'Failed to send voice message');
      } finally {
        setIsSending(false);
        focusInput();
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerRef.current);
    setAudioBlob(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    focusInput();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const DANGEROUS_EXTENSIONS = ['.exe', '.sh', '.bat', '.cmd', '.ps1', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.php', '.py', '.vbs', '.msi', '.dll'];
  const MAX_ALLOWED_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

  const validateAndAddFiles = async (files: File[]) => {
    const validFiles: File[] = [];

    for (const file of files) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      if (DANGEROUS_EXTENSIONS.includes(ext)) {
        antMessage.error(`File "${file.name}" is not allowed for security reasons.`);
        continue;
      }

      if (file.size > MAX_ALLOWED_FILE_SIZE) {
        antMessage.error(`File "${file.name}" exceeds the 25MB size limit.`);
        continue;
      }

      const isDuplicate = attachments.some(a => a.name === file.name && a.size === file.size);
      if (isDuplicate) {
        antMessage.warning(`File "${file.name}" is already attached.`);
        continue;
      }

      // If image, optimize and compress before attaching
      if (file.type.startsWith('image/') && !file.type.includes('svg') && !file.type.includes('gif')) {
        try {
          const compressed = await compressImage(file);
          validFiles.push(compressed);
        } catch {
          validFiles.push(file);
        }
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
    if (e.target) {
      e.target.value = '';
    }
    focusInput();
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    focusInput();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleStatusChange = async (value: string) => {
    if (!id) return;
    const isClosing = value === 'CLOSED';
    Modal.confirm({
      title: isClosing ? 'Close Ticket Permanently?' : 'Confirm Status Change',
      content: isClosing
        ? 'Are you sure you want to close this ticket permanently? It cannot be reopened.'
        : `Are you sure you want to change the ticket status to ${value}?`,
      okText: isClosing ? 'Yes, Close' : 'Yes',
      okButtonProps: isClosing ? { danger: true } : undefined,
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await updateStatus(id, value, ticket?.version);
        } catch (err: any) {
          Modal.error({ title: 'Error', content: err.message || 'Failed to update status' });
        }
      }
    });
  };

  const authUser: any = user;
  const authUserId = authUser?.id || authUser?.sub;
  const isAssignee = ticket?.assignees?.some((a: any) => (a.userId || a.user?.id) === authUserId);
  const isCreator = (ticket?.createdById || ticket?.createdBy?.id) === authUserId;
  const isAdmin = authUser?.role?.name === 'Super Admin' || authUser?.type === 'super_admin';
  const canAddAssignee = Boolean(isCreator || isAssignee || isAdmin);
  const canEditStatus = Boolean(isAssignee || isAdmin || isCreator);
  const canExtendEscalation = Boolean(canUserExtendTicketEscalation(ticket, authUserId));

  const escalationTiming = useMemo(
    () => computeTicketEscalationTiming(ticket, new Date(currentTime), 'Asia/Kolkata', holidayDates),
    [ticket, currentTime, holidayDates]
  );

  const projectedExtensionTiming = useMemo(() => {
    if (!ticket || !escalationTiming.isApplicable) return null;
    const validAddMins = Math.max(1, Math.min(43200, Math.floor(Number(extendMinutes) || 0)));
    const currentExtended = Number(ticket.escalationExtendedMinutes || 0);
    // Match backend behavior: if already overdue, extend relative to elapsed + validAddMins
    const elapsedTotalMs = escalationTiming.thresholdMs - escalationTiming.remainingMs;
    const effectiveNewExtended = escalationTiming.isOverdue
      ? Math.max(
          currentExtended + validAddMins,
          Math.ceil(Math.max(0, elapsedTotalMs - 2 * 60 * 60 * 1000) / (60 * 1000)) + validAddMins
        )
      : currentExtended + validAddMins;

    return computeTicketEscalationTiming(
      { ...ticket, escalationExtendedMinutes: effectiveNewExtended },
      new Date(currentTime),
      'Asia/Kolkata',
      holidayDates
    );
  }, [ticket, escalationTiming, extendMinutes, currentTime, holidayDates]);

  const handleConfirmExtendEscalation = async () => {
    if (!id || !ticket) return;
    const mins = Math.floor(Number(extendMinutes));
    if (!Number.isFinite(mins) || mins <= 0 || mins > 43200) {
      antMessage.warning('Please enter a valid extension duration between 1 and 43200 minutes.');
      return;
    }

    try {
      setIsExtendingEscalation(true);
      const trimmedReason = extendReason.trim() || undefined;
      if (typeof extendEscalationTime === 'function') {
        await extendEscalationTime(id, mins, trimmedReason);
      } else {
        await ticketService.extendEscalationTime(id, {
          additionalMinutes: mins,
          reason: trimmedReason,
        });
        await fetchTicket(id);
      }
      antMessage.success('Escalation time extended successfully');
      setIsExtendModalOpen(false);
      setExtendReason('');
    } catch (err: any) {
      antMessage.error(
        err?.response?.data?.message || err?.message || 'Failed to extend escalation time'
      );
    } finally {
      setIsExtendingEscalation(false);
    }
  };

  // Check if a user is already an associated participant (creator or assignee)
  const isParticipant = (userId: string) => {
    if (!ticket) return false;
    const creatorId = ticket.createdById || ticket.createdBy?.id;
    if (creatorId === userId) return true;
    return ticket.assignees?.some((a: any) => (a.userId || a.user?.id) === userId);
  };

  // Filter mention suggestions based on typed query
  const filteredMentionUsers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();

    return mentionUsers.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.teamName && u.teamName.toLowerCase().includes(q)) ||
        (u.designation && u.designation.toLowerCase().includes(q))
      );
    }).slice(0, 8);
  }, [mentionQuery, mentionUsers]);

  // Handle typing & detecting @ trigger
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    const rawArea = e.target;
    const cursorPos =
      rawArea && rawArea.selectionStart !== undefined && rawArea.selectionStart > 0
        ? rawArea.selectionStart
        : val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9._-]*(?:\s[a-zA-Z0-9._-]*)?)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionDropdownOpen(true);
      setHighlightedMentionIndex(0);
    } else {
      setMentionDropdownOpen(false);
      setMentionQuery(null);
    }
  };

  // Select user from autocomplete: context-aware for mention vs assignee addition
  const handleSelectMentionUser = (selectedUser: MentionUser) => {
    justSelectedMentionRef.current = true;
    setTimeout(() => {
      justSelectedMentionRef.current = false;
    }, 300);

    const isPart = isParticipant(selectedUser.id);
    const rawArea = textareaRef.current;
    const cursorPos = rawArea?.selectionStart ?? message.length;
    const textBeforeCursor = message.slice(0, cursorPos);
    const textAfterCursor = message.slice(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    const mentionInsert = `@${selectedUser.name} `;
    let newText = '';
    let newCursorPos = 0;

    if (atIndex !== -1) {
      newText = textBeforeCursor.slice(0, atIndex) + mentionInsert + textAfterCursor;
      newCursorPos = atIndex + mentionInsert.length;
    } else {
      newText = message + mentionInsert;
      newCursorPos = newText.length;
    }

    setMessage(newText);

    // Record mention entity for all mentioned users so mention metadata is never lost
    setTrackedMentions((prev) => {
      if (prev.some((m) => m.userId === selectedUser.id)) return prev;
      return [...prev, { userId: selectedUser.id, name: selectedUser.name }];
    });

    if (!isPart) {
      // Non-participant: record as pending assignee to be added upon message send
      setPendingAssignees((prev) => {
        if (prev.some((u) => u.id === selectedUser.id)) return prev;
        return [...prev, selectedUser];
      });
    }

    setMentionDropdownOpen(false);
    setMentionQuery(null);

    setTimeout(() => {
      rawArea?.focus();
      rawArea?.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // Keyboard navigation for mention autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionDropdownOpen && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedMentionIndex((prev) => (prev + 1) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedMentionIndex((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        justSelectedMentionRef.current = true;
        setTimeout(() => {
          justSelectedMentionRef.current = false;
        }, 300);
        const targetUser = filteredMentionUsers[highlightedMentionIndex] || filteredMentionUsers[0];
        if (targetUser) {
          handleSelectMentionUser(targetUser);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionDropdownOpen(false);
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (justSelectedMentionRef.current) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusOptions = () => {
    if (isAdmin) {
      return [
        { value: 'OPEN', label: 'Open' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'RESOLVED', label: 'Resolved' },
        { value: 'CLOSED', label: 'Closed' },
        { value: 'REOPENED', label: 'Reopened' }
      ];
    }

    if (!ticket) return [];

    if (ticket.status === 'OPEN' && isAssignee) return [{ value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In Progress' }];
    if (ticket.status === 'REOPENED' && isAssignee) return [{ value: 'REOPENED', label: 'Reopened' }, { value: 'IN_PROGRESS', label: 'In Progress' }];
    if (ticket.status === 'IN_PROGRESS' && isAssignee) return [{ value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'RESOLVED', label: 'Resolved' }];
    if (ticket.status === 'RESOLVED' && isCreator) return [{ value: 'RESOLVED', label: 'Resolved' }, { value: 'CLOSED', label: 'Closed' }, { value: 'REOPENED', label: 'Reopened' }];
    
    return [{ value: ticket.status, label: ticket.status }];
  };

  if (loading && !ticket) return <PageContainer className="!px-0 sm:!px-4 lg:!px-6 !max-w-full lg:!max-w-7xl">Loading...</PageContainer>;
  if (!ticket) return <PageContainer>Ticket not found</PageContainer>;

  const statusOptions = getStatusOptions();

  return (
    <PageContainer className="lg:h-[calc(100vh-128px)] flex flex-col">
      <div className="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div>
          <Title level={3} className="!mb-1">{ticket.title}</Title>
          <Space>
            <Text type="secondary">Created by {ticket.createdBy?.name}</Text>
            <Text type="secondary">•</Text>
            <Text type="secondary">{new Date(ticket.createdAt).toLocaleString()}</Text>
          </Space>
        </div>
        <Button onClick={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/tickets');
          }
        }}>Back to Tickets</Button>
      </div>

      {ticket.aiSummary && <AIInsightsPanel summary={ticket.aiSummary} confidence={ticket.aiConfidence} />}

      {ticket.status === 'RESOLVED' && (isCreator || isAdmin) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
          <div>
            <Text strong className="text-blue-800 block text-base mb-1">This ticket has been marked as Resolved.</Text>
            <Text className="text-blue-600">Please review the resolution. You can close it permanently or reopen it if you need further clarification.</Text>
          </div>
          <Space>
            <Button onClick={() => handleStatusChange('REOPENED')}>Reopen Ticket</Button>
            <Button type="primary" onClick={() => handleStatusChange('CLOSED')}>Close Permanently</Button>
          </Space>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 h-auto lg:flex-1 lg:min-h-0 -mx-4 sm:mx-0 lg:mx-0 mt-[-24px] lg:mt-0">
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex flex-col flex-1 border-0 lg:border border-gray-200 rounded-none lg:rounded-lg bg-white overflow-hidden shadow-none lg:shadow-sm fixed inset-0 top-[64px] z-40 lg:static lg:z-auto lg:min-h-0">
            <div className="flex justify-between items-center px-4 py-3 border-b bg-white z-10 flex-shrink-0 shadow-sm sticky top-0">
              <div className="flex items-center gap-2">
                <Button 
                  type="text" 
                  icon={<span className="text-xl">←</span>} 
                  className="lg:hidden p-0 w-8 h-8 flex items-center justify-center -ml-2"
                  onClick={() => {
                    if (window.history.length > 1) {
                      navigate(-1);
                    } else {
                      navigate('/tickets');
                    }
                  }}
                />
                <span className="font-semibold text-base truncate max-w-[200px]">{ticket.title}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => id && fetchTicket(id)}
                  loading={loading}
                  title="Refresh Conversation"
                />
                <div className="lg:hidden flex items-center">
                  <Button
                    type="text"
                    icon={<MoreOutlined className="text-lg" />}
                    onClick={() => setMobileDrawerOpen(true)}
                  />
                </div>
              </div>
            </div>
            
            <div 
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#efeae2] relative" 
              ref={scrollContainerRef}
              onScroll={handleScroll}
            >
              {ticket.messages && ticket.messages.length > 0 ? (
                ticket.messages.map((msg: any) => {
                  if (msg.isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="bg-[#f0f2f5] text-gray-600 text-[11px] px-3 py-1 rounded-lg text-center shadow-sm shadow-black/5">
                          {msg.content} by {msg.user?.name || 'System'} • {new Date(msg.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  }

                  const isMe = msg.user.id === authUserId;
                  const msgReactions = msg.reactions || [];
                  const totalReactions = msgReactions.length;
                  const reactionGroups = msgReactions.reduce((acc: Record<string, any[]>, curr: any) => {
                    if (!acc[curr.reaction]) acc[curr.reaction] = [];
                    acc[curr.reaction].push(curr);
                    return acc;
                  }, {});
                  const sortedReactionEmojis = Object.entries(reactionGroups)
                    .sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length)
                    .map(([emoji]) => emoji);
                  const topReactionEmojis = sortedReactionEmojis.slice(0, 4);
                  const hasUserReacted = msgReactions.some((r: any) => (r.userId || r.user?.id) === authUserId);

                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && <Avatar icon={<UserOutlined />} className="flex-shrink-0 bg-gray-300 mt-1" size="small" />}
                      <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] group`}>
                        <div className={`px-2.5 pt-2 pb-1.5 shadow-sm relative text-sm flex flex-col ${isMe ? 'bg-[#d9fdd3] text-gray-800 rounded-lg rounded-tr-none' : 'bg-white text-gray-800 rounded-lg rounded-tl-none'}`}>
                          {!isMe && <div className="text-xs font-semibold text-blue-500 mb-0.5">{msg.user.name}</div>}
                          
                          {msg.replyTo && (
                            <div 
                              className={`text-xs p-2 rounded mb-1 border-l-4 cursor-pointer flex flex-col ${isMe ? 'bg-black/5 border-[#128c7e]' : 'bg-black/5 border-blue-500'}`}
                              onClick={() => {
                                // optional: scroll to reply
                              }}
                            >
                              <span className={`font-semibold text-[11px] mb-0.5 ${isMe ? 'text-[#128c7e]' : 'text-blue-500'}`}>{msg.replyTo.user.name}</span>
                              <span className="opacity-80 text-gray-600 truncate">{msg.replyTo.isDeleted ? 'This message was deleted' : msg.replyTo.content.substring(0, 60)}{!msg.replyTo.isDeleted && msg.replyTo.content.length > 60 ? '...' : ''}</span>
                            </div>
                          )}

                          {msg.isDeleted ? (
                            <div className="flex items-center gap-1.5 py-1 text-gray-500 italic text-sm">
                              <StopOutlined className="text-gray-400 text-xs" />
                              <span>This message was deleted</span>
                            </div>
                          ) : editingMessageId === msg.id ? (
                            <div className="flex flex-col gap-2 w-full min-w-[200px] sm:min-w-[260px] my-1">
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                className="w-full text-sm p-2 border border-blue-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white text-gray-800"
                                rows={Math.min(6, Math.max(2, editingContent.split('\n').length))}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveEdit(msg.id, msg.createdAt);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEdit();
                                  }
                                }}
                              />
                              <div className="flex justify-end items-center gap-1.5">
                                <Button size="small" onClick={handleCancelEdit} disabled={isSavingEdit}>
                                  Cancel
                                </Button>
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => handleSaveEdit(msg.id, msg.createdAt)}
                                  loading={isSavingEdit}
                                  disabled={!editingContent.trim()}
                                  className="bg-[#128c7e] hover:bg-[#075e54]"
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <FormattedMessageContent content={msg.content} isMe={isMe} mentions={msg.mentions} knownUsers={mentionUsers} />
                              {msg.audioUrl && (
                                <div className="mt-2 mb-1 w-full sm:max-w-[320px]">
                                  <VoiceMessagePlayer src={msg.audioUrl} isMe={isMe} />
                                </div>
                              )}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-1.5 flex flex-col gap-1.5">
                                  {msg.attachments.map((att: any) => {
                                    const isImage = att.fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.fileName);
                                    const isVideo = att.fileType.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(att.fileName);
                                    const isAudio = att.fileType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(att.fileName);
                                    const isPdf = att.fileType === 'application/pdf' || /\.pdf$/i.test(att.fileName);
                                    const isDoc = att.fileType.includes('word') || /\.(doc|docx)$/i.test(att.fileName);
                                    
                                    if (isImage) {
                                      return (
                                        <div key={att.id} className="rounded-lg overflow-hidden max-w-[250px] sm:max-w-[320px] border border-black/5 shadow-xs">
                                          <Image src={att.fileUrl} alt={att.fileName} className="w-full h-auto object-cover" />
                                        </div>
                                      );
                                    }
                                    
                                    if (isVideo) {
                                      return (
                                        <div key={att.id} className="rounded-lg overflow-hidden max-w-[250px] sm:max-w-[320px] border border-black/5 shadow-xs">
                                          <video src={att.fileUrl} controls className="w-full h-auto bg-black" />
                                        </div>
                                      );
                                    }

                                    if (isAudio) {
                                      return (
                                        <div key={att.id} className="w-full sm:max-w-[320px] py-0.5">
                                          <VoiceMessagePlayer src={att.fileUrl} isMe={isMe} />
                                        </div>
                                      );
                                    }

                                    return (
                                      <div 
                                        key={att.id} 
                                        onClick={() => setPreviewFile({ url: att.fileUrl, name: att.fileName, type: att.fileType })}
                                        className="flex items-center gap-3 p-2.5 rounded-lg bg-black/5 border border-black/10 text-sm max-w-[260px] sm:max-w-[320px] cursor-pointer hover:bg-black/10 transition-colors shadow-xs"
                                      >
                                        <div className={`rounded p-2 flex items-center justify-center shrink-0 ${
                                          isPdf ? 'bg-red-500 text-white' : isDoc ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'
                                        }`}>
                                          {isPdf ? <FilePdfOutlined className="text-lg" /> : isDoc ? <FileWordOutlined className="text-lg" /> : <FileOutlined className="text-lg" />}
                                        </div>
                                        <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                                          <span className="truncate max-w-full font-medium leading-tight text-gray-800" title={att.fileName}>{att.fileName}</span>
                                          <span className="text-[10px] text-gray-500 leading-tight font-mono mt-0.5">
                                            {formatFileSize(att.fileSize)} • {isPdf ? 'PDF' : isDoc ? 'DOCX' : att.fileType.split('/')[1]?.toUpperCase() || 'FILE'}
                                          </span>
                                        </div>
                                        <a
                                          href={att.fileUrl}
                                          download={att.fileName}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex-shrink-0 text-gray-400 hover:text-blue-600 p-1"
                                          title="Download file"
                                        >
                                          <DownloadOutlined className="text-base" />
                                        </a>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Timestamp and status */}
                          <div className="flex justify-end items-center gap-1 mt-0.5 ml-4 float-right pt-1">
                            {msg.isEdited && !msg.isDeleted && (
                              <span className="text-[10px] text-gray-400 italic mr-0.5">edited</span>
                            )}
                            <span className="text-[10px] text-gray-500 leading-none">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && !msg.isDeleted && <span className="text-[12px] text-gray-400 leading-none">✓</span>}
                          </div>
                        </div>
                        
                        {/* Reactions and action menu */}
                        {!msg.isDeleted && (
                          <div className={`flex gap-1.5 mt-0.5 items-center ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {totalReactions > 0 && (
                              <button 
                                type="button"
                                data-testid={`reaction-pill-${msg.id}`}
                                title={`View ${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'}`}
                                className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer flex items-center gap-1.5 transition-all hover:scale-105 shadow-xs ${
                                  hasUserReacted
                                    ? 'bg-blue-50/95 border-blue-200 text-blue-700 font-medium'
                                    : 'bg-white/95 border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReactionDetails(msg.id, sortedReactionEmojis.length === 1 ? sortedReactionEmojis[0] : 'ALL');
                                }}
                              >
                                <span className="flex items-center -space-x-0.5">
                                  {topReactionEmojis.map((emoji) => (
                                    <span key={emoji} className="text-xs leading-none">
                                      {emoji}
                                    </span>
                                  ))}
                                </span>
                                {totalReactions > 1 && (
                                  <span className="text-[11px] font-semibold text-gray-600 leading-none">
                                    {totalReactions}
                                  </span>
                                )}
                              </button>
                            )}
                            
                            <div className="flex items-center gap-1">
                              <Popover 
                                content={
                                  <EmojiPicker 
                                    onEmojiClick={(e) => {
                                      if (id) toggleReaction(id, msg.id, e.emoji);
                                      setOpenReactionPopoverId(null);
                                    }} 
                                    height={350} 
                                    width={300} 
                                  />
                                }
                                trigger="click"
                                placement={isMe ? "bottomRight" : "bottomLeft"}
                                open={openReactionPopoverId === msg.id}
                                onOpenChange={(open) => setOpenReactionPopoverId(open ? msg.id : null)}
                              >
                                <button className="text-[10px] w-6 h-6 rounded-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer flex items-center justify-center shadow-sm">
                                  <SmileOutlined />
                                </button>
                              </Popover>
                              <button 
                                className="text-[10px] w-6 h-6 rounded-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 cursor-pointer flex items-center justify-center shadow-sm"
                                onClick={() => {
                                  setReplyingTo({ id: msg.id, name: isMe ? 'You' : msg.user.name, content: msg.content });
                                  focusInput();
                                }}
                                title="Reply"
                              >
                                <EnterOutlined />
                              </button>
                              {isMe && ticket.status !== 'CLOSED' && isWithin7Minutes(msg.createdAt) && (
                                <>
                                  <button 
                                    className="text-[10px] w-6 h-6 rounded-full bg-white border border-gray-200 hover:bg-blue-50 text-gray-500 hover:text-blue-600 cursor-pointer flex items-center justify-center shadow-sm transition-colors"
                                    onClick={() => handleStartEdit(msg)}
                                    title="Edit message"
                                  >
                                    <EditOutlined />
                                  </button>
                                  <button 
                                    className="text-[10px] w-6 h-6 rounded-full bg-white border border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-600 cursor-pointer flex items-center justify-center shadow-sm transition-colors"
                                    onClick={() => setDeletingMessage(msg)}
                                    title="Delete message"
                                  >
                                    <DeleteOutlined />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-70 mt-10">
                  <div className="bg-[#f0f2f5] px-4 py-2 rounded-lg text-gray-500 text-sm shadow-sm">
                    No messages here yet. Send a message to start the conversation!
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Floating Scroll Button */}
            {showScrollButton && (
              <div className="absolute right-6 bottom-24 z-30">
                <Button 
                  shape="circle" 
                  icon={<ArrowDownOutlined className={hasUnreadMessages ? "text-white" : "text-gray-500"} />} 
                  onClick={scrollToBottom}
                  className={`w-10 h-10 shadow-md flex items-center justify-center ${hasUnreadMessages ? 'bg-[#00a884] hover:bg-[#008f6f] border-none' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                />
                {hasUnreadMessages && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </div>
            )}

            {(hasPermission('tickets:comment') || isAssignee || isCreator || isAdmin) && ticket.status !== 'CLOSED' && (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`bg-[#f0f2f5] px-4 py-3 z-20 flex flex-col flex-shrink-0 border-t border-gray-200 relative transition-colors ${
                  isDraggingOver ? 'bg-blue-50/80 ring-2 ring-blue-400 ring-inset' : ''
                }`}
              >
                {isDraggingOver && (
                  <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[1px] flex items-center justify-center z-30 pointer-events-none rounded border-2 border-dashed border-blue-400">
                    <span className="text-blue-600 font-medium text-sm flex items-center gap-2">
                      <PaperClipOutlined /> Drop files here to attach
                    </span>
                  </div>
                )}
                {replyingTo && (
                  <div className="flex items-center justify-between bg-black/5 border-l-4 border-[#128c7e] p-2 mb-2 rounded-r text-sm">
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-[#128c7e] text-[12px]">{replyingTo.name}</span>
                      <span className="text-gray-600 truncate text-[13px]">{replyingTo.content.substring(0, 60)}{replyingTo.content.length > 60 ? '...' : ''}</span>
                    </div>
                    <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => { setReplyingTo(null); focusInput(); }} className="text-gray-500 hover:text-gray-700" />
                  </div>
                )}
                
                {attachments.length > 0 && (
                  <AttachmentPreviewList
                    attachments={attachments}
                    onRemove={removeAttachment}
                    isUploading={isUploadingAttachments}
                    uploadProgress={uploadProgress}
                    onPreview={(file) => setPreviewFile({ url: URL.createObjectURL(file), name: file.name, type: file.type })}
                  />
                )}

                  {/* Contextual Autocomplete Mention & Assignee Dropdown */}
                  {mentionDropdownOpen && filteredMentionUsers.length > 0 && (
                    <div
                      ref={mentionDropdownRef}
                      data-testid="mention-autocomplete-dropdown"
                      className="absolute bottom-full mb-2 left-2 right-2 sm:left-14 sm:right-auto sm:w-[380px] bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 z-50 animate-fadeIn"
                      style={{ maxHeight: '280px' }}
                    >
                      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <span>{canAddAssignee ? 'Mention or Add Assignee' : 'Mention Participant'}</span>
                        <span className="text-[10px] text-gray-400 font-normal">↑↓ navigate • ↵ select</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                        {filteredMentionUsers.map((u, idx) => {
                          const isPart = isParticipant(u.id);
                          const isHighlighted = idx === highlightedMentionIndex;

                          return (
                            <div
                              key={u.id}
                              onClick={() => handleSelectMentionUser(u)}
                              onMouseEnter={() => setHighlightedMentionIndex(idx)}
                              className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                isHighlighted ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar size="small" className="bg-blue-600 text-white font-semibold shrink-0">
                                  {u.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800 truncate">
                                      {u.name}
                                    </span>
                                    {u.teamName && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0 font-normal">
                                        {u.teamName}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-gray-400 truncate">
                                    {u.designation || u.email}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center">
                                {isPart ? (
                                  <Tag color="green" className="text-[10px] rounded-full mr-0 text-[#075e54] bg-[#dcf8c6] border-emerald-300 font-medium">
                                    Mention
                                  </Tag>
                                ) : canAddAssignee ? (
                                  <Tag color="cyan" className="text-[10px] rounded-full mr-0 text-teal-700 bg-teal-50 border-teal-200 font-medium flex items-center gap-1">
                                    <UserAddOutlined className="text-[9px]" /> Add assignee
                                  </Tag>
                                ) : (
                                  <Tag color="default" className="text-[10px] rounded-full mr-0 text-gray-400">
                                    Not participant
                                  </Tag>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Composer Controls */}
                  <div className="flex items-end gap-2 w-full">
                    {/* Action buttons: Emoji, Attach */}
                    <div className="flex items-center gap-1 mb-1">
                      <Popover 
                        content={
                          <EmojiPicker 
                            onEmojiClick={(e) => {
                              setMessage(prev => prev + e.emoji);
                              focusInput();
                            }} 
                            height={350} 
                            width={300} 
                          />
                        }
                        trigger="click"
                        placement="topLeft"
                      >
                        <Button 
                          type="text" 
                          shape="circle" 
                          icon={<SmileOutlined className="text-gray-500 text-xl" />} 
                          className="flex-shrink-0 w-10 h-10 hover:bg-gray-200" 
                          disabled={isSending} 
                        />
                      </Popover>
                      {/* Hidden Category-specific File Inputs */}
                      <input 
                        type="file" 
                        multiple 
                        ref={imageInputRef} 
                        accept="image/*"
                        onChange={handleAttachmentChange} 
                        className="hidden" 
                      />
                      <input 
                        type="file" 
                        multiple 
                        ref={docInputRef} 
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                        onChange={handleAttachmentChange} 
                        className="hidden" 
                      />
                      <input 
                        type="file" 
                        multiple 
                        ref={audioInputRef} 
                        accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                        onChange={handleAttachmentChange} 
                        className="hidden" 
                      />
                      <input 
                        type="file" 
                        multiple 
                        ref={fileInputRef} 
                        onChange={handleAttachmentChange} 
                        className="hidden" 
                      />
                      <Popover
                        open={attachmentMenuOpen}
                        onOpenChange={setAttachmentMenuOpen}
                        trigger="click"
                        placement="topLeft"
                        content={
                          <div className="flex flex-col gap-1 py-1 w-44">
                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentMenuOpen(false);
                                imageInputRef.current?.click();
                              }}
                              className="flex items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <PictureOutlined className="text-blue-500 text-base" />
                              <span>Photo / Image</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentMenuOpen(false);
                                docInputRef.current?.click();
                              }}
                              className="flex items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <FilePdfOutlined className="text-red-500 text-base" />
                              <span>Document</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentMenuOpen(false);
                                audioInputRef.current?.click();
                              }}
                              className="flex items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <CustomerServiceOutlined className="text-purple-500 text-base" />
                              <span>Audio File</span>
                            </button>
                          </div>
                        }
                      >
                        <Button 
                          type="text" 
                          shape="circle"
                          icon={<PaperClipOutlined className="text-gray-500 text-xl" />} 
                          disabled={isSending || isUploadingAttachments} 
                          title="Attach files" 
                          className="flex-shrink-0 w-10 h-10 hover:bg-gray-200"
                        />
                      </Popover>
                    </div>

                    {/* Auto-growing Textarea Capsule or Active Voice Recording Bar */}
                    <div className="flex-1 bg-white rounded-2xl border border-gray-300 focus-within:border-[#128c7e] shadow-sm px-3.5 py-2 transition-all">
                      {isRecording || isPaused ? (
                        <div className="flex items-center gap-2.5 w-full justify-between py-0.5">
                          {/* Recording/Paused State Indicator & Timer */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                isPaused ? 'bg-amber-500' : 'bg-red-500 animate-ping'
                              }`} 
                            />
                            <span className="font-mono text-sm font-semibold text-gray-800">
                              {formatDuration(recordingDuration)}
                            </span>
                            <span className={`text-xs font-medium truncate ${isPaused ? 'text-amber-600' : 'text-red-500'}`}>
                              {isPaused ? 'Paused' : 'Recording...'}
                            </span>
                          </div>

                          {/* Control Buttons: Pause/Resume and Stop/Cancel */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Pause/Resume Button */}
                            <Button
                              type="text"
                              shape="circle"
                              size="small"
                              icon={
                                isPaused ? (
                                  <PlayCircleOutlined className="text-xl text-emerald-600 hover:text-emerald-700" />
                                ) : (
                                  <PauseCircleOutlined className="text-xl text-amber-500 hover:text-amber-600" />
                                )
                              }
                              onClick={isPaused ? resumeRecording : pauseRecording}
                              title={isPaused ? 'Resume recording' : 'Pause recording'}
                              className="flex items-center justify-center hover:bg-gray-100"
                            />

                            {/* Stop Button: stops recording and transitions to preview */}
                            <Button
                              type="text"
                              shape="circle"
                              size="small"
                              icon={<StopOutlined className="text-lg text-emerald-600 hover:text-emerald-700" />}
                              onClick={stopRecordingToPreview}
                              title="Stop recording"
                              className="flex items-center justify-center hover:bg-emerald-50"
                            />

                            {/* Discard Button: cancels/discards recording without sending */}
                            <Button
                              type="text"
                              shape="circle"
                              size="small"
                              icon={<DeleteOutlined className="text-lg text-red-500 hover:text-red-700" />}
                              onClick={cancelRecording}
                              title="Stop & cancel recording (discard)"
                              className="flex items-center justify-center hover:bg-red-50"
                            />
                          </div>
                        </div>
                      ) : audioBlob ? (
                        <div className="w-full py-0.5">
                          <AudioPreviewPlayer
                            src={audioPreviewUrl!}
                            blob={audioBlob}
                            duration={recordingDuration}
                            onDiscard={cancelRecording}
                            disabled={isSending}
                          />
                        </div>
                      ) : (
                        <textarea
                          ref={textareaRef}
                          rows={1}
                          placeholder="Type a message or @name to mention/assign..."
                          value={message}
                          onChange={(e) => {
                            handleTextChange(e);
                            adjustTextareaHeight();
                          }}
                          onKeyDown={handleKeyDown}
                          disabled={isSending || isAddingAssignee}
                          className="w-full resize-none outline-none text-sm text-gray-800 bg-transparent h-[24px] min-h-[24px] max-h-36 leading-6 placeholder:truncate"
                          style={{ height: '24px', minHeight: '24px' }}
                        />
                      )}
                    </div>

                    {/* Microphone / Send Button (Click mic to record, click same button while recording to send) */}
                    <div className="flex items-center gap-1 mb-1 flex-shrink-0">
                      {isRecording || isPaused ? (
                        <Button 
                          type="primary" 
                          shape="circle" 
                          icon={<SendOutlined />} 
                          className="w-11 h-11 bg-[#00a884] hover:bg-[#008f6f] border-none flex items-center justify-center shadow-md flex-shrink-0 animate-pulse"
                          onClick={stopAndSendRecording} 
                          loading={isSending} 
                          title="Stop recording and send voice message" 
                        />
                      ) : message.trim() || audioBlob || attachments.length > 0 ? (
                        <Button 
                          type="primary" 
                          shape="circle" 
                          icon={<SendOutlined />} 
                          className="w-11 h-11 bg-[#00a884] hover:bg-[#008f6f] border-none flex items-center justify-center shadow-md flex-shrink-0"
                          onClick={handleSendMessage} 
                          loading={isSending || isUploadingAttachments} 
                          title="Send message (Enter)"
                        />
                      ) : (
                        <Button 
                          type="primary" 
                          shape="circle" 
                          icon={<AudioOutlined className="text-xl" />} 
                          className="w-11 h-11 bg-[#00a884] hover:bg-[#008f6f] border-none flex items-center justify-center shadow-md flex-shrink-0"
                          onClick={startRecording} 
                          disabled={isSending || isUploadingAttachments} 
                          title="Record voice message" 
                        />
                      )}
                    </div>
                  </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0 space-y-6 overflow-y-auto">
          <Card title="Details">
            <div className="space-y-4">
              <div>
                <Text type="secondary" className="block mb-1">Description</Text>
                {ticket.description ? (
                  <div>
                    <Paragraph 
                      className={`whitespace-pre-wrap !mb-0 text-sm text-gray-800 ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`}
                    >
                      {ticket.description}
                    </Paragraph>
                    {isLongDescription && (
                      <button
                        type="button"
                        onClick={() => setIsDescriptionExpanded(prev => !prev)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1.5 cursor-pointer inline-flex items-center gap-1 hover:underline"
                      >
                        {isDescriptionExpanded ? (
                          <>View less <UpOutlined className="text-[10px]" /></>
                        ) : (
                          <>View more <DownOutlined className="text-[10px]" /></>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <Text type="secondary" className="text-sm italic">No description provided.</Text>
                )}
              </div>

              <Divider />

              <div>
                <Text type="secondary" className="block mb-1">Status</Text>
                {canEditStatus ? (
                  <Select
                    value={ticket.status}
                    onChange={handleStatusChange}
                    className="w-full"
                    disabled={statusOptions.length <= 1}
                    options={statusOptions}
                  />
                ) : (
                  <Tag>{ticket.status}</Tag>
                )}
              </div>

              <div>
                <Text type="secondary" className="block mb-1">Priority</Text>
                <Tag color={ticket.priority === 'CRITICAL' ? 'red' : ticket.priority === 'URGENT' ? 'volcano' : ticket.priority === 'HIGH' ? 'magenta' : ticket.priority === 'MEDIUM' ? 'orange' : 'default'}>
                  {ticket.priority}
                </Tag>
              </div>

              <div>
                <Text type="secondary" className="block mb-1">Team</Text>
                <Text>{ticket.team?.name || 'N/A'}</Text>
              </div>

              {escalationTiming.isApplicable && (
                <>
                  <Divider />
                  <div
                    data-testid="ticket-details-escalation-section"
                    className="p-3 rounded-lg border border-gray-200 bg-gray-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <ClockCircleOutlined className="text-indigo-600" />
                        Escalation Timer
                      </span>
                      {escalationTiming.extendedMinutes > 0 && (
                        <Tag color="blue" className="!m-0 text-[10px]">
                          +{escalationTiming.extendedMinutes}m extended
                        </Tag>
                      )}
                    </div>

                    <div
                      data-testid="ticket-details-escalation-remaining"
                      className={`text-sm font-semibold ${
                        escalationTiming.isOverdue
                          ? 'text-red-600'
                          : escalationTiming.isPaused
                          ? 'text-slate-700'
                          : escalationTiming.remainingMs <= 30 * 60 * 1000
                          ? 'text-amber-600'
                          : 'text-indigo-700'
                      }`}
                    >
                      {escalationTiming.formattedRemaining}
                    </div>

                    {escalationTiming.deadlineAt && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium text-gray-600">Escalation deadline: </span>
                        <span data-testid="ticket-details-escalation-deadline">
                          {dayjs(escalationTiming.deadlineAt).format('MMM D, YYYY h:mm A')}
                        </span>
                      </div>
                    )}

                    <div className="text-[11px] text-gray-400 leading-snug">
                      Active hours: 10:30 AM – 6:30 PM (excl. Sundays &amp; holidays)
                    </div>

                    {canExtendEscalation && (
                      <Button
                        size="small"
                        type="default"
                        block
                        icon={<ClockCircleOutlined />}
                        data-testid="extend-escalation-btn"
                        onClick={() => {
                          setExtendMinutes(60);
                          setExtendReason('');
                          setIsExtendModalOpen(true);
                        }}
                        className="mt-1 font-medium text-indigo-700 border-indigo-300 bg-indigo-50/60 hover:!bg-indigo-100 hover:!border-indigo-400"
                      >
                        Extend Escalation Time
                      </Button>
                    )}
                  </div>
                </>
              )}

              <Divider />

              <TicketAssigneesSection 
                ticket={ticket} 
                canAddAssignee={canAddAssignee} 
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Extend Escalation Time Modal (Assignee & Assignor only) */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-indigo-600" />
            <span>Extend Escalation Time</span>
          </div>
        }
        open={isExtendModalOpen}
        onCancel={() => !isExtendingEscalation && setIsExtendModalOpen(false)}
        footer={[
          <Button
            key="cancel"
            onClick={() => setIsExtendModalOpen(false)}
            disabled={isExtendingEscalation}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isExtendingEscalation}
            data-testid="confirm-extend-escalation-btn"
            onClick={handleConfirmExtendEscalation}
          >
            Extend Time
          </Button>,
        ]}
        centered
        width={460}
      >
        <div data-testid="extend-escalation-modal" className="py-2 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed mb-0">
            Extend the active working-hour escalation window for this ticket. Escalation calculations
            automatically respect working hours (10:30 AM – 6:30 PM), Sundays, and designated holidays.
          </p>

          <div>
            <Text strong className="block text-xs text-gray-700 mb-2">
              Quick Presets (Active Working Time)
            </Text>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '+30m', value: 30 },
                { label: '+1h', value: 60 },
                { label: '+2h', value: 120 },
                { label: '+4h', value: 240 },
                { label: '+1 Day (8h)', value: 480 },
              ].map((preset) => (
                <Button
                  key={preset.value}
                  size="small"
                  type={extendMinutes === preset.value ? 'primary' : 'default'}
                  data-testid={`extend-preset-${preset.value}`}
                  onClick={() => setExtendMinutes(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Text strong className="block text-xs text-gray-700 mb-1">
              Additional Minutes (1 – 43,200)
            </Text>
            <Input
              type="number"
              min={1}
              max={43200}
              value={extendMinutes}
              data-testid="extend-escalation-minutes-input"
              onChange={(e) => setExtendMinutes(parseInt(e.target.value || '0', 10))}
              suffix="minutes"
            />
          </div>

          <div>
            <Text strong className="block text-xs text-gray-700 mb-1">
              Reason (Optional)
            </Text>
            <Input.TextArea
              rows={2}
              maxLength={300}
              placeholder="e.g. Waiting for vendor confirmation or scheduled maintenance window..."
              value={extendReason}
              data-testid="extend-escalation-reason-input"
              onChange={(e) => setExtendReason(e.target.value)}
            />
          </div>

          {projectedExtensionTiming && projectedExtensionTiming.deadlineAt && (
            <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 text-xs space-y-1">
              <div className="font-semibold text-indigo-900">
                New Projected Escalation Deadline:
              </div>
              <div className="text-indigo-700 font-medium" data-testid="projected-escalation-deadline">
                {dayjs(projectedExtensionTiming.deadlineAt).format('MMM D, YYYY h:mm A')} (
                {projectedExtensionTiming.shortRemaining})
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title="Ticket is Resolved"
        open={showResolvePrompt}
        onCancel={() => setShowResolvePrompt(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowResolvePrompt(false)} disabled={isSending}>
            Cancel
          </Button>,
          <Button 
            key="reopen" 
            loading={isSending}
            onClick={async () => {
              if (!id || isSending) return;
              setIsSending(true);
              try {
                await addMessage(id, message, 'REOPENED', replyingTo?.id);
                setMessage('');
                setReplyingTo(null);
                setShowResolvePrompt(false);
              } finally {
                setIsSending(false);
              }
            }}
          >
            Reopen Ticket
          </Button>,
          <Button 
            key="close" 
            type="primary" 
            loading={isSending}
            onClick={async () => {
              if (!id || isSending) return;
              setIsSending(true);
              try {
                await addMessage(id, message, 'CLOSED', replyingTo?.id);
                setMessage('');
                setReplyingTo(null);
                setShowResolvePrompt(false);
              } finally {
                setIsSending(false);
              }
            }}
          >
            Close Permanently
          </Button>,
        ]}
      >
        <p>This ticket is currently marked as Resolved. How would you like to proceed with your message?</p>
      </Modal>

      <Modal
        title={previewFile?.name || 'File Preview'}
        open={!!previewFile}
        onCancel={() => setPreviewFile(null)}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} href={previewFile?.url} target="_blank" download>
            Download
          </Button>,
          <Button key="close" onClick={() => setPreviewFile(null)}>Close</Button>
        ]}
        width={800}
        centered
        styles={{ body: { padding: 0, height: '70vh' } }}
      >
        {previewFile?.type.startsWith('image/') ? (
          <div className="w-full h-full flex items-center justify-center bg-black/90 p-4">
            <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain" />
          </div>
        ) : previewFile?.type.startsWith('video/') ? (
          <video src={previewFile.url} controls autoPlay className="w-full h-full bg-black object-contain" />
        ) : previewFile?.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm)$/i.test(previewFile?.name || '') ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-6">
            <CustomerServiceOutlined className="text-6xl text-purple-500 mb-4" />
            <p className="text-gray-800 font-semibold text-lg mb-4">{previewFile?.name}</p>
            <audio controls src={previewFile?.url} className="w-80" autoPlay />
          </div>
        ) : previewFile?.type === 'application/pdf' || previewFile?.name.toLowerCase().endsWith('.pdf') ? (
          <div className="w-full h-full flex flex-col">
            {previewFile.url.includes('cloudinary.com') && (
              <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 border-b text-xs text-gray-600">
                <span className="font-medium">PDF Preview</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="small"
                    type={pdfViewMode === 'document' ? 'primary' : 'default'}
                    onClick={() => setPdfViewMode('document')}
                    className="text-xs h-6 px-2"
                  >
                    Full Document (PDF)
                  </Button>
                  <Button
                    size="small"
                    type={pdfViewMode === 'image' ? 'primary' : 'default'}
                    onClick={() => setPdfViewMode('image')}
                    className="text-xs h-6 px-2"
                  >
                    Image View (Page 1)
                  </Button>
                </div>
              </div>
            )}
            {pdfViewMode === 'image' && previewFile.url.includes('cloudinary.com') ? (
              <div className="w-full flex-1 flex items-center justify-center bg-gray-900 p-4 overflow-auto">
                <img
                  src={previewFile.url.replace(/\.pdf(\?.*)?$/i, '.jpg$1')}
                  alt={previewFile.name}
                  className="max-w-full max-h-full object-contain shadow-lg rounded"
                />
              </div>
            ) : (
              <iframe src={previewFile?.url} className="w-full flex-1 border-none" title={previewFile?.name} />
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <FileOutlined className="text-6xl text-blue-500 mb-4" />
            <h4 className="text-lg font-semibold text-gray-800 mb-1">{previewFile?.name}</h4>
            <p className="text-sm text-gray-500 mb-6">Preview is not available directly for this document format.</p>
            <Button type="primary" size="large" icon={<DownloadOutlined />} href={previewFile?.url} target="_blank" download>
              Download to view
            </Button>
          </div>
        )}
      </Modal>

      {/* Delete Message Confirmation Modal */}
      <Modal
        open={!!deletingMessage}
        onCancel={() => !isDeleting && setDeletingMessage(null)}
        footer={null}
        title="Delete Message?"
        centered
        width={400}
      >
        <div className="py-2 flex flex-col gap-4">
          <p className="text-gray-600 text-sm mb-1">
            Are you sure you want to delete this message? You can delete it for yourself or for everyone in this conversation.
          </p>

          <div className="flex flex-col gap-2.5">
            <Button
              danger
              type="primary"
              block
              loading={isDeleting}
              onClick={() => handleConfirmDelete('everyone')}
              className="font-medium"
            >
              Delete for Everyone
            </Button>
            <div className="text-[11px] text-gray-500 text-center -mt-1 mb-1">
              Removes the message for all participants in this ticket.
            </div>

            <Button
              block
              loading={isDeleting}
              onClick={() => handleConfirmDelete('me')}
              className="font-medium"
            >
              Delete for Me
            </Button>
            <div className="text-[11px] text-gray-500 text-center -mt-1 mb-1">
              Removes the message from your view only.
            </div>

            <Button
              type="text"
              block
              disabled={isDeleting}
              onClick={() => setDeletingMessage(null)}
              className="mt-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Drawer
        title="Ticket Details"
        placement="bottom"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        height="85vh"
        styles={{ body: { paddingBottom: 80 } }}
      >
        <div className="space-y-6">
          <div>
            <Title level={5}>Description</Title>
            {ticket.description ? (
              <div>
                <Paragraph 
                  className={`whitespace-pre-wrap !mb-0 text-sm text-gray-800 ${!isDescriptionExpanded ? 'line-clamp-3' : ''}`}
                >
                  {ticket.description}
                </Paragraph>
                {isLongDescription && (
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded(prev => !prev)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium mt-1.5 cursor-pointer inline-flex items-center gap-1 hover:underline"
                  >
                    {isDescriptionExpanded ? (
                      <>View less <UpOutlined className="text-[10px]" /></>
                    ) : (
                      <>View more <DownOutlined className="text-[10px]" /></>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <Paragraph className="whitespace-pre-wrap text-gray-400 italic">No description provided.</Paragraph>
            )}
          </div>
          <Divider />
          <div className="space-y-4">
            <div>
              <Text type="secondary" className="block mb-1">Status</Text>
              {canEditStatus ? (
                <Select
                  value={ticket.status}
                  onChange={handleStatusChange}
                  className="w-full"
                  disabled={statusOptions.length <= 1}
                  options={statusOptions}
                />
              ) : (
                <Tag>{ticket.status}</Tag>
              )}
            </div>

            <div>
              <Text type="secondary" className="block mb-1">Priority</Text>
              <Tag color={ticket.priority === 'CRITICAL' ? 'red' : ticket.priority === 'URGENT' ? 'volcano' : ticket.priority === 'HIGH' ? 'magenta' : ticket.priority === 'MEDIUM' ? 'orange' : 'default'}>
                {ticket.priority}
              </Tag>
            </div>

            <div>
              <Text type="secondary" className="block mb-1">Team</Text>
              <Text>{ticket.team?.name || 'N/A'}</Text>
            </div>

            {escalationTiming.isApplicable && (
              <>
                <Divider />
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <ClockCircleOutlined className="text-indigo-600" />
                      Escalation Timer
                    </span>
                    {escalationTiming.extendedMinutes > 0 && (
                      <Tag color="blue" className="!m-0 text-[10px]">
                        +{escalationTiming.extendedMinutes}m extended
                      </Tag>
                    )}
                  </div>

                  <div
                    className={`text-sm font-semibold ${
                      escalationTiming.isOverdue
                        ? 'text-red-600'
                        : escalationTiming.isPaused
                        ? 'text-slate-700'
                        : escalationTiming.remainingMs <= 30 * 60 * 1000
                        ? 'text-amber-600'
                        : 'text-indigo-700'
                    }`}
                  >
                    {escalationTiming.formattedRemaining}
                  </div>

                  {escalationTiming.deadlineAt && (
                    <div className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">Escalation deadline: </span>
                      <span>{dayjs(escalationTiming.deadlineAt).format('MMM D, YYYY h:mm A')}</span>
                    </div>
                  )}

                  {canExtendEscalation && (
                    <Button
                      size="small"
                      type="default"
                      block
                      icon={<ClockCircleOutlined />}
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        setExtendMinutes(60);
                        setExtendReason('');
                        setIsExtendModalOpen(true);
                      }}
                      className="mt-1 font-medium text-indigo-700 border-indigo-300 bg-indigo-50/60"
                    >
                      Extend Escalation Time
                    </Button>
                  )}
                </div>
              </>
            )}

            <Divider />

            <TicketAssigneesSection 
              ticket={ticket} 
              canAddAssignee={canAddAssignee} 
            />
          </div>
        </div>
      </Drawer>

      <MessageReactionDetailsModal
        open={reactionDetailsModal.open}
        onClose={() =>
          setReactionDetailsModal({
            open: false,
            messageId: null,
            initialEmoji: null,
            fetchedReactions: [],
            loading: false,
          })
        }
        messageId={reactionDetailsModal.messageId}
        ticketId={id || ''}
        initialEmoji={reactionDetailsModal.initialEmoji}
        reactions={activeModalReactions}
        currentUserId={authUserId}
        onToggleReaction={(emoji) => {
          if (id && reactionDetailsModal.messageId) {
            toggleReaction(id, reactionDetailsModal.messageId, emoji);
          }
        }}
        loading={reactionDetailsModal.loading}
      />
    </PageContainer>
  );
};
