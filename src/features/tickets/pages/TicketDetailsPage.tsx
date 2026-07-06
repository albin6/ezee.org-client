import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Space, Divider, Typography, Avatar, List, Select } from 'antd';
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

  const handleSendMessage = async () => {
    if (!message.trim() || !id) return;
    await addMessage(id, message);
    setMessage('');
  };

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    await updateStatus(id, status);
  };

  if (loading && !ticket) return <PageContainer>Loading...</PageContainer>;
  if (!ticket) return <PageContainer>Ticket not found</PageContainer>;

  const authUser: any = user;
  const isAssignee = ticket.assignees?.some(a => a.user.id === authUser?.sub);
  const isCreator = ticket.createdBy?.id === authUser?.sub;
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
            <div className="flex flex-col gap-4">
              {ticket.messages && ticket.messages.length > 0 ? (
                ticket.messages.map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <Avatar icon={<UserOutlined />} className="mt-1 flex-shrink-0" />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Text strong>{msg.user.name}</Text>
                        <Text type="secondary" className="text-xs">{new Date(msg.createdAt).toLocaleString()}</Text>
                      </div>
                      <Text className="text-gray-800 whitespace-pre-wrap">{msg.content}</Text>
                    </div>
                  </div>
                ))
              ) : (
                <Text type="secondary" className="text-center py-4 block">No messages yet.</Text>
              )}
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
