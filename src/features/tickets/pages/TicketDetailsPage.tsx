import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Space, Divider, Typography, Avatar, Select, Modal } from 'antd';
import { UserOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { useTicketStore } from '../store/ticket.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';

const { Title, Text, Paragraph } = Typography;

export const TicketDetailsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentTicket: ticket, loading, fetchTicket, addMessage, updateStatus } = useTicketStore();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (id) fetchTicket(id);
  }, [id, fetchTicket]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !id) return;
    await addMessage(id, message);
    setMessage('');
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
      <div className="flex justify-between items-center mb-6">
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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
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
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <Avatar icon={<UserOutlined />} className="flex-shrink-0 bg-gray-300" />
                      <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <Text strong className="text-xs">{isMe ? 'You' : msg.user.name}</Text>
                          <Text type="secondary" className="text-[10px]">{new Date(msg.createdAt).toLocaleString()}</Text>
                        </div>
                        <div className={`px-4 py-2 shadow-sm ${isMe ? 'bg-[#1677ff] text-white rounded-2xl rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'}`}>
                          <Text className={isMe ? "text-white whitespace-pre-wrap" : "text-gray-800 whitespace-pre-wrap"}>{msg.content}</Text>
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
              <div className="mt-4 flex gap-2">
                <Input.TextArea
                  rows={2}
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button type="primary" icon={<SendOutlined />} className="h-auto" onClick={handleSendMessage}>
                  Send
                </Button>
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
    </PageContainer>
  );
};
