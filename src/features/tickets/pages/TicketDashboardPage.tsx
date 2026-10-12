import React from 'react';
import { Button, Card, Typography } from 'antd';
import { DashboardOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';

const { Title, Paragraph } = Typography;

export const TicketDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Tickets & Issues overview and navigation."
        extra={
          <Button
            type="primary"
            icon={<UnorderedListOutlined />}
            onClick={() => navigate('/tickets')}
            data-testid="go-to-tickets-btn"
          >
            View Tickets
          </Button>
        }
      />

      <Card
        data-testid="tickets-dashboard-placeholder"
        className="rounded-xl border border-gray-100 shadow-xs"
      >
        <div className="py-12 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl mb-4">
            <DashboardOutlined />
          </div>
          <Title level={4} className="!mb-2">
            Tickets &amp; Issues Dashboard
          </Title>
          <Paragraph type="secondary" className="!mb-6 text-sm">
            Dashboard metrics and insights will be configured in an upcoming enhancement. Use the Tickets subtab to view and manage all tickets and issues.
          </Paragraph>
          <Button
            type="default"
            icon={<UnorderedListOutlined />}
            onClick={() => navigate('/tickets')}
          >
            Go to Tickets
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
};
