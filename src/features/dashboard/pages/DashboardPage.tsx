import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Tag,
  Button,
  Table,
  Tabs,
  Avatar,
  Empty,
  Skeleton,
} from 'antd';
import {
  CheckCircleOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  CustomerServiceOutlined,
  SyncOutlined,
  PlusOutlined,
  ArrowRightOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  FundOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  AimOutlined,
  FolderOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { PageContainer } from '@/shared/components/PageContainer';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { CoordinatorDashboard } from './CoordinatorDashboard';
import { taskApi, type Task } from '@/features/tasks/api/task.api';
import { ticketService } from '@/features/tickets/api/ticket.service';
import { teamService, type Team } from '@/features/teams/api/team.service';
import { userService } from '@/features/users/api/user.service';

const STATUS_PALETTE: Record<string, { label: string; color: string }> = {
  TODO: { label: 'To Do', color: '#94a3b8' },
  IN_PROGRESS: { label: 'In Progress', color: '#2563eb' },
  IN_REVIEW: { label: 'In Review', color: '#f59e0b' },
  COMPLETED: { label: 'Completed', color: '#10b981' },
  VERIFIED: { label: 'Verified', color: '#06b6d4' },
  CANCELLED: { label: 'Cancelled', color: '#64748b' },
  BLOCKED: { label: 'Blocked', color: '#ef4444' },
};

const PRIORITY_PALETTE: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: '#10b981' },
  MEDIUM: { label: 'Medium', color: '#3b82f6' },
  HIGH: { label: 'High', color: '#f59e0b' },
  CRITICAL: { label: 'Critical', color: '#ef4444' },
  URGENT: { label: 'Urgent', color: '#ef4444' },
};

interface QuickLaunchItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  path: string;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  // Role & Permission Checks
  const isSuperAdmin =
    user?.type === 'super_admin' ||
    (user as any)?.role === 'Super Admin' ||
    (user as any)?.role?.name === 'Super Admin';

  const isCoordinator =
    (user as any)?.type === 'STUDENT_COORDINATOR' ||
    (user as any)?.role === 'STUDENT_COORDINATOR';

  const canReadTasks = hasPermission('tasks:read');
  const canReadTickets = hasPermission('tickets:read');
  const canCreateTickets = hasPermission('tickets:create') || isSuperAdmin;
  const canReadTeams = hasPermission('teams:read');
  const canReadUsers = hasPermission('users:read');
  const canReadRoles = hasPermission('roles:read');
  const canReadExecutiveKPI = hasPermission('kpi:read_executive_report');
  const canReadMELKPI = hasPermission('kpi:read_all') || hasPermission('kpi:curate_report');
  const canReadTeamKPI = hasPermission('kpi:read');
  const canReadThreads = hasPermission('foundation_threads:read');
  const canReadBatches = hasPermission('batches:read');
  const canReadStudents = hasPermission('students:read');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [metrics, setMetrics] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const fetchCalls: Promise<{ type: string; data: any }>[] = [];

      // Only invoke endpoints permitted for the user's role
      if (canReadTasks) {
        fetchCalls.push(
          taskApi.getDashboardMetrics({}).then((data) => ({ type: 'tasks', data }))
        );
      }

      if (canReadTickets) {
        fetchCalls.push(
          ticketService
            .getTickets({ limit: 8, sortBy: 'createdAt', sortOrder: 'desc' })
            .then((data) => ({ type: 'tickets', data }))
        );
      }

      if (canReadTeams) {
        fetchCalls.push(
          teamService.getTeams({ limit: 100 }).then((data) => ({ type: 'teams', data }))
        );
      }

      if (canReadUsers) {
        fetchCalls.push(
          userService.getUsers({ limit: 1 }).then((data) => ({ type: 'users', data }))
        );
      }

      if (fetchCalls.length > 0) {
        const results = await Promise.allSettled(fetchCalls);

        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            const { type, data } = result.value;
            if (type === 'tasks') {
              setMetrics(data);
            }
            if (type === 'tickets') {
              setTickets(Array.isArray(data?.data) ? data.data : []);
            }
            if (type === 'teams') {
              setTeams(Array.isArray(data?.data) ? data.data : []);
            }
            if (type === 'users') {
              setTotalUsers(data?.meta?.total || data?.data?.length || 0);
            }
          }
        });
      }

      setLastUpdated(dayjs().format('HH:mm:ss'));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isCoordinator) {
      fetchDashboardData();
    }
  }, [isCoordinator, canReadTasks, canReadTickets, canReadTeams, canReadUsers]);

  const greeting = useMemo(() => {
    const hour = dayjs().hour();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const roleDisplayName = useMemo(() => {
    if (isSuperAdmin) return 'Super Administrator';
    const roleName = (user as any)?.role?.name || (user as any)?.role;
    if (roleName) return roleName;
    return 'Enterprise Member';
  }, [user, isSuperAdmin]);

  const completionRate = useMemo(() => {
    const total = metrics?.summary?.total || 0;
    const completed = (metrics?.summary?.completed || 0) + (metrics?.summary?.verified || 0);
    if (total === 0) return 0;
    return Math.min(100, Math.round((completed / total) * 100));
  }, [metrics]);

  const openTicketsCount = useMemo(() => {
    return tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
  }, [tickets]);

  const statusChartData = useMemo(() => {
    if (!metrics?.statusDistribution || !Array.isArray(metrics.statusDistribution)) {
      return [];
    }
    return metrics.statusDistribution
      .filter((item: any) => item.count > 0)
      .map((item: any) => ({
        name: STATUS_PALETTE[item.status]?.label || item.status,
        value: item.count,
        color: STATUS_PALETTE[item.status]?.color || '#94a3b8',
      }));
  }, [metrics]);

  const priorityChartData = useMemo(() => {
    if (!metrics?.priorityDistribution || !Array.isArray(metrics.priorityDistribution)) {
      return [];
    }
    return metrics.priorityDistribution.map((item: any) => ({
      name: PRIORITY_PALETTE[item.priority]?.label || item.priority,
      count: item.count,
      fill: PRIORITY_PALETTE[item.priority]?.color || '#3b82f6',
    }));
  }, [metrics]);

  const towerTeamsCount = useMemo(() => {
    return teams.filter((t) => t.type === 'TOWER').length;
  }, [teams]);

  // Construct quick launch items permitted for user's role
  const quickLaunchItems = useMemo<QuickLaunchItem[]>(() => {
    const items: (QuickLaunchItem | false)[] = [
      canReadTeams && {
        key: 'teams',
        label: 'Teams',
        icon: <ApartmentOutlined className="text-lg text-blue-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-blue-200 hover:bg-blue-50/30',
        path: '/teams',
      },
      canReadUsers && {
        key: 'users',
        label: 'Users',
        icon: <UserOutlined className="text-lg text-purple-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-purple-200 hover:bg-purple-50/30',
        path: '/users',
      },
      canReadRoles && {
        key: 'roles',
        label: 'Roles & RBAC',
        icon: <SafetyCertificateOutlined className="text-lg text-amber-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-amber-200 hover:bg-amber-50/30',
        path: '/roles',
      },
      canReadExecutiveKPI && {
        key: 'executive_kpi',
        label: 'Executive KPI',
        icon: <BarChartOutlined className="text-lg text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-emerald-200 hover:bg-emerald-50/30',
        path: '/kpi/executive',
      },
      canReadMELKPI && {
        key: 'mel_kpi',
        label: 'MEL Analytics',
        icon: <FundOutlined className="text-lg text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-cyan-200 hover:bg-cyan-50/30',
        path: '/kpi/mel',
      },
      canReadTeamKPI && {
        key: 'team_kpi',
        label: 'Team KPI',
        icon: <AimOutlined className="text-lg text-rose-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-rose-200 hover:bg-rose-50/30',
        path: '/kpi/teams',
      },
      canReadTasks && {
        key: 'tasks',
        label: 'Tasks Board',
        icon: <CheckCircleOutlined className="text-lg text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-indigo-200 hover:bg-indigo-50/30',
        path: '/tasks',
      },
      canReadTickets && {
        key: 'tickets',
        label: 'Support Tickets',
        icon: <CustomerServiceOutlined className="text-lg text-teal-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-teal-200 hover:bg-teal-50/30',
        path: '/tickets',
      },
      canReadThreads && {
        key: 'threads',
        label: 'Foundation Threads',
        icon: <FolderOutlined className="text-lg text-violet-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-violet-200 hover:bg-violet-50/30',
        path: '/foundation/threads',
      },
      canReadBatches && {
        key: 'batches',
        label: 'Batches',
        icon: <DatabaseOutlined className="text-lg text-orange-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-orange-200 hover:bg-orange-50/30',
        path: '/batches',
      },
      canReadStudents && {
        key: 'students',
        label: 'Students',
        icon: <TeamOutlined className="text-lg text-sky-600 mb-2 group-hover:scale-110 transition-transform" />,
        colorClass: 'hover:border-sky-200 hover:bg-sky-50/30',
        path: '/students',
      },
    ];

    return items.filter(Boolean) as QuickLaunchItem[];
  }, [
    canReadTeams,
    canReadUsers,
    canReadRoles,
    canReadExecutiveKPI,
    canReadMELKPI,
    canReadTeamKPI,
    canReadTasks,
    canReadTickets,
    canReadThreads,
    canReadBatches,
    canReadStudents,
  ]);

  if (isCoordinator) {
    return <CoordinatorDashboard />;
  }

  // Count active KPI cards to dynamically adjust responsive column spans
  const activeKpiCount =
    (canReadTasks ? 2 : 0) +
    (canReadTickets ? 1 : 0) +
    (canReadTeams || canReadUsers ? 1 : 0);

  const kpiColSpan = {
    xs: 24,
    sm: activeKpiCount > 1 ? 12 : 24,
    lg: activeKpiCount >= 4 ? 6 : activeKpiCount === 3 ? 8 : activeKpiCount === 2 ? 12 : 24,
  };

  const ticketColumns = [
    {
      title: 'Ticket',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <div className="flex flex-col">
          <span
            onClick={() => navigate(`/tickets/${record.id}`)}
            className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer line-clamp-1 transition-colors"
          >
            {text}
          </span>
          <span className="text-xs text-gray-400">
            {record.ticketNumber ? `#${record.ticketNumber} • ` : ''}
            {dayjs(record.createdAt).format('MMM D, YYYY')}
          </span>
        </div>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => {
        const color =
          priority === 'URGENT' || priority === 'CRITICAL'
            ? 'red'
            : priority === 'HIGH'
            ? 'orange'
            : priority === 'MEDIUM'
            ? 'blue'
            : 'default';
        return <Tag color={color}>{priority || 'NORMAL'}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const color =
          status === 'OPEN'
            ? 'blue'
            : status === 'IN_PROGRESS'
            ? 'processing'
            : status === 'RESOLVED' || status === 'CLOSED'
            ? 'success'
            : 'default';
        return <Tag color={color}>{status?.replace('_', ' ') || 'OPEN'}</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 70,
      render: (_: any, record: any) => (
        <Button
          type="text"
          size="small"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate(`/tickets/${record.id}`)}
        />
      ),
    },
  ];

  const hasAnyOperationalData =
    canReadTasks || canReadTickets || canReadTeams || canReadUsers || quickLaunchItems.length > 0;

  return (
    <PageContainer>
      {/* Dynamic Welcome & Command Bar */}
      <div className="mb-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-36 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-400/20">
                <SafetyCertificateOutlined className="text-blue-300" /> {roleDisplayName}
              </span>
              {lastUpdated && (
                <span className="text-xs text-blue-200/60 hidden sm:inline">
                  Synced: {lastUpdated}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0">
              {greeting}, {(user as any)?.name || 'User'}
            </h1>
            <p className="text-sm text-blue-100/70 mt-1 max-w-xl m-0">
              {isSuperAdmin
                ? 'Full enterprise operational command across all departments, tasks, tickets, and analytics.'
                : `Role-scoped operational overview tailored for ${roleDisplayName}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
            <Button
              icon={<SyncOutlined spin={refreshing} />}
              onClick={() => fetchDashboardData(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/30 backdrop-blur-sm"
            >
              Refresh
            </Button>
            {canReadTasks && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/tasks')}
                className="bg-blue-500 hover:bg-blue-400 border-none shadow-md font-medium"
              >
                Tasks Hub
              </Button>
            )}
            {canCreateTickets && (
              <Button
                icon={<PlusOutlined />}
                onClick={() => navigate('/tickets/new')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white border-none shadow-md font-medium"
              >
                New Ticket
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading && activeKpiCount > 0 && !metrics && tickets.length === 0 ? (
        <div className="space-y-6">
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4].slice(0, activeKpiCount || 4).map((i) => (
              <Col {...kpiColSpan} key={i}>
                <Card variant="borderless" className="rounded-xl shadow-xs">
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card variant="borderless" className="rounded-xl shadow-xs">
                <Skeleton active paragraph={{ rows: 6 }} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card variant="borderless" className="rounded-xl shadow-xs">
                <Skeleton active paragraph={{ rows: 6 }} />
              </Card>
            </Col>
          </Row>
        </div>
      ) : !hasAnyOperationalData ? (
        <Card variant="borderless" className="rounded-2xl border border-gray-100 shadow-xs p-8 text-center">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div className="space-y-2">
                <div className="font-semibold text-gray-800 text-base">
                  Welcome to your Portal Workspace
                </div>
                <div className="text-gray-500 text-xs max-w-md mx-auto">
                  Your assigned role ({roleDisplayName}) does not currently have permissions to view general operational task feeds or tickets.
                </div>
              </div>
            }
          >
            <Button type="primary" onClick={() => navigate('/profile')}>
              View My Profile
            </Button>
          </Empty>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Row 1: KPI Summary Metric Cards (Permission-Gated) */}
          {activeKpiCount > 0 && (
            <Row gutter={[16, 16]}>
              {/* Active Tasks & Completion (Requires tasks:read) */}
              {canReadTasks && (
                <Col {...kpiColSpan}>
                  <Card
                    variant="borderless"
                    hoverable
                    onClick={() => navigate('/tasks')}
                    className="rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all duration-200 h-full"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Active Tasks
                        </span>
                        <div className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                          {metrics?.summary?.active ?? 0}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-lg">
                        <CheckCircleOutlined />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Completion Rate</span>
                        <span className="font-semibold text-gray-700">{completionRate}%</span>
                      </div>
                      <Progress
                        percent={completionRate}
                        showInfo={false}
                        strokeColor={{ '0%': '#3b82f6', '100%': '#10b981' }}
                        size="small"
                      />
                      <div className="text-[11px] text-gray-400 mt-1 flex justify-between">
                        <span>Total: {metrics?.summary?.total ?? 0}</span>
                        <span>Done: {metrics?.summary?.completed ?? 0}</span>
                      </div>
                    </div>
                  </Card>
                </Col>
              )}

              {/* Overdue / Blocked Risk Card (Requires tasks:read) */}
              {canReadTasks && (
                <Col {...kpiColSpan}>
                  <Card
                    variant="borderless"
                    hoverable
                    onClick={() => navigate('/tasks')}
                    className="rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all duration-200 h-full"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Risk & Blockers
                        </span>
                        <div className="text-2xl sm:text-3xl font-bold text-rose-600 mt-1">
                          {(metrics?.summary?.overdue ?? 0) + (metrics?.summary?.blocked ?? 0)}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 text-lg">
                        <AlertOutlined />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-1.5 min-h-[38px]">
                      {metrics?.summary?.overdue > 0 ? (
                        <Tag color="error" className="m-0 text-xs">
                          {metrics.summary.overdue} Overdue
                        </Tag>
                      ) : null}
                      {metrics?.summary?.blocked > 0 ? (
                        <Tag color="warning" className="m-0 text-xs">
                          {metrics.summary.blocked} Blocked
                        </Tag>
                      ) : null}
                      {!metrics?.summary?.overdue && !metrics?.summary?.blocked ? (
                        <Tag color="success" className="m-0 text-xs">
                          All systems on track
                        </Tag>
                      ) : null}
                    </div>
                  </Card>
                </Col>
              )}

              {/* Support Tickets Dispatch (Requires tickets:read) */}
              {canReadTickets && (
                <Col {...kpiColSpan}>
                  <Card
                    variant="borderless"
                    hoverable
                    onClick={() => navigate('/tickets')}
                    className="rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all duration-200 h-full"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Support Dispatch
                        </span>
                        <div className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                          {openTicketsCount}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-lg">
                        <CustomerServiceOutlined />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 min-h-[38px]">
                      <span>Tracked in feed:</span>
                      <span className="font-medium text-gray-800">{tickets.length} tickets</span>
                    </div>
                  </Card>
                </Col>
              )}

              {/* Organization Reach (Requires teams:read or users:read) */}
              {(canReadTeams || canReadUsers) && (
                <Col {...kpiColSpan}>
                  <Card
                    variant="borderless"
                    hoverable
                    onClick={() => navigate(canReadTeams ? '/teams' : '/users')}
                    className="rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all duration-200 h-full"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Organization Reach
                        </span>
                        <div className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
                          {canReadUsers ? totalUsers || '--' : `${teams.length} Teams`}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 text-lg">
                        <TeamOutlined />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 min-h-[38px]">
                      {canReadTeams ? (
                        <>
                          <span>Active Teams:</span>
                          <span className="font-semibold text-purple-700">
                            {teams.length} Teams {towerTeamsCount > 0 ? `(${towerTeamsCount} Tower)` : ''}
                          </span>
                        </>
                      ) : (
                        <span>Team directory access restricted</span>
                      )}
                    </div>
                  </Card>
                </Col>
              )}
            </Row>
          )}

          {/* Row 2: Visual Charts & Analytics (Only shown if user has tasks:read permission) */}
          {canReadTasks && (
            <Row gutter={[16, 16]}>
              {/* Status Breakdown (Donut Chart) */}
              <Col xs={24} lg={12}>
                <Card
                  variant="borderless"
                  className="rounded-2xl border border-gray-100 shadow-xs h-full"
                  title={
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm sm:text-base">
                        Task Pipeline Breakdown
                      </span>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate('/tasks/dashboard')}
                        className="p-0 text-blue-600 hover:text-blue-700 text-xs"
                      >
                        Task Analytics →
                      </Button>
                    </div>
                  }
                >
                  {statusChartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center">
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No active tasks in status pipeline"
                      />
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {statusChartData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: any) => [`${value} tasks`, 'Count']}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              borderRadius: '8px',
                              border: 'none',
                              fontSize: '12px',
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </Col>

              {/* Priority Distribution (Bar Chart) */}
              <Col xs={24} lg={12}>
                <Card
                  variant="borderless"
                  className="rounded-2xl border border-gray-100 shadow-xs h-full"
                  title={
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm sm:text-base">
                        Task Priority Spectrum
                      </span>
                      <Tag color="blue" className="text-xs">
                        Total: {metrics?.summary?.total ?? 0}
                      </Tag>
                    </div>
                  }
                >
                  {priorityChartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center">
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No task priority distribution recorded"
                      />
                    </div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={priorityChartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <RechartsTooltip
                            formatter={(value: any) => [`${value} tasks`, 'Priority']}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              color: '#fff',
                              borderRadius: '8px',
                              border: 'none',
                              fontSize: '12px',
                            }}
                          />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                            {priorityChartData.map((entry: any, index: number) => (
                              <Cell key={`bar-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          )}

          {/* Row 3: Live Feeds & Action Lists (Responsive to active modules) */}
          {(canReadTickets || canReadTasks) && (
            <Row gutter={[16, 16]}>
              {/* Recent Support Tickets (Requires tickets:read) */}
              {canReadTickets && (
                <Col xs={24} lg={canReadTasks ? 14 : 24}>
                  <Card
                    variant="borderless"
                    className="rounded-2xl border border-gray-100 shadow-xs h-full flex flex-col"
                    title={
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CustomerServiceOutlined className="text-blue-600" />
                          <span className="font-semibold text-gray-900 text-sm sm:text-base">
                            Recent Support Tickets
                          </span>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => navigate('/tickets')}
                          className="p-0 text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          View All ({tickets.length}) →
                        </Button>
                      </div>
                    }
                  >
                    {tickets.length === 0 ? (
                      <div className="py-12 text-center">
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="No recent support tickets logged"
                        />
                        {canCreateTickets && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => navigate('/tickets/new')}
                            className="mt-3"
                          >
                            Create First Ticket
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <Table
                            dataSource={tickets}
                            columns={ticketColumns}
                            rowKey="id"
                            pagination={{ pageSize: 5, size: 'small' }}
                            size="small"
                          />
                        </div>

                        {/* Mobile Friendly Card List */}
                        <div className="sm:hidden space-y-2.5">
                          {tickets.slice(0, 5).map((ticket) => (
                            <div
                              key={ticket.id}
                              onClick={() => navigate(`/tickets/${ticket.id}`)}
                              className="p-3 bg-gray-50/70 hover:bg-blue-50/40 rounded-xl border border-gray-100 cursor-pointer transition-all"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-sm text-gray-900 line-clamp-1">
                                  {ticket.title}
                                </span>
                                <Tag
                                  color={
                                    ticket.priority === 'URGENT' || ticket.priority === 'CRITICAL'
                                      ? 'red'
                                      : ticket.priority === 'HIGH'
                                      ? 'orange'
                                      : 'blue'
                                  }
                                  className="m-0 text-[10px]"
                                >
                                  {ticket.priority || 'MED'}
                                </Tag>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                                <span>{dayjs(ticket.createdAt).format('MMM D, YYYY')}</span>
                                <Tag
                                  color={ticket.status === 'OPEN' ? 'blue' : 'default'}
                                  className="m-0 text-[10px]"
                                >
                                  {ticket.status?.replace('_', ' ') || 'OPEN'}
                                </Tag>
                              </div>
                            </div>
                          ))}
                          {tickets.length > 5 && (
                            <Button
                              block
                              size="small"
                              onClick={() => navigate('/tickets')}
                              className="mt-2"
                            >
                              View {tickets.length - 5} More Tickets
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </Card>
                </Col>
              )}

              {/* Deadlines & Bottlenecks (Requires tasks:read) */}
              {canReadTasks && (
                <Col xs={24} lg={canReadTickets ? 10 : 24}>
                  <Card
                    variant="borderless"
                    className="rounded-2xl border border-gray-100 shadow-xs h-full"
                    title={
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClockCircleOutlined className="text-amber-600" />
                          <span className="font-semibold text-gray-900 text-sm sm:text-base">
                            Deadlines & Bottlenecks
                          </span>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => navigate('/tasks')}
                          className="p-0 text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Task Board →
                        </Button>
                      </div>
                    }
                  >
                    <Tabs
                      defaultActiveKey="upcoming"
                      size="small"
                      items={[
                        {
                          key: 'upcoming',
                          label: `Upcoming (${metrics?.upcoming?.length || 0})`,
                          children: (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {!metrics?.upcoming || metrics.upcoming.length === 0 ? (
                                <div className="py-8 text-center text-xs text-gray-400">
                                  No urgent upcoming deadlines in the next 7 days.
                                </div>
                              ) : (
                                metrics.upcoming.slice(0, 5).map((task: Task) => (
                                  <div
                                    key={task.id}
                                    onClick={() => navigate('/tasks')}
                                    className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-100/70 transition-colors cursor-pointer flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium text-gray-900 truncate">
                                        {task.title}
                                      </div>
                                      <div className="text-[11px] text-gray-400">
                                        Due: {task.deadline ? dayjs(task.deadline).format('MMM D, YYYY') : 'No deadline'}
                                      </div>
                                    </div>
                                    <Tag
                                      color={
                                        task.priority === 'CRITICAL'
                                          ? 'red'
                                          : task.priority === 'HIGH'
                                          ? 'orange'
                                          : 'blue'
                                      }
                                      className="m-0 text-[10px]"
                                    >
                                      {task.priority}
                                    </Tag>
                                  </div>
                                ))
                              )}
                            </div>
                          ),
                        },
                        {
                          key: 'overdue',
                          label: `Overdue (${metrics?.overdue?.length || 0})`,
                          children: (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                              {!metrics?.overdue || metrics.overdue.length === 0 ? (
                                <div className="py-8 text-center text-xs text-emerald-600 font-medium">
                                  ✓ No overdue tasks right now!
                                </div>
                              ) : (
                                metrics.overdue.slice(0, 5).map((task: Task) => (
                                  <div
                                    key={task.id}
                                    onClick={() => navigate('/tasks')}
                                    className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50/80 transition-colors cursor-pointer flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-rose-900 truncate">
                                        {task.title}
                                      </div>
                                      <div className="text-[11px] text-rose-600 font-medium">
                                        Was due: {task.deadline ? dayjs(task.deadline).format('MMM D, YYYY') : 'Past due'}
                                      </div>
                                    </div>
                                    <Tag color="error" className="m-0 text-[10px]">
                                      {task.priority || 'OVERDUE'}
                                    </Tag>
                                  </div>
                                ))
                              )}
                            </div>
                          ),
                        },
                      ]}
                    />
                  </Card>
                </Col>
              )}
            </Row>
          )}

          {/* Row 4: Team Member Workload Spotlight & Quick Launchpad */}
          {(canReadTasks || quickLaunchItems.length > 0) && (
            <Row gutter={[16, 16]}>
              {/* Workload Spotlight (Requires tasks:read) */}
              {canReadTasks && (
                <Col xs={24} lg={quickLaunchItems.length > 0 ? 16 : 24}>
                  <Card
                    variant="borderless"
                    className="rounded-2xl border border-gray-100 shadow-xs h-full"
                    title={
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserOutlined className="text-purple-600" />
                          <span className="font-semibold text-gray-900 text-sm sm:text-base">
                            Team Member Workload Spotlight
                          </span>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => navigate('/tasks/dashboard')}
                          className="p-0 text-purple-600 hover:text-purple-700 text-xs font-medium"
                        >
                          Full Roster →
                        </Button>
                      </div>
                    }
                  >
                    {!metrics?.workload || metrics.workload.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-400">
                        No active workload allocations recorded
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {metrics.workload.slice(0, 6).map((member: any) => {
                          const activeCount = member.activeTasks || 0;
                          const completedCount = member.completedTasks || 0;
                          const totalAssigned = activeCount + completedCount;

                          return (
                            <div
                              key={member.userId}
                              className="p-3 bg-gray-50/70 rounded-xl border border-gray-100 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Avatar
                                  style={{ backgroundColor: '#4f46e5' }}
                                  size={34}
                                  className="font-medium shrink-0"
                                >
                                  {(member.userName || 'U').charAt(0).toUpperCase()}
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-900 truncate">
                                    {member.userName}
                                  </div>
                                  <div className="text-[11px] text-gray-400">
                                    {completedCount} done / {totalAssigned} assigned
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <Tag
                                  color={
                                    activeCount > 8
                                      ? 'red'
                                      : activeCount > 4
                                      ? 'orange'
                                      : 'green'
                                  }
                                  className="m-0 text-xs font-medium"
                                >
                                  {activeCount} Active
                                </Tag>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </Col>
              )}

              {/* Quick Access Launchpad (Permission Filtered) */}
              {quickLaunchItems.length > 0 && (
                <Col xs={24} lg={canReadTasks ? 8 : 24}>
                  <Card
                    variant="borderless"
                    className="rounded-2xl border border-gray-100 shadow-xs h-full"
                    title={
                      <div className="flex items-center gap-2">
                        <AppstoreOutlined className="text-blue-600" />
                        <span className="font-semibold text-gray-900 text-sm sm:text-base">
                          Quick Access Hub
                        </span>
                      </div>
                    }
                  >
                    <div
                      className={`grid gap-2.5 ${
                        canReadTasks
                          ? 'grid-cols-2'
                          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
                      }`}
                    >
                      {quickLaunchItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => navigate(item.path)}
                          className={`p-3 rounded-xl border border-gray-100 bg-white ${item.colorClass} transition-all text-left group flex flex-col justify-between`}
                        >
                          {item.icon}
                          <span className="text-xs font-medium text-gray-800">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </Card>
                </Col>
              )}
            </Row>
          )}
        </div>
      )}
    </PageContainer>
  );
};
