import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileText,
  FolderPlus,
  MailPlus,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { formatBytes, formatMinutes, formatRelativeTime, isOverdue, ROLE_LABELS } from '../lib/format';
import { getAttachmentSignedUrl, triggerAttachmentDownload } from '../lib/supabaseService';
import type { Attachment, ProjectTemplate, WorkspaceRole } from '../types/trellas';
import { useApp } from './AppContext';
import { PriorityIndicator, TaskStatusIndicator } from './StatusBadges';
import { UserAvatar } from './UserAvatar';

// ==========================================
// TEAM MEMBERS & MEMBER PROFILE
// ==========================================

export const TeamMembersView: React.FC = () => {
  const { activeWorkspace, members, invitations, navigate, refreshWorkspaceData, showToast } = useApp();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviting, setInviting] = useState(false);

  const canAdmin = activeWorkspace?.role === 'owner' || activeWorkspace?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await apiFetch<{ status: string }>(`/api/workspaces/${activeWorkspace.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail('');
      showToast(
        res.status === 'added_directly' ? 'Member added to workspace' : 'Invitation sent',
        'success',
      );
      await refreshWorkspaceData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Invitation failed', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Team</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Manage workspace roles, permissions, invitations, and member workloads.
          </p>
        </div>
      </div>

      {canAdmin && (
        <form
          onSubmit={handleInvite}
          className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold mb-1">Invite team member by email</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Workspace role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
            >
              <option value="admin">Administrator</option>
              <option value="project_manager">Project Manager</option>
              <option value="member">Member</option>
              <option value="guest">Guest</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-white text-xs font-semibold cursor-pointer"
          >
            <MailPlus className="w-3.5 h-3.5" />
            <span>{inviting ? 'Sending...' : 'Send invite'}</span>
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {members.map((m) => (
          <div
            key={m.id}
            onClick={() => navigate('member-profile', { memberId: m.user_id })}
            className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] hover:border-[#1B3B2B] p-5 space-y-4 cursor-pointer transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="lg" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{m.full_name}</div>
                  <div className="text-xs text-[#646D67] dark:text-[#9CA39F] truncate">{m.job_title}</div>
                  <div className="text-[11px] text-[#7D8580] truncate">{m.email}</div>
                </div>
              </div>
              {canAdmin && m.role !== 'owner' && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!activeWorkspace) return;
                    await apiFetch(`/api/workspaces/${activeWorkspace.id}/members/${m.id}`, { method: 'DELETE' });
                    showToast(`Removed ${m.full_name}`, 'info');
                    await refreshWorkspaceData();
                  }}
                  title="Remove member"
                  className="p-1.5 rounded text-[#8E9691] hover:text-[#B91C1C] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]">
              <div>
                <div className="font-mono-num text-sm font-semibold">{m.assigned_projects_count || 0}</div>
                <div className="text-[11px] text-[#6E7670]">Projects</div>
              </div>
              <div>
                <div className="font-mono-num text-sm font-semibold">{m.assigned_tasks_count || 0}</div>
                <div className="text-[11px] text-[#6E7670]">Tasks</div>
              </div>
              <div>
                <div className="font-mono-num text-sm font-semibold">{formatMinutes(m.active_workload_minutes || 0)}</div>
                <div className="text-[11px] text-[#6E7670]">Workload</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-[#646D67]">{m.department}</span>
              {canAdmin && m.role !== 'owner' ? (
                <select
                  value={m.role}
                  onChange={async (e) => {
                    if (!activeWorkspace) return;
                    await apiFetch(`/api/workspaces/${activeWorkspace.id}/members/${m.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ role: e.target.value }),
                    });
                    showToast('Role updated', 'success');
                    await refreshWorkspaceData();
                  }}
                  className="px-2 py-1 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                >
                  <option value="admin">Administrator</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="member">Member</option>
                  <option value="guest">Guest</option>
                </select>
              ) : (
                <span className="text-xs font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">
                  {ROLE_LABELS[m.role]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-3">
          <h2 className="text-sm font-semibold">Pending Invitations</h2>
          <div className="divide-y divide-[#F0EDE5] dark:divide-[#242926]">
            {invitations.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">{inv.email}</span>
                  <span className="text-[#7D8580]"> · {ROLE_LABELS[inv.role]} · Invited by {inv.invited_by_name}</span>
                </div>
                {canAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!activeWorkspace) return;
                      await apiFetch(`/api/workspaces/${activeWorkspace.id}/invitations/${inv.id}`, { method: 'DELETE' });
                      await refreshWorkspaceData();
                    }}
                    className="text-[#B91C1C] hover:underline cursor-pointer"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const MemberProfileView: React.FC = () => {
  const { selectedMemberId, members, projects, tasks, navigate, setSelectedTaskId } = useApp();
  const member = members.find((m) => m.user_id === selectedMemberId) || members[0];
  if (!member) return null;

  const memberProjects = projects.filter((p) => (p.members || []).some((pm) => pm.user_id === member.user_id));
  const memberTasks = tasks.filter((t) => t.assignees.some((a) => a.user_id === member.user_id));

  return (
    <div className="space-y-6 max-w-5xl">
      <button
        type="button"
        onClick={() => navigate('team')}
        className="text-xs font-medium text-[#545C57] hover:underline cursor-pointer"
      >
        ← Back to Team
      </button>

      <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size="xl" />
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl">{member.full_name}</h1>
            <span className="text-xs font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">{ROLE_LABELS[member.role]}</span>
          </div>
          <div className="text-xs text-[#646D67] dark:text-[#9CA39F]">
            {member.job_title} · {member.department} · {member.email}
          </div>
          {member.bio && <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] max-w-2xl">{member.bio}</p>}
        </div>
        <div className="grid grid-cols-3 gap-4 text-center shrink-0">
          <div>
            <div className="font-display text-xl font-semibold tabular-nums">{memberProjects.length}</div>
            <div className="text-[11px] text-[#6E7670]">Projects</div>
          </div>
          <div>
            <div className="font-display text-xl font-semibold tabular-nums">{memberTasks.length}</div>
            <div className="text-[11px] text-[#6E7670]">Assigned</div>
          </div>
          <div>
            <div className="font-display text-xl font-semibold tabular-nums">
              {memberTasks.filter((t) => t.status === 'completed').length}
            </div>
            <div className="text-[11px] text-[#6E7670]">Completed</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-3">
          <h2 className="font-display text-lg">Assigned Projects</h2>
          {memberProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate('project-detail', { projectId: p.id })}
              className="p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] flex items-center justify-between text-xs cursor-pointer"
            >
              <span className="font-semibold">{p.name}</span>
              <span className="font-mono-num">{p.progress_pct || 0}%</span>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-3">
          <h2 className="font-display text-lg">Assigned Tasks</h2>
          {memberTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className="p-3 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] flex items-center justify-between text-xs cursor-pointer"
            >
              <span className="font-medium truncate pr-2">{t.title}</span>
              <TaskStatusIndicator status={t.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// REPORTS & ANALYTICS VIEW
// ==========================================

export const ReportsAnalyticsView: React.FC = () => {
  const { activeWorkspace, projects, tasks, members, timeEntries } = useApp();
  const [filterProject, setFilterProject] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d'>('all');

  const scopedTasks = useMemo(() => {
    const cutoff =
      dateRange === '7d'
        ? Date.now() - 7 * 86400000
        : dateRange === '30d'
          ? Date.now() - 30 * 86400000
          : 0;
    return tasks.filter((t) => {
      if (filterProject !== 'all' && t.project_id !== filterProject) return false;
      if (cutoff && new Date(t.created_at).getTime() < cutoff) return false;
      return true;
    });
  }, [tasks, filterProject, dateRange]);

  const scopedProjects = useMemo(
    () => (filterProject === 'all' ? projects : projects.filter((p) => p.id === filterProject)),
    [projects, filterProject],
  );

  const metrics = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const totalProjects = scopedProjects.length;
    const activeProjects = scopedProjects.filter((p) => p.status === 'in_progress' || p.status === 'planning').length;
    const completedProjects = scopedProjects.filter((p) => p.status === 'completed').length;
    const delayedProjects = scopedProjects.filter(
      (p) => p.status !== 'completed' && p.due_date && p.due_date.slice(0, 10) < todayIso,
    ).length;

    const totalTasks = scopedTasks.length;
    const completedTasks = scopedTasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = scopedTasks.filter((t) => t.status !== 'completed').length;
    const overdueTasks = scopedTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { totalProjects, activeProjects, completedProjects, delayedProjects, totalTasks, completedTasks, pendingTasks, overdueTasks, completionRate };
  }, [scopedProjects, scopedTasks]);

  const priorityData = useMemo(() => {
    const total = Math.max(1, scopedTasks.length);
    return [
      { label: 'Urgent', count: scopedTasks.filter((t) => t.priority === 'urgent').length, color: '#B91C1C' },
      { label: 'High', count: scopedTasks.filter((t) => t.priority === 'high').length, color: '#C2410C' },
      { label: 'Medium', count: scopedTasks.filter((t) => t.priority === 'medium').length, color: '#C99A4E' },
      { label: 'Low', count: scopedTasks.filter((t) => t.priority === 'low').length, color: '#64748B' },
    ].map((d) => ({ ...d, pct: Math.round((d.count / total) * 100) }));
  }, [scopedTasks]);

  const exportCsv = () => {
    const rows = [
      ['Task ID', 'Title', 'Project', 'Status', 'Priority', 'Due Date', 'Estimated Min', 'Assignees'],
      ...scopedTasks.map((t) => [
        t.id,
        `"${t.title.replace(/"/g, '""')}"`,
        `"${(t.project_name || '').replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        t.due_date || '',
        String(t.estimated_minutes),
        `"${t.assignees.map((a) => a.full_name).join(', ')}"`,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trellas-report-${activeWorkspace?.slug || 'workspace'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Track project completion rates, task distribution, and team productivity.
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
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] text-xs font-semibold cursor-pointer"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-4">
          <div className="text-xs text-[#646D67]">Projects Summary</div>
          <div className="font-display text-2xl font-semibold tabular-nums mt-1">{metrics.totalProjects}</div>
          <div className="text-[11px] text-[#7D8580] mt-1">
            {metrics.activeProjects} active · {metrics.completedProjects} done · {metrics.delayedProjects} delayed
          </div>
        </div>
        <div className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-4">
          <div className="text-xs text-[#646D67]">Completion Rate</div>
          <div className="font-display text-2xl font-semibold tabular-nums mt-1 text-[#1B3B2B] dark:text-[#6EE7B7]">
            {metrics.completionRate}%
          </div>
          <div className="text-[11px] text-[#7D8580] mt-1">
            {metrics.completedTasks} of {metrics.totalTasks} tasks completed
          </div>
        </div>
        <div className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-4">
          <div className="text-xs text-[#646D67]">Pending & Overdue</div>
          <div className="font-display text-2xl font-semibold tabular-nums mt-1">{metrics.pendingTasks}</div>
          <div className="text-[11px] text-[#B91C1C] dark:text-[#F87171] mt-1">
            {metrics.overdueTasks} overdue tasks
          </div>
        </div>
        <div className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-4">
          <div className="text-xs text-[#646D67]">Tracked Time</div>
          <div className="font-display text-2xl font-semibold tabular-nums mt-1">
            {Math.round(timeEntries.reduce((s, e) => s + e.duration_seconds, 0) / 3600)}h
          </div>
          <div className="text-[11px] text-[#7D8580] mt-1">{timeEntries.length} logged sessions</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut / Breakdown by Priority */}
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4">
          <h2 className="font-display text-lg">Tasks by Priority</h2>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <svg viewBox="0 0 120 120" className="w-36 h-36 shrink-0">
              {(() => {
                let offset = 0;
                const r = 44;
                const circ = 2 * Math.PI * r;
                return priorityData.map((seg) => {
                  const len = (seg.pct / 100) * circ;
                  const el = (
                    <circle
                      key={seg.label}
                      cx="60"
                      cy="60"
                      r={r}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="16"
                      strokeDasharray={`${len} ${circ - len}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 60 60)"
                    />
                  );
                  offset += len;
                  return el;
                });
              })()}
              <text x="60" y="64" textAnchor="middle" className="fill-current text-lg font-bold">
                {metrics.totalTasks}
              </text>
            </svg>
            <div className="flex-1 w-full space-y-2.5 text-xs">
              {priorityData.map((p) => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span>{p.label}</span>
                  </span>
                  <span className="font-mono-num font-semibold">
                    {p.count} ({p.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Performance Table */}
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4">
          <h2 className="font-display text-lg">Team Performance & Workload</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#ECE9E0] dark:border-[#242926] text-[#646D67]">
                <tr>
                  <th className="py-2">Member</th>
                  <th className="py-2 text-right">Assigned</th>
                  <th className="py-2 text-right">Completed</th>
                  <th className="py-2 text-right">Outstanding</th>
                  <th className="py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2EFE8] dark:divide-[#242926]">
                {members.map((m) => {
                  const mTasks = scopedTasks.filter((t) => t.assignees.some((a) => a.user_id === m.user_id));
                  const done = mTasks.filter((t) => t.status === 'completed').length;
                  const open = mTasks.length - done;
                  const rate = mTasks.length > 0 ? Math.round((done / mTasks.length) * 100) : 0;
                  return (
                    <tr key={m.user_id}>
                      <td className="py-2.5 font-medium">{m.full_name}</td>
                      <td className="py-2.5 text-right font-mono-num">{mTasks.length}</td>
                      <td className="py-2.5 text-right font-mono-num text-[#16A34A] dark:text-[#4ADE80]">{done}</td>
                      <td className="py-2.5 text-right font-mono-num">{open}</td>
                      <td className="py-2.5 text-right font-mono-num font-semibold">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// FILES & ATTACHMENTS VIEW
// ==========================================

export const FilesView: React.FC = () => {
  const { activeWorkspace, files, projects, tasks, refreshWorkspaceData, showToast } = useApp();
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    let active = true;
    if (!previewFile) {
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(null);
    getAttachmentSignedUrl(previewFile.id)
      .then((url) => {
        if (active) setPreviewUrl(url);
      })
      .catch((err) => {
        if (active) showToast(err instanceof Error ? err.message : 'Unable to load preview', 'error');
      });
    return () => {
      active = false;
    };
  }, [previewFile, showToast]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeWorkspace) return;
    const fd = new FormData();
    fd.append('file', file);
    if (selectedProject) fd.append('project_id', selectedProject);
    if (selectedTask) fd.append('task_id', selectedTask);
    try {
      await apiFetch(`/api/workspaces/${activeWorkspace.id}/files`, { method: 'POST', body: fd });
      showToast(`Uploaded "${file.name}"`, 'success');
      await refreshWorkspaceData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Files & Resources</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Upload, preview, rename, and organize project documents and creative assets (max 10 MB).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="">Workspace-wide</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="px-2.5 py-2 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="">No specific task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-white text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload file</span>
            <input type="file" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#ECE9E0] dark:border-[#242926] text-[#646D67]">
            <tr>
              <th className="py-3 px-4 font-semibold">File Name</th>
              <th className="py-3 px-4 font-semibold">Location</th>
              <th className="py-3 px-4 font-semibold">Size</th>
              <th className="py-3 px-4 font-semibold">Uploaded By</th>
              <th className="py-3 px-4 font-semibold">Added</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2EFE8] dark:divide-[#242926]">
            {files.map((f) => (
              <tr key={f.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#1D211F]">
                <td className="py-3 px-4 font-medium">
                  {renamingId === f.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (renameText.trim()) {
                          await apiFetch(`/api/files/${f.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ original_name: renameText.trim() }),
                          });
                          await refreshWorkspaceData();
                        }
                        setRenamingId(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={() => setRenamingId(null)}
                        className="px-2 py-1 rounded border border-[#1B3B2B] bg-white dark:bg-[#121514]"
                      />
                    </form>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                      <span>{f.original_name}</span>
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-[#646D67]">
                  {[f.project_name, f.task_title].filter(Boolean).join(' · ') || 'Workspace'}
                </td>
                <td className="py-3 px-4 font-mono-num">{formatBytes(f.size_bytes)}</td>
                <td className="py-3 px-4">{f.uploader_name}</td>
                <td className="py-3 px-4 text-[#7D8580]">{formatRelativeTime(f.created_at)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewFile(f)}
                      title="Preview"
                      className="p-1.5 rounded hover:bg-[#EFECE4] dark:hover:bg-[#232825] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerAttachmentDownload(f).catch((err) =>
                          showToast(err instanceof Error ? err.message : 'Download failed', 'error'),
                        )
                      }
                      title="Download"
                      className="p-1.5 rounded hover:bg-[#EFECE4] dark:hover:bg-[#232825] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(f.id);
                        setRenameText(f.original_name);
                      }}
                      title="Rename"
                      className="p-1.5 rounded hover:bg-[#EFECE4] dark:hover:bg-[#232825] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/files/${f.id}`, { method: 'DELETE' });
                        showToast('File deleted', 'info');
                        await refreshWorkspaceData();
                      }}
                      title="Delete"
                      className="p-1.5 rounded text-[#8E9691] hover:text-[#B91C1C] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {files.length === 0 && (
          <div className="p-12 text-center text-xs text-[#7D8580]">
            No files uploaded yet. Upload PDFs, office docs, images, or archives above.
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPreviewFile(null)} />
          <div className="relative z-10 w-full max-w-3xl bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2C312E] overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[#ECE9E0] dark:border-[#242926] flex items-center justify-between">
              <div className="text-sm font-semibold truncate">{previewFile.original_name}</div>
              <button type="button" onClick={() => setPreviewFile(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-auto flex items-center justify-center bg-[#FAF9F6] dark:bg-[#121514]">
              {!previewUrl ? (
                <div className="py-12 text-xs text-[#646D67]">Loading file preview...</div>
              ) : previewFile.mime_type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={previewFile.original_name}
                  className="max-h-[60vh] rounded-lg object-contain"
                />
              ) : previewFile.mime_type === 'application/pdf' || previewFile.mime_type.startsWith('text/') ? (
                <iframe
                  title={previewFile.original_name}
                  src={previewUrl}
                  className="w-full h-[55vh] rounded-lg bg-white"
                />
              ) : (
                <div className="text-center space-y-3 py-8">
                  <FileText className="w-10 h-10 mx-auto text-[#646D67]" />
                  <div className="text-xs text-[#545C57]">Preview unavailable for {previewFile.mime_type}</div>
                  <button
                    type="button"
                    onClick={() =>
                      triggerAttachmentDownload(previewFile).catch((err) =>
                        showToast(err instanceof Error ? err.message : 'Download failed', 'error'),
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Download file
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// TEMPLATES VIEW
// ==========================================

export const TemplatesView: React.FC = () => {
  const { activeWorkspace, templates, navigate, refreshWorkspaceData, showToast } = useApp();
  const [previewTpl, setPreviewTpl] = useState<ProjectTemplate | null>(null);
  const [customProjectName, setCustomProjectName] = useState('');
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCat, setNewTplCat] = useState('Operations');
  const [newTplDesc, setNewTplDesc] = useState('');

  const createProjectFromTpl = async (tpl: ProjectTemplate, customName?: string) => {
    if (!activeWorkspace) return;
    const res = await apiFetch<{ id: string }>(`/api/workspaces/${activeWorkspace.id}/projects`, {
      method: 'POST',
      body: JSON.stringify({
        name: (customName || '').trim() || `${tpl.name}`,
        description: tpl.description,
        color: tpl.color,
        category: tpl.category,
        status: 'planning',
        priority: 'medium',
        template_id: tpl.id,
      }),
    });
    setPreviewTpl(null);
    setCustomProjectName('');
    showToast('Project created from template', 'success');
    await refreshWorkspaceData();
    navigate('project-detail', { projectId: res.id, subView: 'board' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Project Templates</h1>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Launch new projects pre-configured with columns and starter tasks, or save your own workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreatingCustom((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer self-start"
        >
          <Plus className="w-3.5 h-3.5" /> Create custom template
        </button>
      </div>

      {creatingCustom && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeWorkspace) return;
            await apiFetch(`/api/workspaces/${activeWorkspace.id}/templates`, {
              method: 'POST',
              body: JSON.stringify({ name: newTplName, category: newTplCat, description: newTplDesc }),
            });
            setNewTplName('');
            setNewTplDesc('');
            setCreatingCustom(false);
            showToast('Custom template saved', 'success');
            await refreshWorkspaceData();
          }}
          className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-3"
        >
          <div className="text-sm font-semibold">New Custom Template</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              value={newTplName}
              onChange={(e) => setNewTplName(e.target.value)}
              placeholder="Template name..."
              className="px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
            />
            <input
              value={newTplCat}
              onChange={(e) => setNewTplCat(e.target.value)}
              placeholder="Category..."
              className="px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
            />
          </div>
          <textarea
            rows={2}
            value={newTplDesc}
            onChange={(e) => setNewTplDesc(e.target.value)}
            placeholder="Describe what this workflow covers..."
            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreatingCustom(false)} className="px-3 py-1.5 text-xs cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer">
              Save template
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color: tpl.color }}>{tpl.category}</span>
                <span className="text-[#7D8580] font-mono-num">{tpl.sample_tasks.length} tasks</span>
              </div>
              <h3 className="font-semibold text-base">{tpl.name}</h3>
              <p className="text-xs text-[#545C57] dark:text-[#A3ABA6] leading-relaxed">{tpl.description}</p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-[#F0EDE5] dark:border-[#242926]">
              <button
                type="button"
                onClick={() => {
                  setPreviewTpl(tpl);
                  setCustomProjectName(tpl.name);
                }}
                className="flex-1 py-2 px-3 rounded-lg border border-[#E5E2D9] dark:border-[#2A2F2C] hover:border-[#1B3B2B] text-xs font-medium cursor-pointer"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => createProjectFromTpl(tpl)}
                className="flex-1 py-2 px-3 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-white text-xs font-semibold cursor-pointer"
              >
                Use template
              </button>
            </div>
          </div>
        ))}
      </div>

      {previewTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45" onClick={() => setPreviewTpl(null)} />
          <div className="relative z-10 w-full max-w-xl bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2C312E] p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold" style={{ color: previewTpl.color }}>{previewTpl.category}</div>
                <h2 className="font-display text-xl mt-0.5">{previewTpl.name}</h2>
              </div>
              <button type="button" onClick={() => setPreviewTpl(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#545C57] dark:text-[#A3ABA6]">{previewTpl.description}</p>
            <div>
              <div className="text-xs font-semibold mb-2">Board Columns</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {previewTpl.columns.map((c) => (
                  <span key={c.name} className="px-2.5 py-1 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#E5E2D9] dark:border-[#2A2F2C]">
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold mb-2">Included Starter Tasks</div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {previewTpl.sample_tasks.map((st, idx) => (
                  <div key={idx} className="px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] text-xs flex items-center justify-between">
                    <span>{st.title}</span>
                    <PriorityIndicator priority={st.priority} />
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-[#ECE9E0] dark:border-[#242926] flex flex-wrap items-center gap-3">
              <input
                value={customProjectName}
                onChange={(e) => setCustomProjectName(e.target.value)}
                placeholder="Project name..."
                className="flex-1 min-w-[180px] px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
              <button
                type="button"
                onClick={() => createProjectFromTpl(previewTpl, customProjectName)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" /> Create project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
