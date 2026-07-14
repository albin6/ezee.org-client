import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Space, Divider, Typography, Avatar, Select, Modal, Popover } from 'antd';
import { UserOutlined, SendOutlined, ReloadOutlined, SmileOutlined, CloseOutlined, EnterOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { useTicketStore } from '../store/ticket.store';
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
    if (!message.trim() || !id || isSending) return;
    
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
      await addMessage(id, message, undefined, replyingTo?.id);
      setMessage('');
      setReplyingTo(null);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = (status: string) => {
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
                          <Text className={isMe ? "text-white whitespace-pre-wrap" : "text-gray-800 whitespace-pre-wrap"}>{msg.content}</Text>
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
                <div className="flex gap-2">
                  <Input.TextArea
                    rows={2}
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isSending}
                  />
                  <Button type="primary" icon={<SendOutlined />} className="h-auto" onClick={handleSendMessage} loading={isSending}>
                    Send
                  </Button>
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
    </PageContainer>
  );
};
