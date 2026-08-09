import React, { useEffect, useState } from 'react';
import { Card, Select, DatePicker, Tag, Table, Row, Col, Statistic, Space, Spin, Alert } from 'antd';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { taskApi } from '../api/task.api';
import { teamService } from '@/features/teams/api/team.service';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, ProfileOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<string, string> = {
  TODO: '#d9d9d9',
  IN_PROGRESS: '#1890ff',
  REVIEW: '#faad14',
  COMPLETED: '#52c41a',
  VERIFIED: '#13c2c2',
  CANCELLED: '#ff4d4f',
  BLOCKED: '#cf1322'
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#d9d9d9',
  MEDIUM: '#1890ff',
  HIGH: '#faad14',
  CRITICAL: '#f5222d'
};

export const TaskDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);

  const [filters, setFilters] = useState<{ teamId?: string; startDate?: string; endDate?: string }>({});

  useEffect(() => {
    teamService.getTeams({ page: 1, limit: 100 }).then(res => setTeams(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await taskApi.getDashboardMetrics(filters);
        setMetrics(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load dashboard metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [filters]);

  const handleDateChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        startDate: dates[0].toISOString(),
        endDate: dates[1].toISOString()
      }));
    } else {
      setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined }));
    }
  };

  const getMetricInsight = () => {
    if (!metrics) return null;
    const insights = [];
    if (metrics.summary.overdue > 0) {
      insights.push(`${metrics.summary.overdue} tasks are overdue and require immediate attention.`);
    }
    if (metrics.summary.blocked > 0) {
      insights.push(`${metrics.summary.blocked} tasks are currently blocked.`);
    }
    const highWorkloadUsers = metrics.workload.filter((w: any) => w.activeTasks > 10);
    if (highWorkloadUsers.length > 0) {
      insights.push(`${highWorkloadUsers.length} team members have more than 10 active tasks.`);
    }

    if (insights.length === 0) return "Team is operating smoothly with no immediate bottlenecks.";
    return insights.join(' ');
  };

  const renderOverdueColumns = () => [
    { title: 'Title', dataIndex: 'title', key: 'title', render: (text: string) => <a onClick={() => navigate(`/tasks`)}>{text}</a> },
    { title: 'Assignee', dataIndex: 'assignees', key: 'assignees', render: (assignees: any[]) => assignees.map(a => <Tag key={a.userId}>{a.user.name}</Tag>) },
    { title: 'Due Date', dataIndex: 'deadline', key: 'deadline', render: (date: string) => <span className="text-red-500 font-semibold">{dayjs(date).format('MMM DD, YYYY')}</span> },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (p: string) => <Tag color={PRIORITY_COLORS[p]}>{p}</Tag> }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Task Dashboard"
      />

      <div className="bg-white p-4 mb-6 rounded shadow flex gap-4 items-center">
        <Select
          placeholder="Filter by Team"
          allowClear
          className="w-64"
          options={teams.map(t => ({ value: t.id, label: t.name }))}
          onChange={(val) => setFilters(prev => ({ ...prev, teamId: val || undefined }))}
        />
        <RangePicker onChange={handleDateChange} />
      </div>

      {error && <Alert type="error" title={error} className="mb-6" />}

      {loading ? (
        <div className="flex justify-center p-12"><Spin size="large" /></div>
      ) : metrics ? (
        <div className="flex flex-col gap-6">
          {/* Actionable Insights */}
          <Alert type="info" title="Actionable Insights" description={getMetricInsight()} showIcon />

          {/* KPI Row */}
          <Row gutter={16}>
            <Col span={4}>
              <Card onClick={() => navigate('/tasks')} className="cursor-pointer hover:shadow-md transition">
                <Statistic title="Total Tasks" value={metrics.summary.total} prefix={<ProfileOutlined />} />
              </Card>
            </Col>
            <Col span={5}>
              <Card onClick={() => navigate('/tasks?status=IN_PROGRESS')} className="cursor-pointer hover:shadow-md transition">
                <Statistic title="Active" value={metrics.summary.active} valueStyle={{ color: '#1890ff' }} prefix={<ClockCircleOutlined />} />
              </Card>
            </Col>
            <Col span={5}>
              <Card onClick={() => navigate('/tasks?status=COMPLETED')} className="cursor-pointer hover:shadow-md transition">
                <Statistic title="Completed" value={metrics.summary.completed} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
              </Card>
            </Col>
            <Col span={5}>
              <Card onClick={() => navigate('/tasks?status=BLOCKED')} className="cursor-pointer hover:shadow-md transition">
                <Statistic title="Blocked" value={metrics.summary.blocked} valueStyle={{ color: '#cf1322' }} prefix={<PauseCircleOutlined />} />
              </Card>
            </Col>
            <Col span={5}>
              <Card onClick={() => navigate('/tasks')} className="cursor-pointer hover:shadow-md transition">
                <Statistic title="Overdue" value={metrics.summary.overdue} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} />
              </Card>
            </Col>
          </Row>

          {/* Charts Row */}
          <Row gutter={16}>
            <Col span={8}>
              <Card title="Status Distribution" className="h-87.5">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={metrics.statusDistribution}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {metrics.statusDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col span={8}>
              <Card title="Priority Distribution" className="h-87.5">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics.priorityDistribution}>
                    <XAxis dataKey="priority" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {metrics.priorityDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.priority] || '#8884d8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col span={8}>
              <Card title="Workload Overview (Top 10)" className="h-87.5">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics.workload} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="userName" type="category" width={80} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="activeTasks" name="Active" stackId="a" fill="#1890ff" />
                    <Bar dataKey="completedTasks" name="Completed" stackId="a" fill="#52c41a" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Lists Row */}
          <Row gutter={16}>
            <Col span={12}>
              <Card title={<Space><WarningOutlined className="text-red-500" /> Overdue Tasks</Space>} className="h-full">
                <Table
                  dataSource={metrics.overdue}
                  columns={renderOverdueColumns()}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: 'No overdue tasks!' }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title={<Space><ClockCircleOutlined className="text-blue-500" /> Upcoming Deadlines</Space>} className="h-full">
                <Table
                  dataSource={metrics.upcoming}
                  columns={renderOverdueColumns()}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: 'No upcoming deadlines.' }}
                />
              </Card>
            </Col>
          </Row>

        </div>
      ) : null}
    </PageContainer>
  );
};
