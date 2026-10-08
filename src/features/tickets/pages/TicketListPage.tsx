import React, { useEffect, useState, useMemo } from 'react';
import { Button, Tag, Input, Select, DatePicker, Avatar, Modal, Tooltip, Pagination, Empty, Badge } from 'antd';
import { PlusOutlined, FilterOutlined, AlertOutlined, ReloadOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/components/PageContainer';
import { PageHeader } from '@/shared/components/PageHeader';
import { useTicketStore } from '../store/ticket.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { teamService } from '@/features/teams/api/team.service';
import { useUserStore } from '@/features/users/store/user.store';
import { useAuthStore } from '@/features/auth/store/auth.store';

const STATUS_CONFIG: Record<string, {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  cardBorder: string;
  accentBorder: string;
  glowBg: string;
}> = {
  OPEN: {
    label: 'Open',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    dotColor: 'bg-blue-500',
    cardBorder: 'border-blue-200 hover:border-blue-400',
    accentBorder: 'border-t-blue-500',
    glowBg: 'hover:bg-blue-50/25',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    cardBorder: 'border-amber-200 hover:border-amber-400',
    accentBorder: 'border-t-amber-500',
    glowBg: 'hover:bg-amber-50/25',
  },
  RESOLVED: {
    label: 'Resolved',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    cardBorder: 'border-emerald-200 hover:border-emerald-400',
    accentBorder: 'border-t-emerald-500',
    glowBg: 'hover:bg-emerald-50/25',
  },
  CLOSED: {
    label: 'Closed',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-600',
    badgeBorder: 'border-gray-200',
    dotColor: 'bg-gray-400',
    cardBorder: 'border-gray-200 hover:border-gray-300',
    accentBorder: 'border-t-gray-400',
    glowBg: 'hover:bg-gray-50/40',
  },
  REOPENED: {
    label: 'Reopened',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    dotColor: 'bg-purple-500',
    cardBorder: 'border-purple-200 hover:border-purple-400',
    accentBorder: 'border-t-purple-500',
    glowBg: 'hover:bg-purple-50/25',
  },
};

const TICKET_FILTERS_STORAGE_KEY = 'tickets_filters_persistence';

export const TicketListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tickets, loading, total, fetchTickets } = useTicketStore();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();

  const isSuperAdmin = (user as any)?.role?.name === 'Super Admin' || (user as any)?.type === 'super_admin';

  const [searchMode, setSearchMode] = useState<'semantic' | 'keyword'>(() => {
    if (searchParams.has('searchMode')) {
      return (searchParams.get('searchMode') as 'semantic' | 'keyword') || 'semantic';
    }
    try {
      const saved = sessionStorage.getItem(TICKET_FILTERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.searchMode) return parsed.searchMode;
      }
    } catch {}
    return 'semantic';
  });

  const [params, setParams] = useState<any>(() => {
    const hasAnyUrlParam = Array.from(searchParams.keys()).length > 0;
    if (hasAnyUrlParam) {
      return {
        page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 12,
        search: searchParams.get('search') || '',
        status: searchParams.get('status') || undefined,
        priority: searchParams.get('priority') || undefined,
        teamId: searchParams.get('teamId') || undefined,
        createdById: searchParams.get('createdById') || undefined,
        assigneeId: searchParams.get('assigneeId') || undefined,
        dateFrom: searchParams.get('dateFrom') || undefined,
        dateTo: searchParams.get('dateTo') || undefined,
        sortBy: searchParams.get('sortBy') || undefined,
        sortOrder: searchParams.get('sortOrder') || undefined,
        myTickets: searchParams.has('myTickets') ? searchParams.get('myTickets') === 'true' : true,
      };
    }

    try {
      const saved = sessionStorage.getItem(TICKET_FILTERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          page: parsed.page || 1,
          limit: parsed.limit || 12,
          search: parsed.search || '',
          status: parsed.status || undefined,
          priority: parsed.priority || undefined,
          teamId: parsed.teamId || undefined,
          createdById: parsed.createdById || undefined,
          assigneeId: parsed.assigneeId || undefined,
          dateFrom: parsed.dateFrom || undefined,
          dateTo: parsed.dateTo || undefined,
          sortBy: parsed.sortBy || undefined,
          sortOrder: parsed.sortOrder || undefined,
          myTickets: parsed.myTickets !== undefined ? parsed.myTickets : true,
        };
      }
    } catch {}

    return {
      page: 1,
      limit: 12,
      search: '',
      status: undefined,
      priority: undefined,
      teamId: undefined,
      createdById: undefined,
      assigneeId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      myTickets: true,
    };
  });

  const [searchInput, setSearchInput] = useState<string>(() => params.search || '');

  useEffect(() => {
    setSearchInput(params.search || '');
  }, [params.search]);

  const [teams, setTeams] = useState<any[]>([]);
  const { users, fetchUsers } = useUserStore();
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  useEffect(() => {
    fetchTickets({ ...params, searchMode });

    const newSp = new URLSearchParams();
    newSp.set('myTickets', params.myTickets ? 'true' : 'false');
    if (params.search) newSp.set('search', params.search);
    if (searchMode && searchMode !== 'semantic') newSp.set('searchMode', searchMode);
    if (params.status) newSp.set('status', params.status);
    if (params.priority) newSp.set('priority', params.priority);
    if (params.teamId) newSp.set('teamId', params.teamId);
    if (params.createdById) newSp.set('createdById', params.createdById);
    if (params.assigneeId) newSp.set('assigneeId', params.assigneeId);
    if (params.dateFrom) newSp.set('dateFrom', params.dateFrom);
    if (params.dateTo) newSp.set('dateTo', params.dateTo);
    if (params.sortBy) newSp.set('sortBy', params.sortBy);
    if (params.sortOrder) newSp.set('sortOrder', params.sortOrder);
    if (params.page && params.page > 1) newSp.set('page', String(params.page));
    if (params.limit && params.limit !== 12) newSp.set('limit', String(params.limit));

    if (newSp.toString() !== searchParams.toString()) {
      setSearchParams(newSp, { replace: true });
    }

    try {
      sessionStorage.setItem(
        TICKET_FILTERS_STORAGE_KEY,
        JSON.stringify({ ...params, searchMode })
      );
    } catch {}
  }, [params, searchMode, fetchTickets]);

  useEffect(() => {
    const hasAnyUrlParam = Array.from(searchParams.keys()).length > 0;
    if (!hasAnyUrlParam) return;

    const urlMyTickets = searchParams.has('myTickets') ? searchParams.get('myTickets') === 'true' : true;
    const urlMode = (searchParams.get('searchMode') as 'semantic' | 'keyword') || 'semantic';
    const urlPage = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const urlLimit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 12;
    const urlSearch = searchParams.get('search') || '';
    const urlStatus = searchParams.get('status') || undefined;
    const urlPriority = searchParams.get('priority') || undefined;
    const urlTeamId = searchParams.get('teamId') || undefined;
    const urlCreatedById = searchParams.get('createdById') || undefined;
    const urlAssigneeId = searchParams.get('assigneeId') || undefined;
    const urlDateFrom = searchParams.get('dateFrom') || undefined;
    const urlDateTo = searchParams.get('dateTo') || undefined;
    const urlSortBy = searchParams.get('sortBy') || undefined;
    const urlSortOrder = searchParams.get('sortOrder') || undefined;

    setParams((prev: any) => {
      if (
        prev.myTickets === urlMyTickets &&
        prev.page === urlPage &&
        prev.limit === urlLimit &&
        prev.search === urlSearch &&
        prev.status === urlStatus &&
        prev.priority === urlPriority &&
        prev.teamId === urlTeamId &&
        prev.createdById === urlCreatedById &&
        prev.assigneeId === urlAssigneeId &&
        prev.dateFrom === urlDateFrom &&
        prev.dateTo === urlDateTo &&
        prev.sortBy === urlSortBy &&
        prev.sortOrder === urlSortOrder
      ) {
        return prev;
      }
      return {
        ...prev,
        myTickets: urlMyTickets,
        page: urlPage,
        limit: urlLimit,
        search: urlSearch,
        status: urlStatus,
        priority: urlPriority,
        teamId: urlTeamId,
        createdById: urlCreatedById,
        assigneeId: urlAssigneeId,
        dateFrom: urlDateFrom,
        dateTo: urlDateTo,
        sortBy: urlSortBy,
        sortOrder: urlSortOrder,
      };
    });

    setSearchMode((prev) => (prev !== urlMode ? urlMode : prev));
  }, [searchParams]);

  useEffect(() => {
    teamService.getTeams({ page: 1, limit: 100 }).then(res => setTeams(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    fetchUsers({ page: 1, limit: 100, teamId: params.teamId }).catch(console.error);
  }, [fetchUsers, params.teamId]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (params.status) count++;
    if (params.priority) count++;
    if (params.teamId) count++;
    if (params.createdById) count++;
    if (params.assigneeId) count++;
    if (params.dateFrom || params.dateTo) count++;
    if (params.myTickets === false) count++;
    return count;
  }, [params]);

  const resetFilters = () => {
    const defaultState = {
      page: 1,
      limit: 12,
      search: '',
      status: undefined,
      priority: undefined,
      teamId: undefined,
      createdById: undefined,
      assigneeId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      myTickets: true,
    };
    setParams(defaultState);
    setSearchMode('semantic');
    setSearchInput('');
    try {
      sessionStorage.setItem(
        TICKET_FILTERS_STORAGE_KEY,
        JSON.stringify({ ...defaultState, searchMode: 'semantic' })
      );
    } catch {}
  };

  const getTicketSLAStatus = (ticket: any) => {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return 'ok';
    const createdAt = new Date(ticket.createdAt).getTime();
    const ageHours = (Date.now() - createdAt) / (1000 * 60 * 60);
    
    let slaLimit = 120;
    if (ticket.priority === 'HIGH' || ticket.priority === 'URGENT') slaLimit = 24;
    else if (ticket.priority === 'MEDIUM') slaLimit = 72;
    
    if (ageHours >= slaLimit) return 'breached';
    if (ageHours >= slaLimit - 4) return 'approaching';
    return 'ok';
  };

  const FilterControls = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`flex ${isMobile ? 'flex-col gap-3' : 'flex-wrap gap-3 items-center w-full'}`}>
      <Button
        type={params.myTickets ? 'primary' : 'default'}
        onClick={() => setParams((prev: any) => ({ ...prev, myTickets: !prev.myTickets, page: 1 }))}
        className={
          isMobile
            ? `w-full font-medium ${params.myTickets ? 'bg-blue-600 text-white' : 'text-gray-700'}`
            : `min-w-[130px] font-medium flex items-center justify-center gap-1.5 ${
                params.myTickets
                  ? 'bg-blue-600 text-white hover:!bg-blue-700'
                  : 'text-gray-700 hover:text-blue-600 border-gray-300'
              }`
        }
        title={
          params.myTickets
            ? 'Currently viewing My Tickets (created by or assigned to you). Click to view all visible tickets.'
            : 'Currently viewing All Visible Tickets. Click to view only your tickets.'
        }
      >
        <span>{params.myTickets ? 'My Tickets ✓' : 'All Visible Tickets'}</span>
      </Button>

      <Select
        placeholder="Status"
        allowClear
        className={isMobile ? 'w-full' : 'flex-1 min-w-[130px]'}
        value={params.status || undefined}
        onChange={(val) => setParams((prev: any) => ({ ...prev, status: val || undefined, page: 1 }))}
        options={[
          { value: 'OPEN', label: 'Open' },
          { value: 'IN_PROGRESS', label: 'In Progress' },
          { value: 'RESOLVED', label: 'Resolved' },
          { value: 'CLOSED', label: 'Closed' },
          { value: 'REOPENED', label: 'Reopened' },
        ]}
      />

      <Select
        placeholder="Priority"
        allowClear
        className={isMobile ? 'w-full' : 'flex-1 min-w-[120px]'}
        value={params.priority || undefined}
        onChange={(val) => setParams((prev: any) => ({ ...prev, priority: val || undefined, page: 1 }))}
        options={[
          { value: 'LOW', label: 'Low' },
          { value: 'MEDIUM', label: 'Medium' },
          { value: 'HIGH', label: 'High' },
          { value: 'URGENT', label: 'Urgent' },
        ]}
      />

      <Select
        placeholder="Team"
        allowClear
        showSearch
        optionFilterProp="label"
        className={isMobile ? 'w-full' : 'flex-1 min-w-[140px]'}
        value={params.teamId || undefined}
        onChange={(val) => setParams((prev: any) => ({ ...prev, teamId: val || undefined, page: 1 }))}
        options={(teams || []).map(t => ({ value: t.id, label: t.name }))}
      />

      <Select
        placeholder="Creator"
        allowClear
        showSearch
        optionFilterProp="label"
        className={isMobile ? 'w-full' : 'flex-1 min-w-[140px]'}
        value={params.createdById || undefined}
        onChange={(val) => setParams((prev: any) => ({ ...prev, createdById: val || undefined, page: 1 }))}
        options={(users || []).map((u: any) => ({ value: u.id, label: u.name }))}
      />

      <Select
        placeholder="Assignee"
        allowClear
        showSearch
        optionFilterProp="label"
        className={isMobile ? 'w-full' : 'flex-1 min-w-[140px]'}
        value={params.assigneeId || undefined}
        onChange={(val) => setParams((prev: any) => ({ ...prev, assigneeId: val || undefined, page: 1 }))}
        options={(users || []).map((u: any) => ({ value: u.id, label: u.name }))}
      />

      <Select
        placeholder="Sort By"
        className={isMobile ? 'w-full' : 'flex-1 min-w-[140px]'}
        value={params.sortBy ? `${params.sortBy}:${params.sortOrder || 'desc'}` : 'createdAt:desc'}
        onChange={(val) => {
          const [sortBy, sortOrder] = val.split(':');
          setParams((prev: any) => ({ ...prev, sortBy, sortOrder, page: 1 }));
        }}
        options={[
          { value: 'createdAt:desc', label: 'Newest First' },
          { value: 'createdAt:asc', label: 'Oldest First' },
          { value: 'updatedAt:desc', label: 'Recently Updated' },
          { value: 'priority:desc', label: 'Priority' },
        ]}
      />

      <DatePicker.RangePicker
        className={isMobile ? 'w-full' : 'flex-1 min-w-[220px]'}
        value={params.dateFrom && params.dateTo ? [dayjs(params.dateFrom), dayjs(params.dateTo)] : undefined}
        onChange={(dates) => {
          setParams((prev: any) => ({
            ...prev,
            dateFrom: dates?.[0]?.toISOString() || undefined,
            dateTo: dates?.[1]?.toISOString() || undefined,
            page: 1
          }));
        }}
      />

      {activeFiltersCount > 0 && !isMobile && (
        <Button
          type="text"
          icon={<CloseCircleOutlined />}
          onClick={resetFilters}
          className="text-gray-500 hover:text-red-500 text-xs flex items-center"
        >
          Reset
        </Button>
      )}
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span>Tickets & Issues</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                params.myTickets
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {params.myTickets ? 'Viewing: My Tickets' : 'Viewing: All Visible Tickets'}
            </span>
          </div>
        }
        description="Manage and track your enterprise tickets and issues."
        extra={
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <Badge count={activeFiltersCount} size="small" offset={[-2, 2]}>
                <Button icon={<FilterOutlined />} onClick={() => setIsFilterModalOpen(true)}>
                  Filters
                </Button>
              </Badge>
            </div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchTickets(params)}
              loading={loading}
              title="Refresh tickets"
            />
            {hasPermission('tickets:create') && !isSuperAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tickets/new')}>
                Create Ticket
              </Button>
            )}
          </div>
        }
      />

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-gray-100">
        {/* Desktop Filter & Search Bar */}
        <div className="hidden md:flex mb-6 flex-col gap-3 bg-gray-50/80 p-4 rounded-xl border border-gray-200/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-gray-700 font-medium text-sm shrink-0">
              <FilterOutlined className="text-gray-500" />
              <span>Filter Tickets</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                  params.myTickets
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {params.myTickets ? 'My Tickets' : 'All Visible'}
              </span>
              {activeFiltersCount > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {activeFiltersCount} active
                </span>
              )}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <Input.Search
                placeholder={searchMode === 'semantic' ? "Semantic search: describe an issue, concept, or symptom..." : "Search by title, description or ID..."}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value && params.search) {
                    setParams({ ...params, search: '', page: 1 });
                  }
                }}
                onSearch={(val) => setParams({ ...params, search: val, page: 1 })}
                className="w-full"
                allowClear
              />
              <Tooltip title={searchMode === 'semantic' ? 'Semantic search matches concepts, intent, and meaning across title and description. Click to toggle keyword match.' : 'Keyword search looks for exact word stems. Click to toggle AI semantic search.'}>
                <Button
                  onClick={() => setSearchMode(prev => prev === 'semantic' ? 'keyword' : 'semantic')}
                  className={searchMode === 'semantic' ? 'bg-purple-50 text-purple-700 border-purple-300 font-medium hover:!border-purple-500 hover:!text-purple-800 shrink-0 flex items-center gap-1.5' : 'text-gray-600 hover:!text-purple-600 shrink-0 flex items-center gap-1.5'}
                >
                  <span>{searchMode === 'semantic' ? '✨ Semantic AI' : '🔍 Keyword'}</span>
                </Button>
              </Tooltip>
            </div>
          </div>
          <FilterControls />
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden mb-4 flex items-center gap-2">
          <Input.Search
            placeholder={searchMode === 'semantic' ? "Semantic AI search..." : "Search tickets..."}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (!e.target.value && params.search) {
                setParams({ ...params, search: '', page: 1 });
              }
            }}
            onSearch={(val) => setParams({ ...params, search: val, page: 1 })}
            className="w-full"
            size="large"
            allowClear
          />
          <Button
            size="large"
            onClick={() => setSearchMode(prev => prev === 'semantic' ? 'keyword' : 'semantic')}
            className={searchMode === 'semantic' ? 'bg-purple-50 text-purple-700 border-purple-300 font-medium shrink-0' : 'text-gray-500 shrink-0'}
            title={searchMode === 'semantic' ? 'Semantic Search is ON' : 'Keyword Search is ON'}
          >
            {searchMode === 'semantic' ? '✨ AI' : '🔍'}
          </Button>
        </div>

        {/* Responsive Tiles Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 animate-pulse h-44 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                    <div className="h-5 w-20 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-5 w-3/4 bg-gray-200 rounded" />
                  <div className="h-4 w-1/2 bg-gray-200 rounded" />
                </div>
                <div className="h-6 w-full bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : tickets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tickets.map((ticket: any) => {
              const config = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
              const slaStatus = getTicketSLAStatus(ticket);

              return (
                <div
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className={`group relative flex flex-col justify-between p-4 rounded-xl border ${config.cardBorder} bg-white ${config.glowBg} border-t-4 ${config.accentBorder} shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer min-h-[160px]`}
                >
                  {/* Top Row: Priority & SLA + Status Pill */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Tag
                          color={
                            ticket.priority === 'URGENT'
                              ? 'red'
                              : ticket.priority === 'HIGH'
                              ? 'magenta'
                              : ticket.priority === 'MEDIUM'
                              ? 'orange'
                              : 'default'
                          }
                          className="!m-0 text-[11px] font-medium rounded-md"
                        >
                          {ticket.priority}
                        </Tag>

                        {slaStatus === 'breached' && (
                          <Tooltip title="SLA Breached!">
                            <Tag color="error" icon={<AlertOutlined />} className="!m-0 text-[10px] rounded-md">
                              BREACHED
                            </Tag>
                          </Tooltip>
                        )}
                        {ticket.similarityScore !== undefined && ticket.similarityScore !== null && (
                          <Tooltip title={`Semantic relevance match: ${Math.round(ticket.similarityScore * 100)}%`}>
                            <Tag
                              color={ticket.similarityScore >= 0.8 ? 'green' : ticket.similarityScore >= 0.65 ? 'blue' : 'purple'}
                              className="!m-0 text-[10px] font-semibold rounded-md"
                            >
                              ✨ {Math.round(ticket.similarityScore * 100)}%
                            </Tag>
                          </Tooltip>
                        )}
                      </div>

                      {/* Status Badge with colored dot */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} shrink-0`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                        {config.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-base leading-snug line-clamp-2 mb-1"
                      title={ticket.title}
                    >
                      {ticket.title}
                    </h3>

                    {/* Optional Team / Creator Context */}
                    {(ticket.team?.name || ticket.createdBy?.name) && (
                      <p className="text-xs text-gray-500 truncate mb-3">
                        {ticket.team?.name ? `${ticket.team.name} • ` : ''}By {ticket.createdBy?.name || 'Unknown'}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Assignee & Creation Date */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <span className="text-[11px] text-gray-400 shrink-0 font-medium">Assignee:</span>
                      {ticket.assignees && ticket.assignees.length > 0 ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar.Group maxCount={2} size="small" className="shrink-0">
                            {ticket.assignees.map((a: any) => (
                              <Tooltip key={a.user.id} title={a.user.name}>
                                <Avatar size="small" className="bg-blue-600 text-white text-[11px] font-medium">
                                  {a.user.name?.charAt(0).toUpperCase() || 'U'}
                                </Avatar>
                              </Tooltip>
                            ))}
                          </Avatar.Group>
                          <span className="text-xs text-gray-700 font-medium truncate max-w-[100px] sm:max-w-[130px]">
                            {ticket.assignees.map((a: any) => a.user.name).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Unassigned</span>
                      )}
                    </div>

                    <span className="text-[11px] text-gray-400 shrink-0 font-mono">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <Empty
              description={
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-gray-700 font-medium">No tickets found</span>
                  <span className="text-xs text-gray-400">Try adjusting your search or active filters</span>
                </div>
              }
            />
            {activeFiltersCount > 0 && (
              <Button type="default" size="small" onClick={resetFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Responsive Pagination */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-500 order-2 sm:order-1">
              Showing {((params.page - 1) * params.limit) + (tickets.length > 0 ? 1 : 0)}–{Math.min(params.page * params.limit, total)} of {total} tickets
            </span>
            <div className="order-1 sm:order-2">
              <Pagination
                current={params.page}
                pageSize={params.limit}
                total={total}
                showSizeChanger
                pageSizeOptions={['8', '12', '24', '48']}
                onChange={(page, pageSize) => {
                  setParams((prev: any) => ({ ...prev, page, limit: pageSize }));
                }}
                size="small"
                responsive
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Filter Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span>Filter Tickets</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                params.myTickets
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {params.myTickets ? 'My Tickets' : 'All Visible'}
            </span>
          </div>
        }
        open={isFilterModalOpen}
        onCancel={() => setIsFilterModalOpen(false)}
        footer={[
          <Button key="reset" onClick={resetFilters} disabled={activeFiltersCount === 0}>
            Reset
          </Button>,
          <Button key="apply" type="primary" onClick={() => setIsFilterModalOpen(false)}>
            Apply Filters
          </Button>
        ]}
      >
        <div className="py-3">
          <FilterControls isMobile={true} />
        </div>
      </Modal>
    </PageContainer>
  );
};
