import React, { useEffect, useState } from 'react';
import { FileText, FolderKanban, ListTodo, MessageSquare, Search, Users, X } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import type { PriorityLevel, ProjectStatus, TaskStatus, TaskType } from '../types/trellas';
import { useApp } from './AppContext';
import { UserAvatar } from './UserAvatar';

export const GlobalModals: React.FC = () => {
  const {
    activeWorkspace,
    projects,
    members,
    templates,
    quickCreateModal,
    setQuickCreateModal,
    globalSearchOpen,
    setGlobalSearchOpen,
    setSelectedTaskId,
    navigate,
    refreshWorkspaceData,
    refreshWorkspaces,
    switchWorkspace,
    showToast,
    toasts,
    dismissToast,
  } = useApp();

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    projects: Array<{ id: string; name: string; category: string; status: string; color: string }>;
    tasks: Array<{ id: string; title: string; status: string; priority: string; project_id: string; project_name: string }>;
    members: Array<{ id: string; full_name: string; email: string; job_title: string; avatar_url: string | null; role: string }>;
    comments: Array<{ id: string; task_id: string; body: string; task_title: string; author_name: string }>;
    files: Array<{ id: string; original_name: string; project_id: string | null; task_id: string | null }>;
  } | null>(null);

  useEffect(() => {
    if (!globalSearchOpen || !activeWorkspace) return;
    const t = window.setTimeout(() => {
      if (!searchQuery.trim()) {
        setSearchResults(null);
        return;
      }
      apiFetch<typeof searchResults>(`/api/workspaces/${activeWorkspace.id}/search?q=${encodeURIComponent(searchQuery)}`)
        .then(setSearchResults)
        .catch(() => {});
    }, 180);
    return () => window.clearTimeout(t);
  }, [searchQuery, globalSearchOpen, activeWorkspace]);

  // Quick Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskPriority, setTaskPriority] = useState<PriorityLevel>('medium');
  const [taskType, setTaskType] = useState<TaskType>('task');
  const [taskStart, setTaskStart] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskEstMin, setTaskEstMin] = useState('60');
  const [taskLabels, setTaskLabels] = useState('');
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);

  // Quick Project Form
  const [prjName, setPrjName] = useState('');
  const [prjDesc, setPrjDesc] = useState('');
  const [prjColor, setPrjColor] = useState('#1B3B2B');
  const [prjCategory, setPrjCategory] = useState('Product');
  const [prjStatus, setPrjStatus] = useState<ProjectStatus>('planning');
  const [prjPriority, setPrjPriority] = useState<PriorityLevel>('medium');
  const [prjManager, setPrjManager] = useState('');
  const [prjStart, setPrjStart] = useState('');
  const [prjDue, setPrjDue] = useState('');
  const [prjTemplateId, setPrjTemplateId] = useState('');

  // Quick Workspace Form
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [wsColor, setWsColor] = useState('#1B3B2B');
  const [wsPlan, setWsPlan] = useState('pro');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (quickCreateModal === 'task' && projects.length > 0 && !taskProjectId) {
      setTaskProjectId(projects[0].id);
    }
    if (quickCreateModal === 'project' && members.length > 0 && !prjManager) {
      setPrjManager(members[0].user_id);
    }
  }, [quickCreateModal, projects, members, taskProjectId, prjManager]);

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !taskProjectId) return;
    setSubmitting(true);
    try {
      const labels = taskLabels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch(`/api/workspaces/${activeWorkspace.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          project_id: taskProjectId,
          title: taskTitle,
          description: taskDesc,
          status: taskStatus,
          priority: taskPriority,
          task_type: taskType,
          start_date: taskStart || null,
          due_date: taskDue || null,
          estimated_minutes: Number(taskEstMin || 0),
          labels,
          assignee_ids: taskAssignees,
        }),
      });
      setTaskTitle('');
      setTaskDesc('');
      setTaskLabels('');
      setTaskAssignees([]);
      setQuickCreateModal(null);
      showToast('Task created', 'success');
      await refreshWorkspaceData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to create task', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: string }>(`/api/workspaces/${activeWorkspace.id}/projects`, {
        method: 'POST',
        body: JSON.stringify({
          name: prjName,
          description: prjDesc,
          color: prjColor,
          category: prjCategory,
          status: prjStatus,
          priority: prjPriority,
          manager_id: prjManager || undefined,
          start_date: prjStart || null,
          due_date: prjDue || null,
          template_id: prjTemplateId || undefined,
        }),
      });
      setPrjName('');
      setPrjDesc('');
      setPrjTemplateId('');
      setQuickCreateModal(null);
      showToast('Project created', 'success');
      await refreshWorkspaceData();
      navigate('project-detail', { projectId: res.id, subView: 'board' });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to create project', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ workspace: { id: string } }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name: wsName, description: wsDesc, logo_color: wsColor, plan: wsPlan }),
      });
      setWsName('');
      setWsDesc('');
      setQuickCreateModal(null);
      await refreshWorkspaces();
      switchWorkspace(res.workspace.id);
      showToast('Workspace created and activated', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to create workspace', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Global Search Modal */}
      {globalSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div className="fixed inset-0 bg-black/45" onClick={() => setGlobalSearchOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2C312E] shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#ECE9E0] dark:border-[#242926]">
              <Search className="w-4 h-4 text-[#646D67]" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects, tasks, team members, comments, or files..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(false)}
                className="p-1 rounded text-[#646D67] hover:text-[#1C1F1D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
              {!searchQuery.trim() && (
                <div className="py-10 text-center text-xs text-[#7D8580]">
                  Type to search across everything in {activeWorkspace?.name}
                </div>
              )}
              {searchResults && (
                <>
                  {searchResults.projects.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[11px] font-semibold text-[#6E7670]">Projects</div>
                      {searchResults.projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            navigate('project-detail', { projectId: p.id });
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <FolderKanban className="w-3.5 h-3.5" style={{ color: p.color }} />
                            <span>{p.name}</span>
                          </span>
                          <span className="text-[#7D8580]">{p.category}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.tasks.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[11px] font-semibold text-[#6E7670]">Tasks</div>
                      {searchResults.tasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            setSelectedTaskId(t.id);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                        >
                          <span className="flex items-center gap-2 font-medium truncate">
                            <ListTodo className="w-3.5 h-3.5 text-[#1B3B2B] dark:text-[#6EE7B7] shrink-0" />
                            <span className="truncate">{t.title}</span>
                          </span>
                          <span className="text-[#7D8580] shrink-0 ml-2">{t.project_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.members.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[11px] font-semibold text-[#6E7670]">Team Members</div>
                      {searchResults.members.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            navigate('member-profile', { memberId: m.id });
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="xs" />
                            <span className="font-medium">{m.full_name}</span>
                          </span>
                          <span className="text-[#7D8580]">{m.job_title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.comments.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[11px] font-semibold text-[#6E7670]">Comments</div>
                      {searchResults.comments.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            setSelectedTaskId(c.task_id);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 font-medium">
                            <MessageSquare className="w-3 h-3 text-[#6E7670]" />
                            <span>{c.author_name} on {c.task_title}</span>
                          </div>
                          <p className="text-[#545C57] dark:text-[#A3ABA6] truncate mt-0.5">{c.body}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.files.length > 0 && (
                    <div className="space-y-1">
                      <div className="px-2 text-[11px] font-semibold text-[#6E7670]">Files</div>
                      {searchResults.files.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setGlobalSearchOpen(false);
                            navigate('files');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-[#F5F4EE] dark:hover:bg-[#232825] cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#6E7670]" />
                          <span className="truncate">{f.original_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.projects.length === 0 &&
                    searchResults.tasks.length === 0 &&
                    searchResults.members.length === 0 &&
                    searchResults.comments.length === 0 &&
                    searchResults.files.length === 0 && (
                      <div className="py-10 text-center text-xs text-[#7D8580]">
                        No matches for "{searchQuery}"
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Modal */}
      {quickCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45" onClick={() => setQuickCreateModal(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2C312E] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-[#ECE9E0] dark:border-[#242926] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(['task', 'project', 'workspace'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setQuickCreateModal(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                      quickCreateModal === m
                        ? 'bg-[#1B3B2B] text-white'
                        : 'text-[#545C57] dark:text-[#A3ABA6] hover:bg-[#F5F4EE] dark:hover:bg-[#232825]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setQuickCreateModal(null)} className="p-1 text-[#646D67] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {quickCreateModal === 'task' && (
                <form onSubmit={submitTask} className="space-y-4">
                  {projects.length === 0 ? (
                    <div className="text-xs text-[#7D8580] py-4">
                      Create a project first before adding tasks.
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Task title</label>
                        <input
                          required
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder="e.g. Finalize onboarding checklist"
                          className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={taskDesc}
                          onChange={(e) => setTaskDesc(e.target.value)}
                          placeholder="Context, acceptance criteria, or notes..."
                          className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Project</label>
                          <select
                            value={taskProjectId}
                            onChange={(e) => setTaskProjectId(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          >
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Status</label>
                          <select
                            value={taskStatus}
                            onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          >
                            <option value="backlog">Backlog</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Priority</label>
                          <select
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value as PriorityLevel)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Type</label>
                          <select
                            value={taskType}
                            onChange={(e) => setTaskType(e.target.value as TaskType)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          >
                            <option value="task">Task</option>
                            <option value="feature">Feature</option>
                            <option value="bug">Bug</option>
                            <option value="story">Story</option>
                            <option value="milestone">Milestone</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Start date</label>
                          <input
                            type="date"
                            value={taskStart}
                            onChange={(e) => setTaskStart(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Due date</label>
                          <input
                            type="date"
                            value={taskDue}
                            onChange={(e) => setTaskDue(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Estimated minutes</label>
                          <input
                            type="number"
                            min={0}
                            value={taskEstMin}
                            onChange={(e) => setTaskEstMin(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Labels (comma separated)</label>
                          <input
                            value={taskLabels}
                            onChange={(e) => setTaskLabels(e.target.value)}
                            placeholder="Design, QA"
                            className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1.5">Assignees</label>
                        <div className="flex flex-wrap gap-2">
                          {members.map((m) => {
                            const selected = taskAssignees.includes(m.user_id);
                            return (
                              <button
                                key={m.user_id}
                                type="button"
                                onClick={() =>
                                  setTaskAssignees((prev) =>
                                    selected ? prev.filter((id) => id !== m.user_id) : [...prev, m.user_id],
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${
                                  selected
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
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setQuickCreateModal(null)}
                          className="px-4 py-2 text-xs font-medium rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1B3B2B] text-white hover:bg-[#142D20] cursor-pointer"
                        >
                          {submitting ? 'Creating...' : 'Create task'}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              )}

              {quickCreateModal === 'project' && (
                <form onSubmit={submitProject} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Project name</label>
                    <input
                      required
                      value={prjName}
                      onChange={(e) => setPrjName(e.target.value)}
                      placeholder="e.g. Customer Portal v3"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={prjDesc}
                      onChange={(e) => setPrjDesc(e.target.value)}
                      placeholder="Scope, goals, and deliverables..."
                      className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Start from template (optional)</label>
                      <select
                        value={prjTemplateId}
                        onChange={(e) => setPrjTemplateId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      >
                        <option value="">Blank 5-column board</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Category</label>
                      <input
                        value={prjCategory}
                        onChange={(e) => setPrjCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Status</label>
                      <select
                        value={prjStatus}
                        onChange={(e) => setPrjStatus(e.target.value as ProjectStatus)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      >
                        <option value="not_started">Not Started</option>
                        <option value="planning">Planning</option>
                        <option value="in_progress">In Progress</option>
                        <option value="on_hold">On Hold</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Priority</label>
                      <select
                        value={prjPriority}
                        onChange={(e) => setPrjPriority(e.target.value as PriorityLevel)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Project manager</label>
                      <select
                        value={prjManager}
                        onChange={(e) => setPrjManager(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      >
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Color accent</label>
                      <input
                        type="color"
                        value={prjColor}
                        onChange={(e) => setPrjColor(e.target.value)}
                        className="w-full h-9 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Start date</label>
                      <input
                        type="date"
                        value={prjStart}
                        onChange={(e) => setPrjStart(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Due date</label>
                      <input
                        type="date"
                        value={prjDue}
                        onChange={(e) => setPrjDue(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQuickCreateModal(null)}
                      className="px-4 py-2 text-xs font-medium rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1B3B2B] text-white hover:bg-[#142D20] cursor-pointer"
                    >
                      {submitting ? 'Creating...' : 'Create project'}
                    </button>
                  </div>
                </form>
              )}

              {quickCreateModal === 'workspace' && (
                <form onSubmit={submitWorkspace} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Workspace name</label>
                    <input
                      required
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      placeholder="e.g. Client Operations"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={wsDesc}
                      onChange={(e) => setWsDesc(e.target.value)}
                      placeholder="What teams or projects live here?"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Brand color</label>
                      <input
                        type="color"
                        value={wsColor}
                        onChange={(e) => setWsColor(e.target.value)}
                        className="w-full h-9 rounded-lg cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Plan tier</label>
                      <select
                        value={wsPlan}
                        onChange={(e) => setWsPlan(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQuickCreateModal(null)}
                      className="px-4 py-2 text-xs font-medium rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1B3B2B] text-white hover:bg-[#142D20] cursor-pointer"
                    >
                      {submitting ? 'Creating...' : 'Create workspace'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications with Undo Support */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl border shadow-lg text-xs font-medium flex items-center justify-between gap-3 ${
              t.type === 'error'
                ? 'bg-[#FEF2F2] dark:bg-[#2C1616] border-[#FECACA] dark:border-[#5C2323] text-[#B91C1C] dark:text-[#FCA5A5]'
                : t.type === 'success'
                  ? 'bg-[#1B3B2B] text-[#FAF9F6] border-[#142D20]'
                  : 'bg-white dark:bg-[#1C201E] border-[#E5E2D9] dark:border-[#2C312E] text-[#1C1F1D] dark:text-[#F1F2EE]'
            }`}
          >
            <span>{t.text}</span>
            <div className="flex items-center gap-2 shrink-0">
              {t.undoAction && (
                <button
                  type="button"
                  onClick={async () => {
                    await t.undoAction!();
                    dismissToast(t.id);
                  }}
                  className="underline font-semibold cursor-pointer"
                >
                  Undo
                </button>
              )}
              <button type="button" onClick={() => dismissToast(t.id)} className="opacity-70 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
