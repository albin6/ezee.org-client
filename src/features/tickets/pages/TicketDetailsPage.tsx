import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Space, Divider, Typography, Avatar, List, Select } from 'antd';
import { UserOutlined, SendOutlined } from '@ant-design/icons';
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

          <Card title="Conversation" className="flex flex-col">
            <List
              itemLayout="horizontal"
              dataSource={ticket.messages || []}
              renderItem={(msg: any) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={
                      <Space>
                        <Text strong>{msg.user.name}</Text>
                        <Text type="secondary" className="text-xs">{new Date(msg.createdAt).toLocaleString()}</Text>
                      </Space>
                    }
                    description={<Text className="text-gray-800 whitespace-pre-wrap">{msg.content}</Text>}
                  />
                </List.Item>
              )}
            />
            
            {hasPermission('tickets:comment') && ticket.status !== 'CLOSED' && (
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
                {canEditStatus && hasPermission('tickets:update') ? (
                  <Select 
                    value={ticket.status} 
                    onChange={handleStatusChange} 
                    className="w-full"
                    options={[
                      { value: 'OPEN', label: 'Open' },
                      { value: 'IN_PROGRESS', label: 'In Progress' },
                      { value: 'RESOLVED', label: 'Resolved' },
                      { value: 'CLOSED', label: 'Closed' },
                      { value: 'REOPENED', label: 'Reopened' }
                    ]}
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
                  <Space direction="vertical" className="w-full">
                    {ticket.assignees.map((a: any) => (
                      <div key={a.user.id} className="flex items-center gap-2">
                        <Avatar size="small" icon={<UserOutlined />} />
                        <Text>{a.user.name}</Text>
                      </div>
                    ))}
                  </Space>
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
