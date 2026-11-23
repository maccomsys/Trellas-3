import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  CheckSquare,
  Clock,
  Download,
  Edit3,
  Link2,
  Paperclip,
  Play,
  Plus,
  Send,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { formatBytes, formatDuration, formatMinutes, formatRelativeTime } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { triggerAttachmentDownload } from '../lib/supabaseService';
import type { DependencyType, PriorityLevel, TaskDetail, TaskStatus } from '../types/trellas';
import { useApp } from './AppContext';
import { PriorityIndicator, TaskStatusIndicator } from './StatusBadges';
import { UserAvatar } from './UserAvatar';

export const TaskDetailDrawer: React.FC = () => {
  const {
    selectedTaskId,
    setSelectedTaskId,
    activeWorkspace,
    tasks,
    members,
    user,
    activeTimer,
    startTaskTimer,
    pauseResumeTimer,
    stopTaskTimer,
    refreshWorkspaceData,
    showToast,
  } = useApp();

  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newItemByChecklist, setNewItemByChecklist] = useState<Record<string, string>>({});
  const [depTaskId, setDepTaskId] = useState('');
  const [depType, setDepType] = useState<DependencyType>('related_to');
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualNote, setManualNote] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [labelInput, setLabelInput] = useState('');

  const loadDetail = useCallback(async (opts?: { silent?: boolean }) => {
    if (!selectedTaskId) {
      setDetail(null);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const res = await apiFetch<{ task: TaskDetail }>(`/api/tasks/${selectedTaskId}`);
      setDetail(res.task);
      setTitleDraft(res.task.title);
      setDescDraft(res.task.description);
    } catch {
      if (!opts?.silent) setDetail(null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const sb = supabase;
    if (!isSupabaseConfigured || !sb || !selectedTaskId) return;
    let timer: number | null = null;
    const scheduleDetailRefresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        loadDetail({ silent: true });
      }, 220);
    };

    const channel = sb
      .channel(`trellas-task-${selectedTaskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `task_id=eq.${selectedTaskId}` }, scheduleDetailRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_reactions' }, scheduleDetailRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks', filter: `task_id=eq.${selectedTaskId}` }, scheduleDetailRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists', filter: `task_id=eq.${selectedTaskId}` }, scheduleDetailRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, scheduleDetailRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments', filter: `task_id=eq.${selectedTaskId}` }, scheduleDetailRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs', filter: `task_id=eq.${selectedTaskId}` }, scheduleDetailRefresh)
      .subscribe();

    return () => {
      if (timer) window.clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [selectedTaskId, loadDetail]);

  if (!selectedTaskId) return null;

  const patchTask = async (patch: Record<string, unknown>) => {
    if (!detail) return;
    try {
      await apiFetch(`/api/tasks/${detail.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      await loadDetail();
      await refreshWorkspaceData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    }
  };

  const handleToggleAssignee = async (userId: string) => {
    if (!detail) return;
    const currentIds = detail.assignees.map((a) => a.user_id);
    const next = currentIds.includes(userId) ? currentIds.filter((id) => id !== userId) : [...currentIds, userId];
    await patchTask({ assignee_ids: next });
  };

  const handleAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !labelInput.trim()) return;
    const next = Array.from(new Set([...detail.labels, labelInput.trim()]));
    setLabelInput('');
    await patchTask({ labels: next });
  };

  const handleRemoveLabel = async (lbl: string) => {
    if (!detail) return;
    await patchTask({ labels: detail.labels.filter((l) => l !== lbl) });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !newSubtaskTitle.trim()) return;
    await apiFetch(`/api/tasks/${detail.id}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title: newSubtaskTitle.trim() }),
    });
    setNewSubtaskTitle('');
    await loadDetail();
    await refreshWorkspaceData();
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !newChecklistTitle.trim()) return;
    await apiFetch(`/api/tasks/${detail.id}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ title: newChecklistTitle.trim() }),
    });
    setNewChecklistTitle('');
    await loadDetail();
  };

  const handleAddChecklistItem = async (checklistId: string) => {
    const text = (newItemByChecklist[checklistId] || '').trim();
    if (!text) return;
    await apiFetch(`/api/checklists/${checklistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    setNewItemByChecklist((prev) => ({ ...prev, [checklistId]: '' }));
    await loadDetail();
    await refreshWorkspaceData();
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !depTaskId) return;
    await apiFetch(`/api/tasks/${detail.id}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ related_task_id: depTaskId, dependency_type: depType }),
    });
    setDepTaskId('');
    await loadDetail();
  };

  const handleManualTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const secs = Math.max(60, Number(manualMinutes || 0) * 60);
    await apiFetch(`/api/tasks/${detail.id}/time-entries`, {
      method: 'POST',
      body: JSON.stringify({ description: manualNote || 'Logged time', duration_seconds: secs, is_running: false }),
    });
    setManualNote('');
    showToast(`Logged ${manualMinutes}m`, 'success');
    await loadDetail();
    await refreshWorkspaceData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detail || !activeWorkspace) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', detail.project_id);
    fd.append('task_id', detail.id);
    try {
      await apiFetch(`/api/workspaces/${activeWorkspace.id}/files`, { method: 'POST', body: fd });
      showToast(`Attached "${file.name}"`, 'success');
      await loadDetail();
      await refreshWorkspaceData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !commentBody.trim()) return;
    const mentionedIds = members
      .filter((m) => commentBody.toLowerCase().includes(`@${m.full_name.toLowerCase()}`))
      .map((m) => m.user_id);

    await apiFetch(`/api/tasks/${detail.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: commentBody.trim(), mentions: mentionedIds }),
    });
    setCommentBody('');
    await loadDetail();
    await refreshWorkspaceData();
  };

  const handleDeleteTask = async () => {
    if (!detail) return;
    const taskId = detail.id;
    await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    setSelectedTaskId(null);
    await refreshWorkspaceData();
    showToast(`Moved "${detail.title}" to Trash`, 'info', async () => {
      await apiFetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
      await refreshWorkspaceData();
    });
  };

  const totalChecklistItems = detail ? detail.checklists.reduce((acc, c) => acc + c.items.length, 0) : 0;
  const doneChecklistItems = detail
    ? detail.checklists.reduce((acc, c) => acc + c.items.filter((i) => i.completed).length, 0)
    : 0;
  const checklistPct = totalChecklistItems > 0 ? Math.round((doneChecklistItems / totalChecklistItems) * 100) : 0;
  const isThisTaskRunning = activeTimer?.taskId === detail?.id;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/35" onClick={() => setSelectedTaskId(null)} />
      <aside className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#161918] border-l border-[#E5E2D9] dark:border-[#2A2F2C] h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-[#ECE9E0] dark:border-[#242926] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#646D67] dark:text-[#9CA39F] min-w-0">
            {detail && (
              <>
                <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: detail.project_color }} />
                <span className="font-medium truncate">{detail.project_name}</span>
                <span>·</span>
                <span className="capitalize">{detail.task_type}</span>
                {detail.is_demo === 1 && (
                  <>
                    <span>·</span>
                    <span className="text-[#92621A] dark:text-[#F3C87B]">Sample data</span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {detail && (
              <>
                <button
                  type="button"
                  onClick={() => patchTask({ is_archived: detail.is_archived ? 0 : 1 })}
                  title="Archive task"
                  className="p-2 rounded-lg text-[#646D67] hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  title="Move to trash"
                  className="p-2 rounded-lg text-[#646D67] hover:text-[#B91C1C] hover:bg-[#FEF2F2] dark:hover:bg-[#2C1616] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              aria-label="Close task drawer"
              className="p-2 rounded-lg text-[#646D67] hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading || !detail ? (
          <div className="p-8 space-y-4">
            <div className="h-7 w-2/3 bg-[#EFECE4] dark:bg-[#232825] rounded animate-pulse" />
            <div className="h-24 w-full bg-[#EFECE4] dark:bg-[#232825] rounded animate-pulse" />
          </div>
        ) : (
          <>
            {/* Sub-tabs */}
            <div className="px-6 pt-3 border-b border-[#ECE9E0] dark:border-[#242926] flex items-center gap-6 text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'details'
                    ? 'border-[#1B3B2B] dark:border-[#6EE7B7] text-[#1C1F1D] dark:text-white'
                    : 'border-transparent text-[#6E7670] hover:text-[#1C1F1D]'
                }`}
              >
                Details & Checklists
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'comments'
                    ? 'border-[#1B3B2B] dark:border-[#6EE7B7] text-[#1C1F1D] dark:text-white'
                    : 'border-transparent text-[#6E7670] hover:text-[#1C1F1D]'
                }`}
              >
                Comments ({detail.comments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'activity'
                    ? 'border-[#1B3B2B] dark:border-[#6EE7B7] text-[#1C1F1D] dark:text-white'
                    : 'border-transparent text-[#6E7670] hover:text-[#1C1F1D]'
                }`}
              >
                Activity ({detail.activity_logs.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'details' && (
                <>
                  {/* Title */}
                  <div>
                    {editingTitle ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setEditingTitle(false);
                          if (titleDraft.trim() && titleDraft !== detail.title) {
                            patchTask({ title: titleDraft.trim() });
                          }
                        }}
                        className="flex gap-2"
                      >
                        <input
                          autoFocus
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onBlur={() => {
                            setEditingTitle(false);
                            if (titleDraft.trim() && titleDraft !== detail.title) patchTask({ title: titleDraft.trim() });
                          }}
                          className="flex-1 font-display text-xl px-2 py-1 rounded border border-[#1B3B2B] bg-[#FAF9F6] dark:bg-[#121514]"
                        />
                      </form>
                    ) : (
                      <h2
                        onClick={() => setEditingTitle(true)}
                        className="font-display text-xl sm:text-2xl tracking-tight cursor-pointer hover:opacity-80 flex items-center gap-2"
                      >
                        <span>{detail.title}</span>
                        <Edit3 className="w-3.5 h-3.5 text-[#8E9691] shrink-0" />
                      </h2>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]">
                    <div>
                      <div className="text-[11px] font-semibold text-[#6E7670] mb-1">Status</div>
                      <select
                        value={detail.status}
                        onChange={(e) => patchTask({ status: e.target.value as TaskStatus })}
                        className="w-full text-xs font-medium bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E] rounded-lg px-2 py-1.5"
                      >
                        <option value="backlog">Backlog</option>
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="in_review">In Review</option>
                        <option value="completed">Completed</option>
                      </select>
                      <div className="mt-1">
                        <TaskStatusIndicator status={detail.status} />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[#6E7670] mb-1">Priority</div>
                      <select
                        value={detail.priority}
                        onChange={(e) => patchTask({ priority: e.target.value as PriorityLevel })}
                        className="w-full text-xs font-medium bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E] rounded-lg px-2 py-1.5"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <div className="mt-1">
                        <PriorityIndicator priority={detail.priority} />
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[#6E7670] mb-1">Start date</div>
                      <input
                        type="date"
                        value={detail.start_date ? detail.start_date.slice(0, 10) : ''}
                        onChange={(e) => patchTask({ start_date: e.target.value || null })}
                        className="w-full text-xs bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E] rounded-lg px-2 py-1.5 font-mono-num"
                      />
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[#6E7670] mb-1">Due date</div>
                      <input
                        type="date"
                        value={detail.due_date ? detail.due_date.slice(0, 10) : ''}
                        onChange={(e) => patchTask({ due_date: e.target.value || null })}
                        className="w-full text-xs bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E] rounded-lg px-2 py-1.5 font-mono-num"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-[#545C57] dark:text-[#A3ABA6]">Description</div>
                    <textarea
                      rows={3}
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      onBlur={() => {
                        if (descDraft !== detail.description) patchTask({ description: descDraft });
                      }}
                      placeholder="Add detailed instructions, links, or notes..."
                      className="w-full px-3 py-2 text-sm rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    />
                  </div>

                  {/* Assignees & Collaborators */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#545C57] dark:text-[#A3ABA6]">
                      Assignee & Collaborators
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => {
                        const assigned = detail.assignees.some((a) => a.user_id === m.user_id);
                        return (
                          <button
                            key={m.user_id}
                            type="button"
                            onClick={() => handleToggleAssignee(m.user_id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer ${
                              assigned
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

                  {/* Labels */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#545C57] dark:text-[#A3ABA6]">Labels</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {detail.labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1B3B2B] dark:text-[#6EE7B7] bg-[#EEF3EF] dark:bg-[#192820] px-2 py-0.5 rounded"
                        >
                          <span>{lbl}</span>
                          <button type="button" onClick={() => handleRemoveLabel(lbl)} className="hover:opacity-70 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <form onSubmit={handleAddLabel} className="inline-flex items-center gap-1">
                        <input
                          value={labelInput}
                          onChange={(e) => setLabelInput(e.target.value)}
                          placeholder="+ Add label"
                          className="w-24 px-2 py-1 text-xs rounded border border-[#DEDAD0] dark:border-[#2C312E] bg-transparent"
                        />
                      </form>
                    </div>
                  </div>

                  {/* Time Tracking */}
                  <div className="p-4 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                          <span>Time Tracking</span>
                        </div>
                        <div className="text-xs text-[#646D67] dark:text-[#9CA39F] font-mono-num">
                          Actual: {formatDuration((detail.actual_seconds || 0) + (activeTimer && isThisTaskRunning ? activeTimer.elapsedSeconds : 0))} · Estimated: {formatMinutes(detail.estimated_minutes)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeTimer && isThisTaskRunning ? (
                          <>
                            <span className="font-mono-num text-xs font-bold text-[#1B3B2B] dark:text-[#6EE7B7]">
                              {formatDuration(activeTimer.elapsedSeconds)}
                            </span>
                            <button
                              type="button"
                              onClick={pauseResumeTimer}
                              className="px-2.5 py-1.5 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] text-xs font-medium cursor-pointer"
                            >
                              {activeTimer.running ? 'Pause' : 'Resume'}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await stopTaskTimer();
                                await loadDetail();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#B91C1C] text-white text-xs font-medium cursor-pointer"
                            >
                              <Square className="w-3 h-3" /> Stop
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startTaskTimer(detail.id, detail.title)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-medium cursor-pointer"
                          >
                            <Play className="w-3 h-3" /> Start timer
                          </button>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleManualTime} className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#ECE9E0] dark:border-[#242926]">
                      <input
                        type="number"
                        min={1}
                        value={manualMinutes}
                        onChange={(e) => setManualMinutes(e.target.value)}
                        className="w-20 px-2.5 py-1.5 text-xs font-mono-num rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                      <span className="text-xs text-[#646D67]">min</span>
                      <input
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        placeholder="Manual entry note..."
                        className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] hover:border-[#1B3B2B] text-xs font-medium cursor-pointer"
                      >
                        Log time
                      </button>
                    </form>

                    {detail.time_entries.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {detail.time_entries.slice(0, 4).map((te) => (
                          <div key={te.id} className="flex items-center justify-between text-xs text-[#545C57] dark:text-[#A3ABA6]">
                            <span>{te.user_name} · {te.description}</span>
                            <span className="font-mono-num">{formatDuration(te.duration_seconds)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subtasks */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#545C57] dark:text-[#A3ABA6]">
                        Subtasks ({detail.subtasks.filter((s) => s.completed).length}/{detail.subtasks.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {detail.subtasks.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]"
                        >
                          <label className="flex items-center gap-2.5 text-xs cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={Boolean(sub.completed)}
                              onChange={async (e) => {
                                await apiFetch(`/api/subtasks/${sub.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ completed: e.target.checked }),
                                });
                                await loadDetail();
                                await refreshWorkspaceData();
                              }}
                            />
                            <span className={sub.completed ? 'line-through text-[#8E9691]' : ''}>{sub.title}</span>
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/subtasks/${sub.id}`, { method: 'DELETE' });
                              await loadDetail();
                              await refreshWorkspaceData();
                            }}
                            className="text-[#8E9691] hover:text-[#B91C1C] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAddSubtask} className="flex gap-2">
                      <input
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Add a subtask..."
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] text-xs font-medium hover:border-[#1B3B2B] cursor-pointer"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Checklists */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#545C57] dark:text-[#A3ABA6] inline-flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5" />
                        Checklists {totalChecklistItems > 0 && `(${checklistPct}%)`}
                      </span>
                    </div>
                    {totalChecklistItems > 0 && (
                      <div className="h-1.5 bg-[#ECEAE2] dark:bg-[#252A27] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1B3B2B] dark:bg-[#34D399] transition-all" style={{ width: `${checklistPct}%` }} />
                      </div>
                    )}
                    {detail.checklists.map((ch) => (
                      <div key={ch.id} className="p-3.5 rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] space-y-2">
                        <div className="text-xs font-semibold">{ch.title}</div>
                        <div className="space-y-1.5">
                          {ch.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                              <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.completed)}
                                  onChange={async (e) => {
                                    await apiFetch(`/api/checklist-items/${item.id}`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ completed: e.target.checked }),
                                    });
                                    await loadDetail();
                                    await refreshWorkspaceData();
                                  }}
                                />
                                <span className={item.completed ? 'line-through text-[#8E9691]' : ''}>{item.text}</span>
                              </label>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/checklist-items/${item.id}`, { method: 'DELETE' });
                                  await loadDetail();
                                }}
                                className="text-[#8E9691] hover:text-[#B91C1C] cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <input
                            value={newItemByChecklist[ch.id] || ''}
                            onChange={(e) => setNewItemByChecklist((p) => ({ ...p, [ch.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddChecklistItem(ch.id);
                              }
                            }}
                            placeholder="Add checklist item..."
                            className="flex-1 px-2.5 py-1 text-xs rounded bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddChecklistItem(ch.id)}
                            className="px-2.5 py-1 text-xs rounded border border-[#DEDAD0] dark:border-[#2C312E] cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                    <form onSubmit={handleAddChecklist} className="flex gap-2">
                      <input
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        placeholder="New checklist title..."
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] text-xs font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Checklist
                      </button>
                    </form>
                  </div>

                  {/* Dependencies */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-[#545C57] dark:text-[#A3ABA6] inline-flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> Dependencies
                    </div>
                    {detail.dependencies.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(d.related_task_id)}
                          className="flex items-center gap-2 hover:underline text-left cursor-pointer"
                        >
                          <span className="font-semibold capitalize text-[#B7791F] dark:text-[#E2B05E]">
                            {d.dependency_type.replace('_', ' ')}
                          </span>
                          <span>{d.related_task_title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/dependencies/${d.id}`, { method: 'DELETE' });
                            await loadDetail();
                          }}
                          className="text-[#8E9691] hover:text-[#B91C1C] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <form onSubmit={handleAddDependency} className="flex flex-wrap gap-2">
                      <select
                        value={depType}
                        onChange={(e) => setDepType(e.target.value as DependencyType)}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      >
                        <option value="blocking">Blocking</option>
                        <option value="blocked_by">Blocked by</option>
                        <option value="related_to">Related to</option>
                      </select>
                      <select
                        value={depTaskId}
                        onChange={(e) => setDepTaskId(e.target.value)}
                        className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      >
                        <option value="">Select task to link...</option>
                        {tasks
                          .filter((t) => t.id !== detail.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </select>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] text-xs font-medium cursor-pointer"
                      >
                        Link
                      </button>
                    </form>
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#545C57] dark:text-[#A3ABA6] inline-flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" /> Attachments ({detail.attachments.length})
                      </span>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] hover:border-[#1B3B2B] text-xs font-medium cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload file</span>
                        <input type="file" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                    {detail.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{att.original_name}</div>
                          <div className="text-[11px] text-[#7D8580]">
                            {formatBytes(att.size_bytes)} · {att.uploader_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              triggerAttachmentDownload(att).catch((err) =>
                                showToast(err instanceof Error ? err.message : 'Download failed', 'error'),
                              )
                            }
                            className="p-1.5 rounded hover:bg-[#E8E6DC] dark:hover:bg-[#232825] cursor-pointer"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/files/${att.id}`, { method: 'DELETE' });
                              await loadDetail();
                              await refreshWorkspaceData();
                            }}
                            className="p-1.5 rounded text-[#8E9691] hover:text-[#B91C1C] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-5">
                  <div className="space-y-4">
                    {detail.comments.map((c) => (
                      <div key={c.id} className="p-4 rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={c.author_name} avatarUrl={c.author_avatar} size="sm" />
                            <div>
                              <div className="text-xs font-semibold">{c.author_name}</div>
                              <div className="text-[11px] text-[#7D8580]">{formatRelativeTime(c.created_at)}</div>
                            </div>
                          </div>
                          {c.user_id === user?.id && (
                            <div className="flex items-center gap-2 text-[11px] text-[#6E7670]">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setEditingCommentBody(c.body);
                                }}
                                className="hover:underline cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/comments/${c.id}`, { method: 'DELETE' });
                                  await loadDetail();
                                  await refreshWorkspaceData();
                                }}
                                className="hover:text-[#B91C1C] cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        {editingCommentId === c.id ? (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={editingCommentBody}
                              onChange={(e) => setEditingCommentBody(e.target.value)}
                              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#DEDAD0] dark:border-[#2C312E]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/comments/${c.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ body: editingCommentBody }),
                                  });
                                  setEditingCommentId(null);
                                  await loadDetail();
                                }}
                                className="px-3 py-1 rounded bg-[#1B3B2B] text-white text-xs cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="px-3 py-1 rounded border text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                        )}

                        <div className="flex items-center gap-1.5 pt-1">
                          {['👍', '🎉', '✅', '👀'].map((emoji) => {
                            const match = c.reactions.find((r) => r.emoji === emoji);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/comments/${c.id}/reactions`, {
                                    method: 'POST',
                                    body: JSON.stringify({ emoji }),
                                  });
                                  await loadDetail();
                                }}
                                className={`px-2 py-0.5 rounded-md text-xs border transition-colors cursor-pointer ${
                                  match?.user_reacted
                                    ? 'bg-[#EEF3EF] dark:bg-[#1D2F26] border-[#1B3B2B] dark:border-[#6EE7B7]'
                                    : 'border-[#E5E2D9] dark:border-[#2A2F2C] hover:bg-white dark:hover:bg-[#1D211F]'
                                }`}
                              >
                                {emoji} {match && match.count > 0 ? match.count : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {detail.comments.length === 0 && (
                      <div className="py-8 text-center text-xs text-[#7D8580]">
                        No comments yet. Mention teammates with @Full Name.
                      </div>
                    )}
                  </div>

                  <form onSubmit={handlePostComment} className="space-y-2.5 pt-2 border-t border-[#ECE9E0] dark:border-[#242926]">
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-[#6E7670]">
                      <span>Mention:</span>
                      {members.map((m) => (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => setCommentBody((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}@${m.full_name} `)}
                          className="hover:text-[#1B3B2B] dark:hover:text-[#6EE7B7] font-medium cursor-pointer"
                        >
                          @{m.full_name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Write a comment or @mention a teammate..."
                        className="flex-1 px-3 py-2 text-sm rounded-xl bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#1B3B2B] hover:bg-[#142D20] text-white text-xs font-semibold inline-flex items-center gap-1.5 self-end cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-3">
                  {detail.activity_logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-xs py-2 border-b border-[#F0EDE5] dark:border-[#242926]">
                      <UserAvatar name={log.user_name} avatarUrl={log.user_avatar} size="xs" />
                      <div className="flex-1">
                        <span className="font-semibold">{log.user_name}</span>{' '}
                        <span className="text-[#545C57] dark:text-[#A3ABA6]">{log.details}</span>
                        <div className="text-[11px] text-[#8E9691] mt-0.5">{formatRelativeTime(log.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  {detail.activity_logs.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#7D8580]">No activity recorded yet.</div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
