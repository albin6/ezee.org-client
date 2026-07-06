import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import { UserOutlined, SettingOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';

import { useAuthStore } from '@/features/auth/store/auth.store';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <PageContainer>
      <PageHeader 
        title="Dashboard Overview" 
        description={user?.type === 'user' ? "Welcome to the User Portal." : "Welcome to the Enterprise Admin Dashboard."}
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="Active Users"
              value={1128}
              prefix={<UserOutlined className="text-purple-600" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="System Status"
              value="Healthy"
              valueStyle={{ color: '#16a34a' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="Configuration Issues"
              value={0}
              prefix={<SettingOutlined className="text-gray-400" />}
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
