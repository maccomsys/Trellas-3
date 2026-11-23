import React from 'react';
import { AppProvider, useApp } from './components/AppContext';
import { AuthPages } from './components/AuthPages';
import {
  FilesView,
  MemberProfileView,
  ReportsAnalyticsView,
  TeamMembersView,
  TemplatesView,
} from './components/CollaborationViews';
import { DashboardView } from './components/DashboardView';
import { GlobalModals } from './components/GlobalModals';
import { LandingPage } from './components/LandingPage';
import { ProjectDetailsView, ProjectsOverview } from './components/ProjectViews';
import { SettingsView, TrashView } from './components/SettingsAndTrashViews';
import {
  InboxNotificationsView,
  MyTasksView,
  WorkspaceCalendarView,
  WorkspaceTimelineView,
} from './components/TaskCollectionsViews';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { WorkspaceShell } from './components/WorkspaceShell';

const AppRouter: React.FC = () => {
  const { route, user, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#111312] flex items-center justify-center">
        <div className="text-xs font-medium text-[#646D67] dark:text-[#9CA39F]">Loading Trellas workspace...</div>
      </div>
    );
  }

  if (!user) {
    if (
      route === 'login' ||
      route === 'register' ||
      route === 'forgot-password' ||
      route === 'reset-password' ||
      route === 'verify-email'
    ) {
      return (
        <>
          <AuthPages />
          <GlobalModals />
        </>
      );
    }
    return <LandingPage />;
  }

  return (
    <>
      <WorkspaceShell>
        {route === 'dashboard' && <DashboardView />}
        {route === 'my-tasks' && <MyTasksView />}
        {(route === 'inbox' || route === 'notifications') && <InboxNotificationsView />}
        {route === 'projects' && <ProjectsOverview />}
        {(route === 'project-detail' || route === 'boards') && <ProjectDetailsView />}
        {route === 'calendar' && <WorkspaceCalendarView />}
        {route === 'timeline' && <WorkspaceTimelineView />}
        {route === 'team' && <TeamMembersView />}
        {route === 'member-profile' && <MemberProfileView />}
        {route === 'reports' && <ReportsAnalyticsView />}
        {route === 'files' && <FilesView />}
        {route === 'templates' && <TemplatesView />}
        {route === 'trash' && <TrashView />}
        {route === 'settings' && <SettingsView />}
      </WorkspaceShell>
      <TaskDetailDrawer />
      <GlobalModals />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
