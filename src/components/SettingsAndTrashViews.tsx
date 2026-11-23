import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { formatDuration, formatRelativeTime } from '../lib/format';
import { supabase } from '../lib/supabase';
import { uploadUserAvatar } from '../lib/supabaseService';
import type { Project, SessionInfo, Task, ThemeMode } from '../types/trellas';
import { useApp } from './AppContext';
import { UserAvatar } from './UserAvatar';

// ==========================================
// TRASH & ARCHIVED ITEMS VIEW
// ==========================================

export const TrashView: React.FC = () => {
  const { activeWorkspace, refreshWorkspaceData, showToast } = useApp();
  const [trashedProjects, setTrashedProjects] = useState<Project[]>([]);
  const [trashedTasks, setTrashedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrash = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        apiFetch<{ projects: Project[] }>(`/api/workspaces/${activeWorkspace.id}/projects?trash=1`),
        apiFetch<{ tasks: Task[] }>(`/api/workspaces/${activeWorkspace.id}/tasks?trash=1`),
      ]);
      setTrashedProjects(pRes.projects);
      setTrashedTasks(tRes.tasks);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Trash</h1>
        <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
          Restore deleted projects and tasks or remove them permanently.
        </p>
      </div>

      {loading ? (
        <div className="h-48 rounded-2xl bg-[#EFECE4] dark:bg-[#1B1F1D] animate-pulse" />
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-3">
            <h2 className="text-sm font-semibold">Deleted Projects ({trashedProjects.length})</h2>
            {trashedProjects.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between border-t border-[#F0EDE5] dark:border-[#242926] text-xs">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[#7D8580]">Deleted {p.deleted_at ? formatRelativeTime(p.deleted_at) : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/projects/${p.id}/restore`, { method: 'POST' });
                      showToast(`Restored "${p.name}"`, 'success');
                      await loadTrash();
                      await refreshWorkspaceData();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/projects/${p.id}?permanent=1`, { method: 'DELETE' });
                      showToast('Permanently deleted', 'info');
                      await loadTrash();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEF2F2] dark:bg-[#2C1616] text-[#B91C1C] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Delete forever
                  </button>
                </div>
              </div>
            ))}
            {trashedProjects.length === 0 && <div className="text-xs text-[#7D8580] py-3">No deleted projects.</div>}
          </div>

          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 space-y-3">
            <h2 className="text-sm font-semibold">Deleted Tasks ({trashedTasks.length})</h2>
            {trashedTasks.map((t) => (
              <div key={t.id} className="py-2.5 flex items-center justify-between border-t border-[#F0EDE5] dark:border-[#242926] text-xs">
                <div>
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-[#7D8580]">{t.project_name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/tasks/${t.id}/restore`, { method: 'POST' });
                      showToast(`Restored "${t.title}"`, 'success');
                      await loadTrash();
                      await refreshWorkspaceData();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/tasks/${t.id}?permanent=1`, { method: 'DELETE' });
                      showToast('Permanently deleted', 'info');
                      await loadTrash();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEF2F2] dark:bg-[#2C1616] text-[#B91C1C] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Delete forever
                  </button>
                </div>
              </div>
            ))}
            {trashedTasks.length === 0 && <div className="text-xs text-[#7D8580] py-3">No deleted tasks.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// SETTINGS & PREFERENCES VIEW
// ==========================================

const AVATAR_PRESETS = [
  '/src/assets/images/avatar_maya_chen_1795389987021.jpg',
  '/src/assets/images/avatar_julian_wright_1795389986590.jpg',
  '/src/assets/images/avatar_priya_rao_1795389986691.jpg',
  '/src/assets/images/avatar_theo_silva_1795389986722.jpg',
];

export const SettingsView: React.FC = () => {
  const {
    user,
    preferences,
    theme,
    setThemeMode,
    activeWorkspace,
    timeEntries,
    refreshAccount,
    refreshWorkspaces,
    logout,
    showToast,
  } = useApp();

  const [tab, setTab] = useState<'profile' | 'account' | 'workspace' | 'notifications' | 'appearance' | 'time'>('profile');

  // Profile form
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'America/Los_Angeles');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password & Sessions
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confPass, setConfPass] = useState('');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  // Workspace form
  const [wsName, setWsName] = useState(activeWorkspace?.name || '');
  const [wsDesc, setWsDesc] = useState(activeWorkspace?.description || '');
  const [wsColor, setWsColor] = useState(activeWorkspace?.logo_color || '#1B3B2B');
  const [confirmDeleteWs, setConfirmDeleteWs] = useState(false);

  // Regional
  const [language, setLanguage] = useState(preferences?.language || 'en-US');
  const [dateFormat, setDateFormat] = useState(preferences?.date_format || 'MMM d, yyyy');
  const [timeFormat, setTimeFormat] = useState(preferences?.time_format || '12h');

  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name);
      setWsDesc(activeWorkspace.description);
      setWsColor(activeWorkspace.logo_color);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (tab === 'account') {
      apiFetch<{ sessions: SessionInfo[] }>('/api/account/sessions')
        .then((r) => setSessions(r.sessions))
        .catch(() => {});
    }
  }, [tab]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName,
          email,
          job_title: jobTitle,
          department,
          bio,
          timezone,
          avatar_url: avatarUrl || null,
        }),
      });
      await refreshAccount();
      showToast('Profile saved', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Save failed', 'error');
    }
  };

  const toggleNotifPref = async (key: string, val: boolean) => {
    await apiFetch('/api/account/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ [key]: val }),
    });
    await refreshAccount();
    showToast('Notification preference updated', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Settings & Preferences</h1>
        <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
          Manage your profile, security sessions, workspace branding, notifications, and appearance.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#EFECE4] dark:bg-[#1A1E1C] text-xs">
        {(
          [
            { id: 'profile', label: 'Profile' },
            { id: 'account', label: 'Account & Security' },
            { id: 'workspace', label: 'Workspace' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'appearance', label: 'Appearance & Regional' },
            { id: 'time', label: 'Time Logs' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
              tab === t.id ? 'bg-white dark:bg-[#272D2A] shadow-xs' : 'text-[#646D67]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form
          onSubmit={saveProfile}
          className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center gap-5">
            <UserAvatar name={fullName || 'User'} avatarUrl={avatarUrl || null} size="xl" />
            <div className="space-y-2">
              <div className="text-xs font-semibold">Choose profile portrait</div>
              <div className="flex flex-wrap items-center gap-2">
                {AVATAR_PRESETS.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setAvatarUrl(url)}
                    className={`rounded-full p-0.5 border-2 cursor-pointer ${
                      avatarUrl === url ? 'border-[#1B3B2B] dark:border-[#6EE7B7]' : 'border-transparent'
                    }`}
                  >
                    <img src={url} alt="Preset portrait" className="w-8 h-8 rounded-full object-cover" />
                  </button>
                ))}
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DEDAD0] dark:border-[#2C312E] hover:border-[#1B3B2B] text-xs font-medium cursor-pointer ml-1">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingAvatar ? 'Uploading...' : 'Upload photo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={uploadingAvatar}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingAvatar(true);
                      try {
                        const publicUrl = await uploadUserAvatar(file);
                        setAvatarUrl(publicUrl);
                        showToast('Profile photo uploaded. Click Save profile to apply.', 'success');
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
                      } finally {
                        setUploadingAvatar(false);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-xs text-[#646D67] hover:underline ml-1 cursor-pointer"
                >
                  Use initials
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Full name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Email address</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Job title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Department</label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Time zone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
            >
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Chicago">America/Chicago (CST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Europe/Berlin">Europe/Berlin (CET)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Short biography</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
            />
          </div>

          <button type="submit" className="px-5 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer">
            Save profile
          </button>
        </form>
      )}

      {tab === 'account' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Email Verification Status</div>
              <div className="text-xs text-[#646D67]">{user?.email}</div>
            </div>
            {user?.email_verified ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                <CheckCircle2 className="w-4 h-4" /> Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await apiFetch<{ ok?: boolean; sent?: boolean }>('/api/auth/verify-email', {
                      method: 'POST',
                      body: JSON.stringify({ email: user?.email }),
                    });
                    await refreshAccount();
                    showToast(
                      res.sent ? 'Verification link sent to your email' : 'Email verified',
                      'success',
                    );
                  } catch (err) {
                    showToast(err instanceof ApiError ? err.message : 'Verification request failed', 'error');
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
              >
                Verify email now
              </button>
            )}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiFetch('/api/account/change-password', {
                  method: 'POST',
                  body: JSON.stringify({ current_password: curPass, new_password: newPass, confirm_password: confPass }),
                });
                setCurPass('');
                setNewPass('');
                setConfPass('');
                showToast('Password updated', 'success');
              } catch (err) {
                showToast(err instanceof ApiError ? err.message : 'Failed to change password', 'error');
              }
            }}
            className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4"
          >
            <h2 className="text-sm font-semibold">Change Password</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="password"
                required
                value={curPass}
                onChange={(e) => setCurPass(e.target.value)}
                placeholder="Current password"
                className="px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="New password (8+ chars)"
                className="px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
              <input
                type="password"
                required
                minLength={8}
                value={confPass}
                onChange={(e) => setConfPass(e.target.value)}
                placeholder="Confirm new password"
                className="px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer">
              Update password
            </button>
          </form>

          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Active Sessions ({sessions.length})</h2>
              {supabase && (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase?.auth.signOut({ scope: 'others' });
                    showToast('Signed out of all other devices', 'success');
                  }}
                  className="text-xs font-medium text-[#1B3B2B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
                >
                  Sign out other devices
                </button>
              )}
            </div>
            {sessions.map((s) => (
              <div key={s.id} className="py-2 flex items-center justify-between border-t border-[#F0EDE5] dark:border-[#242926] text-xs">
                <div>
                  <div className="font-medium truncate max-w-md">
                    {s.is_current ? 'Current session · ' : ''}{s.user_agent || 'Web browser'}
                  </div>
                  <div className="text-[#7D8580]">Last active {formatRelativeTime(s.last_active_at)}</div>
                </div>
                {!s.is_current && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/account/sessions/${s.id}`, { method: 'DELETE' });
                      setSessions((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                    className="text-[#B91C1C] hover:underline cursor-pointer"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#FECACA] dark:border-[#5C2323] p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#B91C1C] dark:text-[#FCA5A5] text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" /> Delete Account
            </div>
            <p className="text-xs text-[#646D67]">Deactivate your account and sign out of all sessions.</p>
            {confirmDeleteAccount ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/api/account', { method: 'DELETE' });
                    await logout();
                  }}
                  className="px-4 py-2 rounded-lg bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm permanent account deletion
                </button>
                <button type="button" onClick={() => setConfirmDeleteAccount(false)} className="px-3 py-2 text-xs cursor-pointer">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAccount(true)}
                className="px-4 py-2 rounded-lg border border-[#FECACA] text-[#B91C1C] text-xs font-semibold cursor-pointer"
              >
                Delete account
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'workspace' && activeWorkspace && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await apiFetch(`/api/workspaces/${activeWorkspace.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ name: wsName, description: wsDesc, logo_color: wsColor }),
                });
                await refreshWorkspaces();
                showToast('Workspace settings saved', 'success');
              } catch (err) {
                showToast(err instanceof ApiError ? err.message : 'Update failed', 'error');
              }
            }}
            className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4"
          >
            <h2 className="text-sm font-semibold">Workspace Branding & Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Workspace name</label>
                <input
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Brand color</label>
                <input
                  type="color"
                  value={wsColor}
                  onChange={(e) => setWsColor(e.target.value)}
                  className="w-24 h-10 rounded cursor-pointer"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Description</label>
              <textarea
                rows={2}
                value={wsDesc}
                onChange={(e) => setWsDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              />
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer">
              Save workspace
            </button>
          </form>

          {activeWorkspace.role === 'owner' && (
            <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#FECACA] dark:border-[#5C2323] p-6 space-y-3">
              <div className="text-sm font-semibold text-[#B91C1C]">Delete Workspace</div>
              {confirmDeleteWs ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/workspaces/${activeWorkspace.id}`, { method: 'DELETE' });
                      setConfirmDeleteWs(false);
                      showToast('Workspace deleted', 'info');
                      await refreshWorkspaces();
                    }}
                    className="px-4 py-2 rounded-lg bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm delete "{activeWorkspace.name}"
                  </button>
                  <button type="button" onClick={() => setConfirmDeleteWs(false)} className="px-3 py-2 text-xs cursor-pointer">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteWs(true)}
                  className="px-4 py-2 rounded-lg border border-[#FECACA] text-[#B91C1C] text-xs font-semibold cursor-pointer"
                >
                  Delete workspace
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 divide-y divide-[#F0EDE5] dark:divide-[#242926]">
          {[
            { key: 'notify_assignments', label: 'Task assignments', desc: 'Notify me when a task is assigned to me' },
            { key: 'notify_mentions', label: '@Mentions', desc: 'Notify me when someone mentions me in a comment' },
            { key: 'notify_comments', label: 'Task comments', desc: 'Notify me on replies to tasks I collaborate on' },
            { key: 'notify_deadlines', label: 'Upcoming deadlines', desc: 'Remind me when assigned tasks are due today or overdue' },
            { key: 'notify_updates', label: 'Project updates', desc: 'Notify me when project status or membership changes' },
          ].map((item) => {
            const checked = Boolean((preferences as unknown as Record<string, unknown>)?.[item.key]);
            return (
              <label key={item.key} className="py-4 flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs text-[#646D67]">{item.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleNotifPref(item.key, e.target.checked)}
                  className="w-4 h-4 accent-[#1B3B2B]"
                />
              </label>
            );
          })}
        </div>
      )}

      {tab === 'appearance' && (
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Theme Mode</div>
            <div className="flex gap-3">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setThemeMode(m)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                    theme === m
                      ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                      : 'bg-[#FAF9F6] dark:bg-[#121514] border-[#DEDAD0] dark:border-[#2C312E]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#ECE9E0] dark:border-[#242926]">
            <div>
              <label className="block text-xs font-semibold mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Español</option>
                <option value="fr-FR">Français</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Date Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              >
                <option value="MMM d, yyyy">Nov 22, 2026</option>
                <option value="dd/MM/yyyy">22/11/2026</option>
                <option value="yyyy-MM-dd">2026-11-22</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Time Format</label>
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              >
                <option value="12h">12-hour (3:25 PM)</option>
                <option value="24h">24-hour (15:25)</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await apiFetch('/api/account/preferences', {
                method: 'PATCH',
                body: JSON.stringify({ language, date_format: dateFormat, time_format: timeFormat }),
              });
              await refreshAccount();
              showToast('Regional settings saved', 'success');
            }}
            className="px-4 py-2 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
          >
            Save regional preferences
          </button>
        </div>
      )}

      {tab === 'time' && (
        <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="w-4 h-4 text-[#1B3B2B] dark:text-[#6EE7B7]" />
            <span>Personal & Team Time Logs</span>
          </div>
          <div className="divide-y divide-[#F0EDE5] dark:divide-[#242926]">
            {timeEntries.map((te) => (
              <div key={te.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold">{te.task_title}</div>
                  <div className="text-[#646D67]">
                    {te.project_name} · {te.user_name} · {te.description}
                  </div>
                </div>
                <span className="font-mono-num font-semibold">{formatDuration(te.duration_seconds)}</span>
              </div>
            ))}
            {timeEntries.length === 0 && <div className="py-6 text-xs text-[#7D8580]">No time entries logged yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
};
