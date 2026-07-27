import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, List, Avatar } from 'antd';
import { BookOutlined, TeamOutlined, CalendarOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { foundationService, Thread } from '@/features/foundation/api/foundation.service';

export const CoordinatorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchThreads = async () => {
      setLoading(true);
      try {
        const response = await foundationService.getThreads();
        setThreads(response.data);
      } catch (error) {
        console.error('Failed to fetch threads', error);
      } finally {
        setLoading(false);
      }
    };
    fetchThreads();
  }, []);

  const openThreadsCount = threads.filter(t => t.status === 'OPEN').length;
  
  return (
    <PageContainer>
      <PageHeader
        title="Coordinator Dashboard"
        description="Welcome to your Coordinator Portal. Here is your overview."
      />

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless">
            <Statistic
              title="My Assigned Threads"
              value={threads.length}
              loading={loading}
              prefix={<BookOutlined className="text-blue-600" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless">
            <Statistic
              title="Active (Open) Threads"
              value={openThreadsCount}
              loading={loading}
              styles={{ content: { color: '#16a34a' } }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless">
            <Statistic
              title="Upcoming Meetings"
              value={openThreadsCount} // Using open threads as a proxy for now
              loading={loading}
              prefix={<CalendarOutlined className="text-purple-600" />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} className="mt-6">
        <Col xs={24} lg={12}>
          <Card title="Recent Threads" variant="borderless">
            <List
              loading={loading}
              dataSource={threads.slice(0, 5)}
              renderItem={(thread) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<BookOutlined />} className="bg-blue-100 text-blue-600" />}
                    title={thread.title}
                    description={`Batch: ${thread.batch?.name || 'N/A'} | Status: ${thread.status}`}
                  />
                </List.Item>
              )}
              locale={{ emptyText: 'No assigned threads found.' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Upcoming Exams / Meetings" variant="borderless">
            <List
              loading={loading}
              dataSource={threads.filter(t => t.status === 'OPEN').slice(0, 5)}
              renderItem={(thread) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<VideoCameraOutlined />} className="bg-purple-100 text-purple-600" />}
                    title={thread.title}
                    description={`Exam Type: ${thread.examType}`}
                  />
                </List.Item>
              )}
              locale={{ emptyText: 'No active exams found.' }}
            />
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};
