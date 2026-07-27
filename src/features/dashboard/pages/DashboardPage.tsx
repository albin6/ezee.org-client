import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { UserOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';

import { useAuthStore } from '@/features/auth/store/auth.store';
import { CoordinatorDashboard } from './CoordinatorDashboard';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  
  const isCoordinator = (user as any)?.type === 'STUDENT_COORDINATOR' || (user as any)?.role === 'STUDENT_COORDINATOR';

  if (isCoordinator) {
    return <CoordinatorDashboard />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard Overview"
        description={user?.type === 'user' ? "Welcome to the User Portal." : "Welcome to the Enterprise Admin Dashboard."}
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless">
            <Statistic
              title="Active Users"
              value={1128}
              prefix={<UserOutlined className="text-purple-600" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless">
            <Statistic
              title="System Status"
              value="Healthy"
              styles={{ content: { color: '#16a34a' } }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless">
            <Statistic
              title="Avg. Response Time"
              value={1.2}
              suffix="ms"
              prefix={<ThunderboltOutlined className="text-yellow-500" />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="mt-6">
        <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          Analytics Chart Placeholder
        </div>
      </Card>
    </PageContainer>
  );
};
