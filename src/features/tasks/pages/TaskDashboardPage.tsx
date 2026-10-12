import React, { useEffect, useState, useMemo } from 'react';
import { Card, Select, DatePicker, Tag, Table, Row, Col, Statistic, Space, Spin, Alert, Button, Progress, Avatar, Empty } from 'antd';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { taskApi, type TaskDashboardFilters } from '../api/task.api';
import { teamService } from '@/features/teams/api/team.service';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  WarningOutlined, 
  ProfileOutlined, 
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  SyncOutlined,
  HourglassOutlined,
  ReloadOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<string, string> = {
  TODO: '#9ca3af',
  IN_PROGRESS: '#1890ff',
  IN_REVIEW: '#722ed1',
  REVIEW: '#faad14',
  COMPLETED: '#52c41a',
  VERIFIED: '#13c2c2',
  REJECTED: '#f5222d',
  CANCELLED: '#ff4d4f',
  BLOCKED: '#cf1322'
};

const PRIORITY_CHART_COLORS: Record<string, string> = {
  LOW: '#52c41a',
  MEDIUM: '#1890ff',
  HIGH: '#fa8c16',
  CRITICAL: '#f5222d'
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'green',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red'
};

export const TaskDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const anyUser = user as any;
  const isSuperAdmin =
    anyUser?.role?.name === 'Super Admin' ||
    anyUser?.type === 'super_admin' ||
    anyUser?.role === 'Super Admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [scope, setScope] = useState<'my_tasks' | 'my_group'>(isSuperAdmin ? 'my_group' : 'my_tasks');

  const [filters, setFilters] = useState<{
    teamId?: string;
    memberId?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  useEffect(() => {
    teamService.getTeams({ page: 1, limit: 100 }).then(res => setTeams(res.data || [])).catch(console.error);
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const requestParams: TaskDashboardFilters = {
        scope,
        teamId: filters.teamId,
        memberId: scope === 'my_group' ? filters.memberId : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
      const data = await taskApi.getDashboardMetrics(requestParams);
      setMetrics(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [filters, scope]);

  const canViewGroup = Boolean(
    isSuperAdmin ||
    metrics?.canViewGroup ||
    metrics?.isReportingOfficer ||
    (Array.isArray(metrics?.groupMembers) && metrics.groupMembers.length > 0)
  );

  const groupMembers: any[] = useMemo(() => {
    const allMembers = Array.isArray(metrics?.groupMembers) ? metrics.groupMembers : [];
    if (!filters.teamId) return allMembers;
    return allMembers.filter(
      (m: any) => !Array.isArray(m.teams) || m.teams.length === 0 || m.teams.some((t: any) => t.id === filters.teamId)
    );
  }, [metrics?.groupMembers, filters.teamId]);

  const availableTeams = useMemo(() => {
    if (isSuperAdmin) return teams;
    if (scope === 'my_group' && Array.isArray(metrics?.authorizedTeams) && metrics.authorizedTeams.length > 0) {
      return metrics.authorizedTeams;
    }
    const userTeamIds = new Set(
      (anyUser?.teamMembers || []).map((tm: any) => tm.teamId).filter(Boolean)
    );
    if (userTeamIds.size > 0 && teams.length > 0) {
      return teams.filter(t => userTeamIds.has(t.id));
    }
    return teams;
  }, [isSuperAdmin, scope, metrics?.authorizedTeams, teams, anyUser]);

  const selectedMember = useMemo(() => {
    if (!filters.memberId) return null;
    return (metrics?.groupMembers || []).find((m: any) => m.id === filters.memberId) || null;
  }, [filters.memberId, metrics?.groupMembers]);

  const handleScopeChange = (nextScope: 'my_tasks' | 'my_group') => {
    setScope(nextScope);
    if (nextScope === 'my_tasks') {
      setFilters(prev => ({ ...prev, memberId: undefined, teamId: undefined }));
    }
  };

  const handleDateChange = (dates: any) => {
    if (dates && dates.length === 2 && dates[0] && dates[1]) {
      setFilters(prev => ({
        ...prev,
        startDate: dates[0].toISOString(),
        endDate: dates[1].toISOString()
      }));
    } else {
      setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined }));
    }
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Boolean(filters.teamId || filters.memberId || filters.startDate || filters.endDate);

  const summary = useMemo(() => {
    const s = metrics?.summary || {};
    const total = Number(s.total) || 0;
    const completed = Number(s.completed) || 0;
    const overdue = Number(s.overdue) || 0;
    const blocked = Number(s.blocked) || 0;
    const active = Number(s.active) || 0;

    // Derive pending & inProgress from summary or statusDistribution for backward compatibility
    const statusMap = new Map<string, number>();
    if (Array.isArray(metrics?.statusDistribution)) {
      for (const item of metrics.statusDistribution) {
        statusMap.set(item.status, Number(item.count) || 0);
      }
    }

    const pending =
      s.pending !== undefined
        ? Number(s.pending)
        : statusMap.get('TODO') ?? 0;

    const inProgress =
      s.inProgress !== undefined
        ? Number(s.inProgress)
        : statusMap.has('IN_PROGRESS') || statusMap.has('IN_REVIEW') || statusMap.has('REJECTED')
        ? (statusMap.get('IN_PROGRESS') || 0) +
          (statusMap.get('IN_REVIEW') || 0) +
          (statusMap.get('REVIEW') || 0) +
          (statusMap.get('REJECTED') || 0)
        : Math.max(0, active - pending);

    const approaching =
      s.approaching !== undefined
        ? Number(s.approaching)
        : Array.isArray(metrics?.upcoming)
        ? metrics.upcoming.length
        : 0;

    const completionRate = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    return {
      total,
      pending,
      inProgress,
      active,
      completed,
      overdue,
      approaching,
      blocked,
      completionRate,
    };
  }, [metrics]);

  const memberBreakdownList: any[] = useMemo(() => {
    if (Array.isArray(metrics?.memberBreakdown) && metrics.memberBreakdown.length > 0) {
      return metrics.memberBreakdown;
    }
    if (Array.isArray(metrics?.workload)) {
      return metrics.workload.map((w: any) => {
        const activeTasks = Number(w.activeTasks) || 0;
        const completedTasks = Number(w.completedTasks) || 0;
        const totalTasks = w.totalTasks !== undefined ? Number(w.totalTasks) : activeTasks + completedTasks;
        const pendingTasks = w.pendingTasks !== undefined ? Number(w.pendingTasks) : 0;
        const inProgressTasks = w.inProgressTasks !== undefined ? Number(w.inProgressTasks) : activeTasks;
        const overdueTasks = w.overdueTasks !== undefined ? Number(w.overdueTasks) : 0;
        const completionRate =
          w.completionRate !== undefined
            ? Number(w.completionRate)
            : totalTasks > 0
            ? Math.round((completedTasks / totalTasks) * 100)
            : 0;
        return {
          ...w,
          totalTasks,
          pendingTasks,
          inProgressTasks,
          activeTasks,
          completedTasks,
          overdueTasks,
          completionRate,
        };
      });
    }
    return [];
  }, [metrics]);

  const getMetricInsight = () => {
    if (!metrics) return null;
    const insights: string[] = [];
    if (summary.overdue > 0) {
      insights.push(
        scope === 'my_tasks'
          ? `You have ${summary.overdue} overdue task${summary.overdue > 1 ? 's' : ''} requiring immediate attention.`
          : `${summary.overdue} task${summary.overdue > 1 ? 's' : ''} are overdue and require immediate attention.`
      );
    }
    if (summary.approaching > 0) {
      insights.push(
        `${summary.approaching} task${summary.approaching > 1 ? 's are' : ' is'} approaching deadline.`
      );
    }
    if (summary.blocked > 0) {
      insights.push(`${summary.blocked} tasks are currently blocked.`);
    }
    if (scope === 'my_group') {
      const highWorkloadUsers = (metrics.workload || []).filter((w: any) => w.activeTasks > 10);
      if (highWorkloadUsers.length > 0) {
        insights.push(`${highWorkloadUsers.length} team members have more than 10 active tasks.`);
      }
    }

    if (insights.length === 0) {
      return scope === 'my_tasks'
        ? 'You are right on track with no overdue tasks or bottlenecks.'
        : 'Team is operating smoothly with no immediate bottlenecks.';
    }
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
        <span className="text-red-500 font-semibold text-xs whitespace-nowrap">
          {date ? dayjs(date).format('MMM DD, YYYY • hh:mm A') : '-'}
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
        <span className="text-blue-600 font-semibold text-xs whitespace-nowrap">
          {date ? dayjs(date).format('MMM DD, YYYY • hh:mm A') : '-'}
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

  const renderMemberBreakdownColumns = () => [
    {
      title: 'Group Member',
      dataIndex: 'userName',
      key: 'userName',
      render: (name: string, record: any) => {
        const initial = (name || 'U').charAt(0).toUpperCase();
        const isFiltered = filters.memberId === record.userId;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar size={30} className="bg-indigo-100 text-indigo-700 font-semibold text-xs shrink-0 border border-indigo-200">
              {initial}
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                {name}
                {isFiltered && (
                  <Tag color="purple" className="ml-1.5 text-[10px] py-0 px-1.5">Filtered</Tag>
                )}
              </span>
              {(record.designation || record.roleName) && (
                <span className="text-[11px] text-gray-500 truncate">
                  {[record.designation, record.roleName].filter(Boolean).join(' • ')}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Total',
      dataIndex: 'totalTasks',
      key: 'totalTasks',
      align: 'center' as const,
      render: (val: number) => <span className="font-semibold text-gray-800">{val}</span>
    },
    {
      title: 'Pending',
      dataIndex: 'pendingTasks',
      key: 'pendingTasks',
      align: 'center' as const,
      render: (val: number) => <Tag color="default" className="m-0 font-medium">{val}</Tag>
    },
    {
      title: 'In Progress',
      dataIndex: 'inProgressTasks',
      key: 'inProgressTasks',
      align: 'center' as const,
      render: (val: number) => <Tag color="blue" className="m-0 font-medium">{val}</Tag>
    },
    {
      title: 'Completed',
      dataIndex: 'completedTasks',
      key: 'completedTasks',
      align: 'center' as const,
      render: (val: number) => <Tag color="green" className="m-0 font-medium">{val}</Tag>
    },
    {
      title: 'Overdue',
      dataIndex: 'overdueTasks',
      key: 'overdueTasks',
      align: 'center' as const,
      render: (val: number) => (
        <Tag color={val > 0 ? 'red' : 'default'} className="m-0 font-medium">
          {val}
        </Tag>
      )
    },
    {
      title: 'Completion Rate',
      dataIndex: 'completionRate',
      key: 'completionRate',
      width: 160,
      render: (rate: number) => (
        <Progress
          percent={rate || 0}
          size="small"
          strokeColor={rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#f59e0b'}
        />
      )
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: any, record: any) => {
        const isSelected = filters.memberId === record.userId;
        return (
          <Button
            size="small"
            type={isSelected ? 'primary' : 'default'}
            onClick={() =>
              setFilters(prev => ({
                ...prev,
                memberId: isSelected ? undefined : record.userId
              }))
            }
            className="text-xs"
          >
            {isSelected ? 'Showing' : 'View Metrics'}
          </Button>
        );
      }
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
              <span className={`font-medium flex items-center gap-1 shrink-0 ${isOverdue ? 'text-red-500 font-semibold' : 'text-blue-600'}`}>
                <CalendarOutlined className="text-[11px]" />
                {task.deadline ? dayjs(task.deadline).format('MMM DD, YYYY • hh:mm A') : 'No deadline'}
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
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span>Task Dashboard</span>
            <span
              data-testid="dashboard-scope-badge"
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                scope === 'my_group'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {scope === 'my_group'
                ? selectedMember
                  ? `Viewing: My Group • ${selectedMember.name}`
                  : `Viewing: My Group (${groupMembers.length} member${groupMembers.length === 1 ? '' : 's'})`
                : 'Viewing: My Tasks'}
            </span>
          </div>
        }
        description={
          scope === 'my_group'
            ? 'Analyse task distribution, completion rates, and deadlines across your authorized group'
            : 'Personal overview of your assigned tasks, progress, and upcoming deadlines'
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchMetrics}
            loading={loading}
            title="Refresh dashboard"
          />
        }
      />

      {/* Scope Toggle & Filter Bar */}
      <div className="bg-white p-3.5 sm:p-5 mb-4 sm:mb-6 rounded-xl shadow-xs border border-gray-200/80 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          {canViewGroup && (
            <div className="flex items-center gap-2" data-testid="dashboard-scope-switcher">
              <Button
                type={scope === 'my_tasks' ? 'primary' : 'default'}
                icon={<UserOutlined />}
                data-testid="scope-my-tasks-btn"
                onClick={() => handleScopeChange('my_tasks')}
                className={
                  scope === 'my_tasks'
                    ? 'bg-blue-600 text-white hover:!bg-blue-700 font-medium'
                    : 'text-gray-700 hover:text-blue-600 border-gray-300 font-medium'
                }
              >
                {scope === 'my_tasks' ? 'My Tasks ✓' : 'My Tasks'}
              </Button>
              <Button
                type={scope === 'my_group' ? 'primary' : 'default'}
                icon={<TeamOutlined />}
                data-testid="scope-my-group-btn"
                onClick={() => handleScopeChange('my_group')}
                className={
                  scope === 'my_group'
                    ? 'bg-indigo-600 text-white hover:!bg-indigo-700 border-indigo-600 font-medium'
                    : 'text-gray-700 hover:text-indigo-600 border-gray-300 font-medium'
                }
              >
                {scope === 'my_group'
                  ? `My Group (${groupMembers.length}) ✓`
                  : `My Group (${groupMembers.length})`}
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
          {(scope === 'my_group' || availableTeams.length > 1 || isSuperAdmin) && (
            <Select
              placeholder="Filter by Team"
              allowClear
              className="w-full sm:w-52"
              value={filters.teamId}
              options={availableTeams.map((t: any) => ({ value: t.id, label: t.name }))}
              onChange={(val) =>
                setFilters(prev => ({
                  ...prev,
                  teamId: val || undefined,
                  memberId: undefined,
                }))
              }
            />
          )}

          {scope === 'my_group' && groupMembers.length > 0 && (
            <Select
              placeholder="Filter by Group Member"
              allowClear
              showSearch
              optionFilterProp="label"
              data-testid="group-member-select"
              className="w-full sm:w-56"
              value={filters.memberId}
              options={groupMembers.map((m: any) => ({
                value: m.id,
                label: m.designation ? `${m.name} (${m.designation})` : m.name,
              }))}
              onChange={(val) => setFilters(prev => ({ ...prev, memberId: val || undefined }))}
            />
          )}

          <RangePicker
            onChange={handleDateChange}
            className="w-full sm:w-auto"
          />

          {hasActiveFilters && (
            <Button
              type="text"
              icon={<CloseCircleOutlined />}
              onClick={handleClearFilters}
              className="text-gray-500 hover:text-red-500 text-xs flex items-center"
            >
              Reset
            </Button>
          )}
        </div>
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

          {/* KPI Grid: 6 cards (2 columns on xs, 3 on sm, 6 on lg) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <Card 
              onClick={() => navigate('/tasks')} 
              data-testid="kpi-total-tasks"
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Total Tasks</span>} 
                value={summary.total} 
                prefix={<ProfileOutlined className="text-gray-400" />} 
                styles={{ content: { fontSize: '1.25rem', fontWeight: 600 } }}
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks?status=TODO')} 
              data-testid="kpi-pending-tasks"
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Pending</span>} 
                value={summary.pending} 
                styles={{ content: { color: '#6b7280', fontSize: '1.25rem', fontWeight: 600 } }} 
                prefix={<HourglassOutlined />} 
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks?status=IN_PROGRESS')} 
              data-testid="kpi-in-progress-tasks"
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">In Progress</span>} 
                value={summary.inProgress} 
                styles={{ content: { color: '#1890ff', fontSize: '1.25rem', fontWeight: 600 } }} 
                prefix={<SyncOutlined />} 
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks?status=COMPLETED')} 
              data-testid="kpi-completed-tasks"
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Completed</span>} 
                value={summary.completed} 
                styles={{ content: { color: '#52c41a', fontSize: '1.25rem', fontWeight: 600 } }} 
                prefix={<CheckCircleOutlined />} 
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks')} 
              data-testid="kpi-overdue-tasks"
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Overdue</span>} 
                value={summary.overdue} 
                styles={{ content: { color: '#f5222d', fontSize: '1.25rem', fontWeight: 600 } }} 
                prefix={<WarningOutlined />} 
              />
            </Card>

            <Card 
              onClick={() => navigate('/tasks')} 
              data-testid="kpi-approaching-tasks"
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
              styles={{ body: { padding: '14px 16px' } }}
            >
              <Statistic 
                title={<span className="text-xs sm:text-sm text-gray-500 font-medium">Approaching Deadline</span>} 
                value={summary.approaching} 
                styles={{ content: { color: '#722ed1', fontSize: '1.25rem', fontWeight: 600 } }} 
                prefix={<ClockCircleOutlined />} 
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
                        data={metrics.statusDistribution || []}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label
                      >
                        {(metrics.statusDistribution || []).map((entry: any, index: number) => (
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
                    <BarChart data={metrics.priorityDistribution || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {(metrics.priorityDistribution || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PRIORITY_CHART_COLORS[entry.priority] || STATUS_COLORS[entry.priority] || '#1890ff'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card 
                title={
                  <span className="font-semibold text-sm sm:text-base">
                    {scope === 'my_group' ? 'Group Workload Overview' : 'Completion Overview'}
                  </span>
                } 
                className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                styles={{ body: { padding: '12px' } }}
              >
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.workload || []} layout="vertical" margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
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

          {/* Individual User-Level Breakdown in Group Mode */}
          {scope === 'my_group' && (
            <Card
              data-testid="group-member-breakdown-card"
              title={
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Space>
                    <TeamOutlined className="text-indigo-600" />
                    <span className="font-semibold text-sm sm:text-base">
                      Group Member Task Breakdown ({memberBreakdownList.length})
                    </span>
                  </Space>
                  {filters.memberId && (
                    <Button
                      size="small"
                      type="link"
                      onClick={() => setFilters(prev => ({ ...prev, memberId: undefined }))}
                    >
                      Show all group members
                    </Button>
                  )}
                </div>
              }
              className="rounded-xl border border-gray-200/80 shadow-xs"
              styles={{ body: { padding: '12px 16px' } }}
            >
              {/* Desktop Breakdown Table */}
              <div className="hidden md:block">
                <Table
                  dataSource={memberBreakdownList}
                  columns={renderMemberBreakdownColumns()}
                  rowKey="userId"
                  size="small"
                  pagination={memberBreakdownList.length > 10 ? { pageSize: 10 } : false}
                  locale={{ emptyText: <Empty description="No group members found in scope" /> }}
                />
              </div>

              {/* Mobile Breakdown Cards */}
              <div className="md:hidden space-y-2.5">
                {memberBreakdownList.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 text-xs">
                    No group members found in scope.
                  </div>
                ) : (
                  memberBreakdownList.map((member: any) => {
                    const isSelected = filters.memberId === member.userId;
                    return (
                      <div
                        key={member.userId}
                        className="p-3 bg-gray-50/80 rounded-lg border border-gray-200/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-gray-900 text-sm truncate">
                              {member.userName}
                            </span>
                            {(member.designation || member.roleName) && (
                              <span className="text-xs text-gray-500 truncate">
                                {[member.designation, member.roleName].filter(Boolean).join(' • ')}
                              </span>
                            )}
                          </div>
                          <Button
                            size="small"
                            type={isSelected ? 'primary' : 'default'}
                            onClick={() =>
                              setFilters(prev => ({
                                ...prev,
                                memberId: isSelected ? undefined : member.userId
                              }))
                            }
                            className="text-xs"
                          >
                            {isSelected ? 'Showing' : 'Filter'}
                          </Button>
                        </div>

                        <div className="grid grid-cols-5 gap-1.5 text-center text-xs pt-1 border-t border-gray-200/60">
                          <div>
                            <div className="text-gray-400 text-[10px]">Total</div>
                            <div className="font-semibold text-gray-800">{member.totalTasks}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-[10px]">Pending</div>
                            <div className="font-semibold text-gray-600">{member.pendingTasks}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-[10px]">In Prog</div>
                            <div className="font-semibold text-blue-600">{member.inProgressTasks}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-[10px]">Done</div>
                            <div className="font-semibold text-emerald-600">{member.completedTasks}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-[10px]">Overdue</div>
                            <div className="font-semibold text-red-600">{member.overdueTasks}</div>
                          </div>
                        </div>

                        <Progress
                          percent={member.completionRate || 0}
                          size="small"
                          strokeColor={member.completionRate >= 80 ? '#10b981' : '#3b82f6'}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          )}

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

