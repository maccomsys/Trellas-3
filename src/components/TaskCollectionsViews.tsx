import React, { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatRelativeTime, formatShortDate, isDueToday, isOverdue } from '../lib/format';
import type { Task } from '../types/trellas';
import { useApp } from './AppContext';
import { PriorityIndicator, TaskStatusIndicator } from './StatusBadges';
import { UserAvatar } from './UserAvatar';

// ==========================================
// MY TASKS VIEW
// ==========================================

export const MyTasksView: React.FC = () => {
  const {
    activeWorkspace,
    user,
    tasks,
    projects,
    members,
    setSelectedTaskId,
    setQuickCreateModal,
    refreshWorkspaceData,
    showToast,
  } = useApp();

  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [bucket, setBucket] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'status' | 'created_at' | 'title'>('due_date');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const base = tasks.filter((t) => {
      if (scope === 'mine' && !t.assignees.some((a) => a.user_id === user?.id) && t.created_by !== user?.id) {
        return false;
      }
      if (bucket === 'today' && !(t.status !== 'completed' && isDueToday(t.due_date))) return false;
      if (bucket === 'overdue' && !isOverdue(t.due_date, t.status)) return false;
      if (bucket === 'completed' && t.status !== 'completed') return false;
      if (bucket === 'upcoming' && (t.status === 'completed' || isDueToday(t.due_date) || isOverdue(t.due_date, t.status))) return false;
      if (filterProject !== 'all' && t.project_id !== filterProject) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.labels.some((l) => l.toLowerCase().includes(q))) return false;
      }
      return true;
    });

    const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...base].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'priority') return pOrder[a.priority] - pOrder[b.priority];
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      if (sortBy === 'created_at') return b.created_at.localeCompare(a.created_at);
      return (a.due_date || '9999').localeCompare(b.due_date || '9999');
    });
  }, [tasks, scope, user?.id, bucket, filterProject, filterPriority, filterStatus, search, sortBy]);

  const handleBulk = async (action: string, value?: string) => {
    if (!activeWorkspace || selectedIds.length === 0) return;
    await apiFetch(`/api/workspaces/${activeWorkspace.id}/tasks/bulk`, {
      method: 'POST',
      body: JSON.stringify({ task_ids: selectedIds, action, value }),
    });
    setSelectedIds([]);
    showToast(`Updated ${selectedIds.length} tasks`, 'success');
    await refreshWorkspaceData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">My Tasks</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Filter, sort, and bulk-update tasks across all projects.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex p-1 rounded-lg bg-[#EFECE4] dark:bg-[#1A1E1C] text-xs">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                scope === 'mine' ? 'bg-white dark:bg-[#272D2A] shadow-xs' : 'text-[#646D67]'
              }`}
            >
              Assigned to me
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-3 py-1 rounded-md font-semibold cursor-pointer ${
                scope === 'all' ? 'bg-white dark:bg-[#272D2A] shadow-xs' : 'text-[#646D67]'
              }`}
            >
              All workspace
            </button>
          </div>
          <button
            type="button"
            onClick={() => setQuickCreateModal('task')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> New task
          </button>
        </div>
      </div>

      {/* Bucket Tabs + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFECE4] dark:bg-[#1A1E1C] text-xs overflow-x-auto">
          {(['all', 'today', 'upcoming', 'overdue', 'completed'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`px-3 py-1.5 rounded-md font-medium capitalize cursor-pointer whitespace-nowrap ${
                bucket === b ? 'bg-white dark:bg-[#272D2A] font-semibold shadow-xs' : 'text-[#646D67]'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#646D67] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] w-44"
            />
          </div>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All statuses</option>
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="due_date">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="status">Sort: Status</option>
            <option value="title">Sort: Name</option>
            <option value="created_at">Sort: Recently created</option>
          </select>
        </div>
      </div>

      {/* Bulk Toolbar */}
      {selectedIds.length > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-[#1B3B2B] text-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold">{selectedIds.length} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleBulk('status', e.target.value);
                e.target.value = '';
              }}
              className="px-2 py-1 rounded bg-[#142D20] border border-white/20"
            >
              <option value="">Status...</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleBulk('assign', e.target.value);
                e.target.value = '';
              }}
              className="px-2 py-1 rounded bg-[#142D20] border border-white/20"
            >
              <option value="">Assign member...</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleBulk('delete')}
              className="px-2.5 py-1 rounded bg-[#B91C1C] cursor-pointer"
            >
              Move to Trash
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#ECE9E0] dark:border-[#242926] text-[#646D67]">
            <tr>
              <th className="py-3 px-4 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onChange={(e) => setSelectedIds(e.target.checked ? filtered.map((t) => t.id) : [])}
                />
              </th>
              <th className="py-3 px-4 font-semibold">Task</th>
              <th className="py-3 px-4 font-semibold">Project</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold">Priority</th>
              <th className="py-3 px-4 font-semibold">Due Date</th>
              <th className="py-3 px-4 font-semibold">Assignees</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2EFE8] dark:divide-[#242926]">
            {filtered.map((t) => (
              <tr
                key={t.id}
                onClick={() => setSelectedTaskId(t.id)}
                className="hover:bg-[#FAF9F6] dark:hover:bg-[#1D211F] cursor-pointer"
              >
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={(e) =>
                      setSelectedIds((prev) =>
                        e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                      )
                    }
                  />
                </td>
                <td className="py-3 px-4 font-semibold text-sm">{t.title}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: t.project_color }} />
                    <span>{t.project_name}</span>
                  </span>
                </td>
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
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-10 text-center text-xs text-[#7D8580]">No tasks match your current filters.</div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// WORKSPACE CALENDAR VIEW
// ==========================================

export const WorkspaceCalendarView: React.FC = () => {
  const { activeWorkspace, tasks, projects, members, setSelectedTaskId, refreshWorkspaceData, showToast } = useApp();
  const [calDate, setCalDate] = useState(() => new Date());
  const [mode, setMode] = useState<'month' | 'week' | 'day'>('month');
  const [filterProject, setFilterProject] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [createProjectId, setCreateProjectId] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterProject !== 'all' && t.project_id !== filterProject) return false;
      if (filterAssignee !== 'all' && !t.assignees.some((a) => a.user_id === filterAssignee)) return false;
      return true;
    });
  }, [tasks, filterProject, filterAssignee]);

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const startDow = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(year, month, 1 - startDow + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { iso, dayNum: d.getDate(), inMonth: d.getMonth() === month };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Calendar</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Centralized schedule of task deadlines, upcoming activities, and team workloads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All assignees</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
            ))}
          </select>
        </div>
      </div>

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
            <button
              type="button"
              onClick={() => setCalDate(new Date())}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#E5E2D9] dark:border-[#2A2F2C] cursor-pointer"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] text-xs">
            {(['month', 'week', 'day'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded capitalize cursor-pointer ${
                  mode === m ? 'bg-white dark:bg-[#232825] font-semibold' : 'text-[#646D67]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {createDate && projects.length > 0 && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!activeWorkspace || !createTitle.trim()) return;
              await apiFetch(`/api/workspaces/${activeWorkspace.id}/tasks`, {
                method: 'POST',
                body: JSON.stringify({
                  project_id: createProjectId || projects[0].id,
                  title: createTitle.trim(),
                  start_date: createDate,
                  due_date: createDate,
                }),
              });
              setCreateTitle('');
              setCreateDate(null);
              showToast(`Scheduled task for ${createDate}`, 'success');
              await refreshWorkspaceData();
            }}
            className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#1B3B2B]"
          >
            <span className="text-xs font-semibold">Schedule on {createDate}:</span>
            <input
              autoFocus
              required
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Task title..."
              className="flex-1 min-w-[180px] px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
            />
            <select
              value={createProjectId || projects[0].id}
              onChange={(e) => setCreateProjectId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer">
              Add task
            </button>
            <button type="button" onClick={() => setCreateDate(null)} className="px-2 py-1.5 text-xs cursor-pointer">
              Cancel
            </button>
          </form>
        )}

        {mode === 'month' ? (
          <div className="grid grid-cols-7 gap-px bg-[#E6E4DC] dark:bg-[#242926] rounded-xl overflow-hidden border border-[#E6E4DC] dark:border-[#242926]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="bg-[#FAF9F6] dark:bg-[#141716] py-2 px-2 text-[11px] font-semibold text-[#646D67]">
                {d}
              </div>
            ))}
            {cells.map((cell) => {
              const dayTasks = filteredTasks.filter((t) => t.due_date?.slice(0, 10) === cell.iso);
              return (
                <div
                  key={cell.iso}
                  onClick={() => setCreateDate(cell.iso)}
                  className={`min-h-[96px] p-1.5 bg-white dark:bg-[#181B1A] hover:bg-[#FAF9F6] dark:hover:bg-[#1D211F] cursor-pointer space-y-1 ${
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
                            : 'bg-[#F5F4EE] dark:bg-[#232825]'
                      }`}
                    >
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && <div className="text-[10px] text-[#6E7670]">+{dayTasks.length - 3} more</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {(mode === 'week'
              ? cells.slice(0, 7)
              : [{ iso: calDate.toISOString().slice(0, 10), dayNum: calDate.getDate(), inMonth: true }]
            ).map((cell) => {
              const dayTasks = filteredTasks.filter((t) => t.due_date?.slice(0, 10) === cell.iso);
              return (
                <div key={cell.iso} className="p-3.5 rounded-xl border border-[#ECE9E0] dark:border-[#242926] flex items-start gap-4">
                  <div className="font-mono-num text-xs font-semibold w-28 shrink-0">{cell.iso}</div>
                  <div className="flex-1 space-y-1.5">
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="p-2 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] text-xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-medium">{t.title} · {t.project_name}</span>
                        <TaskStatusIndicator status={t.status} />
                      </div>
                    ))}
                    {dayTasks.length === 0 && <span className="text-xs text-[#7D8580]">No tasks scheduled</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// WORKSPACE TIMELINE VIEW
// ==========================================

export const WorkspaceTimelineView: React.FC = () => {
  const { tasks, projects, setSelectedTaskId, refreshWorkspaceData } = useApp();
  const [filterProject, setFilterProject] = useState('all');

  const filtered = tasks.filter((t) => (filterProject === 'all' ? true : t.project_id === filterProject));
  const start = new Date();
  start.setDate(start.getDate() - 10);
  const days = Array.from({ length: 28 }).map((_, idx) => {
    const d = new Date(start);
    d.setDate(d.getDate() + idx);
    return {
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: d.getDate(),
    };
  });

  const shiftDates = async (t: Task, delta: number) => {
    const shift = (iso: string | null) => {
      if (!iso) return null;
      const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
      d.setDate(d.getDate() + delta);
      return d.toISOString().slice(0, 10);
    };
    await apiFetch(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        start_date: shift(t.start_date || t.due_date),
        due_date: shift(t.due_date || t.start_date),
      }),
    });
    await refreshWorkspaceData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Timeline</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Gantt-style workspace schedule across projects and milestones.
          </p>
        </div>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] self-start"
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 overflow-x-auto">
        <div className="min-w-[860px] space-y-2">
          <div className="grid grid-cols-[260px_1fr] border-b border-[#ECE9E0] dark:border-[#242926] pb-2 text-[11px] font-semibold text-[#646D67]">
            <div>Task</div>
            <div className="grid grid-cols-28">
              {days.map((d) => (
                <div key={d.iso} className="text-center font-mono-num">{d.label}</div>
              ))}
            </div>
          </div>
          {filtered.map((t) => {
            const sIso = (t.start_date || t.due_date || days[10].iso).slice(0, 10);
            const eIso = (t.due_date || t.start_date || days[12].iso).slice(0, 10);
            let sIdx = days.findIndex((d) => d.iso >= sIso);
            let eIdx = days.findIndex((d) => d.iso >= eIso);
            if (sIdx === -1) sIdx = 0;
            if (eIdx === -1) eIdx = days.length - 1;
            if (eIdx < sIdx) eIdx = sIdx;
            const leftPct = (sIdx / days.length) * 100;
            const widthPct = Math.max(4, ((eIdx - sIdx + 1) / days.length) * 100);

            return (
              <div key={t.id} className="grid grid-cols-[260px_1fr] items-center py-2 border-b border-[#F2EFE8] dark:border-[#242926] text-xs">
                <div className="pr-3 flex items-center justify-between gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(t.id)}
                    className="truncate font-medium hover:underline text-left cursor-pointer"
                  >
                    {t.title}
                  </button>
                  <div className="flex items-center gap-1 text-[10px] shrink-0">
                    <button type="button" onClick={() => shiftDates(t, -1)} className="px-1 border rounded cursor-pointer">◀</button>
                    <button type="button" onClick={() => shiftDates(t, 1)} className="px-1 border rounded cursor-pointer">▶</button>
                  </div>
                </div>
                <div className="relative h-7 bg-[#FAF9F6] dark:bg-[#121514] rounded-md">
                  <div
                    onClick={() => setSelectedTaskId(t.id)}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: t.project_color || '#1B3B2B' }}
                    className="absolute top-1 bottom-1 rounded-md text-white text-[10px] px-2 flex items-center truncate cursor-pointer"
                  >
                    {t.project_name} · {formatShortDate(sIso)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// INBOX & NOTIFICATIONS VIEW
// ==========================================

export const InboxNotificationsView: React.FC = () => {
  const { activeWorkspace, notifications, setSelectedTaskId, navigate, refreshWorkspaceData } = useApp();
  const [catFilter, setCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');

  const filtered = notifications.filter((n) => {
    if (catFilter !== 'all' && n.category !== catFilter) return false;
    if (statusFilter === 'unread' && n.is_read) return false;
    if (statusFilter === 'read' && !n.is_read) return false;
    return true;
  });

  const markAllRead = async () => {
    if (!activeWorkspace) return;
    await apiFetch(`/api/workspaces/${activeWorkspace.id}/notifications/mark-all-read`, { method: 'POST' });
    await refreshWorkspaceData();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Inbox & Notifications</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Stay on top of task assignments, @mentions, comments, and upcoming deadlines.
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] hover:border-[#1B3B2B] text-xs font-semibold cursor-pointer self-start"
        >
          <Check className="w-3.5 h-3.5" /> Mark all as read
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
        >
          <option value="all">All categories</option>
          <option value="mention">Mentions</option>
          <option value="assignment">Assignments</option>
          <option value="comment">Comments</option>
          <option value="deadline">Deadlines</option>
          <option value="status">Status changes</option>
          <option value="project">Projects</option>
          <option value="invitation">Invitations</option>
        </select>
        <div className="flex p-1 rounded-lg bg-[#EFECE4] dark:bg-[#1A1E1C] text-xs">
          {(['all', 'unread', 'read'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md capitalize cursor-pointer ${
                statusFilter === s ? 'bg-white dark:bg-[#272D2A] font-semibold' : 'text-[#646D67]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] divide-y divide-[#F0EDE5] dark:divide-[#242926]">
        {filtered.map((n) => (
          <div
            key={n.id}
            className={`p-4 flex items-start justify-between gap-4 ${
              !n.is_read ? 'bg-[#F5F8F6] dark:bg-[#18211C]' : ''
            }`}
          >
            <div
              onClick={async () => {
                if (!n.is_read) {
                  await apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
                  await refreshWorkspaceData();
                }
                if (n.link_type === 'task' && n.link_id) setSelectedTaskId(n.link_id);
                else if (n.link_type === 'project' && n.link_id) navigate('project-detail', { projectId: n.link_id });
              }}
              className="flex items-start gap-3 flex-1 cursor-pointer"
            >
              {n.actor_name ? (
                <UserAvatar name={n.actor_name} avatarUrl={n.actor_avatar} size="sm" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#EFECE4] dark:bg-[#232825] flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">{n.title}</span>
                  <span className="text-[#8E9691]">·</span>
                  <span className="capitalize text-[#646D67] dark:text-[#9CA39F]">{n.category}</span>
                  <span className="text-[#8E9691]">·</span>
                  <span className="text-[#8E9691]">{formatRelativeTime(n.created_at)}</span>
                </div>
                <p className="text-xs text-[#545C57] dark:text-[#A3ABA6]">{n.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/notifications/${n.id}/read`, {
                    method: 'PATCH',
                    body: JSON.stringify({ is_read: !n.is_read }),
                  });
                  await refreshWorkspaceData();
                }}
                className="px-2 py-1 rounded text-[11px] border border-[#E5E2D9] dark:border-[#2A2F2C] cursor-pointer"
              >
                {n.is_read ? 'Mark unread' : 'Mark read'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/notifications/${n.id}`, { method: 'DELETE' });
                  await refreshWorkspaceData();
                }}
                className="p-1.5 rounded text-[#8E9691] hover:text-[#B91C1C] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-12 text-center text-xs text-[#7D8580]">No notifications in this view.</div>
        )}
      </div>
    </div>
  );
};
