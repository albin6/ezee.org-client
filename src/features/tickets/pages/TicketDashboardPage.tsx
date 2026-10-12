import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Card,
  Select,
  DatePicker,
  Tag,
  Table,
  Row,
  Col,
  Statistic,
  Spin,
  Alert,
  Button,
  Progress,
  Avatar,
  Empty,
  Tooltip as AntTooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ProfileOutlined,
  UserOutlined,
  TeamOutlined,
  SyncOutlined,
  HourglassOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  FireOutlined,
  AlertOutlined,
  UnorderedListOutlined,
  TrophyOutlined,
  BellOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { ticketService, type TicketDashboardFilters } from '../api/ticket.service';
import { teamService } from '@/features/teams/api/team.service';
import { useAuthStore } from '@/features/auth/store/auth.store';

const { RangePicker } = DatePicker;

const STATUS_CHART_COLORS: Record<string, string> = {
  OPEN: '#2563eb',
  IN_PROGRESS: '#d97706',
  REOPENED: '#9333ea',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
};

const STATUS_TAG_COLORS: Record<string, string> = {
  OPEN: 'blue',
  IN_PROGRESS: 'gold',
  REOPENED: 'purple',
  RESOLVED: 'green',
  CLOSED: 'default',
};

const PERIOD_OPTIONS: {
  value: NonNullable<TicketDashboardFilters['period']>;
  label: string;
}[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom', label: 'Custom Date Range' },
  { value: 'all', label: 'All Time' },
];

export const TicketDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const authState = useAuthStore();
  const user = authState?.user;
  const anyUser = user as any;
  const isSuperAdmin =
    anyUser?.role?.name === 'Super Admin' ||
    anyUser?.type === 'super_admin' ||
    anyUser?.role === 'Super Admin';

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [scope, setScope] = useState<'my_overview' | 'group_overview'>('my_overview');
  const [period, setPeriod] =
    useState<NonNullable<TicketDashboardFilters['period']>>('last_30_days');
  const [filters, setFilters] = useState<{
    teamId?: string;
    memberId?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  useEffect(() => {
    if (typeof teamService?.getTeams === 'function') {
      teamService
        .getTeams({ page: 1, limit: 100 })
        .then((res) => setTeams(res?.data || []))
        .catch(() => {});
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    if (typeof ticketService?.getDashboardMetrics !== 'function') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const requestParams: TicketDashboardFilters = {
        scope,
        period,
        teamId: filters.teamId,
        memberId: scope === 'group_overview' ? filters.memberId : undefined,
        startDate: period === 'custom' ? filters.startDate : undefined,
        endDate: period === 'custom' ? filters.endDate : undefined,
      };
      const data = await ticketService.getDashboardMetrics(requestParams);
      setMetrics(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err?.message || 'Failed to load ticket dashboard metrics'
      );
    } finally {
      setLoading(false);
    }
  }, [scope, period, filters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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
      (m: any) =>
        !Array.isArray(m.teams) ||
        m.teams.length === 0 ||
        m.teams.some((t: any) => t.id === filters.teamId)
    );
  }, [metrics?.groupMembers, filters.teamId]);

  const availableTeams = useMemo(() => {
    if (isSuperAdmin) return teams;
    if (
      scope === 'group_overview' &&
      Array.isArray(metrics?.authorizedTeams) &&
      metrics.authorizedTeams.length > 0
    ) {
      return metrics.authorizedTeams;
    }
    const userTeamIds = new Set(
      (anyUser?.teamMembers || []).map((tm: any) => tm.teamId).filter(Boolean)
    );
    if (userTeamIds.size > 0 && teams.length > 0) {
      return teams.filter((t) => userTeamIds.has(t.id));
    }
    return teams;
  }, [isSuperAdmin, scope, metrics?.authorizedTeams, teams, anyUser]);

  const selectedMember = useMemo(() => {
    if (!filters.memberId) return null;
    return (metrics?.groupMembers || []).find((m: any) => m.id === filters.memberId) || null;
  }, [filters.memberId, metrics?.groupMembers]);

  const handleScopeChange = (nextScope: 'my_overview' | 'group_overview') => {
    setScope(nextScope);
    if (nextScope === 'my_overview') {
      setFilters((prev) => ({ ...prev, memberId: undefined }));
    }
  };

  const handlePeriodChange = (nextPeriod: NonNullable<TicketDashboardFilters['period']>) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== 'custom') {
      setFilters((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
    }
  };

  const handleCustomDateChange = (dates: any) => {
    if (dates && dates.length === 2 && dates[0] && dates[1]) {
      setPeriod('custom');
      setFilters((prev) => ({
        ...prev,
        startDate: dates[0].format ? dates[0].format('YYYY-MM-DD') : dates[0].toISOString(),
        endDate: dates[1].format ? dates[1].format('YYYY-MM-DD') : dates[1].toISOString(),
      }));
    } else {
      setFilters((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
    }
  };

  const handleResetFilters = () => {
    setPeriod('last_30_days');
    setFilters({});
  };

  const hasActiveFilters = Boolean(
    period !== 'last_30_days' ||
      filters.teamId ||
      filters.memberId ||
      filters.startDate ||
      filters.endDate
  );

  const summary = useMemo(() => {
    const s = metrics?.summary || {};
    const total = Number(s.total) || 0;
    const open = Number(s.open) || 0;
    const inProgress = Number(s.inProgress) || 0;
    const reopened = Number(s.reopened) || 0;
    const pending = s.pending !== undefined ? Number(s.pending) : open + reopened;
    const resolved = Number(s.resolved) || 0;
    const closed = Number(s.closed) || 0;
    const resolvedOrClosed =
      s.resolvedOrClosed !== undefined ? Number(s.resolvedOrClosed) : resolved + closed;
    const escalated = Number(s.escalated) || 0;
    const escalationEvents = Number(s.escalationEvents) || 0;
    const overdue = Number(s.overdue) || 0;
    const awaitingAction =
      s.awaitingAction !== undefined ? Number(s.awaitingAction) : open + reopened;
    const unread = Number(s.unread) || 0;
    const resolutionRate =
      s.resolutionRate !== undefined
        ? Number(s.resolutionRate)
        : total > 0
        ? Math.round((resolvedOrClosed / total) * 100)
        : 0;
    const escalationRate =
      s.escalationRate !== undefined
        ? Number(s.escalationRate)
        : total > 0
        ? Math.round((escalated / total) * 100)
        : 0;

    return {
      total,
      open,
      inProgress,
      reopened,
      pending,
      resolved,
      closed,
      resolvedOrClosed,
      escalated,
      escalationEvents,
      overdue,
      awaitingAction,
      unread,
      resolutionRate,
      escalationRate,
    };
  }, [metrics]);

  const resolutionPerf = useMemo(() => {
    const rp = metrics?.resolutionPerformance || {};
    const groupAvg = metrics?.groupAverageResolution || {};
    const totalResolved =
      rp.totalResolved !== undefined ? Number(rp.totalResolved) : summary.resolvedOrClosed;
    const validResolvedCount =
      rp.validResolvedCount !== undefined
        ? Number(rp.validResolvedCount)
        : groupAvg.validResolvedTickets !== undefined
        ? Number(groupAvg.validResolvedTickets)
        : totalResolved;

    return {
      totalResolved,
      validResolvedCount,
      eligibleForResolution:
        rp.eligibleForResolution !== undefined ? Number(rp.eligibleForResolution) : summary.total,
      avgResolutionTimeMs: rp.avgResolutionTimeMs ?? groupAvg.avgResolutionTimeMs ?? null,
      formattedAvgResolutionTime:
        rp.formattedAvgResolutionTime || groupAvg.formattedAvgResolutionTime || 'N/A',
      avgBusinessResolutionTimeMs:
        rp.avgBusinessResolutionTimeMs ?? groupAvg.avgBusinessResolutionTimeMs ?? null,
      formattedAvgBusinessResolutionTime:
        rp.formattedAvgBusinessResolutionTime ||
        groupAvg.formattedAvgBusinessResolutionTime ||
        'N/A',
      resolutionRate:
        rp.resolutionRate !== undefined ? Number(rp.resolutionRate) : summary.resolutionRate,
      escalatedCount:
        rp.escalatedCount !== undefined ? Number(rp.escalatedCount) : summary.escalated,
      escalationEventsCount:
        rp.escalationEventsCount !== undefined
          ? Number(rp.escalationEventsCount)
          : summary.escalationEvents,
      escalationRate:
        rp.escalationRate !== undefined ? Number(rp.escalationRate) : summary.escalationRate,
      overdueCount: rp.overdueCount !== undefined ? Number(rp.overdueCount) : summary.overdue,
    };
  }, [metrics, summary]);

  const statusDistribution: any[] = useMemo(() => {
    if (Array.isArray(metrics?.statusDistribution) && metrics.statusDistribution.length > 0) {
      return metrics.statusDistribution.map((item: any) => ({
        status: item.status,
        label: item.label || item.status,
        count: Number(item.count) || 0,
        percentage:
          item.percentage !== undefined
            ? Number(item.percentage)
            : summary.total > 0
            ? Math.round(((Number(item.count) || 0) / summary.total) * 100)
            : 0,
      }));
    }
    return [
      { status: 'OPEN', label: 'Open', count: summary.open, percentage: 0 },
      { status: 'IN_PROGRESS', label: 'In Progress', count: summary.inProgress, percentage: 0 },
      { status: 'REOPENED', label: 'Reopened', count: summary.reopened, percentage: 0 },
      { status: 'RESOLVED', label: 'Resolved', count: summary.resolved, percentage: 0 },
      { status: 'CLOSED', label: 'Closed', count: summary.closed, percentage: 0 },
    ];
  }, [metrics?.statusDistribution, summary]);

  const nonZeroStatusData = useMemo(
    () => statusDistribution.filter((s) => s.count > 0),
    [statusDistribution]
  );

  const resolutionTrend: any[] = useMemo(() => {
    if (!Array.isArray(metrics?.resolutionTrend)) return [];
    return metrics.resolutionTrend;
  }, [metrics?.resolutionTrend]);

  const hasTrendActivity = useMemo(
    () =>
      resolutionTrend.some(
        (pt) => (Number(pt.assigned) || 0) > 0 || (Number(pt.resolved) || 0) > 0 || (Number(pt.escalated) || 0) > 0
      ),
    [resolutionTrend]
  );

  const memberPerformanceList: any[] = useMemo(() => {
    if (Array.isArray(metrics?.memberPerformance)) {
      return metrics.memberPerformance;
    }
    return [];
  }, [metrics?.memberPerformance]);

  const topEscalatedUsers: any[] = useMemo(() => {
    if (Array.isArray(metrics?.topEscalatedUsers)) {
      return metrics.topEscalatedUsers;
    }
    return [];
  }, [metrics?.topEscalatedUsers]);

  const fastestResolver = metrics?.fastestResolver || null;

  const navigateToTicketsWithStatus = (statusParam?: string) => {
    const query = new URLSearchParams();
    if (statusParam) {
      query.set('status', statusParam);
    } else {
      query.set('status', 'ALL');
    }
    if (scope === 'group_overview') {
      query.set('myGroup', 'true');
      query.set('myTickets', 'false');
      if (filters.memberId) {
        query.set('assigneeId', filters.memberId);
      }
    } else {
      query.set('myTickets', 'true');
      query.set('myGroup', 'false');
    }
    if (filters.teamId) {
      query.set('teamId', filters.teamId);
    }
    navigate(`/tickets?${query.toString()}`);
  };

  const memberColumns = [
    {
      title: 'Group Member',
      dataIndex: 'userName',
      key: 'userName',
      render: (name: string, record: any) => {
        const initial = (name || 'U').charAt(0).toUpperCase();
        const isFiltered = filters.memberId === record.userId;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar
              size={30}
              className="bg-purple-100 text-purple-700 font-semibold text-xs shrink-0 border border-purple-200"
            >
              {initial}
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">
                {name}
                {isFiltered && (
                  <Tag color="purple" className="ml-1.5 text-[10px] py-0 px-1.5">
                    Filtered
                  </Tag>
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
      },
    },
    {
      title: 'Assigned',
      dataIndex: 'totalTickets',
      key: 'totalTickets',
      align: 'center' as const,
      render: (val: number) => <span className="font-semibold text-gray-800">{val ?? 0}</span>,
    },
    {
      title: 'Open / In Progress',
      key: 'activeTickets',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <div className="flex items-center justify-center gap-1">
          <AntTooltip title="Open">
            <Tag color="blue" className="m-0 font-medium">
              {record.openTickets ?? 0}
            </Tag>
          </AntTooltip>
          <AntTooltip title="In Progress">
            <Tag color="gold" className="m-0 font-medium">
              {record.inProgressTickets ?? 0}
            </Tag>
          </AntTooltip>
        </div>
      ),
    },
    {
      title: 'Resolved',
      dataIndex: 'resolvedTickets',
      key: 'resolvedTickets',
      align: 'center' as const,
      render: (val: number) => (
        <Tag color="green" className="m-0 font-medium">
          {val ?? 0}
        </Tag>
      ),
    },
    {
      title: 'Escalated',
      dataIndex: 'escalatedTickets',
      key: 'escalatedTickets',
      align: 'center' as const,
      render: (val: number) => (
        <Tag color={(val ?? 0) > 0 ? 'volcano' : 'default'} className="m-0 font-medium">
          {val ?? 0}
        </Tag>
      ),
    },
    {
      title: 'Overdue',
      dataIndex: 'overdueTickets',
      key: 'overdueTickets',
      align: 'center' as const,
      render: (val: number) => (
        <Tag color={(val ?? 0) > 0 ? 'red' : 'default'} className="m-0 font-medium">
          {val ?? 0}
        </Tag>
      ),
    },
    {
      title: 'Avg Resolution Time',
      dataIndex: 'formattedAvgResolutionTime',
      key: 'formattedAvgResolutionTime',
      align: 'center' as const,
      render: (text: string, record: any) => (
        <div className="flex flex-col items-center">
          <span className="font-semibold text-gray-800 text-xs sm:text-sm">
            {text || 'N/A'}
          </span>
          {record.formattedAvgBusinessResolutionTime &&
            record.formattedAvgBusinessResolutionTime !== 'N/A' && (
              <span className="text-[10px] text-gray-500">
                Biz: {record.formattedAvgBusinessResolutionTime}
              </span>
            )}
        </div>
      ),
    },
    {
      title: 'Resolution Rate',
      dataIndex: 'resolutionRate',
      key: 'resolutionRate',
      width: 150,
      render: (rate: number) => (
        <Progress
          percent={rate || 0}
          size="small"
          strokeColor={rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#f59e0b'}
        />
      ),
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
            data-testid={`member-filter-btn-${record.userId}`}
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                memberId: isSelected ? undefined : record.userId,
              }))
            }
            className="text-xs"
          >
            {isSelected ? 'Showing' : 'Filter Member'}
          </Button>
        );
      },
    },
  ];

  const activePeriodLabel =
    PERIOD_OPTIONS.find((p) => p.value === period)?.label || 'Last 30 Days';

  return (
    <PageContainer>
      <div data-testid="tickets-dashboard-page">
        <PageHeader
          title={
            <div className="flex items-center gap-2.5 flex-wrap">
              <span>Tickets &amp; Issues Dashboard</span>
              <span
                data-testid="ticket-dashboard-scope-badge"
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  scope === 'group_overview'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}
              >
                {scope === 'group_overview'
                  ? selectedMember
                    ? `Viewing: Group Overview • ${selectedMember.name}`
                    : `Viewing: Group Overview (${groupMembers.length} member${
                        groupMembers.length === 1 ? '' : 's'
                      })`
                  : 'Viewing: My Overview'}
              </span>
              <span
                data-testid="ticket-dashboard-period-badge"
                className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700 border border-gray-200"
              >
                Period: {activePeriodLabel}
              </span>
            </div>
          }
          description={
            scope === 'group_overview'
              ? 'Consolidated insights into group ticket volume, status distribution, member resolution speed, and escalations.'
              : 'Personal overview of your assigned tickets, status breakdown, resolution speed, and escalation activity.'
          }
          extra={
            <div className="flex items-center gap-2">
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchDashboard}
                loading={loading}
                data-testid="refresh-ticket-dashboard-btn"
                title="Refresh dashboard"
              />
              <Button
                type="primary"
                icon={<UnorderedListOutlined />}
                onClick={() => navigate('/tickets')}
                data-testid="go-to-tickets-btn"
              >
                View Tickets
              </Button>
            </div>
          }
        />

        {/* Scope Switcher & Period / Filter Control Bar */}
        <div
          data-testid="ticket-dashboard-control-bar"
          className="bg-white p-3.5 sm:p-5 mb-4 sm:mb-6 rounded-xl shadow-xs border border-gray-200/80 flex flex-col gap-3.5"
        >
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              {canViewGroup && (
                <div
                  className="flex items-center gap-2"
                  data-testid="ticket-dashboard-scope-switcher"
                >
                  <Button
                    type={scope === 'my_overview' ? 'primary' : 'default'}
                    icon={<UserOutlined />}
                    data-testid="scope-my-overview-btn"
                    onClick={() => handleScopeChange('my_overview')}
                    className={
                      scope === 'my_overview'
                        ? 'bg-purple-600 text-white hover:!bg-purple-700 border-purple-600 font-medium'
                        : 'text-gray-700 hover:text-purple-600 border-gray-300 font-medium'
                    }
                  >
                    {scope === 'my_overview' ? 'My Overview ✓' : 'My Overview'}
                  </Button>
                  <Button
                    type={scope === 'group_overview' ? 'primary' : 'default'}
                    icon={<TeamOutlined />}
                    data-testid="scope-group-overview-btn"
                    onClick={() => handleScopeChange('group_overview')}
                    className={
                      scope === 'group_overview'
                        ? 'bg-indigo-600 text-white hover:!bg-indigo-700 border-indigo-600 font-medium'
                        : 'text-gray-700 hover:text-indigo-600 border-gray-300 font-medium'
                    }
                  >
                    {scope === 'group_overview'
                      ? `Group Overview (${groupMembers.length}) ✓`
                      : `Group Overview (${groupMembers.length})`}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 items-stretch sm:items-center">
              <Select
                data-testid="ticket-dashboard-period-select"
                value={period}
                onChange={(val) => handlePeriodChange(val)}
                options={PERIOD_OPTIONS}
                className="w-full sm:w-44"
                aria-label="Reporting Period"
              />

              {period === 'custom' && (
                <RangePicker
                  data-testid="ticket-dashboard-custom-range"
                  onChange={handleCustomDateChange}
                  className="w-full sm:w-auto"
                />
              )}

              {(scope === 'group_overview' || availableTeams.length > 1 || isSuperAdmin) &&
                availableTeams.length > 0 && (
                  <Select
                    placeholder="Filter by Team"
                    allowClear
                    data-testid="ticket-dashboard-team-select"
                    className="w-full sm:w-48"
                    value={filters.teamId}
                    options={availableTeams.map((t: any) => ({
                      value: t.id,
                      label: t.name,
                    }))}
                    onChange={(val) =>
                      setFilters((prev) => ({
                        ...prev,
                        teamId: val || undefined,
                        memberId: undefined,
                      }))
                    }
                  />
                )}

              {scope === 'group_overview' && groupMembers.length > 0 && (
                <Select
                  placeholder="Filter by Group Member"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  data-testid="ticket-dashboard-member-select"
                  className="w-full sm:w-52"
                  value={filters.memberId}
                  options={groupMembers.map((m: any) => ({
                    value: m.id,
                    label: m.designation ? `${m.name} (${m.designation})` : m.name,
                  }))}
                  onChange={(val) =>
                    setFilters((prev) => ({ ...prev, memberId: val || undefined }))
                  }
                />
              )}

              {hasActiveFilters && (
                <Button
                  type="text"
                  icon={<CloseCircleOutlined />}
                  data-testid="reset-dashboard-filters-btn"
                  onClick={handleResetFilters}
                  className="text-gray-500 hover:text-red-500 text-xs flex items-center"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Quick Reporting Period Pills */}
          <div
            className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-100"
            data-testid="ticket-dashboard-period-pills"
          >
            <span className="text-xs text-gray-500 font-medium mr-1">Period:</span>
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = period === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`period-btn-${opt.value}`}
                  onClick={() => handlePeriodChange(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                    isActive
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <Alert
            type="error"
            data-testid="ticket-dashboard-error"
            title={error}
            className="mb-6 rounded-xl"
            showIcon
          />
        )}

        {loading ? (
          <div
            className="flex justify-center p-12"
            data-testid="ticket-dashboard-loading"
          >
            <Spin size="large" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* A. Ticket Summary Cards (8 cards: 2 cols on mobile, 4 on desktop) */}
            <div
              className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3"
              data-testid="ticket-summary-grid"
            >
              <Card
                onClick={() => navigateToTicketsWithStatus('ALL')}
                data-testid="kpi-total-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={
                    <span className="text-xs text-gray-500 font-medium">
                      {scope === 'group_overview' ? 'Group Total' : 'Total Assigned'}
                    </span>
                  }
                  value={summary.total}
                  prefix={<ProfileOutlined className="text-gray-400" />}
                  styles={{ content: { fontSize: '1.25rem', fontWeight: 700 } }}
                />
              </Card>

              <Card
                onClick={() => navigateToTicketsWithStatus('OPEN')}
                data-testid="kpi-open-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={<span className="text-xs text-gray-500 font-medium">Open</span>}
                  value={summary.open}
                  prefix={<AlertOutlined />}
                  styles={{
                    content: { color: '#2563eb', fontSize: '1.25rem', fontWeight: 700 },
                  }}
                />
              </Card>

              <Card
                onClick={() => navigateToTicketsWithStatus('IN_PROGRESS')}
                data-testid="kpi-in-progress-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={
                    <span className="text-xs text-gray-500 font-medium">In Progress</span>
                  }
                  value={summary.inProgress}
                  prefix={<SyncOutlined />}
                  styles={{
                    content: { color: '#d97706', fontSize: '1.25rem', fontWeight: 700 },
                  }}
                />
              </Card>

              <Card
                onClick={() => navigateToTicketsWithStatus('OPEN,REOPENED')}
                data-testid="kpi-pending-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={
                    <span className="text-xs text-gray-500 font-medium">
                      Pending{summary.reopened > 0 ? ` (${summary.reopened} Reopened)` : ''}
                    </span>
                  }
                  value={summary.pending}
                  prefix={<HourglassOutlined />}
                  styles={{
                    content: { color: '#7c3aed', fontSize: '1.25rem', fontWeight: 700 },
                  }}
                />
              </Card>

              <Card
                onClick={() => navigateToTicketsWithStatus('RESOLVED,CLOSED')}
                data-testid="kpi-resolved-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={
                    <span className="text-xs text-gray-500 font-medium">
                      Resolved / Closed
                    </span>
                  }
                  value={summary.resolvedOrClosed}
                  prefix={<CheckCircleOutlined />}
                  styles={{
                    content: { color: '#10b981', fontSize: '1.25rem', fontWeight: 700 },
                  }}
                />
              </Card>

              <Card
                onClick={() => navigateToTicketsWithStatus('OPEN,IN_PROGRESS')}
                data-testid="kpi-escalated-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={
                    <span className="text-xs text-gray-500 font-medium">Escalated</span>
                  }
                  value={summary.escalated}
                  prefix={<FireOutlined />}
                  styles={{
                    content: { color: '#ea580c', fontSize: '1.25rem', fontWeight: 700 },
                  }}
                />
              </Card>

              <Card
                onClick={() => navigateToTicketsWithStatus('OPEN,IN_PROGRESS')}
                data-testid="kpi-overdue-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={
                    <span className="text-xs text-gray-500 font-medium">Overdue</span>
                  }
                  value={summary.overdue}
                  prefix={<WarningOutlined />}
                  styles={{
                    content: { color: '#dc2626', fontSize: '1.25rem', fontWeight: 700 },
                  }}
                />
              </Card>

              <Card
                onClick={() => navigateToTicketsWithStatus('OPEN,IN_PROGRESS')}
                data-testid="kpi-awaiting-action-tickets"
                className="cursor-pointer hover:shadow-md transition-all rounded-xl border border-gray-200/80"
                styles={{ body: { padding: '14px' } }}
              >
                <Statistic
                  title={
                    <span className="text-xs text-gray-500 font-medium">
                      Awaiting Action
                    </span>
                  }
                  value={summary.awaitingAction}
                  prefix={<BellOutlined />}
                  styles={{
                    content: { color: '#4f46e5', fontSize: '1.25rem', fontWeight: 700 },
                  }}
                />
              </Card>
            </div>

            {/* C. Resolution Performance & Group Average Resolution Time */}
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              data-testid="resolution-performance-section"
            >
              <Card
                data-testid={
                  scope === 'group_overview'
                    ? 'group-avg-resolution-card'
                    : 'metric-avg-resolution-time'
                }
                className="rounded-xl border border-gray-200/80 shadow-xs"
                styles={{ body: { padding: '16px 20px' } }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      {scope === 'group_overview'
                        ? 'Group Average Resolution Time'
                        : 'Average Resolution Time'}
                    </div>
                    <div
                      className="text-2xl font-bold text-gray-900"
                      data-testid="avg-resolution-time-value"
                    >
                      {resolutionPerf.formattedAvgResolutionTime}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span data-testid="avg-business-resolution-time-value">
                        Business hours avg (10:30 AM–6:30 PM):{' '}
                        <strong className="text-gray-700">
                          {resolutionPerf.formattedAvgBusinessResolutionTime}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
                    <ClockCircleOutlined />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                  <span>Valid completed resolutions in period:</span>
                  <span className="font-semibold text-gray-800">
                    {resolutionPerf.validResolvedCount}
                  </span>
                </div>
              </Card>

              <Card
                data-testid="metric-resolution-rate"
                className="rounded-xl border border-gray-200/80 shadow-xs"
                styles={{ body: { padding: '16px 20px' } }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-full">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      {scope === 'group_overview'
                        ? 'Group Resolution Performance'
                        : 'Individual Resolution Performance'}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-2xl font-bold text-emerald-600"
                        data-testid="total-resolved-period-value"
                      >
                        {resolutionPerf.totalResolved}
                      </span>
                      <span className="text-xs text-gray-500">
                        tickets resolved ({resolutionPerf.resolutionRate}% resolution rate)
                      </span>
                    </div>
                    <div className="mt-2">
                      <Progress
                        percent={resolutionPerf.resolutionRate}
                        size="small"
                        strokeColor="#10b981"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                  <span>Eligible tickets in period:</span>
                  <span className="font-semibold text-gray-800">
                    {resolutionPerf.eligibleForResolution}
                  </span>
                </div>
              </Card>

              <Card
                data-testid="metric-escalation-rate"
                className="rounded-xl border border-gray-200/80 shadow-xs"
                styles={{ body: { padding: '16px 20px' } }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Escalation &amp; Overdue Health
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-2xl font-bold text-orange-600"
                        data-testid="escalation-count-value"
                      >
                        {resolutionPerf.escalatedCount}
                      </span>
                      <span className="text-xs text-gray-500">
                        escalated ({resolutionPerf.escalationRate}% escalation rate)
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <Tag color={summary.overdue > 0 ? 'red' : 'green'} className="m-0">
                        {summary.overdue} Overdue
                      </Tag>
                      <Tag color="default" className="m-0">
                        {resolutionPerf.escalationEventsCount} Escalation Event
                        {resolutionPerf.escalationEventsCount === 1 ? '' : 's'}
                      </Tag>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-lg shrink-0">
                    <FireOutlined />
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
                  <span>Unread assigned tickets:</span>
                  <span className="font-semibold text-gray-800">{summary.unread}</span>
                </div>
              </Card>
            </div>

            {/* Group Highlights Row: Top 3 Users With Highest Escalations & Fastest Issue Resolver */}
            {scope === 'group_overview' && (
              <Row gutter={[16, 16]} data-testid="group-highlights-row">
                <Col xs={24} lg={12}>
                  <Card
                    data-testid="top-escalated-users-card"
                    title={
                      <div className="flex items-center gap-2">
                        <FireOutlined className="text-orange-500" />
                        <span className="font-semibold text-sm sm:text-base">
                          Top 3 Users With Highest Escalations
                        </span>
                      </div>
                    }
                    className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                    styles={{ body: { padding: '16px' } }}
                  >
                    {topEscalatedUsers.length === 0 ? (
                      <div
                        className="py-8 text-center"
                        data-testid="top-escalated-empty"
                      >
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="No escalated tickets among group members for the selected period."
                        />
                      </div>
                    ) : (
                      <div className="space-y-3" data-testid="top-escalated-users-list">
                        {topEscalatedUsers.map((item: any, idx: number) => {
                          const rankColors = [
                            'bg-red-50 text-red-700 border-red-200',
                            'bg-orange-50 text-orange-700 border-orange-200',
                            'bg-amber-50 text-amber-700 border-amber-200',
                          ];
                          const badgeClass =
                            rankColors[idx] ||
                            'bg-gray-50 text-gray-700 border-gray-200';
                          return (
                            <div
                              key={item.userId}
                              data-testid={`top-escalated-rank-${idx + 1}`}
                              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/60 hover:bg-gray-100/70 transition"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-7 h-7 rounded-full border font-bold text-xs flex items-center justify-center shrink-0 ${badgeClass}`}
                                >
                                  #{item.rank || idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 text-sm truncate">
                                    {item.userName}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {[item.designation, item.roleName]
                                      .filter(Boolean)
                                      .join(' • ') || `${item.totalTickets} assigned`}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Tag
                                  color="volcano"
                                  className="m-0 font-semibold text-xs"
                                  data-testid={`top-escalated-count-${item.userId}`}
                                >
                                  {item.escalatedTickets} Escalated Ticket
                                  {item.escalatedTickets === 1 ? '' : 's'}
                                </Tag>
                                <span className="text-xs text-gray-500">
                                  ({item.escalationRate}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card
                    data-testid="fastest-resolver-card"
                    title={
                      <div className="flex items-center gap-2">
                        <ThunderboltOutlined className="text-emerald-500" />
                        <span className="font-semibold text-sm sm:text-base">
                          Fastest Issue Resolver
                        </span>
                      </div>
                    }
                    className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                    styles={{ body: { padding: '16px' } }}
                  >
                    {!fastestResolver ? (
                      <div
                        className="py-8 text-center"
                        data-testid="fastest-resolver-empty"
                      >
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="No valid completed ticket resolutions recorded for group members in the selected period."
                        />
                      </div>
                    ) : (
                      <div
                        className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 border border-emerald-200/80"
                        data-testid="fastest-resolver-content"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center text-xl font-bold shrink-0">
                              <TrophyOutlined />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="font-bold text-gray-900 text-base"
                                  data-testid="fastest-resolver-name"
                                >
                                  {fastestResolver.userName}
                                </span>
                                <Tag color="green" className="m-0 text-xs font-medium">
                                  Fastest Resolver
                                </Tag>
                                {fastestResolver.isLimitedSample && (
                                  <Tag
                                    color="gold"
                                    className="m-0 text-xs font-medium"
                                    data-testid="fastest-resolver-limited-sample-badge"
                                  >
                                    Limited Sample ({fastestResolver.validResolvedCount}{' '}
                                    resolved)
                                  </Tag>
                                )}
                              </div>
                              {(fastestResolver.designation ||
                                fastestResolver.roleName) && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {[
                                    fastestResolver.designation,
                                    fastestResolver.roleName,
                                  ]
                                    .filter(Boolean)
                                    .join(' • ')}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-gray-500">Avg Resolution Time</div>
                            <div
                              className="text-xl font-bold text-emerald-700"
                              data-testid="fastest-resolver-avg-time"
                            >
                              {fastestResolver.formattedAvgResolutionTime}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Biz Hrs:{' '}
                              {fastestResolver.formattedAvgBusinessResolutionTime}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-emerald-200/60 grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/80 rounded-lg p-2 border border-gray-100">
                            <div className="text-[11px] text-gray-500">
                              Tickets Resolved
                            </div>
                            <div
                              className="font-bold text-gray-900 text-sm"
                              data-testid="fastest-resolver-count"
                            >
                              {fastestResolver.resolvedTickets}
                            </div>
                          </div>
                          <div className="bg-white/80 rounded-lg p-2 border border-gray-100">
                            <div className="text-[11px] text-gray-500">Assigned</div>
                            <div className="font-bold text-gray-900 text-sm">
                              {fastestResolver.totalTickets}
                            </div>
                          </div>
                          <div className="bg-white/80 rounded-lg p-2 border border-gray-100">
                            <div className="text-[11px] text-gray-500">
                              Resolution Rate
                            </div>
                            <div className="font-bold text-emerald-600 text-sm">
                              {fastestResolver.resolutionRate}%
                            </div>
                          </div>
                        </div>

                        {fastestResolver.sampleSizeNote && (
                          <div
                            className="mt-2.5 text-xs text-amber-700 bg-amber-50/80 border border-amber-200/70 rounded-lg px-3 py-1.5"
                            data-testid="fastest-resolver-sample-note"
                          >
                            {fastestResolver.sampleSizeNote}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            )}

            {/* B. Status Distribution & Resolution Trend Over Time */}
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={10}>
                <Card
                  data-testid="status-distribution-card"
                  title={
                    <span className="font-semibold text-sm sm:text-base">
                      {scope === 'group_overview'
                        ? 'Group Status Distribution'
                        : 'Ticket Status Distribution'}
                    </span>
                  }
                  className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                  styles={{ body: { padding: '16px' } }}
                >
                  {summary.total === 0 ? (
                    <div
                      className="py-8 text-center"
                      data-testid="status-distribution-empty"
                    >
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No tickets assigned in the selected reporting period."
                      />
                    </div>
                  ) : (
                    <div className="w-full h-56 mb-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={nonZeroStatusData}
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={72}
                            label
                          >
                            {nonZeroStatusData.map((entry: any, index: number) => (
                              <Cell
                                key={`status-cell-${index}`}
                                fill={STATUS_CHART_COLORS[entry.status] || '#6366f1'}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    {statusDistribution.map((item: any) => (
                      <div
                        key={item.status}
                        data-testid={`status-dist-row-${item.status}`}
                        onClick={() => navigateToTicketsWithStatus(item.status)}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{
                              backgroundColor:
                                STATUS_CHART_COLORS[item.status] || '#6b7280',
                            }}
                          />
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag
                            color={STATUS_TAG_COLORS[item.status] || 'default'}
                            className="m-0 font-semibold text-xs"
                          >
                            {item.count}
                          </Tag>
                          <span className="text-xs text-gray-400 w-9 text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>

              <Col xs={24} lg={14}>
                <Card
                  data-testid="resolution-trend-card"
                  title={
                    <span className="font-semibold text-sm sm:text-base">
                      Resolution &amp; Ticket Trend Over Time
                    </span>
                  }
                  className="rounded-xl border border-gray-200/80 shadow-xs h-full"
                  styles={{ body: { padding: '16px' } }}
                >
                  {!hasTrendActivity ? (
                    <div
                      className="py-12 text-center"
                      data-testid="resolution-trend-empty"
                    >
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No ticket creation, resolution, or escalation activity recorded in this period."
                      />
                    </div>
                  ) : (
                    <div className="w-full h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={resolutionTrend}
                          margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                        >
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar
                            dataKey="assigned"
                            name="Assigned"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="resolved"
                            name="Resolved"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="escalated"
                            name="Escalated"
                            fill="#f97316"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            {/* C. Group Member Performance Breakdown (Group Overview only) */}
            {scope === 'group_overview' && (
              <Card
                data-testid="group-member-performance-card"
                title={
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-sm sm:text-base">
                      Group Member Performance Breakdown ({memberPerformanceList.length})
                    </span>
                    {filters.memberId && (
                      <Button
                        size="small"
                        type="link"
                        onClick={() =>
                          setFilters((prev) => ({ ...prev, memberId: undefined }))
                        }
                        className="p-0 text-xs"
                      >
                        Show All Group Members
                      </Button>
                    )}
                  </div>
                }
                className="rounded-xl border border-gray-200/80 shadow-xs"
                styles={{ body: { padding: '12px' } }}
              >
                {memberPerformanceList.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No group members found in your reporting scope."
                  />
                ) : (
                  <>
                    <div className="hidden md:block">
                      <Table
                        dataSource={memberPerformanceList}
                        columns={memberColumns}
                        rowKey="userId"
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                        size="small"
                      />
                    </div>
                    <div className="block md:hidden space-y-2.5">
                      {memberPerformanceList.map((member: any) => {
                        const isSelected = filters.memberId === member.userId;
                        return (
                          <div
                            key={member.userId}
                            className={`p-3 rounded-lg border transition ${
                              isSelected
                                ? 'bg-indigo-50/60 border-indigo-300'
                                : 'bg-gray-50/70 border-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar
                                  size={28}
                                  className="bg-purple-100 text-purple-700 font-semibold text-xs shrink-0"
                                >
                                  {(member.userName || 'U').charAt(0).toUpperCase()}
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 text-sm truncate">
                                    {member.userName}
                                  </div>
                                  {(member.designation || member.roleName) && (
                                    <div className="text-[11px] text-gray-500 truncate">
                                      {[member.designation, member.roleName]
                                        .filter(Boolean)
                                        .join(' • ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="small"
                                type={isSelected ? 'primary' : 'default'}
                                onClick={() =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    memberId: isSelected ? undefined : member.userId,
                                  }))
                                }
                                className="text-xs"
                              >
                                {isSelected ? 'Showing' : 'Filter'}
                              </Button>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5 text-center text-xs mb-2">
                              <div className="bg-white p-1.5 rounded border border-gray-100">
                                <div className="text-gray-400 text-[10px]">Assigned</div>
                                <div className="font-semibold text-gray-800">
                                  {member.totalTickets}
                                </div>
                              </div>
                              <div className="bg-white p-1.5 rounded border border-gray-100">
                                <div className="text-gray-400 text-[10px]">Active</div>
                                <div className="font-semibold text-blue-600">
                                  {member.activeTickets}
                                </div>
                              </div>
                              <div className="bg-white p-1.5 rounded border border-gray-100">
                                <div className="text-gray-400 text-[10px]">Resolved</div>
                                <div className="font-semibold text-emerald-600">
                                  {member.resolvedTickets}
                                </div>
                              </div>
                              <div className="bg-white p-1.5 rounded border border-gray-100">
                                <div className="text-gray-400 text-[10px]">Escalated</div>
                                <div className="font-semibold text-orange-600">
                                  {member.escalatedTickets}
                                </div>
                              </div>
                              <div className="bg-white p-1.5 rounded border border-gray-100">
                                <div className="text-gray-400 text-[10px]">Avg Time</div>
                                <div className="font-semibold text-gray-800">
                                  {member.formattedAvgResolutionTime || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <Progress
                              percent={member.resolutionRate || 0}
                              size="small"
                              strokeColor={
                                member.resolutionRate >= 80
                                  ? '#10b981'
                                  : member.resolutionRate >= 50
                                  ? '#3b82f6'
                                  : '#f59e0b'
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};
