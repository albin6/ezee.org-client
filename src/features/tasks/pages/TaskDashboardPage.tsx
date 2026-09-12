import React, { useEffect, useState } from 'react';
import { Card, Select, DatePicker, Tag, Table, Row, Col, Statistic, Space, Spin, Alert } from 'antd';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { taskApi } from '../api/task.api';
import { teamService } from '@/features/teams/api/team.service';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  WarningOutlined, 
  ProfileOutlined, 
  PauseCircleOutlined,
  CalendarOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<string, string> = {
  TODO: '#9ca3af',
  IN_PROGRESS: '#1890ff',
  REVIEW: '#faad14',
  COMPLETED: '#52c41a',
  VERIFIED: '#13c2c2',
  CANCELLED: '#ff4d4f',
  BLOCKED: '#cf1322'
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'green',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red'
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
    { 
      title: 'Title', 
      dataIndex: 'title', 
      key: 'title', 
      render: (text: string) => (
        <a onClick={() => navigate(`/tasks`)} className="font-medium text-blue-600 hover:text-blue-800">
          {text}
        </a>
      )
    },
    { 
      title: 'Assignee', 
      dataIndex: 'assignees', 
      key: 'assignees', 
      render: (assignees: any[]) => (
        <div className="flex flex-wrap gap-1">
          {assignees?.map(a => (
            <Tag key={a.userId || a.user?.id} className="m-0 text-xs">
              {a.user?.name || 'User'}
            </Tag>
          ))}
        </div>
      )
    },
    { 
      title: 'Due Date', 
      dataIndex: 'deadline', 
      key: 'deadline', 
      render: (date: string) => (
        <span className="text-red-500 font-semibold text-xs">
          {dayjs(date).format('MMM DD, YYYY')}
        </span>
      ) 
    },
    { 
      title: 'Priority', 
      dataIndex: 'priority', 
      key: 'priority', 
      render: (p: string) => <Tag color={PRIORITY_COLORS[p] || 'default'} className="m-0">{p}</Tag> 
    }
  ];

  const renderUpcomingColumns = () => [
    { 
      title: 'Title', 
      dataIndex: 'title', 
      key: 'title', 
      render: (text: string) => (
        <a onClick={() => navigate(`/tasks`)} className="font-medium text-blue-600 hover:text-blue-800">
          {text}
        </a>
      )
    },
    { 
      title: 'Assignee', 
      dataIndex: 'assignees', 
      key: 'assignees', 
      render: (assignees: any[]) => (
        <div className="flex flex-wrap gap-1">
          {assignees?.map(a => (
            <Tag key={a.userId || a.user?.id} className="m-0 text-xs">
              {a.user?.name || 'User'}
            </Tag>
          ))}
        </div>
      )
    },
    { 
      title: 'Due Date', 
      dataIndex: 'deadline', 
      key: 'deadline', 
      render: (date: string) => (
        <span className="text-blue-600 font-semibold text-xs">
          {dayjs(date).format('MMM DD, YYYY')}
        </span>
      ) 
    },
    { 
      title: 'Priority', 
      dataIndex: 'priority', 
      key: 'priority', 
      render: (p: string) => <Tag color={PRIORITY_COLORS[p] || 'default'} className="m-0">{p}</Tag> 
    }
  ];

  // Mobile card list for deadlines/overdue
  const renderMobileTaskList = (taskList: any[], isOverdue: boolean) => {
    if (!taskList || taskList.length === 0) {
      return (
        <div className="py-6 text-center text-gray-400 text-xs">
          {isOverdue ? 'No overdue tasks!' : 'No upcoming deadlines.'}
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {taskList.map((task: any) => (
          <div
            key={task.id}
            onClick={() => navigate('/tasks')}
            className="p-3 bg-gray-50/80 hover:bg-gray-100/80 rounded-lg border border-gray-100 transition cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition">
                {task.title}
              </span>
              <Tag color={PRIORITY_COLORS[task.priority] || 'default'} className="m-0 text-[11px] shrink-0">
                {task.priority}
              </Tag>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-200/50">
              <span className="flex items-center gap-1">
                <UserOutlined className="text-gray-400 text-[11px]" />
                <span className="truncate max-w-[140px]">
                  {task.assignees?.map((a: any) => a.user?.name).join(', ') || 'Unassigned'}
                </span>
              </span>
              <span className={`font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-blue-600'}`}>
                <CalendarOutlined className="text-[11px]" />
                {dayjs(task.deadline).format('MMM DD, YYYY')}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Task Dashboard"
        description="Monitor team workloads, distribution, and critical task deadlines"
      />

      {/* Filter Bar */}
      <div className="bg-white p-3.5 sm:p-5 mb-4 sm:mb-6 rounded-xl shadow-xs border border-gray-200/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <Select
          placeholder="Filter by Team"
          allowClear
          className="w-full sm:w-64"
          options={teams.map(t => ({ value: t.id, label: t.name }))}
          onChange={(val) => setFilters(prev => ({ ...prev, teamId: val || undefined }))}
        />
        <RangePicker onChange={handleDateChange} className="w-full sm:w-auto" />
      </div>

      {error && <Alert type="error" title={error} className="mb-6 rounded-xl" />}

      {loading ? (
        <div className="flex justify-center p-12"><Spin size="large" /></div>
      ) : metrics ? (
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Actionable Insights */}
          <Alert 
            type="info" 
            title="Actionable Insights" 
            description={getMetricInsight()} 
            showIcon 
            className="rounded-xl border border-blue-100"
          />

          {/* KPI Grid: Responsive for mobile (2 columns on xs, 3 on sm, 5 on lg) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <Card 
              onClick={() => navigate('/tasks')} 
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Total Tasks</span>} 
                value={metrics.summary.total} 
                prefix={<ProfileOutlined className="text-gray-400" />} 
                valueStyle={{ fontSize: '1.25rem', fontWeight: 600 }}
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks?status=IN_PROGRESS')} 
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Active</span>} 
                value={metrics.summary.active} 
                valueStyle={{ color: '#1890ff', fontSize: '1.25rem', fontWeight: 600 }} 
                prefix={<ClockCircleOutlined />} 
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks?status=COMPLETED')} 
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Completed</span>} 
                value={metrics.summary.completed} 
                valueStyle={{ color: '#52c41a', fontSize: '1.25rem', fontWeight: 600 }} 
                prefix={<CheckCircleOutlined />} 
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks?status=BLOCKED')} 
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Blocked</span>} 
                value={metrics.summary.blocked} 
                valueStyle={{ color: '#cf1322', fontSize: '1.25rem', fontWeight: 600 }} 
                prefix={<PauseCircleOutlined />} 
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks')} 
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80 col-span-2 sm:col-span-1"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Overdue</span>} 
                value={metrics.summary.overdue} 
                valueStyle={{ color: '#f5222d', fontSize: '1.25rem', fontWeight: 600 }} 
                prefix={<WarningOutlined />} 
              />
            </Card>
          </div>

          {/* Charts Row: Stack on mobile (xs=24), 3 columns on desktop (lg=8) */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card 
                title={<span className="font-semibold text-sm sm:text-base">Status Distribution</span>} 
                className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                styles={{ body: { padding: '12px' } }}
              >
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.statusDistribution}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label
                      >
                        {metrics.statusDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#8884d8'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card 
                title={<span className="font-semibold text-sm sm:text-base">Priority Distribution</span>} 
                className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                styles={{ body: { padding: '12px' } }}
              >
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.priorityDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {metrics.priorityDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.priority] || '#1890ff'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card 
                title={<span className="font-semibold text-sm sm:text-base">Workload Overview (Top 10)</span>} 
                className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                styles={{ body: { padding: '12px' } }}
              >
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.workload} layout="vertical" margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="userName" type="category" width={75} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="activeTasks" name="Active" stackId="a" fill="#1890ff" />
                      <Bar dataKey="completedTasks" name="Completed" stackId="a" fill="#52c41a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Overdue & Upcoming Lists: Stack on mobile (xs=24), 2 columns on desktop (lg=12) */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <WarningOutlined className="text-red-500" />
                    <span className="font-semibold text-sm sm:text-base">Overdue Tasks</span>
                  </Space>
                } 
                className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                styles={{ body: { padding: '12px 16px' } }}
              >
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table
                    dataSource={metrics.overdue}
                    columns={renderOverdueColumns()}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: 'No overdue tasks!' }}
                  />
                </div>

                {/* Mobile Card List View */}
                <div className="md:hidden">
                  {renderMobileTaskList(metrics.overdue, true)}
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card 
                title={
                  <Space>
                    <ClockCircleOutlined className="text-blue-500" />
                    <span className="font-semibold text-sm sm:text-base">Upcoming Deadlines</span>
                  </Space>
                } 
                className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                styles={{ body: { padding: '12px 16px' } }}
              >
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table
                    dataSource={metrics.upcoming}
                    columns={renderUpcomingColumns()}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    locale={{ emptyText: 'No upcoming deadlines.' }}
                  />
                </div>

                {/* Mobile Card List View */}
                <div className="md:hidden">
                  {renderMobileTaskList(metrics.upcoming, false)}
                </div>
              </Card>
            </Col>
          </Row>

        </div>
      ) : null}
    </PageContainer>
  );
};
