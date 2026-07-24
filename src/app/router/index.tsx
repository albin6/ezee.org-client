import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { AdminLayout } from '../layouts/AdminLayout';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { RolesPage } from '@/features/rbac/pages/RolesPage';
import { BatchesPage } from '@/features/foundation/pages/BatchesPage';
import { StudentsPage } from '@/features/foundation/pages/StudentsPage';
import { TeamsPage } from '@/features/teams/pages/TeamsPage';
import { TeamDetailsPage } from '@/features/teams/pages/TeamDetailsPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { TicketListPage } from '@/features/tickets/pages/TicketListPage';
import { TicketDetailsPage } from '@/features/tickets/pages/TicketDetailsPage';
import { CreateTicketPage } from '@/features/tickets/pages/CreateTicketPage';
import { TaskListPage } from '@/features/tasks/pages/TaskListPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
          {
            path: '/roles',
            element: <RolesPage />,
          },
          {
            path: '/batches',
            element: <BatchesPage />,
          },
          {
            path: '/students',
            element: <StudentsPage />,
          },
          {
            path: '/users',
            element: <UsersPage />,
          },
          {
            path: '/teams',
            element: <TeamsPage />,
          },
          {
            path: '/tasks',
            element: <TaskListPage />,
          },
          {
            path: '/teams/:id',
            element: <TeamDetailsPage />,
          },
          {
            path: '/tickets',
            element: <TicketListPage />,
          },
          {
            path: '/tickets/new',
            element: <CreateTicketPage />,
          },
          {
            path: '/tickets/:id',
            element: <TicketDetailsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
