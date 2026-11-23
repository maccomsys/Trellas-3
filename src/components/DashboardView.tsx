import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  ListTodo,
  Plus,
} from 'lucide-react';
import { formatFullDate, formatRelativeTime, formatShortDate, isDueToday, isOverdue } from '../lib/format';
import type { Task } from '../types/trellas';
import { useApp } from './AppContext';
import { PriorityIndicator, TaskStatusIndicator } from './StatusBadges';
import { UserAvatar } from './UserAvatar';

export const DashboardView: React.FC = () => {
  const {
    user,
    projects,
    tasks,
    members,
    activity,
    navigate,
    setQuickCreateModal,
    setSelectedTaskId,
    workspaceLoading,
  } = useApp();

  const [myTaskTab, setMyTaskTab] = useState<'today' | 'upcoming' | 'overdue' | 'completed'>('today');

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning').length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
    const overdueTasks = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
    return { totalProjects, activeProjects, totalTasks, completedTasks, pendingTasks, overdueTasks };
  }, [projects, tasks]);

  const myTasks = useMemo(() => {
    const mine = tasks.filter(
      (t) => t.assignees.some((a) => a.user_id === user?.id) || t.created_by === user?.id,
    );
    const today = mine.filter((t) => t.status !== 'completed' && isDueToday(t.due_date));
    const overdue = mine.filter((t) => isOverdue(t.due_date, t.status));
    const upcoming = mine.filter(
      (t) => t.status !== 'completed' && !isDueToday(t.due_date) && !isOverdue(t.due_date, t.status),
    );
    const completed = mine.filter((t) => t.status === 'completed');
    return { today, upcoming, overdue, completed };
  }, [tasks, user?.id]);

  const statusDistribution = useMemo(() => {
    const counts = {
      backlog: tasks.filter((t) => t.status === 'backlog').length,
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      in_review: tasks.filter((t) => t.status === 'in_review').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
    };
    const total = Math.max(1, tasks.length);
    return [
      { label: 'Backlog', count: counts.backlog, color: '#64748B', pct: Math.round((counts.backlog / total) * 100) },
      { label: 'To Do', count: counts.todo, color: '#2563EB', pct: Math.round((counts.todo / total) * 100) },
      { label: 'In Progress', count: counts.in_progress, color: '#C99A4E', pct: Math.round((counts.in_progress / total) * 100) },
      { label: 'In Review', count: counts.in_review, color: '#7C3AED', pct: Math.round((counts.in_review / total) * 100) },
      { label: 'Completed', count: counts.completed, color: '#16A34A', pct: Math.round((counts.completed / total) * 100) },
    ];
  }, [tasks]);

  const workloadByMember = useMemo(() => {
    const maxCount = Math.max(1, ...members.map((m) => Number(m.assigned_tasks_count || 0)));
    return members.map((m) => ({
      id: m.user_id,
      name: m.full_name,
      avatar: m.avatar_url,
      assigned: Number(m.assigned_tasks_count || 0),
      completed: Number(m.completed_tasks_count || 0),
      pct: Math.round((Number(m.assigned_tasks_count || 0) / maxCount) * 100),
    }));
  }, [members]);

  // Weekly completion sparkline derived from tasks & demo cadence
  const weeklyVelocity = useMemo(() => {
    const base = [3, 5, 4, 6, 5, 7, Math.max(2, stats.completedTasks)];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'];
    const maxV = Math.max(1, ...base);
    return base.map((val, idx) => ({ label: labels[idx], val, h: Math.round((val / maxV) * 100) }));
  }, [stats.completedTasks]);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const currentTabTasks: Task[] = myTasks[myTaskTab];

  if (workspaceLoading && tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-2xl bg-[#EFECE4] dark:bg-[#1B1F1D] animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#EFECE4] dark:bg-[#1B1F1D] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E6E4DC] dark:border-[#242926]">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[#646D67] dark:text-[#8E9691]">{todayFormatted}</div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">
            {greeting}, {user?.full_name.split(' ')[0]}.
          </h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            {myTasks.today.length} due today · {stats.overdueTasks} overdue · {stats.activeProjects} active projects in motion.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setQuickCreateModal('task')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> New task
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateModal('project')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E] hover:border-[#1B3B2B] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <FolderKanban className="w-3.5 h-3.5" /> New project
          </button>
          <button
            type="button"
            onClick={() => navigate('boards')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E] hover:border-[#1B3B2B] text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <span>Open boards</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 6 Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Projects', value: stats.totalProjects, icon: <Layers className="w-4 h-4 text-[#1B3B2B] dark:text-[#6EE7B7]" />, sub: 'Across workspace' },
          { label: 'Active Projects', value: stats.activeProjects, icon: <FolderKanban className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />, sub: 'Planning & active' },
          { label: 'Total Tasks', value: stats.totalTasks, icon: <ListTodo className="w-4 h-4 text-[#545C57] dark:text-[#A3ABA6]" />, sub: 'All open & done' },
          { label: 'Completed Tasks', value: stats.completedTasks, icon: <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" />, sub: `${stats.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% completion` },
          { label: 'Pending Tasks', value: stats.pendingTasks, icon: <Clock className="w-4 h-4 text-[#B7791F] dark:text-[#E2B05E]" />, sub: 'Remaining items' },
          { label: 'Overdue Tasks', value: stats.overdueTasks, icon: <AlertTriangle className="w-4 h-4 text-[#B91C1C] dark:text-[#F87171]" />, sub: 'Needs attention' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#646D67] dark:text-[#9CA39F]">{card.label}</span>
              {card.icon}
            </div>
            <div className="font-display text-2xl font-semibold tabular-nums">{card.value}</div>
            <div className="text-[11px] text-[#7D8580]">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Split: My Tasks + Project Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* My Tasks Overview */}
        <div className="lg:col-span-7 bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg tracking-tight">My Tasks</h2>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]">
              {(
                [
                  { id: 'today', label: `Today (${myTasks.today.length})` },
                  { id: 'upcoming', label: `Upcoming (${myTasks.upcoming.length})` },
                  { id: 'overdue', label: `Overdue (${myTasks.overdue.length})` },
                  { id: 'completed', label: `Completed (${myTasks.completed.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMyTaskTab(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    myTaskTab === tab.id
                      ? 'bg-white dark:bg-[#232825] text-[#1C1F1D] dark:text-white shadow-xs'
                      : 'text-[#646D67] dark:text-[#9CA39F] hover:text-[#1C1F1D]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#F0EDE5] dark:divide-[#242926]">
            {currentTabTasks.slice(0, 8).map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTaskId(t.id)}
                className="py-3 flex items-center justify-between gap-4 hover:bg-[#FAF9F6] dark:hover:bg-[#1D211F] px-2 -mx-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E7670] dark:text-[#8E9691]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: t.project_color }} />
                      <span>{t.project_name}</span>
                    </span>
                    <span>·</span>
                    <TaskStatusIndicator status={t.status} />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <PriorityIndicator priority={t.priority} compact />
                  <span
                    className={`font-mono-num text-xs ${
                      isOverdue(t.due_date, t.status) ? 'text-[#B91C1C] dark:text-[#F87171] font-semibold' : 'text-[#6E7670]'
                    }`}
                  >
                    {formatShortDate(t.due_date)}
                  </span>
                  <div className="flex -space-x-1.5">
                    {t.assignees.slice(0, 2).map((a) => (
                      <UserAvatar key={a.user_id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {currentTabTasks.length === 0 && (
              <div className="py-10 text-center text-xs text-[#7D8580]">
                No tasks in this bucket.{' '}
                <button
                  type="button"
                  onClick={() => setQuickCreateModal('task')}
                  className="text-[#1B3B2B] dark:text-[#6EE7B7] font-semibold hover:underline cursor-pointer"
                >
                  Create a task
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Project Progress */}
        <div className="lg:col-span-5 bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg tracking-tight">Project Progress</h2>
            <button
              type="button"
              onClick={() => navigate('projects')}
              className="text-xs font-medium text-[#1B3B2B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="space-y-4">
            {projects.slice(0, 5).map((p) => (
              <div
                key={p.id}
                onClick={() => navigate('project-detail', { projectId: p.id, subView: 'overview' })}
                className="p-3.5 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] hover:border-[#1B3B2B] transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-semibold truncate">{p.name}</span>
                  </div>
                  <span className="font-mono-num text-xs font-semibold">{p.progress_pct || 0}%</span>
                </div>
                <div className="h-1.5 bg-[#E6E4DC] dark:bg-[#252A27] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${p.progress_pct || 0}%`, backgroundColor: p.color }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#6E7670] dark:text-[#8E9691]">
                  <span>Lead: {p.manager_name}</span>
                  <span className="font-mono-num">
                    {p.completed_tasks || 0}/{p.total_tasks || 0} tasks · Due {formatFullDate(p.due_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Productivity Charts + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Charts Panel */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Tasks Completed Over Time */}
          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Completion Cadence</h3>
              <span className="text-xs text-[#6E7670]">Last 7 days</span>
            </div>
            <div className="h-36 flex items-end justify-between gap-2 pt-4">
              {weeklyVelocity.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="font-mono-num text-[11px] text-[#6E7670]">{d.val}</span>
                  <div className="w-full max-w-[30px] bg-[#FAF9F6] dark:bg-[#121514] rounded-t-md h-24 flex items-end overflow-hidden">
                    <div
                      className="w-full bg-[#1B3B2B] dark:bg-[#34D399] rounded-t-md transition-all"
                      style={{ height: `${Math.max(12, d.h)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[#646D67]">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Task Distribution by Status */}
          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tasks by Status</h3>
              <span className="font-mono-num text-xs text-[#6E7670]">{tasks.length} total</span>
            </div>
            <div className="space-y-2.5">
              {statusDistribution.map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{s.label}</span>
                    <span className="font-mono-num text-[#6E7670]">
                      {s.count} ({s.pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#F5F4EE] dark:bg-[#232825] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workload by Team Member */}
          <div className="sm:col-span-2 bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Workload by Team Member</h3>
              <button
                type="button"
                onClick={() => navigate('team')}
                className="text-xs font-medium text-[#1B3B2B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
              >
                Manage team
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {workloadByMember.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate('member-profile', { memberId: m.id })}
                  className="p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] flex items-center gap-3 cursor-pointer hover:border-[#1B3B2B]"
                >
                  <UserAvatar name={m.name} avatarUrl={m.avatar} size="md" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold truncate">{m.name}</span>
                      <span className="font-mono-num text-[#6E7670]">
                        {m.completed}/{m.assigned} done
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#E6E4DC] dark:bg-[#252A27] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1B3B2B] dark:bg-[#6EE7B7] rounded-full" style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-4 bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-4">
          <h2 className="font-display text-lg tracking-tight">Recent Activity</h2>
          <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
            {activity.slice(0, 12).map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs">
                <UserAvatar name={act.user_name} avatarUrl={act.user_avatar} size="xs" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="leading-snug">
                    <span className="font-semibold">{act.user_name}</span>{' '}
                    <span className="text-[#545C57] dark:text-[#A3ABA6]">{act.details}</span>
                  </p>
                  <div className="text-[11px] text-[#8E9691] mt-0.5">{formatRelativeTime(act.created_at)}</div>
                </div>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="py-8 text-center text-xs text-[#7D8580]">No workspace activity yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
