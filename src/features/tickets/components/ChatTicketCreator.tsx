import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Avatar, Tag, Popover, Image, Modal, Progress, message } from 'antd';
import { 
  ArrowLeftOutlined, 
  SendOutlined, 
  AudioOutlined, 
  PaperClipOutlined, 
  SmileOutlined, 
  CloseOutlined, 
  PauseCircleOutlined, 
  PlayCircleOutlined, 
  StopOutlined, 
  DeleteOutlined, 
  FileOutlined, 
  UndoOutlined, 
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import EmojiPicker from 'emoji-picker-react';
import { ticketService, type MentionUser } from '../api/ticket.service';
import { useTicketStore } from '../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { teamService } from '@/features/teams/api/team.service';

const DRAFT_STORAGE_KEY = 'ticket_composer_draft_v1';
const ENTER_CONFIRM_KEY = 'ticket_enter_confirm_count';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const ChatTicketCreator: React.FC = () => {
  const navigate = useNavigate();
  const { createTicket } = useTicketStore();
  const { user: authUser } = useAuthStore();

  // Content state
  const [content, setContent] = useState('');
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Mention dropdown autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
  const [highlightedMentionIndex, setHighlightedMentionIndex] = useState(0);

  // Undo countdown buffer state
  const [isUndoPending, setIsUndoPending] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(10);
  const undoTimerRef = useRef<any>(null);
  const pendingPayloadRef = useRef<any>(null);

  // Enter confirmation onboarding state
  const [showEnterModal, setShowEnterModal] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load mentionable users and teams on mount
  useEffect(() => {
    ticketService.getUsersMentionLookup()
      .then(res => setMentionUsers(res || []))
      .catch(console.error);

    teamService.getTeams({ page: 1, limit: 100 })
      .then(res => setTeams(res.data || []))
      .catch(console.error);
  }, []);

  // Restore draft from localStorage (if < 24 hours old)
  useEffect(() => {
    try {
      const savedDraftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraftRaw) {
        const parsed = JSON.parse(savedDraftRaw);
        if (Date.now() - parsed.timestamp < DRAFT_MAX_AGE_MS) {
          setContent(parsed.content || '');
          if (parsed.selectedTeamId) setSelectedTeamId(parsed.selectedTeamId);
          message.info('Restored your previous draft (expires in 24h)');
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to restore draft', e);
    }
  }, []);

  // Persist draft to localStorage on content change
  useEffect(() => {
    if (isUndoPending) return; // Do not overwrite while in undo buffer
    if (!content.trim() && !audioBlob && attachments.length === 0) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          content,
          selectedTeamId,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error('Failed to save draft', e);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [content, selectedTeamId, audioBlob, attachments.length, isUndoPending]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [audioPreviewUrl]);

  // Extract tagged users from content: matches any @Name in mentionUsers
  const taggedAssignees = useMemo(() => {
    if (!content && !mentionUsers.length) return [];
    return mentionUsers.filter(u => content.includes(`@${u.name}`));
  }, [content, mentionUsers]);

  // Inferred team from first tagged assignee
  const inferredTeam = useMemo(() => {
    if (selectedTeamId) {
      return teams.find(t => t.id === selectedTeamId) || null;
    }
    if (taggedAssignees.length > 0 && taggedAssignees[0].teamId) {
      return teams.find(t => t.id === taggedAssignees[0].teamId) || { id: taggedAssignees[0].teamId, name: taggedAssignees[0].teamName };
    }
    return null;
  }, [selectedTeamId, taggedAssignees, teams]);

  // Parse Title and Description in real-time
  const parsedTicket = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      if (audioBlob) {
        const creatorName = (authUser as any)?.name || 'User';
        const assigneeNames = taggedAssignees.map(a => a.name).join(', ') || 'Assignee';
        return {
          title: `Ticket by ${creatorName} to ${assigneeNames}`,
          description: '',
          isVoiceFirst: true
        };
      }
      return { title: '', description: '', isVoiceFirst: false };
    }

    // Option A: First line up to \n, trimmed to max 120 characters
    const firstNewlineIndex = trimmed.indexOf('\n');
    let title = '';
    let description = '';

    if (firstNewlineIndex !== -1) {
      title = trimmed.slice(0, firstNewlineIndex).trim();
      description = trimmed.slice(firstNewlineIndex + 1).trim();
    } else {
      title = trimmed;
      description = '';
    }

    if (title.length > 120) {
      title = title.slice(0, 117) + '...';
    }

    return { title, description, isVoiceFirst: false };
  }, [content, audioBlob, authUser, taggedAssignees]);

  // Filter mentions for autocomplete popup
  const filteredMentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionUsers.filter(u => 
      u.name.toLowerCase().includes(q) || 
      (u.teamName && u.teamName.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [mentionQuery, mentionUsers]);

  // Handle typing & detecting @ trigger
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([\w\s]*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionDropdownOpen(true);
      setHighlightedMentionIndex(0);
    } else {
      setMentionDropdownOpen(false);
      setMentionQuery(null);
    }
  };

  // Insert selected mention into textarea
  const insertMention = (selectedUser: MentionUser) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const newText = textBeforeCursor.slice(0, atIndex) + `@${selectedUser.name} ` + textAfterCursor;
      setContent(newText);
      setMentionDropdownOpen(false);
      setMentionQuery(null);

      // Auto set team if not set
      if (!selectedTeamId && selectedUser.teamId) {
        setSelectedTeamId(selectedUser.teamId);
      }

      setTimeout(() => {
        textarea.focus();
        const newPos = atIndex + selectedUser.name.length + 2;
        textarea.setSelectionRange(newPos, newPos);
      }, 50);
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      message.error('Microphone access denied or unavailable');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(recordTimerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(recordTimerRef.current);
    setAudioBlob(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Attachment handling
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Trigger Send action with Validation & Onboarding Check
  const triggerSend = () => {
    if (isRecording || isPaused) {
      message.warning('Please stop audio recording before sending');
      return;
    }

    if (!content.trim() && !audioBlob && attachments.length === 0) {
      message.warning('Please type a message, record voice, or attach a file');
      return;
    }

    // MANDATORY RULE: Must mention at least 1 assignee
    if (taggedAssignees.length === 0) {
      message.error('Rule: You must tag at least one assignee using @ to create a ticket');
      textareaRef.current?.focus();
      return;
    }

    // Check first-time enter confirmation onboarding (alert 2-3 times)
    const confirmCount = parseInt(localStorage.getItem(ENTER_CONFIRM_KEY) || '0', 10);
    if (confirmCount < 3) {
      setShowEnterModal(true);
      return;
    }

    startUndoBuffer();
  };

  // Start 10-Second Undo Buffer
  const startUndoBuffer = () => {
    setShowEnterModal(false);
    setIsUndoPending(true);
    setUndoCountdown(10);

    // Save pending payload
    pendingPayloadRef.current = {
      title: parsedTicket.title,
      description: parsedTicket.description,
      teamId: inferredTeam?.id,
      assignees: taggedAssignees.map(a => a.id),
      rawText: content.trim(),
      audioBlob,
      attachments: [...attachments],
    };

    // Countdown interval
    undoTimerRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(undoTimerRef.current);
          finalizeTicketCreation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Undo button action
  const cancelUndoBuffer = () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setIsUndoPending(false);
    setUndoCountdown(10);
    message.info('Sending cancelled. Your message has been preserved.');
    textareaRef.current?.focus();
  };

  // Finalize Ticket Creation (after 10s or when "Send Now" clicked)
  const finalizeTicketCreation = async () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setIsUndoPending(false);
    setIsUploading(true);

    const payloadData = pendingPayloadRef.current;
    if (!payloadData) return;

    try {
      let audioUrl: string | undefined = undefined;
      if (payloadData.audioBlob) {
        const audioRes = await ticketService.uploadAudio(payloadData.audioBlob);
        audioUrl = audioRes.url;
      }

      let uploadedAttachments: any[] = [];
      if (payloadData.attachments && payloadData.attachments.length > 0) {
        uploadedAttachments = await Promise.all(
          payloadData.attachments.map((file: File) => ticketService.uploadAttachment(file))
        );
      }

      const firstMessage = (payloadData.rawText || audioUrl || (uploadedAttachments && uploadedAttachments.length > 0)) ? {
        content: payloadData.rawText || '',
        audioUrl,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      } : undefined;

      const createdTicket = await createTicket({
        title: payloadData.title,
        description: payloadData.description,
        teamId: payloadData.teamId,
        assignees: payloadData.assignees,
        firstMessage,
      });

      // Clear draft
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      message.success('Ticket created successfully!');
      navigate(`/tickets/${createdTicket.id}`);
    } catch (err: any) {
      console.error('Creation failed', err);
      message.error(err.response?.data?.message || err.message || 'Failed to create ticket');
      setIsUploading(false);
    }
  };

  // Keyboard Navigation & Enter key handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If mention autocomplete is open, handle arrow keys and enter for selecting user
    if (mentionDropdownOpen && filteredMentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedMentionIndex(prev => (prev + 1) % filteredMentionOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedMentionIndex(prev => (prev - 1 + filteredMentionOptions.length) % filteredMentionOptions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentionOptions[highlightedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionDropdownOpen(false);
        return;
      }
    }

    // Enter to Send, Shift + Enter for New Line
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Normal newline
        return;
      }
      e.preventDefault();
      triggerSend();
    }
  };

  // Confirm onboarding modal action
  const handleConfirmOnboardingSend = () => {
    const confirmCount = parseInt(localStorage.getItem(ENTER_CONFIRM_KEY) || '0', 10);
    localStorage.setItem(ENTER_CONFIRM_KEY, (confirmCount + 1).toString());
    startUndoBuffer();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-5xl mx-auto bg-[#efeae2] border border-gray-300 rounded-xl overflow-hidden shadow-lg relative">
      
      {/* 1. Header Bar */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined className="text-lg text-gray-600" />} 
            onClick={() => navigate('/tickets')} 
            className="hover:bg-gray-100"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800 text-base">New Ticket</span>
              {inferredTeam ? (
                <Tag color="blue" className="font-medium rounded-full px-2.5 py-0.5">
                  <TeamOutlined className="mr-1" /> {inferredTeam.name}
                </Tag>
              ) : (
                <Tag color="orange" className="rounded-full px-2">Select or Tag Team</Tag>
              )}
            </div>
            <p className="text-xs text-gray-500 hidden sm:block">
              Tag assignees with <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-semibold">@name</code> to route automatically
            </p>
          </div>
        </div>

        {/* Action badges & Assignee chips */}
        <div className="flex items-center gap-2">
          {taggedAssignees.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-xs">
              {taggedAssignees.map(a => (
                <Tag 
                  key={a.id} 
                  color="cyan" 
                  className="rounded-full flex items-center gap-1 px-2 py-0.5 text-xs font-semibold"
                >
                  <Avatar size={16} className="bg-blue-500 text-[10px]">{a.name[0]}</Avatar>
                  {a.name}
                </Tag>
              ))}
            </div>
          )}

          {content.trim() && (
            <Button 
              size="small" 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => {
                setContent('');
                localStorage.removeItem(DRAFT_STORAGE_KEY);
                message.info('Draft cleared');
              }}
              title="Clear draft"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* 2. Real-time Live Preview Canvas */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-end space-y-4">
        
        {/* Structure helper card */}
        {!content.trim() && !audioBlob && attachments.length === 0 && (
          <div className="bg-white/85 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-black/5 max-w-md mx-auto text-center space-y-2 my-auto">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-lg">
              <ThunderboltOutlined />
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">Quick Ticket Creation</h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Start typing like in WhatsApp. The <strong>first line</strong> becomes the ticket title.
              Mention <span className="text-blue-600 font-medium">@assignee</span> to route it to their team.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-2 text-left font-mono text-xs text-gray-600">
              <span className="text-blue-600 font-semibold block">Payment API 500 error on staging</span>
              <span className="text-gray-500 block">Users cannot checkout with Stripe.</span>
              <span className="text-purple-600 font-semibold block">@DevOps Lead</span>
            </div>
          </div>
        )}

        {/* Live parsed message bubble */}
        {(parsedTicket.title || audioBlob || attachments.length > 0) && (
          <div className="flex justify-end">
            <div className="bg-[#d9fdd3] text-gray-800 rounded-2xl rounded-tr-none p-3 shadow-md max-w-[85%] sm:max-w-[75%] border border-emerald-200 space-y-2 animate-fadeIn">
              
              {/* Title highlight badge */}
              <div className="border-b border-emerald-300/60 pb-1.5 mb-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircleOutlined /> Ticket Title
                  </span>
                  {inferredTeam && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-medium">
                      {inferredTeam.name}
                    </span>
                  )}
                </div>
                <div className="font-bold text-base text-emerald-950 mt-0.5 leading-snug">
                  {parsedTicket.title || 'Untitled Ticket'}
                </div>
              </div>

              {/* Description body */}
              {parsedTicket.description && (
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {parsedTicket.description}
                </div>
              )}

              {/* Audio preview */}
              {audioPreviewUrl && (
                <div className="bg-white/70 p-2 rounded-lg border border-emerald-300 flex items-center gap-2 mt-2">
                  <audio controls src={audioPreviewUrl} className="h-8 max-w-[240px]" />
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={cancelRecording} />
                </div>
              )}

              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/80 border border-emerald-300 rounded px-2 py-1 text-xs">
                      {file.type.startsWith('image/') ? (
                        <Image src={URL.createObjectURL(file)} width={24} height={24} className="rounded object-cover" />
                      ) : (
                        <FileOutlined className="text-gray-500" />
                      )}
                      <span className="truncate max-w-[100px] font-medium">{file.name}</span>
                      <CloseOutlined className="cursor-pointer text-gray-400 hover:text-red-500 text-[10px]" onClick={() => removeAttachment(i)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Timestamp and status */}
              <div className="flex justify-end items-center gap-1 text-[10px] text-emerald-700 pt-1">
                <span>Draft Preview</span>
                <span>•</span>
                <span>Ready to create</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Autocomplete Mention Dropdown */}
      {mentionDropdownOpen && filteredMentionOptions.length > 0 && (
        <div 
          className="absolute bottom-20 left-4 right-4 sm:left-12 sm:right-auto sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 z-50 animate-fadeIn"
        >
          <div className="px-3 py-1.5 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Mention Assignee (Enter to pick)
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filteredMentionOptions.map((user, idx) => (
              <div
                key={user.id}
                onClick={() => insertMention(user)}
                onMouseEnter={() => setHighlightedMentionIndex(idx)}
                className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  idx === highlightedMentionIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Avatar size="small" className="bg-blue-500 text-white shrink-0">
                    {user.name[0]}
                  </Avatar>
                  <div className="overflow-hidden">
                    <div className="text-sm font-semibold text-gray-800 truncate">{user.name}</div>
                    <div className="text-[11px] text-gray-500 truncate">{user.designation || user.email}</div>
                  </div>
                </div>
                <Tag color="geekblue" className="text-[10px] rounded-full shrink-0">
                  {user.teamName || 'Team'}
                </Tag>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Active Undo Banner (10s buffer) */}
      {isUndoPending && (
        <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between gap-4 z-30 shadow-2xl border-t border-gray-800 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <Progress 
                type="circle" 
                percent={(undoCountdown / 10) * 100} 
                size={32} 
                strokeColor="#10b981" 
                format={() => <span className="text-xs text-white font-bold">{undoCountdown}</span>} 
              />
            </div>
            <div>
              <div className="font-semibold text-sm">Creating Ticket in {undoCountdown}s...</div>
              <div className="text-xs text-gray-400">Targeting {inferredTeam?.name || 'Assigned Team'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              type="primary" 
              danger 
              icon={<UndoOutlined />} 
              onClick={cancelUndoBuffer}
              className="font-semibold"
            >
              Undo (Cancel)
            </Button>
            <Button 
              type="primary" 
              onClick={finalizeTicketCreation}
              className="bg-emerald-600 hover:bg-emerald-500 border-none font-semibold"
            >
              Send Now
            </Button>
          </div>
        </div>
      )}

      {/* 5. Input Composer Bar */}
      {!isUndoPending && (
        <div className="bg-[#f0f2f5] p-3 border-t border-gray-300 z-20 flex flex-col gap-2">
          
          {/* Active Audio Recording Bar */}
          {(isRecording || isPaused) && (
            <div className="flex items-center justify-between bg-red-50 text-red-600 px-4 py-2 rounded-xl border border-red-200">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full bg-red-500 ${isRecording ? 'animate-ping' : ''}`} />
                <span className="font-mono font-bold text-sm">{formatDuration(recordingDuration)}</span>
                <span className="text-xs text-red-500">Recording Voice Note</span>
              </div>
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <Button type="text" shape="circle" icon={<PlayCircleOutlined className="text-xl text-green-600" />} onClick={resumeRecording} />
                ) : (
                  <Button type="text" shape="circle" icon={<PauseCircleOutlined className="text-xl text-orange-500" />} onClick={pauseRecording} />
                )}
                <Button type="text" shape="circle" icon={<StopOutlined className="text-xl text-red-600" />} onClick={stopRecording} />
                <Button type="text" shape="circle" icon={<DeleteOutlined className="text-lg text-gray-400 hover:text-red-500" />} onClick={cancelRecording} />
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
                    onEmojiClick={(e) => setContent(prev => prev + e.emoji)} 
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
                  className="w-10 h-10 hover:bg-gray-200" 
                  disabled={isUploading}
                />
              </Popover>

              <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                onChange={handleAttachmentChange} 
                className="hidden" 
              />
              <Button 
                type="text" 
                shape="circle" 
                icon={<PaperClipOutlined className="text-gray-500 text-xl" />} 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                title="Attach files"
                className="w-10 h-10 hover:bg-gray-200"
              />
            </div>

            {/* Auto-growing Textarea */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-300 focus-within:border-[#128c7e] shadow-sm px-3.5 py-2 transition-all">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Type title on line 1, description below, @name to assign..."
                value={content}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                disabled={isUploading || isRecording || isPaused}
                className="w-full resize-none outline-none text-sm text-gray-800 bg-transparent max-h-36 overflow-y-auto leading-relaxed"
                style={{ minHeight: '38px' }}
              />
            </div>

            {/* Audio Record & Send Buttons */}
            <div className="flex items-center gap-1 mb-1">
              {content.trim() || audioBlob || attachments.length > 0 ? (
                <Button 
                  type="primary" 
                  shape="circle" 
                  icon={<SendOutlined />} 
                  onClick={triggerSend}
                  loading={isUploading}
                  className={`w-11 h-11 border-none flex items-center justify-center shadow-md ${
                    taggedAssignees.length > 0 ? 'bg-[#00a884] hover:bg-[#008f6f]' : 'bg-gray-400 cursor-not-allowed'
                  }`}
                  title={taggedAssignees.length === 0 ? 'Tag at least one assignee with @' : 'Send Ticket (Enter)'}
                />
              ) : (
                <Button 
                  type="primary" 
                  shape="circle" 
                  icon={<AudioOutlined className="text-xl" />} 
                  onClick={startRecording}
                  disabled={isUploading || isRecording || isPaused}
                  className="w-11 h-11 bg-[#00a884] hover:bg-[#008f6f] border-none flex items-center justify-center shadow-md"
                  title="Record Voice Note"
                />
              )}
            </div>
          </div>

          {/* Footer Helper Text */}
          <div className="flex justify-between items-center px-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <InfoCircleOutlined /> Press <strong>Enter</strong> to send • <strong>Shift + Enter</strong> for new line
            </span>
            {taggedAssignees.length === 0 ? (
              <span className="text-red-500 font-medium">⚠️ Tag at least 1 assignee with @</span>
            ) : (
              <span className="text-emerald-700 font-medium">✓ Ready to send</span>
            )}
          </div>
        </div>
      )}

      {/* 6. First-Time Enter Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-600">
            <ExclamationCircleOutlined /> Create Ticket Now?
          </div>
        }
        open={showEnterModal}
        onCancel={() => setShowEnterModal(false)}
        footer={[
          <Button key="back" onClick={() => setShowEnterModal(false)}>
            Keep Editing (Shift+Enter for new line)
          </Button>,
          <Button key="submit" type="primary" onClick={handleConfirmOnboardingSend} className="bg-emerald-600">
            Send Ticket Now
          </Button>,
        ]}
      >
        <div className="space-y-3 py-2 text-sm text-gray-700">
          <p>
            You pressed <strong>Enter</strong> to create this ticket.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800 space-y-1">
            <div>• <strong>Enter:</strong> Creates the ticket immediately.</div>
            <div>• <strong>Shift + Enter:</strong> Inserts a new line for multi-line descriptions.</div>
          </div>
          <p className="text-xs text-gray-500">
            (We will only show this reminder the first 2-3 times to help you get used to the shortcuts!)
          </p>
        </div>
      </Modal>

    </div>
  );
};
