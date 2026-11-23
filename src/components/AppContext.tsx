import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiFetch, setAuthToken } from '../lib/api';
import { localGetCurrentSession, localLogout } from '../lib/localWorkspaceService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ensureSupabaseUserProfile, runSupabaseOnboardingIfNeeded } from '../lib/supabaseService';
import type {
  ActivityLog,
  Attachment,
  NotificationItem,
  Project,
  ProjectTemplate,
  Task,
  ThemeMode,
  TimeEntry,
  User,
  UserPreferences,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from '../types/trellas';

export type AppRoute =
  | 'landing'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email'
  | 'dashboard'
  | 'my-tasks'
  | 'inbox'
  | 'projects'
  | 'project-detail'
  | 'boards'
  | 'calendar'
  | 'timeline'
  | 'team'
  | 'member-profile'
  | 'reports'
  | 'files'
  | 'templates'
  | 'notifications'
  | 'trash'
  | 'settings';

export type ProjectSubView = 'board' | 'list' | 'calendar' | 'timeline' | 'overview';

interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error';
  undoAction?: () => Promise<void>;
}

interface AppContextValue {
  route: AppRoute;
  navigate: (route: AppRoute, opts?: { projectId?: string; subView?: ProjectSubView; taskId?: string; memberId?: string }) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  projectSubView: ProjectSubView;
  setProjectSubView: (view: ProjectSubView) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;

  authLoading: boolean;
  user: User | null;
  preferences: UserPreferences | null;
  theme: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  switchWorkspace: (workspaceId: string) => void;

  projects: Project[];
  tasks: Task[];
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  notifications: NotificationItem[];
  activity: ActivityLog[];
  files: Attachment[];
  templates: ProjectTemplate[];
  timeEntries: TimeEntry[];
  workspaceLoading: boolean;

  activeTimer: { entryId: string; taskId: string; taskTitle: string; elapsedSeconds: number; running: boolean } | null;
  startTaskTimer: (taskId: string, taskTitle: string) => Promise<void>;
  pauseResumeTimer: () => Promise<void>;
  stopTaskTimer: () => Promise<void>;

  loginSuccess: (payload: { token: string; user: User; preferences: UserPreferences }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  refreshWorkspaceData: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  syncProjectTasksLocal: (projectId: string, projectTasks: Task[]) => void;
  workspaceSyncSeq: number;

  toasts: ToastMessage[];
  showToast: (text: string, type?: 'info' | 'success' | 'error', undoAction?: () => Promise<void>) => void;
  dismissToast: (id: string) => void;

  quickCreateModal: 'task' | 'project' | 'workspace' | null;
  setQuickCreateModal: (mode: 'task' | 'project' | 'workspace' | null) => void;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  isRecoveryMode: boolean;
  setIsRecoveryMode: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<AppRoute>('landing');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSubView, setProjectSubView] = useState<ProjectSubView>('board');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [theme, setTheme] = useState<ThemeMode>('light');

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSyncSeq, setWorkspaceSyncSeq] = useState(0);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [quickCreateModal, setQuickCreateModal] = useState<'task' | 'project' | 'workspace' | null>(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const routeRef = useRef<AppRoute>('landing');
  routeRef.current = route;

  const [activeTimer, setActiveTimer] = useState<{
    entryId: string;
    taskId: string;
    taskTitle: string;
    elapsedSeconds: number;
    running: boolean;
  } | null>(null);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info', undoAction?: () => Promise<void>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text, type, undoAction }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, undoAction ? 6500 : 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Apply light/dark class on documentElement
  useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', isDark);
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setTheme(mode);
      if (user) {
        apiFetch('/api/account/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ theme: mode }),
        })
          .then((res: unknown) => {
            const r = res as { preferences?: UserPreferences };
            if (r?.preferences) setPreferences(r.preferences);
          })
          .catch(() => {});
      }
    },
    [user],
  );

  const loadWorkspaceData = useCallback(async (wsId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setWorkspaceLoading(true);
    try {
      const [prjRes, tskRes, memRes, ntfRes, actRes, filRes, tplRes, teRes] = await Promise.all([
        apiFetch<{ projects: Project[] }>(`/api/workspaces/${wsId}/projects`),
        apiFetch<{ tasks: Task[] }>(`/api/workspaces/${wsId}/tasks`),
        apiFetch<{ members: WorkspaceMember[]; invitations: WorkspaceInvitation[] }>(`/api/workspaces/${wsId}/members`),
        apiFetch<{ notifications: NotificationItem[] }>(`/api/workspaces/${wsId}/notifications`),
        apiFetch<{ activity: ActivityLog[] }>(`/api/workspaces/${wsId}/activity`),
        apiFetch<{ files: Attachment[] }>(`/api/workspaces/${wsId}/files`),
        apiFetch<{ templates: ProjectTemplate[] }>(`/api/workspaces/${wsId}/templates`),
        apiFetch<{ entries: TimeEntry[] }>(`/api/workspaces/${wsId}/time-entries`),
      ]);
      setProjects(prjRes.projects);
      setTasks(tskRes.tasks);
      setMembers(memRes.members);
      setInvitations(memRes.invitations);
      setNotifications(ntfRes.notifications);
      setActivity(actRes.activity);
      setFiles(filRes.files);
      setTemplates(tplRes.templates);
      setTimeEntries(teRes.entries);
      setWorkspaceSyncSeq((s) => s + 1);
    } catch (err) {
      console.error('Failed to load workspace data', err);
    } finally {
      if (!opts?.silent) setWorkspaceLoading(false);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const res = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
    setWorkspaces(res.workspaces);
    if (res.workspaces.length > 0) {
      setActiveWorkspaceId((prev) => {
        const stillExists = res.workspaces.some((w) => w.id === prev);
        return stillExists ? prev : res.workspaces[0].id;
      });
    } else {
      setActiveWorkspaceId(null);
    }
  }, []);

  const refreshWorkspaceData = useCallback(async () => {
    if (activeWorkspaceId) {
      await loadWorkspaceData(activeWorkspaceId);
    }
  }, [activeWorkspaceId, loadWorkspaceData]);

  const syncProjectTasksLocal = useCallback((projectId: string, projectTasks: Task[]) => {
    setTasks((prev) => {
      const taskMap = new Map(projectTasks.map((t) => [t.id, t]));
      const seen = new Set<string>();
      const next: Task[] = [];
      for (const t of prev) {
        if (t.project_id === projectId) {
          const updated = taskMap.get(t.id);
          if (updated) {
            next.push(updated);
            seen.add(t.id);
          }
        } else {
          next.push(t);
        }
      }
      for (const t of projectTasks) {
        if (!seen.has(t.id)) {
          next.push(t);
        }
      }
      return next;
    });
    const total = projectTasks.length;
    const completed = projectTasks.filter((t) => t.status === 'completed').length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, total_tasks: total, completed_tasks: completed, progress_pct: progressPct }
          : p,
      ),
    );
  }, []);

  useEffect(() => {
    if (user && activeWorkspaceId) {
      loadWorkspaceData(activeWorkspaceId);
    }
  }, [user, activeWorkspaceId, loadWorkspaceData]);

  // Bootstrap session (Supabase Auth if configured, else Express cookie session)
  useEffect(() => {
    let active = true;

    const sb = supabase;
    if (isSupabaseConfigured && sb) {
      const isRecoveryHash =
        window.location.hash.includes('type=recovery') ||
        window.location.search.includes('type=recovery');

      const hydrateSupabaseSession = async () => {
        try {
          const { data } = await sb.auth.getSession();
          if (!active) return;
          if (!data.session) return;

          setAuthToken(data.session.access_token);
          const profile = await ensureSupabaseUserProfile(data.session.user);
          if (!active) return;
          setUser(profile.user);
          setPreferences(profile.preferences);
          if (profile.preferences?.theme) setTheme(profile.preferences.theme);

          let wsRes = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
          if (wsRes.workspaces.length === 0) {
            await runSupabaseOnboardingIfNeeded().catch(() => {});
            wsRes = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
          }
          if (!active) return;
          setWorkspaces(wsRes.workspaces);
          if (wsRes.workspaces.length > 0) {
            setActiveWorkspaceId(wsRes.workspaces[0].id);
          }

          if (isRecoveryHash) {
            setIsRecoveryMode(true);
            setRoute('reset-password');
          } else {
            setRoute('dashboard');
          }
        } catch {
          // Not signed in or failed bootstrap
        } finally {
          if (active) setAuthLoading(false);
        }
      };

      hydrateSupabaseSession();

      const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
        if (!active) return;
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
          if (session?.access_token) setAuthToken(session.access_token);
          setRoute('reset-password');
          return;
        }
        if (event === 'SIGNED_OUT') {
          setAuthToken(null);
          setUser(null);
          setPreferences(null);
          setWorkspaces([]);
          setActiveWorkspaceId(null);
          setProjects([]);
          setTasks([]);
          setSelectedProjectId(null);
          setSelectedTaskId(null);
          setActiveTimer(null);
          setIsRecoveryMode(false);
          setRoute('landing');
          return;
        }
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
          setAuthToken(session.access_token);
          try {
            const profile = await ensureSupabaseUserProfile(session.user);
            if (!active) return;
            setUser(profile.user);
            setPreferences(profile.preferences);
            if (profile.preferences?.theme) setTheme(profile.preferences.theme);

            if (event === 'SIGNED_IN') {
              let wsRes = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
              if (wsRes.workspaces.length === 0) {
                await runSupabaseOnboardingIfNeeded().catch(() => {});
                wsRes = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
              }
              if (!active) return;
              setWorkspaces(wsRes.workspaces);
              if (wsRes.workspaces.length > 0) {
                setActiveWorkspaceId((prev) => prev || wsRes.workspaces[0].id);
              }
              if (
                ['landing', 'login', 'register', 'verify-email', 'forgot-password'].includes(routeRef.current)
              ) {
                setRoute('dashboard');
              }
            }
          } catch {
            // ignore transient auth refresh sync error
          }
        }
      });

      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    }

    const hydrateLocalSession = async () => {
      try {
        const localSess = await localGetCurrentSession();
        if (!active || !localSess) return;
        setAuthToken(localSess.token);
        setUser(localSess.user);
        setPreferences(localSess.preferences);
        if (localSess.preferences?.theme) setTheme(localSess.preferences.theme);
        setWorkspaces(localSess.workspaces);
        if (localSess.workspaces.length > 0) {
          setActiveWorkspaceId(localSess.workspaces[0].id);
        }
        setRoute('dashboard');
      } catch {
        // ignore invalid local session
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    hydrateLocalSession();
    return () => {
      active = false;
    };
  }, []);

  // Supabase Realtime workspace synchronization
  useEffect(() => {
    const sb = supabase;
    if (!isSupabaseConfigured || !sb || !user || !activeWorkspaceId) return;
    let debounceTimer: number | null = null;
    const scheduleSync = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        loadWorkspaceData(activeWorkspaceId, { silent: true });
      }, 220);
    };

    const channel = sb
      .channel(`trellas-ws-${activeWorkspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${activeWorkspaceId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `workspace_id=eq.${activeWorkspaceId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments', filter: `workspace_id=eq.${activeWorkspaceId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs', filter: `workspace_id=eq.${activeWorkspaceId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries', filter: `workspace_id=eq.${activeWorkspaceId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${activeWorkspaceId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_invitations', filter: `workspace_id=eq.${activeWorkspaceId}` }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_columns' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_reactions' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, scheduleSync)
      .subscribe();

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      sb.removeChannel(channel);
    };
  }, [user, activeWorkspaceId, loadWorkspaceData]);

  // Global keyboard shortcuts (Cmd/Ctrl+K for Search, N for Quick Task)
  useEffect(() => {
    if (!user) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((v) => !v);
      } else if (!inInput && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setQuickCreateModal('task');
      } else if (e.key === 'Escape') {
        setGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user]);

  // Live timer tick
  useEffect(() => {
    if (!activeTimer || !activeTimer.running) return;
    const iv = window.setInterval(() => {
      setActiveTimer((prev) => (prev && prev.running ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : prev));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [activeTimer]);

  const startTaskTimer = useCallback(
    async (taskId: string, taskTitle: string) => {
      if (activeTimer) {
        await apiFetch(`/api/time-entries/${activeTimer.entryId}`, {
          method: 'PATCH',
          body: JSON.stringify({ duration_seconds: activeTimer.elapsedSeconds, is_running: false }),
        });
      }
      const res = await apiFetch<{ id: string }>(`/api/tasks/${taskId}/time-entries`, {
        method: 'POST',
        body: JSON.stringify({ description: `Working on ${taskTitle}`, duration_seconds: 0, is_running: true }),
      });
      setActiveTimer({ entryId: res.id, taskId, taskTitle, elapsedSeconds: 0, running: true });
      showToast(`Timer started for "${taskTitle}"`, 'info');
    },
    [activeTimer, showToast],
  );

  const pauseResumeTimer = useCallback(async () => {
    if (!activeTimer) return;
    const nextRunning = !activeTimer.running;
    setActiveTimer((prev) => (prev ? { ...prev, running: nextRunning } : prev));
    await apiFetch(`/api/time-entries/${activeTimer.entryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ duration_seconds: activeTimer.elapsedSeconds, is_running: nextRunning }),
    });
  }, [activeTimer]);

  const stopTaskTimer = useCallback(async () => {
    if (!activeTimer) return;
    const current = activeTimer;
    setActiveTimer(null);
    await apiFetch(`/api/time-entries/${current.entryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ duration_seconds: current.elapsedSeconds, is_running: false }),
    });
    showToast(`Logged ${Math.max(1, Math.round(current.elapsedSeconds / 60))}m on "${current.taskTitle}"`, 'success');
    await refreshWorkspaceData();
  }, [activeTimer, refreshWorkspaceData, showToast]);

  const loginSuccess = useCallback(async (payload: { token: string; user: User; preferences: UserPreferences }) => {
    setAuthToken(payload.token);
    setUser(payload.user);
    setPreferences(payload.preferences);
    if (payload.preferences?.theme) setTheme(payload.preferences.theme);
    const wsRes = await apiFetch<{ workspaces: Workspace[] }>('/api/workspaces');
    setWorkspaces(wsRes.workspaces);
    if (wsRes.workspaces.length > 0) {
      setActiveWorkspaceId(wsRes.workspaces[0].id);
    }
    setRoute('dashboard');
  }, []);

  const logout = useCallback(async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      } else {
        await localLogout();
      }
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setPreferences(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    setProjects([]);
    setTasks([]);
    setSelectedProjectId(null);
    setSelectedTaskId(null);
    setActiveTimer(null);
    setIsRecoveryMode(false);
    setRoute('landing');
  }, []);

  const refreshAccount = useCallback(async () => {
    const res = await apiFetch<{ user: User; preferences: UserPreferences }>('/api/auth/me');
    setUser(res.user);
    setPreferences(res.preferences);
    if (res.preferences?.theme) setTheme(res.preferences.theme);
  }, []);

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    setSelectedProjectId(null);
    setSelectedTaskId(null);
  }, []);

  const navigate = useCallback(
    (
      nextRoute: AppRoute,
      opts?: { projectId?: string; subView?: ProjectSubView; taskId?: string; memberId?: string },
    ) => {
      setRoute(nextRoute);
      if (opts?.projectId !== undefined) setSelectedProjectId(opts.projectId);
      if (opts?.subView !== undefined) setProjectSubView(opts.subView);
      if (opts?.taskId !== undefined) setSelectedTaskId(opts.taskId);
      if (opts?.memberId !== undefined) setSelectedMemberId(opts.memberId);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [],
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <AppContext.Provider
      value={{
        route,
        navigate,
        selectedProjectId,
        setSelectedProjectId,
        projectSubView,
        setProjectSubView,
        selectedTaskId,
        setSelectedTaskId,
        selectedMemberId,
        setSelectedMemberId,
        authLoading,
        user,
        preferences,
        theme,
        setThemeMode,
        workspaces,
        activeWorkspace,
        switchWorkspace,
        projects,
        tasks,
        members,
        invitations,
        notifications,
        activity,
        files,
        templates,
        timeEntries,
        workspaceLoading,
        activeTimer,
        startTaskTimer,
        pauseResumeTimer,
        stopTaskTimer,
        loginSuccess,
        logout,
        refreshAccount,
        refreshWorkspaceData,
        refreshWorkspaces,
        syncProjectTasksLocal,
        workspaceSyncSeq,
        toasts,
        showToast,
        dismissToast,
        quickCreateModal,
        setQuickCreateModal,
        globalSearchOpen,
        setGlobalSearchOpen,
        isRecoveryMode,
        setIsRecoveryMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
