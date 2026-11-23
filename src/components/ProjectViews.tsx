import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Bookmark,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Copy,
  GanttChart,
  Kanban,
  LayoutGrid,
  List,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { formatFullDate, formatRelativeTime, formatShortDate, isOverdue } from '../lib/format';
import type {
  BoardColumn,
  PriorityLevel,
  Project,
  ProjectDiscussion,
  ProjectMilestone,
  ProjectStatus,
  Task,
  TaskStatus,
} from '../types/trellas';
import { useApp } from './AppContext';
import { KanbanBoard } from './KanbanBoard';
import { PriorityIndicator, ProjectStatusIndicator, TaskStatusIndicator } from './StatusBadges';
import { UserAvatar } from './UserAvatar';

// ==========================================
// PROJECTS OVERVIEW PAGE
// ==========================================

export const ProjectsOverview: React.FC = () => {
  const {
    activeWorkspace,
    projects,
    navigate,
    setQuickCreateModal,
    refreshWorkspaceData,
    showToast,
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!showArchived || !activeWorkspace) return;
    apiFetch<{ projects: Project[] }>(`/api/workspaces/${activeWorkspace.id}/projects?archived=1`)
      .then((res) => setArchivedProjects(res.projects.filter((p) => p.is_archived)))
      .catch(() => {});
  }, [showArchived, activeWorkspace]);

  const displayed = useMemo(() => {
    const base = showArchived ? archivedProjects : projects;
    return base.filter((p) => {
      if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, archivedProjects, showArchived, search, statusFilter]);

  const togglePin = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiFetch(`/api/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_pinned: p.is_pinned ? 0 : 1 }) });
    await refreshWorkspaceData();
  };

  const handleDuplicate = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiFetch(`/api/projects/${p.id}/duplicate`, { method: 'POST' });
    showToast(`Duplicated "${p.name}"`, 'success');
    await refreshWorkspaceData();
  };

  const handleArchiveToggle = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiFetch(`/api/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_archived: p.is_archived ? 0 : 1 }) });
    showToast(p.is_archived ? `Restored "${p.name}"` : `Archived "${p.name}"`, 'info');
    await refreshWorkspaceData();
    if (showArchived && activeWorkspace) {
      const res = await apiFetch<{ projects: Project[] }>(`/api/workspaces/${activeWorkspace.id}/projects?archived=1`);
      setArchivedProjects(res.projects.filter((x) => x.is_archived));
    }
  };

  const handleSaveAsTemplate = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    await apiFetch(`/api/workspaces/${activeWorkspace.id}/templates`, {
      method: 'POST',
      body: JSON.stringify({
        project_id: p.id,
        name: `${p.name} Template`,
        category: p.category,
        description: p.description,
      }),
    });
    showToast(`Saved "${p.name}" as reusable template`, 'success');
    await refreshWorkspaceData();
  };

  const handleDeleteProject = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/projects/${p.id}`, { method: 'DELETE' });
      await refreshWorkspaceData();
      showToast(`Moved "${p.name}" to Trash`, 'info', async () => {
        await apiFetch(`/api/projects/${p.id}/restore`, { method: 'POST' });
        await refreshWorkspaceData();
      });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Unable to delete project', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Projects</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Organize team initiatives with boards, timelines, files, and milestones.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer ${
              showArchived
                ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                : 'bg-white dark:bg-[#181B1A] border-[#E5E2D9] dark:border-[#2A2F2C]'
            }`}
          >
            {showArchived ? 'Viewing Archived' : 'Show Archived'}
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateModal('project')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> New project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#646D67] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] w-56"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
        >
          <option value="all">All statuses</option>
          <option value="not_started">Not Started</option>
          <option value="planning">Planning</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {displayed.map((p) => (
          <div
            key={p.id}
            onClick={() => navigate('project-detail', { projectId: p.id, subView: 'board' })}
            className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] hover:border-[#1B3B2B] dark:hover:border-[#6EE7B7] p-5 flex flex-col justify-between gap-4 cursor-pointer transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: p.color }} />
                  <h3 className="font-semibold text-base truncate">{p.name}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => togglePin(p, e)}
                    title={p.is_pinned ? 'Unpin project' : 'Pin project'}
                    className={`p-1 rounded hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer ${
                      p.is_pinned ? 'text-[#1B3B2B] dark:text-[#6EE7B7]' : 'text-[#8E9691]'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleSaveAsTemplate(p, e)}
                    title="Save as template"
                    className="p-1 rounded text-[#8E9691] hover:text-[#1B3B2B] hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDuplicate(p, e)}
                    title="Duplicate project"
                    className="p-1 rounded text-[#8E9691] hover:text-[#1B3B2B] hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleArchiveToggle(p, e)}
                    title={p.is_archived ? 'Restore project' : 'Archive project'}
                    className="p-1 rounded text-[#8E9691] hover:text-[#B7791F] hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteProject(p, e)}
                    title="Move to trash"
                    className="p-1 rounded text-[#8E9691] hover:text-[#B91C1C] hover:bg-[#FEF2F2] dark:hover:bg-[#2C1616] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#646D67] dark:text-[#9CA39F]">
                <span>{p.category}</span>
                <span>·</span>
                <ProjectStatusIndicator status={p.status} />
                <span>·</span>
                <PriorityIndicator priority={p.priority} />
                {p.is_demo === 1 && (
                  <>
                    <span>·</span>
                    <span className="text-[#92621A] dark:text-[#F3C87B]">Sample</span>
                  </>
                )}
              </div>

              <p className="text-xs text-[#545C57] dark:text-[#A3ABA6] line-clamp-2 leading-relaxed">
                {p.description || 'No project description yet.'}
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#F0EDE5] dark:border-[#242926]">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6E7670]">
                    {p.completed_tasks || 0}/{p.total_tasks || 0} tasks completed
                  </span>
                  <span className="font-mono-num font-semibold">{p.progress_pct || 0}%</span>
                </div>
                <div className="h-1.5 bg-[#ECEAE2] dark:bg-[#252A27] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${p.progress_pct || 0}%`, backgroundColor: p.color }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-1.5">
                  {(p.members || []).slice(0, 4).map((m) => (
                    <UserAvatar key={m.user_id} name={m.full_name} avatarUrl={m.avatar_url} size="xs" />
                  ))}
                </div>
                <span className="font-mono-num text-[11px] text-[#6E7670]">
                  Due {formatFullDate(p.due_date)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {displayed.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-12 text-center space-y-3">
            <div className="text-sm font-semibold">
              {showArchived ? 'No archived projects' : 'No matching projects'}
            </div>
            <p className="text-xs text-[#6E7670]">
              {showArchived ? 'Archived projects will appear here.' : 'Create a project or adjust your filters.'}
            </p>
            {!showArchived && (
              <button
                type="button"
                onClick={() => setQuickCreateModal('project')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create project
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// PROJECT DETAILS (5 VIEWS: BOARD, LIST, CALENDAR, TIMELINE, OVERVIEW)
// ==========================================

export const ProjectDetailsView: React.FC = () => {
  const {
    activeWorkspace,
    selectedProjectId,
    setSelectedProjectId,
    projects,
    tasks: workspaceTasks,
    projectSubView,
    setProjectSubView,
    members,
    setSelectedTaskId,
    refreshWorkspaceData,
    syncProjectTasksLocal,
    workspaceSyncSeq,
    showToast,
  } = useApp();

  const targetProjectId = selectedProjectId || projects[0]?.id || null;

  const [data, setData] = useState<{
    project: Project;
    board: { id: string; name: string };
    columns: BoardColumn[];
    tasks: Task[];
    milestones: ProjectMilestone[];
    discussions: ProjectDiscussion[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // List View state
  const [listSort, setListSort] = useState<'title' | 'status' | 'priority' | 'due_date' | 'created_at'>('due_date');
  const [listAsc, setListAsc] = useState(true);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);

  // Calendar View state
  const [calDate, setCalDate] = useState(() => new Date());
  const [calMode, setCalMode] = useState<'month' | 'week' | 'day'>('month');
  const [quickCalDate, setQuickCalDate] = useState<string | null>(null);
  const [quickCalTitle, setQuickCalTitle] = useState('');

  // Overview discussions & milestones
  const [discTitle, setDiscTitle] = useState('');
  const [discBody, setDiscBody] = useState('');
  const [msTitle, setMsTitle] = useState('');
  const [msDue, setMsDue] = useState('');

  const workspaceTasksRef = useRef(workspaceTasks);
  workspaceTasksRef.current = workspaceTasks;
  const loadSeqRef = useRef(0);
  const pendingBoardMutationsRef = useRef(0);

  const loadProject = useCallback(async () => {
    const reqSeq = ++loadSeqRef.current;
    if (!targetProjectId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<typeof data>(`/api/projects/${targetProjectId}`);
      if (reqSeq !== loadSeqRef.current || pendingBoardMutationsRef.current > 0) return;
      setData(res);
    } catch {
      if (reqSeq === loadSeqRef.current) setData(null);
    } finally {
      if (reqSeq === loadSeqRef.current) setLoading(false);
    }
  }, [targetProjectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (workspaceSyncSeq === 0 || pendingBoardMutationsRef.current > 0) return;
    setData((prev) => {
      if (!prev) return prev;
      const projectTasks = workspaceTasksRef.current.filter((t) => t.project_id === prev.project.id);
      return { ...prev, tasks: projectTasks };
    });
  }, [workspaceSyncSeq]);

  if (!targetProjectId) {
    return (
      <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-12 text-center space-y-3">
        <div className="font-display text-xl">No projects in this workspace yet</div>
        <p className="text-xs text-[#6E7670]">Create your first project to unlock Boards, Lists, Calendar, and Timeline views.</p>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="h-96 rounded-2xl bg-[#EFECE4] dark:bg-[#1B1F1D] animate-pulse" />;
  }

  if (!data) return null;

  const { project, board, columns, tasks, milestones, discussions } = data;

  const sortedListTasks = [...tasks].sort((a, b) => {
    const dir = listAsc ? 1 : -1;
    if (listSort === 'title') return a.title.localeCompare(b.title) * dir;
    if (listSort === 'status') return a.status.localeCompare(b.status) * dir;
    if (listSort === 'priority') {
      const order: Record<PriorityLevel, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] - order[b.priority]) * dir;
    }
    if (listSort === 'due_date') {
      return (a.due_date || '9999').localeCompare(b.due_date || '9999') * dir;
    }
    return a.created_at.localeCompare(b.created_at) * dir;
  });

  const handleBulkAction = async (action: string, value?: string) => {
    if (!activeWorkspace || selectedBulkIds.length === 0) return;
    await apiFetch(`/api/workspaces/${activeWorkspace.id}/tasks/bulk`, {
      method: 'POST',
      body: JSON.stringify({ task_ids: selectedBulkIds, action, value }),
    });
    setSelectedBulkIds([]);
    showToast(`Updated ${selectedBulkIds.length} tasks`, 'success');
    await loadProject();
    await refreshWorkspaceData();
  };

  // Calendar Grid Helpers
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calCells: { dateStr: string; dayNum: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(year, month, 1 - startDayOfWeek + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    calCells.push({
      dateStr: `${y}-${m}-${day}`,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }

  // Timeline Range (28 days window centered around tasks or today)
  const timelineStart = new Date();
  timelineStart.setDate(timelineStart.getDate() - 10);
  const timelineDays = Array.from({ length: 28 }).map((_, idx) => {
    const d = new Date(timelineStart);
    d.setDate(d.getDate() + idx);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return { iso: `${y}-${m}-${day}`, label: d.getDate(), monthLabel: d.toLocaleDateString('en-US', { month: 'short' }) };
  });

  const shiftTaskDates = async (t: Task, deltaDays: number) => {
    const shift = (iso: string | null) => {
      if (!iso) return null;
      const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
      d.setDate(d.getDate() + deltaDays);
      return d.toISOString().slice(0, 10);
    };
    const nextStart = shift(t.start_date || t.due_date);
    const nextDue = shift(t.due_date || t.start_date);
    await apiFetch(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ start_date: nextStart, due_date: nextDue }),
    });
    await loadProject();
    await refreshWorkspaceData();
  };

  return (
    <div className="space-y-6">
      {/* Project Header + Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E6E4DC] dark:border-[#242926]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
            <select
              value={project.id}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="font-display text-2xl bg-transparent focus:outline-none cursor-pointer pr-2"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-white dark:bg-[#181B1A] text-sm">
                  {p.name}
                </option>
              ))}
            </select>
            <ProjectStatusIndicator status={project.status} />
            <PriorityIndicator priority={project.priority} />
          </div>
          <p className="text-xs text-[#646D67] dark:text-[#9CA39F]">
            Manager: {project.manager_name} · Due {formatFullDate(project.due_date)} · {tasks.length} tasks
          </p>
        </div>

        {/* 5 View Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#EFECE4] dark:bg-[#1A1E1C] self-start overflow-x-auto max-w-full">
          {(
            [
              { id: 'board', label: 'Board', icon: <Kanban className="w-3.5 h-3.5" /> },
              { id: 'list', label: 'List', icon: <List className="w-3.5 h-3.5" /> },
              { id: 'calendar', label: 'Calendar', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
              { id: 'timeline', label: 'Timeline', icon: <GanttChart className="w-3.5 h-3.5" /> },
              { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setProjectSubView(v.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                projectSubView === v.id
                  ? 'bg-white dark:bg-[#272D2A] text-[#1C1F1D] dark:text-white shadow-xs'
                  : 'text-[#545C57] dark:text-[#A3ABA6] hover:text-[#1C1F1D]'
              }`}
            >
              {v.icon}
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* VIEW 1: BOARD */}
      {projectSubView === 'board' && (
        <KanbanBoard
          key={project.id}
          projectId={project.id}
          boardId={board.id}
          columns={columns}
          tasks={tasks}
          onTasksChange={(nextTasks) => {
            setData((prev) => (prev && prev.project.id === project.id ? { ...prev, tasks: nextTasks } : prev));
            syncProjectTasksLocal(project.id, nextTasks);
          }}
          onPendingChange={(count) => {
            pendingBoardMutationsRef.current = count;
          }}
          onReload={loadProject}
        />
      )}

      {/* VIEW 2: LIST */}
      {projectSubView === 'list' && (
        <div className="space-y-3">
          {selectedBulkIds.length > 0 && (
            <div className="px-4 py-2.5 rounded-xl bg-[#1B3B2B] text-[#FAF9F6] flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-semibold">{selectedBulkIds.length} tasks selected</span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleBulkAction('status', e.target.value);
                    e.target.value = '';
                  }}
                  className="px-2 py-1 rounded bg-[#142D20] text-white border border-white/20"
                >
                  <option value="">Set status...</option>
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                </select>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleBulkAction('priority', e.target.value);
                    e.target.value = '';
                  }}
                  className="px-2 py-1 rounded bg-[#142D20] text-white border border-white/20"
                >
                  <option value="">Set priority...</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleBulkAction('archive')}
                  className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 cursor-pointer"
                >
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('delete')}
                  className="px-2.5 py-1 rounded bg-[#B91C1C] hover:bg-[#991B1B] cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#ECE9E0] dark:border-[#242926] text-[#646D67] dark:text-[#9CA39F]">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      checked={selectedBulkIds.length === sortedListTasks.length && sortedListTasks.length > 0}
                      onChange={(e) =>
                        setSelectedBulkIds(e.target.checked ? sortedListTasks.map((t) => t.id) : [])
                      }
                    />
                  </th>
                  {(
                    [
                      { k: 'title', label: 'Task Name' },
                      { k: 'status', label: 'Status' },
                      { k: 'priority', label: 'Priority' },
                      { k: 'due_date', label: 'Due Date' },
                    ] as const
                  ).map((col) => (
                    <th
                      key={col.k}
                      onClick={() => {
                        if (listSort === col.k) setListAsc((v) => !v);
                        else {
                          setListSort(col.k);
                          setListAsc(true);
                        }
                      }}
                      className="py-3 px-4 font-semibold cursor-pointer hover:text-[#1C1F1D] dark:hover:text-white"
                    >
                      {col.label} {listSort === col.k ? (listAsc ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th className="py-3 px-4 font-semibold">Assignees</th>
                  <th className="py-3 px-4 font-semibold">Labels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EFE8] dark:divide-[#242926]">
                {sortedListTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className="hover:bg-[#FAF9F6] dark:hover:bg-[#1D211F] cursor-pointer"
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedBulkIds.includes(t.id)}
                        onChange={(e) =>
                          setSelectedBulkIds((prev) =>
                            e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                          )
                        }
                      />
                    </td>
                    <td className="py-3 px-4 font-semibold text-sm">{t.title}</td>
                    <td className="py-3 px-4">
                      <TaskStatusIndicator status={t.status} />
                    </td>
                    <td className="py-3 px-4">
                      <PriorityIndicator priority={t.priority} />
                    </td>
                    <td
                      className={`py-3 px-4 font-mono-num ${
                        isOverdue(t.due_date, t.status) ? 'text-[#B91C1C] dark:text-[#F87171] font-semibold' : ''
                      }`}
                    >
                      {formatShortDate(t.due_date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex -space-x-1.5">
                        {t.assignees.slice(0, 3).map((a) => (
                          <UserAvatar key={a.user_id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#646D67]">{t.labels.join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedListTasks.length === 0 && (
              <div className="p-10 text-center text-xs text-[#7D8580]">No tasks in this project yet.</div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: CALENDAR */}
      {projectSubView === 'calendar' && (
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg border border-[#E5E2D9] dark:border-[#2A2F2C] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-display text-lg px-2">
                {calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setCalDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg border border-[#E5E2D9] dark:border-[#2A2F2C] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] text-xs">
              {(['month', 'week', 'day'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCalMode(m)}
                  className={`px-2.5 py-1 rounded capitalize cursor-pointer ${
                    calMode === m ? 'bg-white dark:bg-[#232825] font-semibold' : 'text-[#646D67]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {quickCalDate && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!activeWorkspace || !quickCalTitle.trim()) return;
                await apiFetch(`/api/workspaces/${activeWorkspace.id}/tasks`, {
                  method: 'POST',
                  body: JSON.stringify({
                    project_id: project.id,
                    title: quickCalTitle.trim(),
                    due_date: quickCalDate,
                    start_date: quickCalDate,
                  }),
                });
                setQuickCalTitle('');
                setQuickCalDate(null);
                await loadProject();
                await refreshWorkspaceData();
              }}
              className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#1B3B2B]"
            >
              <span className="text-xs font-semibold">New task on {quickCalDate}:</span>
              <input
                autoFocus
                required
                value={quickCalTitle}
                onChange={(e) => setQuickCalTitle(e.target.value)}
                placeholder="Task title..."
                className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer">
                Add
              </button>
              <button type="button" onClick={() => setQuickCalDate(null)} className="px-2 py-1.5 text-xs cursor-pointer">
                Cancel
              </button>
            </form>
          )}

          {calMode === 'month' ? (
            <div className="grid grid-cols-7 gap-px bg-[#E6E4DC] dark:bg-[#242926] rounded-xl overflow-hidden border border-[#E6E4DC] dark:border-[#242926]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="bg-[#FAF9F6] dark:bg-[#141716] py-2 px-2 text-[11px] font-semibold text-[#646D67]">
                  {d}
                </div>
              ))}
              {calCells.map((cell) => {
                const dayTasks = tasks.filter(
                  (t) => t.due_date?.slice(0, 10) === cell.dateStr || t.start_date?.slice(0, 10) === cell.dateStr,
                );
                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setQuickCalDate(cell.dateStr)}
                    className={`min-h-[92px] p-1.5 bg-white dark:bg-[#181B1A] hover:bg-[#FAF9F6] dark:hover:bg-[#1D211F] cursor-pointer space-y-1 ${
                      !cell.inMonth ? 'opacity-45' : ''
                    }`}
                  >
                    <div className="text-[11px] font-mono-num font-semibold text-[#646D67]">{cell.dayNum}</div>
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTaskId(t.id);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[11px] truncate font-medium ${
                          t.status === 'completed'
                            ? 'bg-[#ECFDF5] dark:bg-[#122920] text-[#166534] dark:text-[#6EE7B7]'
                            : isOverdue(t.due_date, t.status)
                              ? 'bg-[#FEF2F2] dark:bg-[#2C1616] text-[#B91C1C] dark:text-[#FCA5A5]'
                              : 'bg-[#F5F4EE] dark:bg-[#232825] text-[#1C1F1D] dark:text-[#F1F2EE]'
                        }`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-[#6E7670] px-1">+{dayTasks.length - 3} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {(calMode === 'week' ? calCells.slice(0, 7) : calCells.filter((c) => c.dateStr === calDate.toISOString().slice(0, 10))).map((cell) => {
                const dayTasks = tasks.filter((t) => t.due_date?.slice(0, 10) === cell.dateStr);
                return (
                  <div key={cell.dateStr} className="p-3 rounded-xl border border-[#ECE9E0] dark:border-[#242926] flex items-start justify-between gap-4">
                    <div className="font-mono-num text-xs font-semibold w-28 shrink-0">{cell.dateStr}</div>
                    <div className="flex-1 space-y-1.5">
                      {dayTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTaskId(t.id)}
                          className="p-2 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] text-xs font-medium flex items-center justify-between cursor-pointer"
                        >
                          <span>{t.title}</span>
                          <TaskStatusIndicator status={t.status} />
                        </div>
                      ))}
                      {dayTasks.length === 0 && <span className="text-xs text-[#7D8580]">No deadlines</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: TIMELINE (GANTT) */}
      {projectSubView === 'timeline' && (
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Project Gantt Timeline & Milestones</h3>
            <span className="text-xs text-[#6E7670]">Use ◀ / ▶ controls to shift task dates</span>
          </div>

          <div className="min-w-[820px] space-y-2">
            <div className="grid grid-cols-[240px_1fr] border-b border-[#ECE9E0] dark:border-[#242926] pb-2 text-[11px] font-semibold text-[#646D67]">
              <div>Task / Milestone</div>
              <div className="grid grid-cols-28 gap-0">
                {timelineDays.map((d) => (
                  <div key={d.iso} className="text-center font-mono-num">
                    {d.label}
                  </div>
                ))}
              </div>
            </div>

            {tasks.map((t) => {
              const sIso = (t.start_date || t.due_date || timelineDays[10].iso).slice(0, 10);
              const eIso = (t.due_date || t.start_date || timelineDays[12].iso).slice(0, 10);
              let startIdx = timelineDays.findIndex((d) => d.iso >= sIso);
              let endIdx = timelineDays.findIndex((d) => d.iso >= eIso);
              if (startIdx === -1) startIdx = 0;
              if (endIdx === -1) endIdx = timelineDays.length - 1;
              if (endIdx < startIdx) endIdx = startIdx;
              const leftPct = (startIdx / timelineDays.length) * 100;
              const widthPct = Math.max(4, ((endIdx - startIdx + 1) / timelineDays.length) * 100);

              return (
                <div
                  key={t.id}
                  className="grid grid-cols-[240px_1fr] items-center py-2 border-b border-[#F2EFE8] dark:border-[#242926] text-xs"
                >
                  <div className="pr-3 flex items-center justify-between gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className="truncate font-medium hover:underline text-left cursor-pointer"
                    >
                      {t.title}
                    </button>
                    <div className="flex items-center gap-1 shrink-0 text-[10px]">
                      <button
                        type="button"
                        onClick={() => shiftTaskDates(t, -1)}
                        title="Shift -1 day"
                        className="px-1 py-0.5 rounded border border-[#E5E2D9] dark:border-[#2A2F2C] cursor-pointer"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftTaskDates(t, 1)}
                        title="Shift +1 day"
                        className="px-1 py-0.5 rounded border border-[#E5E2D9] dark:border-[#2A2F2C] cursor-pointer"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                  <div className="relative h-7 bg-[#FAF9F6] dark:bg-[#121514] rounded-md">
                    <div
                      onClick={() => setSelectedTaskId(t.id)}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: project.color }}
                      className="absolute top-1 bottom-1 rounded-md text-white text-[10px] font-medium px-2 flex items-center truncate cursor-pointer opacity-90 hover:opacity-100"
                    >
                      {t.status === 'completed' ? '✓ ' : ''}
                      {formatShortDate(sIso)} – {formatShortDate(eIso)}
                    </div>
                  </div>
                </div>
              );
            })}

            {milestones.map((ms) => {
              const idx = Math.max(0, timelineDays.findIndex((d) => d.iso >= ms.due_date.slice(0, 10)));
              const leftPct = (idx / timelineDays.length) * 100;
              return (
                <div key={ms.id} className="grid grid-cols-[240px_1fr] items-center py-2 text-xs">
                  <div className="pr-3 font-semibold text-[#B7791F] dark:text-[#E2B05E] truncate">
                    ◆ {ms.title}
                  </div>
                  <div className="relative h-6">
                    <div
                      style={{ left: `${leftPct}%` }}
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-[#C99A4E]"
                      title={`${ms.title} (${ms.due_date})`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 5: OVERVIEW */}
      {projectSubView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4">
              <h3 className="font-display text-lg">Project Brief & Status</h3>
              <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] leading-relaxed">
                {project.description || 'No description added.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-[#ECE9E0] dark:border-[#242926] text-xs">
                <div>
                  <div className="text-[#6E7670] mb-1">Status</div>
                  <select
                    value={project.status}
                    onChange={async (e) => {
                      await apiFetch(`/api/projects/${project.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: e.target.value as ProjectStatus }),
                      });
                      await loadProject();
                      await refreshWorkspaceData();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <div className="text-[#6E7670] mb-1">Start date</div>
                  <input
                    type="date"
                    value={project.start_date?.slice(0, 10) || ''}
                    onChange={async (e) => {
                      await apiFetch(`/api/projects/${project.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ start_date: e.target.value || null }),
                      });
                      await loadProject();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] font-mono-num"
                  />
                </div>
                <div>
                  <div className="text-[#6E7670] mb-1">Due date</div>
                  <input
                    type="date"
                    value={project.due_date?.slice(0, 10) || ''}
                    onChange={async (e) => {
                      await apiFetch(`/api/projects/${project.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ due_date: e.target.value || null }),
                      });
                      await loadProject();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] font-mono-num"
                  />
                </div>
              </div>
            </div>

            {/* Project Discussions */}
            <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                <h3 className="font-display text-lg">Project Discussions</h3>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!discTitle.trim() || !discBody.trim()) return;
                  await apiFetch(`/api/projects/${project.id}/discussions`, {
                    method: 'POST',
                    body: JSON.stringify({ title: discTitle.trim(), body: discBody.trim() }),
                  });
                  setDiscTitle('');
                  setDiscBody('');
                  await loadProject();
                }}
                className="space-y-2.5 p-4 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]"
              >
                <input
                  required
                  value={discTitle}
                  onChange={(e) => setDiscTitle(e.target.value)}
                  placeholder="Discussion topic..."
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
                <textarea
                  required
                  rows={2}
                  value={discBody}
                  onChange={(e) => setDiscBody(e.target.value)}
                  placeholder="Share an update, decision, or question with the project team..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
                >
                  <Send className="w-3 h-3" /> Post update
                </button>
              </form>

              <div className="space-y-3">
                {discussions.map((d) => (
                  <div key={d.id} className="p-4 rounded-xl border border-[#ECE9E0] dark:border-[#242926] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={d.author_name} avatarUrl={d.author_avatar} size="xs" />
                        <span className="font-semibold">{d.author_name}</span>
                      </div>
                      <span className="text-[#7D8580]">{formatRelativeTime(d.created_at)}</span>
                    </div>
                    <div className="text-sm font-semibold">{d.title}</div>
                    <p className="text-xs text-[#545C57] dark:text-[#A3ABA6] leading-relaxed">{d.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Milestones */}
            <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4">
              <h3 className="font-display text-lg">Milestones</h3>
              <div className="space-y-2">
                {milestones.map((ms) => (
                  <label
                    key={ms.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] text-xs cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={Boolean(ms.completed)}
                        onChange={async (e) => {
                          await apiFetch(`/api/milestones/${ms.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ completed: e.target.checked }),
                          });
                          await loadProject();
                        }}
                      />
                      <span className={ms.completed ? 'line-through text-[#8E9691]' : 'font-semibold'}>
                        {ms.title}
                      </span>
                    </span>
                    <span className="font-mono-num text-[#6E7670]">{formatShortDate(ms.due_date)}</span>
                  </label>
                ))}
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!msTitle.trim() || !msDue) return;
                  await apiFetch(`/api/projects/${project.id}/milestones`, {
                    method: 'POST',
                    body: JSON.stringify({ title: msTitle.trim(), due_date: msDue }),
                  });
                  setMsTitle('');
                  setMsDue('');
                  await loadProject();
                }}
                className="flex flex-wrap gap-2 pt-2"
              >
                <input
                  required
                  value={msTitle}
                  onChange={(e) => setMsTitle(e.target.value)}
                  placeholder="New milestone..."
                  className="flex-1 min-w-[140px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
                <input
                  required
                  type="date"
                  value={msDue}
                  onChange={(e) => setMsDue(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer">
                  Add
                </button>
              </form>
            </div>

            {/* Project Members */}
            <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4">
              <h3 className="font-display text-lg">Project Members</h3>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isMember = (project.members || []).some((pm) => pm.user_id === m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={async () => {
                        const current = (project.members || []).map((pm) => pm.user_id);
                        const next = isMember ? current.filter((id) => id !== m.user_id) : [...current, m.user_id];
                        await apiFetch(`/api/projects/${project.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ member_ids: next }),
                        });
                        await loadProject();
                        await refreshWorkspaceData();
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer ${
                        isMember
                          ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                          : 'bg-[#FAF9F6] dark:bg-[#121514] border-[#DEDAD0] dark:border-[#2C312E]'
                      }`}
                    >
                      <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="xs" />
                      <span>{m.full_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
