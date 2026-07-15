import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Space, Divider, Typography, Avatar, Select, Modal, Popover, Image } from 'antd';
import { UserOutlined, SendOutlined, ReloadOutlined, SmileOutlined, CloseOutlined, EnterOutlined, AudioOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined, PaperClipOutlined, FileOutlined, DownloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { useTicketStore } from '../store/ticket.store';
import { ticketService } from '../api/ticket.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

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
      content: `Are you sure you want to change the ticket status to ${status}?`,
      okText: 'Yes',
      cancelText: 'No',
      onOk: async () => {
        await updateStatus(id, status, ticket?.version);
      }
    });
  };

  if (loading && !ticket) return <PageContainer>Loading...</PageContainer>;
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card>
            <Title level={5}>Description</Title>
            <Paragraph className="whitespace-pre-wrap">{ticket.description || 'No description provided.'}</Paragraph>
          </Card>

          <Card
            title={
              <div className="flex justify-between items-center">
                <span>Conversation</span>
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => id && fetchTicket(id)}
                  loading={loading}
                  title="Refresh Conversation"
                />
              </div>
            }
            className="flex flex-col"
          >
            <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto p-4 border border-gray-200 rounded-md bg-gray-50">
              {ticket.messages && ticket.messages.length > 0 ? (
                ticket.messages.map((msg: any) => {
                  if (msg.isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="bg-gray-200/60 text-gray-600 text-xs px-4 py-1.5 rounded-full text-center">
                          {msg.content} by {msg.user.name} • {new Date(msg.createdAt).toLocaleString()}
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
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <Avatar icon={<UserOutlined />} className="flex-shrink-0 bg-gray-300" />
                      <div className={`flex flex-col max-w-[90%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1 px-1">
                          <Text strong className="text-xs whitespace-nowrap">{isMe ? 'You' : msg.user.name}</Text>
                          <Text type="secondary" className="text-[10px] whitespace-nowrap">{new Date(msg.createdAt).toLocaleString()}</Text>
                          <button 
                            className="text-[10px] text-gray-400 hover:text-blue-500 flex items-center cursor-pointer bg-transparent border-none p-0 ml-1 whitespace-nowrap"
                            onClick={() => setReplyingTo({ id: msg.id, name: isMe ? 'You' : msg.user.name, content: msg.content })}
                          >
                            <EnterOutlined /> Reply
                          </button>
                        </div>
                        <div className={`px-4 py-2 shadow-sm relative ${isMe ? 'bg-[#1677ff] text-white rounded-2xl rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'}`}>
                          {msg.replyTo && (
                            <div className={`text-xs p-1.5 rounded mb-2 border-l-2 ${isMe ? 'bg-black/10 text-white/80 border-white/40' : 'bg-black/5 text-gray-500 border-gray-400'}`}>
                              <span className="font-semibold">{msg.replyTo.user.name}</span>: {msg.replyTo.content.substring(0, 50)}{msg.replyTo.content.length > 50 ? '...' : ''}
                            </div>
                          )}
                          <Text className={isMe ? "text-white whitespace-pre-wrap break-words" : "text-gray-800 whitespace-pre-wrap break-words"}>{msg.content}</Text>
                          {msg.audioUrl && (
                            <div className="mt-2 w-full max-w-[250px] sm:max-w-[300px]">
                              <audio controls src={msg.audioUrl} className="w-full h-10 rounded shadow-sm" />
                            </div>
                          )}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                              {msg.attachments.map((att: any) => {
                                const isImage = att.fileType.startsWith('image/');
                                const isVideo = att.fileType.startsWith('video/');
                                
                                if (isImage) {
                                  return (
                                    <div key={att.id} className="rounded overflow-hidden max-w-[250px] sm:max-w-[300px]">
                                      <Image src={att.fileUrl} alt={att.fileName} className="w-full h-auto object-cover" />
                                    </div>
                                  );
                                }
                                
                                if (isVideo) {
                                  return (
                                    <div key={att.id} className="rounded overflow-hidden max-w-[250px] sm:max-w-[300px]">
                                      <video src={att.fileUrl} controls className="w-full h-auto bg-black" />
                                    </div>
                                  );
                                }

                                return (
                                  <div 
                                    key={att.id} 
                                    onClick={() => setPreviewFile({ url: att.fileUrl, name: att.fileName, type: att.fileType })}
                                    className={`flex items-center gap-2 p-2 rounded border text-sm max-w-[250px] sm:max-w-[300px] cursor-pointer hover:bg-gray-50 transition-colors ${isMe ? 'bg-white/20 border-white/30 text-white hover:bg-white/30 hover:text-white' : 'bg-white border-gray-200 text-blue-600 hover:bg-blue-50'}`}
                                  >
                                    <FileOutlined className="text-lg flex-shrink-0" />
                                    <div className="flex flex-col overflow-hidden">
                                      <span className="truncate max-w-full font-medium leading-tight">{att.fileName}</span>
                                      <span className="text-[10px] opacity-80 leading-tight">{(att.fileSize / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <DownloadOutlined className="ml-auto flex-shrink-0 opacity-70" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        <div className={`flex gap-1 mt-1 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {groupedReactions && Object.entries(groupedReactions).map(([emoji, reacts]: [string, any]) => (
                            <button 
                              key={emoji}
                              className={`text-xs px-1.5 py-0.5 rounded-full border cursor-pointer flex items-center gap-1 ${reacts.some((r: any) => r.userId === authUserId) ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}
                              onClick={() => id && toggleReaction(id, msg.id, emoji)}
                            >
                              <span>{emoji}</span> <span>{reacts.length}</span>
                            </button>
                          ))}
                          <Popover 
                            content={<EmojiPicker onEmojiClick={(e) => id && toggleReaction(id, msg.id, e.emoji)} height={350} width={300} />}
                            trigger="click"
                            placement={isMe ? "bottomRight" : "bottomLeft"}
                          >
                            <button className="text-xs px-1.5 py-0.5 rounded-full border bg-white border-gray-200 hover:bg-gray-50 text-gray-400 cursor-pointer">
                              <SmileOutlined />
                            </button>
                          </Popover>
                        </div>

                      </div>
                    </div>
                  );
                })
              ) : (
                <Text type="secondary" className="text-center py-4 block">No messages yet.</Text>
              )}
              <div ref={messagesEndRef} />
            </div>

            {(hasPermission('tickets:comment') || isAssignee || isCreator || isAdmin) && ticket.status !== 'CLOSED' && (
              <div className="mt-4 flex flex-col gap-2">
                {replyingTo && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2 rounded text-sm text-blue-800">
                    <div>
                      <span className="font-medium mr-1">Replying to {replyingTo.name}:</span>
                      <span className="opacity-80">{replyingTo.content.substring(0, 50)}{replyingTo.content.length > 50 ? '...' : ''}</span>
                    </div>
                    <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setReplyingTo(null)} />
                  </div>
                )}
                <div className="flex flex-col gap-2 relative border rounded bg-white p-2">
                  
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded">
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

                  {isRecording || audioBlob ? (
                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded justify-between">
                      <div className="flex items-center gap-3">
                        {audioBlob && audioPreviewUrl ? (
                           <audio controls src={audioPreviewUrl} className="h-10 max-w-[200px]" />
                        ) : (
                          <>
                            <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-orange-400' : 'bg-red-500 animate-pulse'}`}></div>
                            <span className="text-red-500 font-mono text-sm">{formatDuration(recordingDuration)}</span>
                            {isPaused ? (
                              <Button type="text" shape="circle" icon={<PlayCircleOutlined className="text-green-600 text-lg" />} onClick={resumeRecording} />
                            ) : (
                              <Button type="text" shape="circle" icon={<PauseCircleOutlined className="text-orange-500 text-lg" />} onClick={pauseRecording} />
                            )}
                            <Button type="text" shape="circle" icon={<StopOutlined className="text-red-500 text-lg" />} onClick={stopRecording} />
                          </>
                        )}
                      </div>
                      <Button type="text" shape="circle" icon={<DeleteOutlined className="text-gray-500" />} onClick={cancelRecording} />
                    </div>
                  ) : (
                    <Input.TextArea
                      variant="borderless"
                      rows={2}
                      placeholder="Type your message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={isSending}
                      className="resize-none"
                    />
                  )}

                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-1">
                      <input 
                        type="file" 
                        multiple 
                        ref={fileInputRef} 
                        onChange={handleAttachmentChange} 
                        className="hidden" 
                      />
                      <Button 
                        type="text" 
                        icon={<PaperClipOutlined className="text-gray-400 hover:text-blue-500" />} 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isSending || isUploadingAttachments} 
                        title="Attach files" 
                      />
                      {!isRecording && !audioBlob && (
                        <Button type="text" icon={<AudioOutlined className={message.trim() ? "text-gray-300" : "text-blue-500"} />} onClick={startRecording} disabled={isSending || isUploadingAttachments || message.trim().length > 0} title="Record voice message" />
                      )}
                    </div>
                    <Button type="primary" icon={<SendOutlined />} className="h-auto" onClick={handleSendMessage} loading={isSending || isUploadingAttachments} disabled={(!message.trim() && !audioBlob && attachments.length === 0)}>
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-1 space-y-6">
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
    </PageContainer>
  );
};
