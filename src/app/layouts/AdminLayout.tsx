import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Button, Drawer, Tooltip } from 'antd';
import { 
  UserOutlined, 
  LogoutOutlined, 
  DashboardOutlined, 
  ProfileOutlined, 
  MenuOutlined, 
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CloseOutlined,
  DownOutlined,
  SafetyCertificateOutlined, 
  DatabaseOutlined, 
  TeamOutlined, 
  FolderOutlined, 
  BugOutlined, 
  CheckSquareOutlined, 
  MessageOutlined, 
  FileDoneOutlined, 
  AimOutlined, 
  RadarChartOutlined 
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useNotificationStore } from '@/features/notifications/store/notification.store';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

const { Header, Content, Sider } = Layout;

const getRouteMeta = (pathname: string): { title: string; category?: string } => {
  if (pathname === '/dashboard') return { title: 'Dashboard', category: 'Overview' };
  if (pathname === '/profile') return { title: 'My Profile', category: 'Account' };
  if (pathname === '/roles') return { title: 'Roles & Permissions', category: 'Administration' };
  if (pathname === '/users') return { title: 'User Management', category: 'Administration' };
  if (pathname === '/teams') return { title: 'Team Management', category: 'Organization' };
  if (pathname.startsWith('/teams/')) return { title: 'Team Details', category: 'Organization' };
  if (pathname === '/tasks') return { title: 'Task Management', category: 'Operations' };
  if (pathname === '/tasks/dashboard') return { title: 'Task Analytics', category: 'Operations' };
  if (pathname === '/tickets') return { title: 'Tickets & Issues', category: 'Support' };
  if (pathname === '/tickets/new') return { title: 'Create Ticket', category: 'Support' };
  if (pathname.startsWith('/tickets/')) return { title: 'Ticket Details', category: 'Support' };
  if (pathname === '/batches') return { title: 'Batches', category: 'Foundation' };
  if (pathname === '/students') return { title: 'Students', category: 'Foundation' };
  if (pathname === '/foundation/overview') return { title: 'Foundation Overview', category: 'Foundation' };
  if (pathname === '/foundation/coordinator') return { title: 'Student Coordinator', category: 'Foundation' };
  if (pathname === '/foundation/threads') return { title: 'Discussion Threads', category: 'Foundation' };
  if (pathname.startsWith('/foundation/threads/')) return { title: 'Thread Details', category: 'Foundation' };
  if (pathname === '/foundation/results') return { title: 'Exam Results', category: 'Foundation' };
  if (pathname === '/kpi/executive') return { title: 'Executive KPI Portal', category: 'Analytics' };
  if (pathname === '/kpi/mel') return { title: 'MEL Analytics Center', category: 'Analytics' };
  if (pathname === '/kpi/curator') return { title: 'Report Curator', category: 'Analytics' };
  if (pathname.startsWith('/kpi/teams')) return { title: 'Team KPIs', category: 'Analytics' };

  const segment = pathname.split('/').filter(Boolean).pop() || 'Dashboard';
  const formatted = segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
  return { title: formatted };
};

export const AdminLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, accessToken, isAuthenticated } = useAuthStore();
  const { connectSocket, disconnectSocket } = useNotificationStore();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const routeMeta = getRouteMeta(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      navigate('/login');
    }
  }, [isAuthenticated, navigate, disconnectSocket]);

  useEffect(() => {
    if (accessToken) {
      connectSocket();
    }
    return () => disconnectSocket();
  }, [accessToken, connectSocket, disconnectSocket]);

  const isCoordinator = (user as any)?.type === 'STUDENT_COORDINATOR' || (user as any)?.role === 'STUDENT_COORDINATOR';
  const anyUser = user as any;
  const userName = isCoordinator 
    ? anyUser?.name || 'Coordinator' 
    : (anyUser?.type === 'user' || anyUser?.email ? anyUser?.name || 'User' : anyUser?.identifier || 'Admin');
  const userRole = anyUser?.role?.name || (isCoordinator ? 'Coordinator' : anyUser?.type === 'super_admin' ? 'Super Admin' : 'Member');

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined className="text-gray-500 text-base" />,
      label: <span className="text-sm font-medium text-gray-700">My Profile</span>,
      onClick: () => navigate('/profile'),
      className: 'py-2 px-3',
    },
    {
      type: 'divider' as const,
      className: 'my-1',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined className="text-red-500 text-base" />,
      label: <span className="text-sm font-medium text-red-600">Log out</span>,
      danger: true,
      onClick: handleLogout,
      className: 'py-2 px-3',
    },
  ];

  let menuItems: any[] = [];

  if (isCoordinator) {
    menuItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
        onClick: () => {
          navigate('/dashboard');
          setMobileMenuOpen(false);
        },
      },
      {
        key: '/foundation/threads',
        icon: <FolderOutlined />,
        label: 'My Threads',
        onClick: () => {
          navigate('/foundation/threads');
          setMobileMenuOpen(false);
        },
      },
      {
        key: '/profile',
        icon: <ProfileOutlined />,
        label: 'Profile',
        onClick: () => {
          navigate('/profile');
          setMobileMenuOpen(false);
        },
      },
    ];
  } else {
    menuItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Dashboard',
        onClick: () => {
          navigate('/dashboard');
          setMobileMenuOpen(false);
        },
      },
      {
        key: '/profile',
        icon: <ProfileOutlined />,
        label: 'Profile',
        onClick: () => {
          navigate('/profile');
          setMobileMenuOpen(false);
        },
      },
    ];

    if (hasPermission('roles:read')) {
      menuItems.push({
      key: '/roles',
      icon: <SafetyCertificateOutlined />,
      label: 'Roles & Permissions',
      onClick: () => {
        navigate('/roles');
        setMobileMenuOpen(false);
      },
    });
    }

    if (hasPermission('foundation:read')) {
      const foundationChildren: any[] = [];

    if (hasPermission('foundation_overview:read')) {
      foundationChildren.push({
        key: '/foundation/overview',
        icon: <DashboardOutlined />,
        label: 'Overview',
        onClick: () => {
          navigate('/foundation/overview');
          setMobileMenuOpen(false);
        },
      });
    }

    if (hasPermission('foundation_coordinator:read')) {
      foundationChildren.push({
        key: '/foundation/coordinator',
        icon: <UserOutlined />,
        label: 'Student Coordinator',
        onClick: () => {
          navigate('/foundation/coordinator');
          setMobileMenuOpen(false);
        },
      });
    }

    if (hasPermission('foundation_threads:read')) {
      foundationChildren.push({
        key: '/foundation/threads',
        icon: <MessageOutlined />,
        label: 'Threads',
        onClick: () => {
          navigate('/foundation/threads');
          setMobileMenuOpen(false);
        },
      });
    }

    if (hasPermission('foundation_results:read')) {
      foundationChildren.push({
        key: '/foundation/results',
        icon: <FileDoneOutlined />,
        label: 'Results',
        onClick: () => {
          navigate('/foundation/results');
          setMobileMenuOpen(false);
        },
      });
    }

    if (hasPermission('batches:read')) {
      foundationChildren.push({
        key: '/batches',
        icon: <DatabaseOutlined />,
        label: 'Batches',
        onClick: () => {
          navigate('/batches');
          setMobileMenuOpen(false);
        },
      });
    }

    if (hasPermission('students:read')) {
      foundationChildren.push({
        key: '/students',
        icon: <TeamOutlined />,
        label: 'Students',
        onClick: () => {
          navigate('/students');
          setMobileMenuOpen(false);
        },
      });
    }

    if (foundationChildren.length > 0) {
      menuItems.push({
        key: 'foundation',
        icon: <FolderOutlined />,
        label: 'Foundation',
        children: foundationChildren,
      });
    }
      }

    if (hasPermission('teams:read')) {
      menuItems.push({
      key: '/teams',
      icon: <TeamOutlined />,
      label: 'Team Management',
      onClick: () => {
        navigate('/teams');
        setMobileMenuOpen(false);
      },
    });
    }

    if (hasPermission('users:read')) {
      menuItems.push({
      key: '/users',
      icon: <UserOutlined />,
      label: 'User Management',
      onClick: () => {
        navigate('/users');
        setMobileMenuOpen(false);
      },
    });
    }

    if (hasPermission('tickets:read')) {
      menuItems.push({
      key: '/tickets',
      icon: <BugOutlined />,
      label: 'Tickets & Issues',
      onClick: () => {
        navigate('/tickets');
        setMobileMenuOpen(false);
      },
    });
  }

    if (hasPermission('tasks:read')) {
      menuItems.push({
        key: 'tasks_management',
        icon: <CheckSquareOutlined />,
        label: 'Task Management',
        children: [
          {
            key: '/tasks/dashboard',
            label: 'Dashboard',
            onClick: () => {
              navigate('/tasks/dashboard');
              setMobileMenuOpen(false);
            },
          },
          {
            key: '/tasks',
            label: 'Task List',
            onClick: () => {
              navigate('/tasks');
              setMobileMenuOpen(false);
            },
          }
        ]
      });
    }

    if (hasPermission('kpi:read_executive_report')) {
      menuItems.push({
        key: '/kpi/executive',
        icon: <DashboardOutlined />,
        label: 'Executive KPI Portal',
        onClick: () => {
          navigate('/kpi/executive');
          setMobileMenuOpen(false);
        },
      });
    }

    if (hasPermission('kpi:read_all') || hasPermission('kpi:curate_report')) {
      const melChildren: any[] = [
        {
          key: '/kpi/mel',
          label: 'Analytics Center',
          onClick: () => {
            navigate('/kpi/mel');
            setMobileMenuOpen(false);
          },
        },
      ];

      if (hasPermission('kpi:curate_report')) {
        melChildren.push({
          key: '/kpi/curator',
          label: 'Report Curator',
          onClick: () => {
            navigate('/kpi/curator');
            setMobileMenuOpen(false);
          },
        });
      }

      menuItems.push({
        key: 'mel_kpi',
        icon: <RadarChartOutlined />,
        label: 'MEL KPI Center',
        children: melChildren,
      });
    }

    if (hasPermission('kpi:read')) {
      menuItems.push({
        key: '/kpi/teams',
        icon: <AimOutlined />,
        label: 'Team KPIs',
        onClick: () => {
          navigate('/kpi/teams');
          setMobileMenuOpen(false);
        },
      });
    }
  }

  const sidebarHeader = (
    <div className={`h-14 sm:h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'justify-start px-4'} border-b border-gray-800 bg-gray-900 transition-all duration-300 select-none`}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-md tracking-wider shrink-0">
          EZ
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0 overflow-hidden">
            <span className="font-bold text-white text-base tracking-tight leading-none">
              ezee<span className="text-blue-400">.org</span>
            </span>
            <span className="text-[10px] text-gray-400 font-medium tracking-wide uppercase mt-1 truncate">
              {isCoordinator ? 'Coordinator Portal' : (user?.type === 'user' || (user as any)?.email ? 'User Portal' : 'Admin Panel')}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout hasSider className="h-[100dvh] w-full bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <Sider
        width={250}
        collapsedWidth={72}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="hidden lg:block bg-gray-900 h-[100dvh] shrink-0 border-r border-gray-800 transition-all duration-300"
        trigger={null}
      >
        <div className="h-full flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto">
            {sidebarHeader}
            <Menu
              theme="dark"
              mode="inline"
              inlineCollapsed={collapsed}
              selectedKeys={[location.pathname]}
              items={menuItems}
              className="bg-gray-900 border-none pt-2"
            />
          </div>
          {!collapsed ? (
            <div className="p-3 border-t border-gray-800/80 bg-gray-950/60 flex items-center justify-between gap-2 shrink-0">
              <div 
                className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-90"
                onClick={() => navigate('/profile')}
              >
                <Avatar icon={<UserOutlined />} className="bg-purple-600 shrink-0" size={32} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate max-w-[125px]">{userName}</span>
                  <span className="text-[10px] text-gray-400 truncate max-w-[125px]">{userRole}</span>
                </div>
              </div>
              <Button
                type="text"
                danger
                icon={<LogoutOutlined className="text-base" />}
                onClick={handleLogout}
                title="Log out"
                className="hover:bg-red-950/40 text-red-400 hover:text-red-300 flex items-center justify-center h-8 w-8 shrink-0 rounded-lg"
                style={{ color: '#f87171' }}
                aria-label="Log out"
              />
            </div>
          ) : (
            <div className="p-3 border-t border-gray-800/80 bg-gray-950/60 flex justify-center shrink-0">
              <Tooltip title={`${userName} (${userRole})`} placement="right">
                <Avatar icon={<UserOutlined />} className="bg-purple-600 cursor-pointer" size={32} onClick={() => navigate('/profile')} />
              </Tooltip>
            </div>
          )}
        </div>
      </Sider>

      {/* Mobile Drawer Navigation */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width="min(82vw, 300px)"
        styles={{ 
          body: { padding: 0, backgroundColor: '#111827', height: '100%', display: 'flex', flexDirection: 'column' },
          mask: { backdropFilter: 'blur(2px)' }
        }}
        className="lg:hidden"
      >
        <div className="h-full flex flex-col justify-between bg-gray-900">
          {/* Drawer Top Header */}
          <div className="h-14 sm:h-16 flex items-center justify-between px-4 border-b border-gray-800 bg-gray-900 shrink-0">
            <div className="flex items-center gap-2.5 select-none">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-xs tracking-wider">
                EZ
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-sm tracking-tight leading-none">
                  ezee<span className="text-blue-400">.org</span>
                </span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">
                  {isCoordinator ? 'Coordinator' : (user?.type === 'user' || (user as any)?.email ? 'Portal' : 'Admin')}
                </span>
              </div>
            </div>
            <Button
              type="text"
              icon={<CloseOutlined className="text-gray-400 hover:text-white text-base" />}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-800"
              aria-label="Close menu"
            />
          </div>

          {/* Drawer Menu List */}
          <div className="flex-1 overflow-y-auto pt-2 pb-4">
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              className="bg-gray-900 border-none"
            />
          </div>

          {/* Drawer Footer User Profile */}
          <div className="p-3.5 border-t border-gray-800 bg-gray-950/90 shrink-0 flex items-center justify-between gap-3">
            <div 
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-90"
              onClick={() => {
                navigate('/profile');
                setMobileMenuOpen(false);
              }}
            >
              <Avatar icon={<UserOutlined />} className="bg-purple-600 shrink-0" size={34} />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white truncate">{userName}</span>
                <span className="text-[10px] text-gray-400 truncate">{userRole}</span>
              </div>
            </div>
            <Button
              type="text"
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="hover:bg-red-950/40 text-red-400 shrink-0 flex items-center justify-center h-8 w-8"
              title="Log out"
            />
          </div>
        </div>
      </Drawer>

      <Layout className="bg-transparent flex flex-col h-[100dvh] overflow-hidden">
        <Header 
          style={{ height: 64, lineHeight: 'normal' }}
          className="px-4! sm:px-6! md:px-8! flex justify-between items-center bg-white/95 backdrop-blur-xs border-b border-gray-200/80 shadow-2xs shrink-0 z-20"
        >
          {/* Left Side: Hamburger on Mobile/Tablet, Collapse Toggle on Desktop, Mobile Brand Pill, Contextual Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile / Tablet Hamburger */}
            <div className="lg:hidden flex items-center">
              <Button
                type="text"
                icon={<MenuOutlined className="text-gray-700 text-lg" />}
                onClick={() => setMobileMenuOpen(true)}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg hover:bg-gray-100 text-gray-700"
                aria-label="Open navigation menu"
              />
            </div>

            {/* Desktop Sidebar Collapse Toggle */}
            <div className="hidden lg:flex items-center">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined className="text-gray-600 text-base" /> : <MenuFoldOutlined className="text-gray-600 text-base" />}
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              />
            </div>

            {/* Mobile Brand Identity Pill (shown when sidebar is hidden) */}
            <div className="lg:hidden flex items-center gap-1.5 shrink-0 pr-1 select-none">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xs shadow-xs tracking-wider">
                EZ
              </div>
              <span className="hidden sm:inline font-bold text-gray-900 text-sm tracking-tight">
                ezee<span className="text-blue-600">.org</span>
              </span>
            </div>

            {/* Vertical separator */}
            <div className="hidden sm:block h-5 w-px bg-gray-200 mx-0.5 shrink-0" />

            {/* Contextual Route Title & Category */}
            <div className="flex flex-col min-w-0 justify-center">
              {routeMeta.category && (
                <span className="hidden md:inline text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none">
                  {routeMeta.category}
                </span>
              )}
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-gray-800 tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[260px] md:max-w-none m-0 leading-tight">
                {routeMeta.title}
              </h1>
            </div>
          </div>

          {/* Right Side: Notification Bell & User Profile Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 h-full">
            <NotificationBell />

            <Dropdown 
              menu={{ items: userMenuItems }} 
              placement="bottomRight" 
              arrow 
              trigger={['click']}
              dropdownRender={(menu) => (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[210px]">
                  {/* User Profile Header Card */}
                  <div className="px-3.5 py-3 bg-gray-50/90 border-b border-gray-100 flex items-center gap-3">
                    <Avatar 
                      icon={<UserOutlined />} 
                      size={36} 
                      style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}
                      className="shrink-0"
                    />
                    <div className="flex flex-col min-w-0 text-left justify-center">
                      <span className="font-semibold text-gray-900 text-sm leading-snug truncate">
                        {userName}
                      </span>
                    </div>
                  </div>

                  {/* Action Items */}
                  {React.isValidElement(menu) && React.cloneElement(menu as React.ReactElement<any>, {
                    style: {
                      boxShadow: 'none',
                      border: 'none',
                      background: 'transparent',
                      padding: '4px',
                    },
                  })}
                </div>
              )}
            >
              <button 
                type="button" 
                className="flex items-center gap-2 h-10 px-1.5 sm:pl-1.5 sm:pr-3 rounded-full border border-gray-200/90 bg-white hover:bg-gray-50/90 active:bg-gray-100 transition-all shadow-2xs cursor-pointer select-none focus:outline-hidden"
                style={{ lineHeight: 1 }}
              >
                <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
                  <Avatar 
                    icon={<UserOutlined />} 
                    size={32} 
                    style={{ backgroundColor: '#7c3aed', color: '#ffffff' }}
                    className="shrink-0"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full z-10" />
                </div>
                <div className="hidden sm:flex flex-col items-start justify-center min-w-0 text-left gap-0.5">
                  <span className="text-xs font-semibold text-gray-800 leading-none truncate max-w-[110px] md:max-w-[150px]">
                    {userName}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium leading-none">
                    {userRole}
                  </span>
                </div>
                <DownOutlined className="hidden sm:block text-[10px] text-gray-400 shrink-0 ml-0.5 self-center" />
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content className="p-3 sm:p-5 lg:p-8 bg-gray-50 flex-1 overflow-y-auto">
          {(() => {
            const path = location.pathname;
            if (path === '/tickets/new' && !hasPermission('tickets:create')) return <div className="text-center p-8 text-gray-500">Access Denied</div>;

            if (path.startsWith('/roles') && !hasPermission('roles:read')) return <div className="text-center p-8 text-gray-500">Access Denied</div>;
            if (path.startsWith('/batches') && !hasPermission('batches:read')) return <div className="text-center p-8 text-gray-500">Access Denied</div>;
            if (path.startsWith('/students') && !hasPermission('students:read')) return <div className="text-center p-8 text-gray-500">Access Denied</div>;
            if (path.startsWith('/teams') && !hasPermission('teams:read')) return <div className="text-center p-8 text-gray-500">Access Denied</div>;
            if (path.startsWith('/users') && !hasPermission('users:read')) return <div className="text-center p-8 text-gray-500">Access Denied</div>;
            if (path.startsWith('/tickets') && !hasPermission('tickets:read')) return <div className="text-center p-8 text-gray-500">Access Denied</div>;

            return <Outlet />;
          })()}
        </Content>
      </Layout>
    </Layout>
  );
};
