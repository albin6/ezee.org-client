import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Form, Select, message } from 'antd';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useTicketStore } from '../store/ticket.store';
import { apiClient } from '@/shared/api/axios';

export const CreateTicketPage: React.FC = () => {
  const navigate = useNavigate();
  const { createTicket } = useTicketStore();
  const [form] = Form.useForm();
  
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch user's teams
    apiClient.get('/teams').then((res: any) => setTeams(res.data.data)).catch(console.error);
  }, []);

  const handleTeamChange = async (teamId: string) => {
    form.setFieldValue('assignees', []);
    try {
      const res: any = await apiClient.get(`/teams/${teamId}/members`);
      setTeamMembers(res.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      await createTicket(values);
      message.success('Ticket created successfully');
      navigate('/tickets');
    } catch (error) {
      message.error('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Create Ticket"
        description="Submit a new ticket or issue to a team."
      />
      
      <Card className="max-w-2xl">
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a ticket title' }]}
          >
            <Input placeholder="E.g., Server down in production" />
          </Form.Item>

          <Form.Item
            name="teamId"
            label="Target Team"
            rules={[{ required: true, message: 'Please select a target team' }]}
          >
            <Select 
              placeholder="Select Team" 
              onChange={handleTeamChange}
              options={teams.map(t => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>

          <Form.Item
            name="assignees"
            label="Assignees"
          >
            <Select 
              mode="multiple"
              placeholder="Select Assignees (Optional)" 
              disabled={teamMembers.length === 0}
              options={teamMembers.map(m => ({ value: m.user.id, label: m.user.name }))}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={5} placeholder="Describe the issue in detail..." />
          </Form.Item>

          <Form.Item className="mb-0 flex justify-end">
            <Button className="mr-2" onClick={() => navigate('/tickets')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Ticket
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </PageContainer>
  );
};
