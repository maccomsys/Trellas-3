import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Files,
  FolderKanban,
  GanttChart,
  Inbox,
  Kanban,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Pause,
  Pin,
  Play,
  Plus,
  Search,
  Settings,
  Square,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDuration, formatRelativeTime } from '../lib/format';
import { type AppRoute, useApp } from './AppContext';
import { TrellasLogo } from './TrellasLogo';
import { UserAvatar } from './UserAvatar';

const NAV_ITEMS: { id: AppRoute; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'my-tasks', label: 'My Tasks', icon: <ListTodo className="w-4 h-4" /> },
  { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-4 h-4" /> },
  { id: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" /> },
  { id: 'boards', label: 'Boards', icon: <Kanban className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
  { id: 'timeline', label: 'Timeline', icon: <GanttChart className="w-4 h-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports & Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'files', label: 'Files', icon: <Files className="w-4 h-4" /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate className="w-4 h-4" /> },
  { id: 'trash', label: 'Trash', icon: <Trash2 className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export const WorkspaceShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    route,
    navigate,
    selectedProjectId,
    user,
    preferences,
    theme,
    setThemeMode,
    workspaces,
    activeWorkspace,
    switchWorkspace,
    projects,
    notifications,
    activeTimer,
    pauseResumeTimer,
    stopTaskTimer,
    setQuickCreateModal,
    setGlobalSearchOpen,
    setSelectedTaskId,
    refreshAccount,
    refreshWorkspaceData,
    logout,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [quickDropdownOpen, setQuickDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const collapsed = Boolean(preferences?.sidebar_collapsed);
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const pinnedPages = preferences?.pinned_pages || [];

  const toggleSidebarCollapse = async () => {
    await apiFetch('/api/account/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ sidebar_collapsed: !collapsed }),
    });
    await refreshAccount();
  };

  const togglePinPage = async (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = pinnedPages.includes(pageId)
      ? pinnedPages.filter((p) => p !== pageId)
      : [...pinnedPages, pageId];
    await apiFetch('/api/account/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ pinned_pages: next }),
    });
    await refreshAccount();
  };

  const markNotifRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
    await refreshWorkspaceData();
  };

  const markAllRead = async () => {
    if (!activeWorkspace) return;
    await apiFetch(`/api/workspaces/${activeWorkspace.id}/notifications/mark-all-read`, { method: 'POST' });
    await refreshWorkspaceData();
  };

  const sortedProjects = [...projects].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)).slice(0, 6);

  const currentNavLabel =
    route === 'project-detail'
      ? projects.find((p) => p.id === selectedProjectId)?.name || 'Project Details'
      : route === 'member-profile'
        ? 'Member Profile'
        : route === 'notifications'
          ? 'Notifications'
          : NAV_ITEMS.find((n) => n.id === route)?.label || 'Workspace';

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#F5F4EE] dark:bg-[#151817] border-r border-[#E6E4DC] dark:border-[#242926]">
      {/* Brand + Collapse */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#E6E4DC] dark:border-[#242926] shrink-0">
        {!collapsed && (
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="cursor-pointer"
          >
            <TrellasLogo size="sm" />
          </button>
        )}
        <button
          type="button"
          onClick={toggleSidebarCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-[#545C57] dark:text-[#A3ABA6] hover:bg-[#E8E6DC] dark:hover:bg-[#232825] cursor-pointer ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-[#545C57] hover:bg-[#E8E6DC] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Switcher */}
      <div className="p-3 border-b border-[#E6E4DC] dark:border-[#242926] relative">
        <button
          type="button"
          onClick={() => setWsDropdownOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-[#1D211F] border border-[#E5E2D9] dark:border-[#2A2F2C] hover:border-[#1B3B2B] dark:hover:border-[#6EE7B7] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-7 h-7 rounded-md text-xs font-bold text-white flex items-center justify-center shrink-0"
              style={{ backgroundColor: activeWorkspace?.logo_color || '#1B3B2B' }}
            >
              {activeWorkspace?.logo_initials || 'TR'}
            </span>
            {!collapsed && (
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold truncate">{activeWorkspace?.name || 'Workspace'}</div>
                <div className="text-[11px] text-[#646D67] dark:text-[#8E9691] capitalize truncate">
                  {activeWorkspace?.role?.replace('_', ' ') || 'Member'} · {activeWorkspace?.plan || 'Pro'}
                </div>
              </div>
            )}
          </div>
          {!collapsed && <ChevronDown className="w-3.5 h-3.5 text-[#646D67] shrink-0" />}
        </button>

        {wsDropdownOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-white dark:bg-[#1C201E] rounded-xl border border-[#E5E2D9] dark:border-[#2C312E] shadow-lg p-1.5 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold text-[#6E7670] dark:text-[#8E9691]">
              Switch workspace
            </div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  switchWorkspace(ws.id);
                  setWsDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-5 h-5 rounded text-[10px] font-bold text-white flex items-center justify-center shrink-0"
                    style={{ backgroundColor: ws.logo_color }}
                  >
                    {ws.logo_initials}
                  </span>
                  <span className="truncate font-medium">{ws.name}</span>
                </span>
                {ws.id === activeWorkspace?.id && <Check className="w-3.5 h-3.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />}
              </button>
            ))}
            <div className="border-t border-[#ECE9E0] dark:border-[#2A2F2C] pt-1 mt-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setWsDropdownOpen(false);
                  setQuickCreateModal('workspace');
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-[#1B3B2B] dark:text-[#6EE7B7] hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create workspace</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWsDropdownOpen(false);
                  navigate('settings');
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[#545C57] dark:text-[#A3ABA6] hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Workspace settings</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Navigation + Pinned Projects */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        {!collapsed && pinnedPages.length > 0 && (
          <div className="space-y-0.5">
            <div className="px-2.5 pb-1 text-[11px] font-semibold text-[#6E7670] dark:text-[#8E9691]">
              Pinned
            </div>
            {NAV_ITEMS.filter((n) => pinnedPages.includes(n.id)).map((item) => {
              const active = route === item.id;
              return (
                <button
                  key={`pin-${item.id}`}
                  type="button"
                  onClick={() => {
                    navigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1B3B2B] text-[#FAF9F6]'
                      : 'text-[#3F4742] dark:text-[#C5CCC8] hover:bg-[#E8E6DC] dark:hover:bg-[#212623]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-0.5">
          {!collapsed && (
            <div className="px-2.5 pb-1 text-[11px] font-semibold text-[#6E7670] dark:text-[#8E9691]">
              Workspace
            </div>
          )}
          {NAV_ITEMS.map((item) => {
            const active = route === item.id;
            const isPinned = pinnedPages.includes(item.id);
            return (
              <div key={item.id} className="group flex items-center">
                <button
                  type="button"
                  title={collapsed ? item.label : undefined}
                  onClick={() => {
                    navigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1B3B2B] text-[#FAF9F6]'
                      : 'text-[#3F4742] dark:text-[#C5CCC8] hover:bg-[#E8E6DC] dark:hover:bg-[#212623]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {item.icon}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!collapsed && item.id === 'inbox' && unreadCount > 0 && (
                    <span className="font-mono-num text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#C99A4E]/20 text-[#92621A] dark:text-[#F3C87B]">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={(e) => togglePinPage(item.id, e)}
                    title={isPinned ? 'Unpin page' : 'Pin page'}
                    className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                      isPinned ? 'opacity-100 text-[#1B3B2B] dark:text-[#6EE7B7]' : 'text-[#8E9691] hover:text-[#1C1F1D]'
                    }`}
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Projects Section */}
        {!collapsed && (
          <div className="space-y-1">
            <div className="px-2.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#6E7670] dark:text-[#8E9691]">Projects</span>
              <button
                type="button"
                onClick={() => setQuickCreateModal('project')}
                title="Create new project"
                className="p-1 rounded text-[#545C57] hover:text-[#1B3B2B] dark:hover:text-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {sortedProjects.map((p) => {
              const active = route === 'project-detail' && selectedProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    navigate('project-detail', { projectId: p.id, subView: 'board' });
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-[#232825] font-semibold text-[#1C1F1D] dark:text-white border border-[#E5E2D9] dark:border-[#2C312E]'
                      : 'text-[#47504A] dark:text-[#B6BEB9] hover:bg-[#E8E6DC] dark:hover:bg-[#212623]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="font-mono-num text-[11px] text-[#7D8580] shrink-0">
                    {p.progress_pct || 0}%
                  </span>
                </button>
              );
            })}
            {sortedProjects.length === 0 && (
              <div className="px-2.5 py-2 text-xs text-[#7D8580]">No projects yet</div>
            )}
          </div>
        )}
      </div>

      {/* Footer Settings & Sign Out */}
      <div className="p-3 border-t border-[#E6E4DC] dark:border-[#242926] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('settings')}
          className="flex items-center gap-2 min-w-0 hover:opacity-80 cursor-pointer"
        >
          <UserAvatar name={user?.full_name || 'User'} avatarUrl={user?.avatar_url} size="sm" />
          {!collapsed && (
            <div className="text-left min-w-0">
              <div className="text-xs font-semibold truncate">{user?.full_name}</div>
              <div className="text-[11px] text-[#6E7670] truncate">{user?.job_title}</div>
            </div>
          )}
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-lg text-[#646D67] hover:text-[#B91C1C] hover:bg-[#E8E6DC] dark:hover:bg-[#232825] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAF9F6] dark:bg-[#111312] text-[#1C1F1D] dark:text-[#F1F2EE]">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block shrink-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{SidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 bg-[#FAF9F6]/90 dark:bg-[#111312]/90 backdrop-blur-md border-b border-[#E6E4DC] dark:border-[#242926] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-[#545C57] hover:bg-[#EFECE4] dark:hover:bg-[#1D211F] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[#6E7670] dark:text-[#8E9691] truncate">
                {activeWorkspace?.name}
              </span>
              <span className="hidden sm:inline text-[#C8C4B8] dark:text-[#3A403D]">/</span>
              <span className="font-semibold truncate">{currentNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Running Timer Bar */}
            {activeTimer && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#1B3B2B] text-[#FAF9F6] text-xs">
                <Clock className="w-3.5 h-3.5 text-[#6EE7B7]" />
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(activeTimer.taskId)}
                  className="max-w-[140px] truncate hover:underline cursor-pointer"
                >
                  {activeTimer.taskTitle}
                </button>
                <span className="font-mono-num font-semibold">{formatDuration(activeTimer.elapsedSeconds)}</span>
                <button
                  type="button"
                  onClick={pauseResumeTimer}
                  title={activeTimer.running ? 'Pause timer' : 'Resume timer'}
                  className="p-1 hover:bg-white/10 rounded cursor-pointer"
                >
                  {activeTimer.running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={stopTaskTimer}
                  title="Stop & save time entry"
                  className="p-1 hover:bg-white/10 rounded cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] text-xs text-[#646D67] dark:text-[#9CA39F] hover:border-[#1B3B2B] transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden md:inline text-[10px] font-mono-num px-1.5 py-0.5 rounded bg-[#F5F4EE] dark:bg-[#232825]">
                ⌘K
              </kbd>
            </button>

            {/* Quick Create Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickDropdownOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Create</span>
              </button>
              {quickDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#1C201E] rounded-xl border border-[#E5E2D9] dark:border-[#2C312E] shadow-lg p-1.5 z-40">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickDropdownOpen(false);
                      setQuickCreateModal('task');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
                  >
                    New Task (Shortcut: C)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickDropdownOpen(false);
                      setQuickCreateModal('project');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
                  >
                    New Project
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickDropdownOpen(false);
                      setQuickCreateModal('workspace');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
                  >
                    New Workspace
                  </button>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifDropdownOpen((v) => !v)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-[#545C57] dark:text-[#A3ABA6] hover:bg-[#EFECE4] dark:hover:bg-[#1D211F] cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#B91C1C] text-white text-[10px] font-mono-num font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-80 sm:w-96 bg-white dark:bg-[#1C201E] rounded-xl border border-[#E5E2D9] dark:border-[#2C312E] shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#ECE9E0] dark:border-[#2A2F2C] flex items-center justify-between">
                    <span className="text-xs font-semibold">Notifications ({unreadCount} unread)</span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-xs text-[#1B3B2B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#F0EDE5] dark:divide-[#242926]">
                    {notifications.slice(0, 8).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotifRead(n.id);
                          setNotifDropdownOpen(false);
                          if (n.link_type === 'task' && n.link_id) setSelectedTaskId(n.link_id);
                          else if (n.link_type === 'project' && n.link_id) navigate('project-detail', { projectId: n.link_id });
                        }}
                        className={`px-4 py-3 text-xs cursor-pointer hover:bg-[#FAF9F6] dark:hover:bg-[#232825] ${
                          !n.is_read ? 'bg-[#F5F8F6] dark:bg-[#19231E]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{n.title}</span>
                          <span className="text-[11px] text-[#7D8580] shrink-0">{formatRelativeTime(n.created_at)}</span>
                        </div>
                        <p className="text-[#545C57] dark:text-[#A3ABA6] mt-0.5">{n.message}</p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="px-4 py-8 text-center text-xs text-[#7D8580]">All caught up!</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifDropdownOpen(false);
                      navigate('notifications');
                    }}
                    className="w-full py-2.5 text-center text-xs font-semibold border-t border-[#ECE9E0] dark:border-[#2A2F2C] hover:bg-[#FAF9F6] dark:hover:bg-[#232825] cursor-pointer"
                  >
                    Open full inbox & notifications
                  </button>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setThemeMode(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-[#545C57] dark:text-[#A3ABA6] hover:bg-[#EFECE4] dark:hover:bg-[#1D211F] cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full cursor-pointer"
              >
                <UserAvatar name={user?.full_name || 'User'} avatarUrl={user?.avatar_url} size="sm" />
              </button>
              {userDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-[#1C201E] rounded-xl border border-[#E5E2D9] dark:border-[#2C312E] shadow-lg p-1.5 z-40">
                  <div className="px-3 py-2 border-b border-[#ECE9E0] dark:border-[#2A2F2C] mb-1">
                    <div className="text-xs font-semibold truncate">{user?.full_name}</div>
                    <div className="text-[11px] text-[#6E7670] truncate">{user?.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('settings');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
                  >
                    Profile & Account Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#B91C1C] dark:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#2C1616] cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Central Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
