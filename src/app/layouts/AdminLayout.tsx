import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Button, Drawer } from 'antd';
import { UserOutlined, LogoutOutlined, DashboardOutlined, ProfileOutlined, MenuOutlined, SafetyCertificateOutlined, DatabaseOutlined, TeamOutlined, FolderOutlined, BugOutlined, CheckSquareOutlined, MessageOutlined, FileDoneOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { usePermissions } from '@/shared/hooks/usePermissions';
import { useNotificationStore } from '@/features/notifications/store/notification.store';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';

const { Header, Content, Sider } = Layout;

export const AdminLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout, accessToken, isAuthenticated } = useAuthStore();
  const { connectSocket, disconnectSocket } = useNotificationStore();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

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

  const userMenu = (
    <Menu
      items={[
        {
          key: 'profile',
          icon: <UserOutlined />,
          label: 'Profile',
          onClick: () => navigate('/profile'),
        },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: 'Logout',
          danger: true,
          onClick: handleLogout,
        },
      ]}
    />
  );

  let menuItems: any[] = [];

  const isCoordinator = (user as any)?.type === 'STUDENT_COORDINATOR' || (user as any)?.role === 'STUDENT_COORDINATOR';

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

    // Task Management (Visible to everyone in V1 or adapt permissions as needed)
    menuItems.push({
      key: '/tasks',
      icon: <CheckSquareOutlined />,
      label: 'Tasks',
      onClick: () => {
        navigate('/tasks');
        setMobileMenuOpen(false);
      },
    });
  }

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center justify-center text-white text-xl font-bold border-b border-gray-800 bg-gray-900">
        {isCoordinator ? 'Coordinator Portal' : (user?.type === 'user' || (user as any)?.email ? 'User Portal' : 'Admin Panel')}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        className="bg-gray-900"
      />
    </>
  );

  return (
    <Layout hasSider className="h-screen w-full bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <Sider
        width={250}
        className="hidden lg:block bg-gray-900 h-screen shrink-0"
        trigger={null}
      >
        <div className="h-full flex flex-col">
          {sidebarContent}
        </div>
      </Sider>

      {/* Mobile Drawer */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        styles={{ body: { padding: 0, backgroundColor: '#111827' } }}
        className="lg:hidden"
      >
        <div className="h-full flex flex-col">
          {sidebarContent}
        </div>
      </Drawer>

      <Layout className="bg-transparent flex flex-col h-screen overflow-hidden">
        <Header className="px-4 lg:px-8 flex justify-between items-center shadow-sm bg-white shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="lg:hidden flex items-center">
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuOpen(true)}
                className="text-gray-500"
                aria-label="Toggle menu"
              />
            </div>
            <div className="text-xl font-semibold text-gray-800">
              {location.pathname === '/dashboard' ? 'Dashboard' :
                location.pathname === '/profile' ? 'Profile' :
                  location.pathname === '/roles' ? 'Roles & Permissions' :
                    location.pathname === '/users' ? 'User Management' : ''}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Dropdown menu={{ items: userMenu.props.items }} placement="bottomRight" arrow>
              <Button type="text" className="flex items-center gap-2 h-auto py-1">
                <Avatar icon={<UserOutlined />} className="bg-purple-600" />
                <span className="hidden sm:inline text-gray-600 font-medium">
                  {isCoordinator 
                    ? (user as any)?.name || 'Coordinator' 
                    : (user?.type === 'user' || (user as any)?.email ? (user as any)?.name || 'User' : user?.identifier || 'Admin')}
                </span>
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content className="p-4 sm:p-6 lg:p-8 bg-gray-50 flex-1 overflow-y-auto">
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
