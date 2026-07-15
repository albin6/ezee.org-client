import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Space, Divider, Typography, Avatar, Select, Modal, Popover, Image, Drawer } from 'antd';
import { UserOutlined, SendOutlined, MoreOutlined, ReloadOutlined, SmileOutlined, CloseOutlined, EnterOutlined, AudioOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined, PaperClipOutlined, FileOutlined, DownloadOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { useTicketStore } from '../store/ticket.store';
import { ticketService } from '../api/ticket.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { VoiceMessagePlayer } from '../components/VoiceMessagePlayer';
import EmojiPicker from 'emoji-picker-react';

const { Title, Text, Paragraph } = Typography;

export const TicketDetailsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTicket: ticket, loading, fetchTicket, addMessage, updateStatus, joinTicketRoom, leaveTicketRoom, toggleReaction } = useTicketStore();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const [message, setMessage] = useState('');
  const [showResolvePrompt, setShowResolvePrompt] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string, name: string, content: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string, type: string } | null>(null);
  
  // Scroll State
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [openReactionPopoverId, setOpenReactionPopoverId] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!message.trim() && !audioBlob && attachments.length === 0) || !id || isSending || isUploadingAttachments) return;
    
    const authUser: any = user;
    const authUserId = authUser?.id || authUser?.sub;
    const isCreator = ticket?.createdBy?.id === authUserId;
    const isAdmin = authUser?.role?.name === 'Super Admin' || authUser?.type === 'super_admin';

    if (ticket?.status === 'RESOLVED' && (isCreator || isAdmin)) {
      setShowResolvePrompt(true);
      return;
    }

    setIsSending(true);
    try {
      let finalAudioUrl = undefined;
      let finalAttachments: any[] = [];
      
      if (attachments.length > 0) {
        setIsUploadingAttachments(true);
        const uploadPromises = attachments.map(file => ticketService.uploadAttachment(file));
        finalAttachments = await Promise.all(uploadPromises);
        setIsUploadingAttachments(false);
      }

      if (audioBlob) {
        const { url } = await ticketService.uploadAudio(audioBlob);
        finalAudioUrl = url;
      }
      const finalMessage = message.trim() || (attachments.length > 0 ? '📁 Sent attachments' : '🎤 Voice Message');
      await addMessage(id, finalMessage, undefined, replyingTo?.id, finalAudioUrl, finalAttachments);
      setMessage('');
      setReplyingTo(null);
      setAttachments([]);
      cancelRecording();
    } catch (err) {
      console.error('Failed to send message:', err);
      setIsUploadingAttachments(false);
    } finally {
      setIsSending(false);
    }
  };

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
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
    } catch (err) {
      console.error('Error accessing microphone:', err);
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

  const stopRecording = () => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
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
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleStatusChange = async (value: string) => {
    if (!id) return;
    Modal.confirm({
      title: 'Confirm Status Change',
      content: `Are you sure you want to change the ticket status to ${value}?`,
      okText: 'Yes',
      cancelText: 'No',
      onOk: async () => {
        try {
          await updateStatus(id, value, ticket?.version);
        } catch (err: any) {
          Modal.error({ title: 'Error', content: err.message || 'Failed to update status' });
        }
      }
    });
  };

  if (loading && !ticket) return <PageContainer className="!px-0 sm:!px-4 lg:!px-6 !max-w-full lg:!max-w-7xl">Loading...</PageContainer>;
  if (!ticket) return <PageContainer>Ticket not found</PageContainer>;

  const authUser: any = user;
  const authUserId = authUser?.id || authUser?.sub;
  const isAssignee = ticket.assignees?.some((a: any) => a.user.id === authUserId);
  const isCreator = ticket.createdBy?.id === authUserId;
  const isAdmin = authUser?.role?.name === 'Super Admin' || authUser?.type === 'super_admin';

  const canEditStatus = isAssignee || isAdmin || isCreator;

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

    if (ticket.status === 'OPEN' && isAssignee) return [{ value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In Progress' }];
    if (ticket.status === 'REOPENED' && isAssignee) return [{ value: 'REOPENED', label: 'Reopened' }, { value: 'IN_PROGRESS', label: 'In Progress' }];
    if (ticket.status === 'IN_PROGRESS' && isAssignee) return [{ value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'RESOLVED', label: 'Resolved' }];
    if (ticket.status === 'RESOLVED' && isCreator) return [{ value: 'RESOLVED', label: 'Resolved' }, { value: 'CLOSED', label: 'Closed' }, { value: 'REOPENED', label: 'Reopened' }];
    
    return [{ value: ticket.status, label: ticket.status }];
  };

  const statusOptions = getStatusOptions();

  return (
    <PageContainer>
      <div className="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Title level={3} className="!mb-1">{ticket.title}</Title>
          <Space>
            <Text type="secondary">Created by {ticket.createdBy?.name}</Text>
            <Text type="secondary">•</Text>
            <Text type="secondary">{new Date(ticket.createdAt).toLocaleString()}</Text>
          </Space>
        </div>
        <Button onClick={() => navigate('/tickets')}>Back to Tickets</Button>
      </div>

      {ticket.status === 'RESOLVED' && (isCreator || isAdmin) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 h-auto lg:h-[calc(100vh-140px)] -mx-4 sm:mx-0 lg:mx-0 mt-[-24px] lg:mt-0">
        <div className="flex-1 flex flex-col space-y-6 min-w-0 h-full">
          <div className="hidden lg:block">
            <Card>
              <Title level={5}>Description</Title>
              <Paragraph className="whitespace-pre-wrap">{ticket.description || 'No description provided.'}</Paragraph>
            </Card>
          </div>

          <div className="flex flex-col flex-1 border-0 lg:border border-gray-200 rounded-none lg:rounded-lg bg-white overflow-hidden shadow-none lg:shadow-sm fixed inset-0 top-[64px] z-40 lg:static lg:z-auto lg:h-full">
            <div className="flex justify-between items-center px-4 py-3 border-b bg-white z-10 flex-shrink-0 shadow-sm sticky top-0">
              <div className="flex items-center gap-2">
                <Button 
                  type="text" 
                  icon={<span className="text-xl">←</span>} 
                  className="lg:hidden p-0 w-8 h-8 flex items-center justify-center -ml-2"
                  onClick={() => navigate('/tickets')}
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
                <Button
                  className="lg:hidden"
                  type="text"
                  icon={<MoreOutlined className="text-lg" />}
                  onClick={() => setMobileDrawerOpen(true)}
                />
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
                          {msg.content} by {msg.user.name} • {new Date(msg.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  }

                  const isMe = msg.user.id === authUserId;
                  const groupedReactions = msg.reactions?.reduce((acc: any, curr: any) => {
                    if (!acc[curr.reaction]) acc[curr.reaction] = [];
                    acc[curr.reaction].push(curr);
                    return acc;
                  }, {});

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
                              <span className="opacity-80 text-gray-600 truncate">{msg.replyTo.content.substring(0, 60)}{msg.replyTo.content.length > 60 ? '...' : ''}</span>
                            </div>
                          )}

                          <div className="flex flex-col">
                            <span className="whitespace-pre-wrap break-words text-[15px] leading-snug">{msg.content}</span>
                            {msg.audioUrl && (
                              <div className="mt-2 mb-1 w-full sm:max-w-[320px]">
                                <VoiceMessagePlayer src={msg.audioUrl} isMe={isMe} />
                              </div>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-1.5 flex flex-col gap-1">
                                {msg.attachments.map((att: any) => {
                                  const isImage = att.fileType.startsWith('image/');
                                  const isVideo = att.fileType.startsWith('video/');
                                  
                                  if (isImage) {
                                    return (
                                      <div key={att.id} className="rounded overflow-hidden max-w-[250px] sm:max-w-[300px] border border-black/5">
                                        <Image src={att.fileUrl} alt={att.fileName} className="w-full h-auto object-cover" />
                                      </div>
                                    );
                                  }
                                  
                                  if (isVideo) {
                                    return (
                                      <div key={att.id} className="rounded overflow-hidden max-w-[250px] sm:max-w-[300px] border border-black/5">
                                        <video src={att.fileUrl} controls className="w-full h-auto bg-black" />
                                      </div>
                                    );
                                  }

                                  return (
                                    <div 
                                      key={att.id} 
                                      onClick={() => setPreviewFile({ url: att.fileUrl, name: att.fileName, type: att.fileType })}
                                      className="flex items-center gap-3 p-2 rounded-lg bg-black/5 border border-black/10 text-sm max-w-[250px] sm:max-w-[300px] cursor-pointer hover:bg-black/10 transition-colors"
                                    >
                                      <div className="bg-red-400 text-white rounded p-1.5 flex items-center justify-center">
                                        <FileOutlined className="text-lg" />
                                      </div>
                                      <div className="flex flex-col overflow-hidden flex-1">
                                        <span className="truncate max-w-full font-medium leading-tight text-gray-700">{att.fileName}</span>
                                        <span className="text-[10px] text-gray-500 leading-tight">{(att.fileSize / 1024).toFixed(1)} KB • {att.fileType.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                                      </div>
                                      <DownloadOutlined className="flex-shrink-0 text-gray-400" />
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Timestamp and status */}
                            <div className="flex justify-end items-center gap-1 mt-0.5 ml-4 float-right pt-1">
                              <span className="text-[10px] text-gray-500 leading-none">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMe && <span className="text-[12px] text-gray-400 leading-none">✓</span>}
                            </div>
                          </div>
                        </div>
                        
                        {/* Reactions and action menu */}
                        <div className={`flex gap-1 mt-0.5 items-center ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {groupedReactions && Object.entries(groupedReactions).map(([emoji, reacts]: [string, any]) => (
                            <button 
                              key={emoji}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border cursor-pointer flex items-center gap-1 ${reacts.some((r: any) => r.userId === authUserId) ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}
                              onClick={() => id && toggleReaction(id, msg.id, emoji)}
                            >
                              <span>{emoji}</span> <span>{reacts.length}</span>
                            </button>
                          ))}
                          
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
                              onClick={() => setReplyingTo({ id: msg.id, name: isMe ? 'You' : msg.user.name, content: msg.content })}
                              title="Reply"
                            >
                              <EnterOutlined />
                            </button>
                          </div>
                        </div>

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
              <div className="bg-[#f0f2f5] px-4 py-3 z-20 flex flex-col flex-shrink-0 border-t border-gray-200 relative">
                {replyingTo && (
                  <div className="flex items-center justify-between bg-black/5 border-l-4 border-[#128c7e] p-2 mb-2 rounded-r text-sm">
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-[#128c7e] text-[12px]">{replyingTo.name}</span>
                      <span className="text-gray-600 truncate text-[13px]">{replyingTo.content.substring(0, 60)}{replyingTo.content.length > 60 ? '...' : ''}</span>
                    </div>
                    <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setReplyingTo(null)} className="text-gray-500 hover:text-gray-700" />
                  </div>
                )}
                
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-2 mb-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                    {attachments.map((file, index) => {
                        const isImage = file.type.startsWith('image/');
                        return (
                          <div key={index} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1 text-sm max-w-[200px]">
                            {isImage ? (
                              <Image src={URL.createObjectURL(file)} alt={file.name} width={24} height={24} className="object-cover rounded flex-shrink-0" />
                            ) : (
                              <FileOutlined className="text-gray-400 flex-shrink-0" />
                            )}
                            <span 
                              className={`truncate max-w-[120px] text-gray-700 ${!isImage ? 'cursor-pointer hover:text-blue-500 hover:underline' : ''}`}
                              onClick={() => {
                                if (!isImage) {
                                  setPreviewFile({ url: URL.createObjectURL(file), name: file.name, type: file.type });
                                }
                              }}
                            >
                              {file.name}
                            </span>
                            <Button type="text" size="small" className="p-0 min-w-0 h-auto text-gray-400 hover:text-red-500" icon={<CloseOutlined className="text-[10px]" />} onClick={() => removeAttachment(index)} disabled={isSending || isUploadingAttachments} />
                          </div>
                        );
                      })}
                      {isUploadingAttachments && (
                        <div className="flex items-center text-blue-500 text-xs px-2 animate-pulse">
                          Uploading attachments...
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 w-full">
                    <div className="flex items-center gap-1">
                      <Popover 
                        content={<EmojiPicker onEmojiClick={(e) => setMessage(prev => prev + e.emoji)} height={350} width={300} />}
                        trigger="click"
                        placement="topLeft"
                      >
                        <Button type="text" shape="circle" icon={<SmileOutlined className="text-gray-500 text-xl" />} className="flex-shrink-0 w-10 h-10 hover:bg-gray-200" disabled={isSending} />
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
                        disabled={isSending || isUploadingAttachments} 
                        title="Attach files" 
                        className="flex-shrink-0 w-10 h-10 hover:bg-gray-200"
                      />
                    </div>

                    <div className="flex-1 bg-white rounded-3xl min-h-[44px] flex items-center px-4 overflow-hidden border border-gray-300 focus-within:border-[#128c7e] transition-colors">
                      {isRecording || audioBlob ? (
                        <div className="flex items-center gap-3 w-full justify-between py-1">
                          <div className="flex items-center gap-3">
                            {audioBlob && audioPreviewUrl ? (
                              <audio controls src={audioPreviewUrl} className="h-8 max-w-[180px]" />
                            ) : (
                              <>
                                <div className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-orange-400' : 'bg-red-500 animate-pulse'}`}></div>
                                <span className="text-gray-700 font-mono text-[15px]">{formatDuration(recordingDuration)}</span>
                                {isPaused ? (
                                  <Button type="text" shape="circle" size="small" icon={<PlayCircleOutlined className="text-green-600" />} onClick={resumeRecording} />
                                ) : (
                                  <Button type="text" shape="circle" size="small" icon={<PauseCircleOutlined className="text-orange-500" />} onClick={pauseRecording} />
                                )}
                                <Button type="text" shape="circle" size="small" icon={<StopOutlined className="text-red-500" />} onClick={stopRecording} />
                              </>
                            )}
                          </div>
                          <Button type="text" shape="circle" size="small" icon={<DeleteOutlined className="text-gray-400 hover:text-red-500" />} onClick={cancelRecording} />
                        </div>
                      ) : (
                        <Input.TextArea
                          variant="borderless"
                          rows={1}
                          autoSize={{ minRows: 1, maxRows: 5 }}
                          placeholder="Type a message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onPressEnter={(e) => {
                            if (!e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={isSending}
                          className="resize-none !px-0 !py-2.5 text-[15px] leading-relaxed bg-transparent"
                        />
                      )}
                    </div>

                    <div className="flex items-center flex-shrink-0">
                      {message.trim() || audioBlob || attachments.length > 0 ? (
                        <Button 
                          type="primary" 
                          shape="circle" 
                          icon={<SendOutlined />} 
                          className="w-11 h-11 bg-[#00a884] hover:bg-[#008f6f] border-none flex items-center justify-center shadow-md flex-shrink-0 ml-1"
                          onClick={handleSendMessage} 
                          loading={isSending || isUploadingAttachments} 
                        />
                      ) : (
                        <Button 
                          type="primary" 
                          shape="circle" 
                          icon={<AudioOutlined className="text-xl" />} 
                          className="w-11 h-11 bg-[#00a884] hover:bg-[#008f6f] border-none flex items-center justify-center shadow-md flex-shrink-0 ml-1"
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

        <div className="col-span-1 space-y-6 hidden lg:block">
          <Card title="Details">
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
                <Tag color={ticket.priority === 'URGENT' ? 'red' : ticket.priority === 'HIGH' ? 'magenta' : 'default'}>
                  {ticket.priority}
                </Tag>
              </div>

              <div>
                <Text type="secondary" className="block mb-1">Team</Text>
                <Text>{ticket.team?.name || 'N/A'}</Text>
              </div>

              <Divider />

              <div>
                <Text type="secondary" className="block mb-2">Assignees</Text>
                {ticket.assignees?.length ? (
                  <div className="flex flex-col gap-2 w-full">
                    {ticket.assignees.map((a: any) => (
                      <div key={a.user.id} className="flex items-center gap-2">
                        <Avatar size="small" icon={<UserOutlined />} />
                        <Text>{a.user.name}</Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">Unassigned</Text>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
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
        title={previewFile?.name}
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
        {previewFile?.type.startsWith('video/') ? (
          <video src={previewFile.url} controls autoPlay className="w-full h-full bg-black object-contain" />
        ) : (
          <iframe src={previewFile?.url} className="w-full h-full border-none" title={previewFile?.name} />
        )}
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
            <Paragraph className="whitespace-pre-wrap">{ticket.description || 'No description provided.'}</Paragraph>
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
              <Tag color={ticket.priority === 'URGENT' ? 'red' : ticket.priority === 'HIGH' ? 'magenta' : 'default'}>
                {ticket.priority}
              </Tag>
            </div>

            <div>
              <Text type="secondary" className="block mb-1">Team</Text>
              <Text>{ticket.team?.name || 'N/A'}</Text>
            </div>

            <div>
              <Text type="secondary" className="block mb-2">Assignees</Text>
              {ticket.assignees?.length ? (
                <div className="flex flex-col gap-2 w-full">
                  {ticket.assignees.map((a: any) => (
                    <div key={a.user.id} className="flex items-center gap-2">
                      <Avatar size="small" icon={<UserOutlined />} />
                      <Text>{a.user.name}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">Unassigned</Text>
              )}
            </div>
          </div>
        </div>
      </Drawer>
    </PageContainer>
  );
};
