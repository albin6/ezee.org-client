import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, message } from 'antd';
import { TeamOutlined, UserOutlined, BookOutlined, MessageOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { foundationService } from '../api/foundation.service';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const OverviewPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const data = await foundationService.getOverviewMetrics();
        setMetrics(data);
      } catch (error: any) {
        message.error('Failed to load dashboard metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Foundation Overview"
        description="Key performance indicators and metrics for the Foundation program."
      />
      
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} variant="borderless" className="shadow-sm">
            <Statistic
              title="Total Active Students"
              value={metrics?.kpis?.totalStudents || 0}
              prefix={<UserOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} variant="borderless" className="shadow-sm">
            <Statistic
              title="Total Batches"
              value={metrics?.kpis?.totalBatches || 0}
              prefix={<BookOutlined className="text-green-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} variant="borderless" className="shadow-sm">
            <Statistic
              title="Total Coordinators"
              value={metrics?.kpis?.totalCoordinators || 0}
              prefix={<TeamOutlined className="text-purple-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading} bordered={false} className="shadow-sm">
            <Statistic
              title="Open Threads"
              value={metrics?.kpis?.openThreads || 0}
              prefix={<MessageOutlined className="text-orange-500" />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card 
            title="Weekly Activity" 
            variant="borderless" 
            className="shadow-sm" 
            loading={loading}
            styles={{ body: { padding: '24px 24px 0 24px' } }}
          >
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics?.chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#1890ff" 
                    strokeWidth={3} 
                    dot={{ r: 4 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Quick Actions" variant="borderless" className="shadow-sm" loading={loading}>
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                <h4 className="text-blue-800 font-semibold mb-1">Schedule Mock Test</h4>
                <p className="text-blue-600 text-sm m-0">Set up the mid-term evaluation for an active batch.</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer">
                <h4 className="text-purple-800 font-semibold mb-1">Review Coordinator Reports</h4>
                <p className="text-purple-600 text-sm m-0">Check the latest feedback from student coordinators.</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors cursor-pointer">
                <h4 className="text-orange-800 font-semibold mb-1">Check Open Threads</h4>
                <p className="text-orange-600 text-sm m-0">Respond to student and coordinator inquiries.</p>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};
