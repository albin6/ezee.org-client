import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { CoordinatorLoginPage } from '@/features/auth/pages/CoordinatorLoginPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { AdminLayout } from '../layouts/AdminLayout';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { RolesPage } from '@/features/rbac/pages/RolesPage';
import { BatchesPage } from '@/features/foundation/pages/BatchesPage';
import { StudentsPage } from '@/features/foundation/pages/StudentsPage';
import { OverviewPage } from '@/features/foundation/pages/OverviewPage';
import { CoordinatorPage } from '@/features/foundation/pages/CoordinatorPage';
import { ThreadsPage } from '@/features/foundation/pages/ThreadsPage';
import { ThreadDetailsPage } from '@/features/foundation/pages/ThreadDetailsPage';
import { ResultsPage } from '@/features/foundation/pages/ResultsPage';
import { TeamsPage } from '@/features/teams/pages/TeamsPage';
import { TeamDetailsPage } from '@/features/teams/pages/TeamDetailsPage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { TicketListPage } from '@/features/tickets/pages/TicketListPage';
import { TicketDetailsPage } from '@/features/tickets/pages/TicketDetailsPage';
import { CreateTicketPage } from '@/features/tickets/pages/CreateTicketPage';
import { TaskListPage } from '@/features/tasks/pages/TaskListPage';
import { TaskDashboardPage } from '@/features/tasks/pages/TaskDashboardPage';
import { ExecutiveDashboardPage } from '@/features/kpi/pages/ExecutiveDashboardPage';
import { MELAnalyticsDashboardPage } from '@/features/kpi/pages/MELAnalyticsDashboardPage';
import { TeamKPIPage } from '@/features/kpi/pages/TeamKPIPage';
import { ExecutiveReportCuratorPage } from '@/features/kpi/pages/ExecutiveReportCuratorPage';

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
    path: '/coordinator/login',
    element: <CoordinatorLoginPage />,
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
            path: '/foundation/overview',
            element: <OverviewPage />,
          },
          {
            path: '/foundation/coordinator',
            element: <CoordinatorPage />,
          },
          {
            path: '/foundation/threads',
            element: <ThreadsPage />,
          },
          {
            path: '/foundation/threads/:threadId',
            element: <ThreadDetailsPage />,
          },
          {
            path: '/foundation/results',
            element: <ResultsPage />,
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
            path: '/teams/:id',
            element: <TeamDetailsPage />,
          },
          {
            path: '/tasks/dashboard',
            element: <TaskDashboardPage />,
          },
          {
            path: '/tasks',
            element: <TaskListPage />,
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
          {
            path: '/kpi/executive',
            element: <ExecutiveDashboardPage />,
          },
          {
            path: '/kpi/mel',
            element: <MELAnalyticsDashboardPage />,
          },
          {
            path: '/kpi/curator',
            element: <ExecutiveReportCuratorPage />,
          },
          {
            path: '/kpi/teams/:teamId?',
            element: <TeamKPIPage />,
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
