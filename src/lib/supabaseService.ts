import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type {
  ActivityLog,
  Attachment,
  BoardColumn,
  Checklist,
  ChecklistItem,
  CommentReaction,
  DependencyType,
  NotificationItem,
  PriorityLevel,
  Project,
  ProjectDiscussion,
  ProjectMember,
  ProjectMilestone,
  ProjectTemplate,
  SessionInfo,
  Subtask,
  Task,
  TaskAssignee,
  TaskComment,
  TaskDetail,
  TaskStatus,
  TimeEntry,
  User,
  UserPreferences,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from '../types/trellas';
import {
  localGetAttachmentSignedUrl,
  localTriggerAttachmentDownload,
  localUploadUserAvatar,
} from './localWorkspaceService';
import { isSupabaseConfigured, STORAGE_BUCKETS, supabase } from './supabase';

export class SupabaseApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const ALLOWED_FILE_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.svg', '.webp', '.zip', '.txt', '.csv', '.md',
]);
const EXT_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
};
const ALLOWED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function resolveUploadMimeType(file: File, ext: string): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  return EXT_MIME_MAP[ext] || 'text/plain';
}

function requireClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new SupabaseApiError('Supabase is not configured in this environment.', 503);
  }
  return supabase;
}

function throwIfError(error: { message?: string; code?: string } | null, status = 400): void {
  if (!error) return;
  const code = error.code || '';
  const msg = (error.message || '').trim();
  if (code === '42501') {
    const lower = msg.toLowerCase();
    if (lower.includes('permission denied for')) {
      throw new SupabaseApiError(
        `Database permission error (${msg}). Please run the complete supabase/schema.sql script in your Supabase SQL Editor.`,
        403,
      );
    }
    if (lower.includes('"users"') || lower.includes('"user_preferences"')) {
      throw new SupabaseApiError(
        `Permission denied on user profile policy (${msg}). Please ensure supabase/schema.sql RLS policies are applied.`,
        403,
      );
    }
    throw new SupabaseApiError(
      msg ? `Permission denied by workspace access policy (${msg}).` : 'Permission denied by workspace access policy.',
      403,
    );
  }
  if (code === 'PGRST116') {
    throw new SupabaseApiError('Requested record was not found.', 404);
  }
  if (code === '23505') {
    throw new SupabaseApiError('A matching record already exists.', 409);
  }
  throw new SupabaseApiError(msg || 'Database request failed', status);
}

function asIntBool(val: unknown): number {
  if (typeof val === 'number') return val ? 1 : 0;
  return val ? 1 : 0;
}

function parseJsonArray<T = string>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    email: String(row.email || ''),
    full_name: String(row.full_name || 'User'),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    job_title: String(row.job_title || 'Team Member'),
    department: String(row.department || 'Product'),
    bio: String(row.bio || ''),
    timezone: String(row.timezone || 'America/Los_Angeles'),
    email_verified: asIntBool(row.email_verified),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

function mapPreferencesRow(row: Record<string, unknown>): UserPreferences {
  return {
    user_id: String(row.user_id),
    theme: (row.theme as UserPreferences['theme']) || 'light',
    language: String(row.language || 'en-US'),
    date_format: String(row.date_format || 'MMM d, yyyy'),
    time_format: String(row.time_format || '12h'),
    notify_assignments: asIntBool(row.notify_assignments),
    notify_mentions: asIntBool(row.notify_mentions),
    notify_comments: asIntBool(row.notify_comments),
    notify_deadlines: asIntBool(row.notify_deadlines),
    notify_updates: asIntBool(row.notify_updates),
    sidebar_collapsed: asIntBool(row.sidebar_collapsed),
    pinned_pages: parseJsonArray<string>(row.pinned_pages),
  };
}

function mapTemplateRow(row: Record<string, unknown>): ProjectTemplate {
  return {
    id: String(row.id),
    workspace_id: row.workspace_id ? String(row.workspace_id) : null,
    name: String(row.name),
    category: String(row.category),
    description: String(row.description),
    color: String(row.color || '#1B3B2B'),
    columns: parseJsonArray<ProjectTemplate['columns'][number]>(row.columns_json),
    sample_tasks: parseJsonArray<ProjectTemplate['sample_tasks'][number]>(row.sample_tasks_json),
    is_system: asIntBool(row.is_system),
    created_at: String(row.created_at),
  };
}

async function getCurrentSessionAndUser(): Promise<{ accessToken: string; authUser: SupabaseAuthUser }> {
  const client = requireClient();
  const { data: sessionData, error } = await client.auth.getSession();
  if (error || !sessionData.session) {
    throw new SupabaseApiError('Authentication required', 401);
  }
  return {
    accessToken: sessionData.session.access_token,
    authUser: sessionData.session.user,
  };
}

let adminProxyAvailabilityPromise: Promise<boolean> | null = null;

export async function isAdminProxyAvailable(): Promise<boolean> {
  if (!adminProxyAvailabilityPromise) {
    adminProxyAvailabilityPromise = (async () => {
      try {
        const res = await fetch('/api/supabase/status', { method: 'GET' });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          return false;
        }
        const data = (await res.json()) as { serverConfigured?: boolean };
        return Boolean(data?.serverConfigured);
      } catch {
        return false;
      }
    })();
  }
  return adminProxyAvailabilityPromise;
}

async function callAdminProxy<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const { accessToken } = await getCurrentSessionAndUser();
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.includes('application/json')) {
    throw new SupabaseApiError(
      'Supabase admin endpoint is unavailable in this static deployment.',
      res.status >= 400 ? res.status : 404,
    );
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }
  if (!res.ok) {
    throw new SupabaseApiError(String(parsed.error || `Request failed (${res.status})`), res.status);
  }
  return parsed as T;
}

export async function ensureSupabaseUserProfile(authUser: SupabaseAuthUser): Promise<{ user: User; preferences: UserPreferences }> {
  const client = requireClient();
  const uid = authUser.id;
  const now = new Date().toISOString();

  const { data: existingUserRow, error: userSelectErr } = await client
    .from('users')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  throwIfError(userSelectErr);
  let uRow = existingUserRow;

  if (!uRow) {
    const fullName = String(authUser.user_metadata?.full_name || (authUser.email || '').split('@')[0] || 'Trellas User');
    const inserted = await client
      .from('users')
      .upsert(
        {
          id: uid,
          email: (authUser.email || '').toLowerCase(),
          full_name: fullName,
          avatar_url: authUser.user_metadata?.avatar_url || null,
          email_verified: Boolean(authUser.email_confirmed_at),
          created_at: now,
          updated_at: now,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    throwIfError(inserted.error);
    uRow = inserted.data;
  } else if (Boolean(authUser.email_confirmed_at) && !uRow.email_verified) {
    const updated = await client
      .from('users')
      .update({ email_verified: true, updated_at: now })
      .eq('id', uid)
      .select('*')
      .single();
    throwIfError(updated.error);
    if (updated.data) uRow = updated.data;
  }

  const { data: existingPrefRow, error: prefSelectErr } = await client
    .from('user_preferences')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();
  throwIfError(prefSelectErr);
  let pRow = existingPrefRow;

  if (!pRow) {
    const insertedPref = await client
      .from('user_preferences')
      .upsert({ user_id: uid, updated_at: now }, { onConflict: 'user_id' })
      .select('*')
      .single();
    throwIfError(insertedPref.error);
    pRow = insertedPref.data;
  }

  return {
    user: mapUserRow(uRow as Record<string, unknown>),
    preferences: mapPreferencesRow(pRow as Record<string, unknown>),
  };
}

function isoDayOffsetLocal(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function runSupabaseOnboardingIfNeeded(options?: {
  workspace_name?: string;
  include_sample_data?: boolean;
  full_name?: string;
  force_create?: boolean;
}): Promise<void> {
  if (await isAdminProxyAvailable()) {
    try {
      await callAdminProxy('/api/supabase/onboarding', 'POST', options || {});
      return;
    } catch (err) {
      if (!(err instanceof SupabaseApiError) || (err.status !== 404 && err.status !== 503)) {
        throw err;
      }
    }
  }

  // Client-side RLS fallback when deployed statically or without service-role proxy
  const client = requireClient();
  const { authUser } = await getCurrentSessionAndUser();
  const uid = authUser.id;
  const email = (authUser.email || '').trim().toLowerCase();
  const now = new Date().toISOString();

  await ensureSupabaseUserProfile(authUser);

  if (email) {
    const { data: pendingInvs } = await client
      .from('workspace_invitations')
      .select('id, workspace_id, role')
      .ilike('email', email)
      .eq('status', 'pending');

    if (pendingInvs && pendingInvs.length > 0) {
      for (const inv of pendingInvs) {
        await client.from('workspace_members').upsert(
          {
            id: crypto.randomUUID(),
            workspace_id: inv.workspace_id,
            user_id: uid,
            role: inv.role,
            joined_at: now,
          },
          { onConflict: 'workspace_id,user_id', ignoreDuplicates: true },
        );
        await client.from('workspace_invitations').update({ status: 'accepted' }).eq('id', inv.id);
      }
    }
  }

  const { data: memberships, error: memErr } = await client
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', uid);
  throwIfError(memErr);

  if (memberships && memberships.length > 0 && !options?.force_create) {
    return;
  }

  const fullName =
    String(options?.full_name || authUser.user_metadata?.full_name || email.split('@')[0] || 'Trellas User').trim();
  const rawWsName = String(options?.workspace_name || authUser.user_metadata?.workspace_name || '').trim();
  const wsName = rawWsName || `${fullName.split(' ')[0]}'s Workspace`;
  const slugBase = wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const initials =
    wsName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'TR';
  const wsId = crypto.randomUUID();

  const { error: wsErr } = await client.from('workspaces').insert({
    id: wsId,
    name: wsName,
    slug: `${slugBase}-${wsId.slice(0, 4)}`,
    description: 'Workspace created during Trellas onboarding.',
    logo_color: '#1B3B2B',
    logo_initials: initials,
    owner_id: uid,
    plan: 'pro',
    created_at: now,
    updated_at: now,
  });
  throwIfError(wsErr);

  const { error: wmErr } = await client.from('workspace_members').insert({
    id: crypto.randomUUID(),
    workspace_id: wsId,
    user_id: uid,
    role: 'owner',
    joined_at: now,
  });
  throwIfError(wmErr);

  const includeSample =
    options?.include_sample_data !== undefined
      ? Boolean(options.include_sample_data)
      : authUser.user_metadata?.include_sample_data !== false;

  if (includeSample) {
    const prjId = crypto.randomUUID();
    const boardId = crypto.randomUUID();
    await client.from('projects').insert({
      id: prjId,
      workspace_id: wsId,
      name: 'Getting Started Project',
      description: 'Your sample workspace project ready to customize, reorder, and expand.',
      color: '#1B3B2B',
      category: 'Onboarding',
      status: 'in_progress',
      priority: 'medium',
      owner_id: uid,
      manager_id: uid,
      start_date: isoDayOffsetLocal(0),
      due_date: isoDayOffsetLocal(14),
      is_pinned: true,
      is_demo: true,
      created_at: now,
      updated_at: now,
    });
    await client.from('project_members').insert({
      id: crypto.randomUUID(),
      project_id: prjId,
      user_id: uid,
      role: 'lead',
      added_at: now,
    });
    await client.from('boards').insert({ id: boardId, project_id: prjId, name: 'Main Board', created_at: now });

    const colDefs = [
      { name: 'Backlog', status_key: 'backlog', color: '#64748B' },
      { name: 'To Do', status_key: 'todo', color: '#3B82F6' },
      { name: 'In Progress', status_key: 'in_progress', color: '#C99A4E' },
      { name: 'In Review', status_key: 'in_review', color: '#8B5CF6' },
      { name: 'Completed', status_key: 'completed', color: '#16A34A' },
    ];
    const cols: Record<string, string> = {};
    const colInserts = colDefs.map((c, idx) => {
      const cid = crypto.randomUUID();
      cols[c.status_key] = cid;
      return { id: cid, board_id: boardId, name: c.name, position: idx, color: c.color, status_key: c.status_key, created_at: now };
    });
    await client.from('board_columns').insert(colInserts);

    const starterTasks = [
      {
        id: crypto.randomUUID(),
        title: 'Customize your workspace branding & invite teammates',
        status: 'todo',
        priority: 'high',
        due: 2,
      },
      {
        id: crypto.randomUUID(),
        title: 'Explore Kanban drag-and-drop, List, and Calendar views',
        status: 'in_progress',
        priority: 'medium',
        due: 0,
      },
      {
        id: crypto.randomUUID(),
        title: 'Create your Trellas account',
        status: 'completed',
        priority: 'low',
        due: 0,
      },
    ];

    await client.from('tasks').insert(
      starterTasks.map((st) => ({
        id: st.id,
        workspace_id: wsId,
        project_id: prjId,
        board_id: boardId,
        column_id: cols[st.status],
        title: st.title,
        description: 'Sample starter task you can edit, reassign, or move across columns.',
        status: st.status,
        priority: st.priority,
        task_type: 'task',
        position: 0,
        start_date: isoDayOffsetLocal(0),
        due_date: isoDayOffsetLocal(st.due),
        estimated_minutes: 30,
        labels: ['Starter'],
        is_demo: true,
        created_by: uid,
        created_at: now,
        updated_at: now,
      })),
    );
    await client.from('task_assignees').insert(
      starterTasks.map((st) => ({
        id: crypto.randomUUID(),
        task_id: st.id,
        user_id: uid,
        is_primary: true,
        assigned_at: now,
      })),
    );
  }
}

export async function seedSupabaseDemoWorkspace(): Promise<{ usedAdmin: boolean }> {
  if (!(await isAdminProxyAvailable())) {
    return { usedAdmin: false };
  }
  const res = await fetch('/api/supabase/seed-demo', { method: 'POST' });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { usedAdmin: false };
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 404 || res.status === 503) {
    return { usedAdmin: false };
  }
  if (!res.ok) {
    throw new SupabaseApiError(data.error || 'Failed to prepare demo workspace', res.status);
  }
  return { usedAdmin: true };
}

function isoHourOffsetLocal(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export async function seedClientDemoWorkspaceForCurrentUser(authUser: SupabaseAuthUser): Promise<void> {
  const client = requireClient();
  const uid = authUser.id;
  const now = new Date().toISOString();

  await ensureSupabaseUserProfile(authUser);

  await client
    .from('users')
    .update({
      full_name: 'Maya Chen',
      avatar_url: '/src/assets/images/avatar_maya_chen_1795389987021.jpg',
      job_title: 'Head of Product Design',
      department: 'Design',
      bio: 'Designing calm, focused productivity software and leading design systems at Northstar Studio.',
      timezone: 'America/Los_Angeles',
      updated_at: now,
    })
    .eq('id', uid);

  const { data: existingMem } = await client
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', uid);

  if (existingMem && existingMem.length > 0) {
    return;
  }

  const wsNorthstarId = crypto.randomUUID();
  const wsPersonalId = crypto.randomUUID();

  const { error: wsErr } = await client.from('workspaces').insert([
    {
      id: wsNorthstarId,
      name: 'Northstar Studio',
      slug: `northstar-studio-${wsNorthstarId.slice(0, 4)}`,
      description: 'Primary product, design, and engineering studio workspace.',
      logo_color: '#1B3B2B',
      logo_initials: 'NS',
      owner_id: uid,
      plan: 'business',
      created_at: now,
      updated_at: now,
    },
    {
      id: wsPersonalId,
      name: 'Personal Focus',
      slug: `personal-focus-${wsPersonalId.slice(0, 4)}`,
      description: 'Maya personal planning and side-project sandbox.',
      logo_color: '#3B5998',
      logo_initials: 'PF',
      owner_id: uid,
      plan: 'pro',
      created_at: now,
      updated_at: now,
    },
  ]);
  throwIfError(wsErr);

  const { error: wmErr } = await client.from('workspace_members').insert([
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, user_id: uid, role: 'owner', joined_at: now },
    { id: crypto.randomUUID(), workspace_id: wsPersonalId, user_id: uid, role: 'owner', joined_at: now },
  ]);
  throwIfError(wmErr);

  const projDefs = [
    {
      key: 'website',
      id: crypto.randomUUID(),
      workspace_id: wsNorthstarId,
      name: 'Website Redesign',
      description: 'Complete marketing site relaunch with calm editorial typography, updated pricing, and interactive product tours.',
      color: '#1B3B2B',
      category: 'Design & Web',
      status: 'in_progress',
      priority: 'urgent',
      start_date: isoDayOffsetLocal(-18),
      due_date: isoDayOffsetLocal(12),
      is_pinned: true,
    },
    {
      key: 'mobile',
      id: crypto.randomUUID(),
      workspace_id: wsNorthstarId,
      name: 'Mobile Application Development',
      description: 'Native iOS and Android companion app supporting offline task capture, push alerts, and quick board triage.',
      color: '#2563EB',
      category: 'Engineering',
      status: 'in_progress',
      priority: 'high',
      start_date: isoDayOffsetLocal(-25),
      due_date: isoDayOffsetLocal(28),
      is_pinned: true,
    },
    {
      key: 'marketing',
      id: crypto.randomUUID(),
      workspace_id: wsNorthstarId,
      name: 'Marketing Campaign',
      description: 'Q4 customer acquisition push across organic editorial, partner webinars, and lifecycle onboarding emails.',
      color: '#7C3AED',
      category: 'Marketing',
      status: 'in_progress',
      priority: 'high',
      start_date: isoDayOffsetLocal(-10),
      due_date: isoDayOffsetLocal(18),
      is_pinned: false,
    },
    {
      key: 'launch',
      id: crypto.randomUUID(),
      workspace_id: wsNorthstarId,
      name: 'Product Launch',
      description: 'Coordinated v2.4 workspace release across customer docs, changelog announcements, and beta migration.',
      color: '#C99A4E',
      category: 'Product',
      status: 'planning',
      priority: 'medium',
      start_date: isoDayOffsetLocal(-4),
      due_date: isoDayOffsetLocal(35),
      is_pinned: false,
    },
    {
      key: 'ops',
      id: crypto.randomUUID(),
      workspace_id: wsNorthstarId,
      name: 'Business Operations',
      description: 'SOC2 readiness documentation, quarterly vendor audits, and new-hire workspace onboarding playbooks.',
      color: '#0F766E',
      category: 'Operations',
      status: 'completed',
      priority: 'low',
      start_date: isoDayOffsetLocal(-45),
      due_date: isoDayOffsetLocal(-3),
      is_pinned: false,
    },
    {
      key: 'personal',
      id: crypto.randomUUID(),
      workspace_id: wsPersonalId,
      name: 'Q4 Reading & Deep Work',
      description: 'Personal research notes, design book highlights, and weekly reflection routines.',
      color: '#1B3B2B',
      category: 'Personal',
      status: 'in_progress',
      priority: 'medium',
      start_date: isoDayOffsetLocal(-7),
      due_date: isoDayOffsetLocal(21),
      is_pinned: true,
    },
  ];

  const projByKey = new Map(projDefs.map((p) => [p.key, p]));

  const { error: prjErr } = await client.from('projects').insert(
    projDefs.map((p) => ({
      id: p.id,
      workspace_id: p.workspace_id,
      name: p.name,
      description: p.description,
      color: p.color,
      category: p.category,
      status: p.status,
      priority: p.priority,
      owner_id: uid,
      manager_id: uid,
      start_date: p.start_date,
      due_date: p.due_date,
      is_pinned: p.is_pinned,
      is_archived: false,
      is_demo: true,
      created_at: now,
      updated_at: now,
    })),
  );
  throwIfError(prjErr);

  const defaultCols = [
    { name: 'Backlog', pos: 0, color: '#64748B', status_key: 'backlog' },
    { name: 'To Do', pos: 1, color: '#3B82F6', status_key: 'todo' },
    { name: 'In Progress', pos: 2, color: '#C99A4E', status_key: 'in_progress' },
    { name: 'In Review', pos: 3, color: '#8B5CF6', status_key: 'in_review' },
    { name: 'Completed', pos: 4, color: '#16A34A', status_key: 'completed' },
  ];

  const boardsRows: Array<Record<string, unknown>> = [];
  const colRows: Array<Record<string, unknown>> = [];
  const pmRows: Array<Record<string, unknown>> = [];
  const boardByProj = new Map<string, string>();
  const colLookup = new Map<string, Record<string, string>>();

  for (const p of projDefs) {
    const boardId = crypto.randomUUID();
    boardByProj.set(p.id, boardId);
    boardsRows.push({ id: boardId, project_id: p.id, name: 'Main Board', created_at: now });
    const cols: Record<string, string> = {};
    for (const c of defaultCols) {
      const colId = crypto.randomUUID();
      cols[c.status_key] = colId;
      colRows.push({
        id: colId,
        board_id: boardId,
        name: c.name,
        position: c.pos,
        color: c.color,
        status_key: c.status_key,
        created_at: now,
      });
    }
    colLookup.set(p.id, cols);
    pmRows.push({ id: crypto.randomUUID(), project_id: p.id, user_id: uid, role: 'lead', added_at: now });
  }

  await client.from('boards').insert(boardsRows);
  await client.from('board_columns').insert(colRows);
  await client.from('project_members').insert(pmRows);

  const wProj = projByKey.get('website')!;
  const mProj = projByKey.get('mobile')!;
  const mkProj = projByKey.get('marketing')!;
  const lProj = projByKey.get('launch')!;
  const oProj = projByKey.get('ops')!;
  const pProj = projByKey.get('personal')!;

  await client.from('project_milestones').insert([
    { id: crypto.randomUUID(), project_id: wProj.id, title: 'Design System Freeze', description: 'Final sign-off on typography, color tokens, and landing components.', due_date: isoDayOffsetLocal(-3), completed: true, created_at: now },
    { id: crypto.randomUUID(), project_id: wProj.id, title: 'Public Website Cutover', description: 'DNS switch, redirects verified, and production smoke test.', due_date: isoDayOffsetLocal(12), completed: false, created_at: now },
    { id: crypto.randomUUID(), project_id: mProj.id, title: 'TestFlight Beta Release', description: 'Internal dogfooding build distributed to all team members.', due_date: isoDayOffsetLocal(9), completed: false, created_at: now },
    { id: crypto.randomUUID(), project_id: mkProj.id, title: 'Campaign Launch Day', description: 'Email sequences, landing pages, and social announcements live.', due_date: isoDayOffsetLocal(14), completed: false, created_at: now },
  ]);

  await client.from('project_discussions').insert([
    {
      id: crypto.randomUUID(),
      project_id: wProj.id,
      user_id: uid,
      title: 'Editorial typography & contrast verification',
      body: 'We settled on Fraunces for hero headlines paired with Plus Jakarta Sans for interface controls. Contrast ratios across both light ivory and dark charcoal modes pass 4.5:1.',
      created_at: isoHourOffsetLocal(-28),
      updated_at: isoHourOffsetLocal(-28),
    },
  ]);

  const demoTasks = [
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, title: 'Migrate blog content to the new CMS', description: 'Export 42 existing editorial posts, normalize frontmatter tags, and verify canonical image paths in the new CMS.', status: 'todo', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffsetLocal(-1), due_date: isoDayOffsetLocal(3), estimated_minutes: 180, labels: ['Content', 'CMS'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, title: 'QA pass on Safari and mobile', description: 'Test sticky navigation height, drawer transitions, and touch targets at 390px and 768px breakpoints.', status: 'todo', priority: 'high', task_type: 'bug', position: 1, start_date: isoDayOffsetLocal(-4), due_date: isoDayOffsetLocal(-1), estimated_minutes: 120, labels: ['Bug', 'QA'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, title: 'Build the responsive navigation', description: 'Implement collapsible mobile drawer, keyboard focus trap, and crisp single-line top bar contract.', status: 'in_progress', priority: 'urgent', task_type: 'feature', position: 0, start_date: isoDayOffsetLocal(-2), due_date: isoDayOffsetLocal(0), estimated_minutes: 240, labels: ['Engineering', 'UI'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, title: 'Set up the redirect map', description: 'Configure 301 redirect rules for legacy landing pages and verify zero 404 regressions.', status: 'in_progress', priority: 'low', task_type: 'task', position: 1, start_date: isoDayOffsetLocal(-1), due_date: isoDayOffsetLocal(2), estimated_minutes: 90, labels: ['Engineering', 'SEO'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, title: 'Wireframe homepage and pricing', description: 'Finalize hero interactive preview layout, pricing tier comparison table, and FAQ accordion copy.', status: 'in_review', priority: 'high', task_type: 'feature', position: 0, start_date: isoDayOffsetLocal(-5), due_date: isoDayOffsetLocal(0), estimated_minutes: 210, labels: ['Design'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, title: 'Audit Core Web Vitals & font loading', description: 'Preconnect Google Fonts, eliminate layout shift on hero card render, and verify <1.2s LCP.', status: 'completed', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffsetLocal(-8), due_date: isoDayOffsetLocal(-2), estimated_minutes: 120, labels: ['Performance'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: mProj.id, title: 'Implement offline task cache sync', description: 'Queue optimistic task status changes while offline and reconcile with server timestamps upon reconnect.', status: 'in_progress', priority: 'urgent', task_type: 'feature', position: 0, start_date: isoDayOffsetLocal(-3), due_date: isoDayOffsetLocal(0), estimated_minutes: 360, labels: ['Mobile', 'Sync'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: mProj.id, title: 'Design swipe-to-complete gesture interactions', description: 'Prototype tactile card swipe physics and haptic confirmation thresholds for iOS and Android.', status: 'in_review', priority: 'high', task_type: 'feature', position: 0, start_date: isoDayOffsetLocal(-6), due_date: isoDayOffsetLocal(-2), estimated_minutes: 180, labels: ['Design', 'Mobile'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: mkProj.id, title: 'Publish customer spotlight interview series', description: 'Edit and schedule 3 founder stories showing how small studios replaced 5 tools with Trellas.', status: 'in_progress', priority: 'high', task_type: 'story', position: 0, start_date: isoDayOffsetLocal(-2), due_date: isoDayOffsetLocal(1), estimated_minutes: 240, labels: ['Content', 'Campaign'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: lProj.id, title: 'Prepare v2.4 release notes & migration guide', description: 'Document new Gantt timeline dragging, bulk task actions, and workspace role permissions.', status: 'todo', priority: 'high', task_type: 'task', position: 0, start_date: isoDayOffsetLocal(2), due_date: isoDayOffsetLocal(8), estimated_minutes: 120, labels: ['Docs', 'Launch'] },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: oProj.id, title: 'Complete Q4 SaaS vendor cost review', description: 'Consolidate duplicate subscriptions and archive unused team seats.', status: 'completed', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffsetLocal(-20), due_date: isoDayOffsetLocal(-7), estimated_minutes: 120, labels: ['Finance'] },
    { id: crypto.randomUUID(), workspace_id: wsPersonalId, project_id: pProj.id, title: 'Summarize notes from Designing Calm Interfaces', description: 'Extract top 5 typography and spacing heuristics for next studio critique.', status: 'in_progress', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffsetLocal(0), due_date: isoDayOffsetLocal(3), estimated_minutes: 60, labels: ['Reading'] },
  ];

  await client.from('tasks').insert(
    demoTasks.map((t) => ({
      id: t.id,
      workspace_id: t.workspace_id,
      project_id: t.project_id,
      board_id: boardByProj.get(t.project_id)!,
      column_id: colLookup.get(t.project_id)![t.status],
      parent_task_id: null,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      task_type: t.task_type,
      position: t.position,
      start_date: t.start_date,
      due_date: t.due_date,
      estimated_minutes: t.estimated_minutes,
      labels: t.labels,
      is_demo: true,
      is_archived: false,
      created_by: uid,
      created_at: now,
      updated_at: now,
    })),
  );

  await client.from('task_assignees').insert(
    demoTasks.map((t) => ({
      id: crypto.randomUUID(),
      task_id: t.id,
      user_id: uid,
      is_primary: true,
      assigned_at: now,
    })),
  );

  const navTask = demoTasks[2];
  const wireframeTask = demoTasks[4];

  await client.from('subtasks').insert([
    { id: crypto.randomUUID(), task_id: navTask.id, title: 'Implement desktop mega-menu keyboard Escape handler', completed: true, assignee_id: uid, due_date: isoDayOffsetLocal(0), position: 0, created_at: now },
    { id: crypto.randomUUID(), task_id: navTask.id, title: 'Verify mobile slide-over drawer scroll lock', completed: true, assignee_id: uid, due_date: isoDayOffsetLocal(0), position: 1, created_at: now },
    { id: crypto.randomUUID(), task_id: navTask.id, title: 'Add reduced-motion transition fallback', completed: false, assignee_id: uid, due_date: isoDayOffsetLocal(0), position: 2, created_at: now },
    { id: crypto.randomUUID(), task_id: wireframeTask.id, title: 'Export updated hero preview snapshot', completed: true, assignee_id: uid, due_date: isoDayOffsetLocal(0), position: 0, created_at: now },
  ]);

  const chk1 = crypto.randomUUID();
  await client.from('checklists').insert([
    { id: chk1, task_id: navTask.id, title: 'Accessibility & Viewport Checks', position: 0, created_at: now },
  ]);
  await client.from('checklist_items').insert([
    { id: crypto.randomUUID(), checklist_id: chk1, text: '44px minimum touch target on mobile menu toggle', completed: true, position: 0, created_at: now },
    { id: crypto.randomUUID(), checklist_id: chk1, text: 'Visible focus-visible outline on all nav links', completed: true, position: 1, created_at: now },
    { id: crypto.randomUUID(), checklist_id: chk1, text: 'Zero horizontal overflow at 375px width', completed: false, position: 2, created_at: now },
  ]);

  await client.from('time_entries').insert([
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, task_id: navTask.id, user_id: uid, description: 'Implemented responsive navigation drawer', duration_seconds: 5400, started_at: isoHourOffsetLocal(-8), ended_at: isoHourOffsetLocal(-6), is_running: false, created_at: now },
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, task_id: wireframeTask.id, user_id: uid, description: 'Hero layout & pricing table refinement', duration_seconds: 4500, started_at: isoHourOffsetLocal(-14), ended_at: isoHourOffsetLocal(-12), is_running: false, created_at: now },
  ]);

  await client.from('notifications').insert([
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, user_id: uid, actor_id: uid, category: 'deadline', title: 'Task due today', message: '"Build the responsive navigation" is scheduled for today', link_type: 'task', link_id: navTask.id, is_read: false, created_at: isoHourOffsetLocal(-5) },
  ]);

  await client.from('activity_logs').insert([
    { id: crypto.randomUUID(), workspace_id: wsNorthstarId, project_id: wProj.id, task_id: navTask.id, user_id: uid, action: 'created_project', details: 'Initialized Northstar Studio demo workspace', created_at: isoHourOffsetLocal(-2) },
  ]);
}

export async function uploadUserAvatar(file: File): Promise<string> {
  if (!isSupabaseConfigured) {
    return localUploadUserAvatar(file);
  }
  const client = requireClient();
  const { authUser } = await getCurrentSessionAndUser();
  if (file.size > MAX_AVATAR_BYTES) {
    throw new SupabaseApiError('Avatar image must be 5 MB or smaller.', 400);
  }
  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '.png';
  const resolvedType = resolveUploadMimeType(file, ext);
  if (!ALLOWED_AVATAR_TYPES.has(resolvedType)) {
    throw new SupabaseApiError('Supported avatar formats: PNG, JPG, WebP, or SVG.', 400);
  }
  const objectPath = `${authUser.id}/${crypto.randomUUID()}${ext}`;
  const { error } = await client.storage.from(STORAGE_BUCKETS.AVATARS).upload(objectPath, file, {
    contentType: resolvedType,
    upsert: true,
  });
  if (error) {
    throw new SupabaseApiError(error.message || 'Avatar upload failed', 400);
  }
  const { data: pub } = client.storage.from(STORAGE_BUCKETS.AVATARS).getPublicUrl(objectPath);
  return pub.publicUrl;
}

export async function getAttachmentSignedUrl(attachmentId: string, downloadFileName?: string): Promise<string> {
  if (!isSupabaseConfigured) {
    return localGetAttachmentSignedUrl(attachmentId);
  }
  const client = requireClient();
  const { data: att, error } = await client
    .from('attachments')
    .select('stored_name, original_name')
    .eq('id', attachmentId)
    .single();
  throwIfError(error, 404);
  if (!att) throw new SupabaseApiError('Attachment not found.', 404);

  const opts = downloadFileName ? { download: downloadFileName } : undefined;
  const { data: signed, error: signErr } = await client.storage
    .from(STORAGE_BUCKETS.FILES)
    .createSignedUrl(String(att.stored_name), 3600, opts);

  if (signErr || !signed?.signedUrl) {
    throw new SupabaseApiError(signErr?.message || 'Unable to generate file download URL', 400);
  }
  return signed.signedUrl;
}

export async function triggerAttachmentDownload(attachment: Attachment): Promise<void> {
  if (!isSupabaseConfigured) {
    await localTriggerAttachmentDownload(attachment);
    return;
  }
  const url = await getAttachmentSignedUrl(attachment.id, attachment.original_name);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.original_name;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function logWorkspaceActivity(
  workspaceId: string,
  userId: string,
  action: string,
  details: string,
  projectId: string | null = null,
  taskId: string | null = null,
): Promise<void> {
  const client = requireClient();
  await client.from('activity_logs').insert({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    project_id: projectId,
    task_id: taskId,
    user_id: userId,
    action,
    details,
    created_at: new Date().toISOString(),
  });
}

async function sendNotification(
  workspaceId: string,
  userId: string,
  actorId: string | null,
  category: NotificationItem['category'],
  title: string,
  message: string,
  linkType: string | null = null,
  linkId: string | null = null,
): Promise<void> {
  if (actorId && actorId === userId) return;
  const client = requireClient();
  await client.from('notifications').insert({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    user_id: userId,
    actor_id: actorId,
    category,
    title,
    message,
    link_type: linkType,
    link_id: linkId,
    is_read: false,
    created_at: new Date().toISOString(),
  });
}

async function getHydratedTasks(
  workspaceId: string,
  opts: { projectId?: string; includeArchived?: boolean; onlyTrash?: boolean } = {},
): Promise<Task[]> {
  const client = requireClient();
  let query = client.from('tasks').select('*').eq('workspace_id', workspaceId);

  if (opts.onlyTrash) {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
    if (!opts.includeArchived) {
      query = query.eq('is_archived', false);
    }
  }
  if (opts.projectId) {
    query = query.eq('project_id', opts.projectId);
  }

  query = query.order('position', { ascending: true }).order('created_at', { ascending: false });
  const { data: taskRows, error } = await query;
  throwIfError(error);
  const rows = (taskRows || []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const taskIds = rows.map((r) => String(r.id));
  const projectIds = Array.from(new Set(rows.map((r) => String(r.project_id))));

  const [projRes, taRes, subRes, chkRes, cmtRes, attRes, teRes] = await Promise.all([
    client.from('projects').select('id, name, color').in('id', projectIds),
    client.from('task_assignees').select('task_id, user_id, is_primary').in('task_id', taskIds),
    client.from('subtasks').select('id, task_id, completed').in('task_id', taskIds),
    client.from('checklists').select('id, task_id').in('task_id', taskIds),
    client.from('comments').select('id, task_id').in('task_id', taskIds),
    client.from('attachments').select('id, task_id').in('task_id', taskIds),
    client.from('time_entries').select('task_id, duration_seconds').in('task_id', taskIds),
  ]);

  const assigneeRows = (taRes.data || []) as Array<Record<string, unknown>>;
  const userIds = Array.from(new Set(assigneeRows.map((a) => String(a.user_id))));
  const usersRes = userIds.length > 0 ? await client.from('users').select('id, full_name, avatar_url, job_title').in('id', userIds) : { data: [] };
  const userMap = new Map<string, Record<string, unknown>>();
  for (const u of (usersRes.data || []) as Array<Record<string, unknown>>) {
    userMap.set(String(u.id), u);
  }

  const checklistIds = ((chkRes.data || []) as Array<Record<string, unknown>>).map((c) => String(c.id));
  const chkItemsRes = checklistIds.length > 0 ? await client.from('checklist_items').select('checklist_id, completed').in('checklist_id', checklistIds) : { data: [] };
  const chkTaskMap = new Map<string, string>();
  for (const c of (chkRes.data || []) as Array<Record<string, unknown>>) {
    chkTaskMap.set(String(c.id), String(c.task_id));
  }

  const projMap = new Map<string, { name: string; color: string }>();
  for (const p of (projRes.data || []) as Array<Record<string, unknown>>) {
    projMap.set(String(p.id), { name: String(p.name), color: String(p.color || '#1B3B2B') });
  }

  const assigneesByTask = new Map<string, TaskAssignee[]>();
  for (const a of assigneeRows) {
    const u = userMap.get(String(a.user_id));
    if (!u) continue;
    const tid = String(a.task_id);
    const list = assigneesByTask.get(tid) || [];
    list.push({
      user_id: String(a.user_id),
      full_name: String(u.full_name),
      avatar_url: u.avatar_url ? String(u.avatar_url) : null,
      job_title: String(u.job_title || 'Team Member'),
      is_primary: asIntBool(a.is_primary),
    });
    assigneesByTask.set(tid, list);
  }

  const subTotals = new Map<string, { total: number; done: number }>();
  for (const s of (subRes.data || []) as Array<Record<string, unknown>>) {
    const tid = String(s.task_id);
    const cur = subTotals.get(tid) || { total: 0, done: 0 };
    cur.total += 1;
    if (s.completed) cur.done += 1;
    subTotals.set(tid, cur);
  }

  const chkTotals = new Map<string, { total: number; done: number }>();
  for (const ci of (chkItemsRes.data || []) as Array<Record<string, unknown>>) {
    const tid = chkTaskMap.get(String(ci.checklist_id));
    if (!tid) continue;
    const cur = chkTotals.get(tid) || { total: 0, done: 0 };
    cur.total += 1;
    if (ci.completed) cur.done += 1;
    chkTotals.set(tid, cur);
  }

  const commentCounts = new Map<string, number>();
  for (const c of (cmtRes.data || []) as Array<Record<string, unknown>>) {
    const tid = String(c.task_id);
    commentCounts.set(tid, (commentCounts.get(tid) || 0) + 1);
  }

  const attCounts = new Map<string, number>();
  for (const a of (attRes.data || []) as Array<Record<string, unknown>>) {
    const tid = String(a.task_id);
    attCounts.set(tid, (attCounts.get(tid) || 0) + 1);
  }

  const timeTotals = new Map<string, number>();
  for (const te of (teRes.data || []) as Array<Record<string, unknown>>) {
    const tid = String(te.task_id);
    timeTotals.set(tid, (timeTotals.get(tid) || 0) + Number(te.duration_seconds || 0));
  }

  return rows.map((r) => {
    const id = String(r.id);
    const proj = projMap.get(String(r.project_id));
    const sub = subTotals.get(id) || { total: 0, done: 0 };
    const chk = chkTotals.get(id) || { total: 0, done: 0 };
    return {
      id,
      workspace_id: String(r.workspace_id),
      project_id: String(r.project_id),
      project_name: proj?.name || '',
      project_color: proj?.color || '#1B3B2B',
      board_id: String(r.board_id),
      column_id: String(r.column_id),
      parent_task_id: r.parent_task_id ? String(r.parent_task_id) : null,
      title: String(r.title),
      description: String(r.description || ''),
      status: (r.status as TaskStatus) || 'todo',
      priority: (r.priority as PriorityLevel) || 'medium',
      task_type: (r.task_type as Task['task_type']) || 'task',
      position: Number(r.position || 0),
      start_date: r.start_date ? String(r.start_date) : null,
      due_date: r.due_date ? String(r.due_date) : null,
      estimated_minutes: Number(r.estimated_minutes || 0),
      actual_seconds: timeTotals.get(id) || 0,
      labels: parseJsonArray<string>(r.labels),
      is_demo: asIntBool(r.is_demo),
      is_archived: asIntBool(r.is_archived),
      deleted_at: r.deleted_at ? String(r.deleted_at) : null,
      created_by: String(r.created_by),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      assignees: assigneesByTask.get(id) || [],
      comment_count: commentCounts.get(id) || 0,
      attachment_count: attCounts.get(id) || 0,
      subtask_total: sub.total,
      subtask_completed: sub.done,
      checklist_total: chk.total,
      checklist_completed: chk.done,
    };
  });
}

async function getHydratedProjects(
  workspaceId: string,
  opts: { includeArchived?: boolean; onlyTrash?: boolean } = {},
): Promise<Project[]> {
  const client = requireClient();
  let query = client.from('projects').select('*').eq('workspace_id', workspaceId);
  if (opts.onlyTrash) {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
    query = query.eq('is_archived', Boolean(opts.includeArchived));
  }
  query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });

  const { data: rows, error } = await query;
  throwIfError(error);
  const projectRows = (rows || []) as Array<Record<string, unknown>>;
  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => String(p.id));
  const managerIds = Array.from(new Set(projectRows.map((p) => String(p.manager_id))));

  const [mgrRes, boardsRes, tasksRes, pmRes] = await Promise.all([
    client.from('users').select('id, full_name, avatar_url').in('id', managerIds),
    client.from('boards').select('id, project_id').in('project_id', projectIds),
    client.from('tasks').select('id, project_id, status').in('project_id', projectIds).is('deleted_at', null),
    client.from('project_members').select('id, project_id, user_id, role').in('project_id', projectIds),
  ]);

  const pmRows = (pmRes.data || []) as Array<Record<string, unknown>>;
  const pmUserIds = Array.from(new Set(pmRows.map((m) => String(m.user_id))));
  const pmUsersRes = pmUserIds.length > 0 ? await client.from('users').select('id, full_name, email, avatar_url, job_title').in('id', pmUserIds) : { data: [] };

  const mgrMap = new Map<string, Record<string, unknown>>();
  for (const u of (mgrRes.data || []) as Array<Record<string, unknown>>) {
    mgrMap.set(String(u.id), u);
  }
  const pmUserMap = new Map<string, Record<string, unknown>>();
  for (const u of (pmUsersRes.data || []) as Array<Record<string, unknown>>) {
    pmUserMap.set(String(u.id), u);
  }
  const boardMap = new Map<string, string>();
  for (const b of (boardsRes.data || []) as Array<Record<string, unknown>>) {
    if (!boardMap.has(String(b.project_id))) {
      boardMap.set(String(b.project_id), String(b.id));
    }
  }

  const taskStats = new Map<string, { total: number; done: number }>();
  for (const t of (tasksRes.data || []) as Array<Record<string, unknown>>) {
    const pid = String(t.project_id);
    const s = taskStats.get(pid) || { total: 0, done: 0 };
    s.total += 1;
    if (t.status === 'completed') s.done += 1;
    taskStats.set(pid, s);
  }

  const membersByProj = new Map<string, ProjectMember[]>();
  for (const pm of pmRows) {
    const u = pmUserMap.get(String(pm.user_id));
    if (!u) continue;
    const pid = String(pm.project_id);
    const list = membersByProj.get(pid) || [];
    list.push({
      id: String(pm.id),
      project_id: pid,
      user_id: String(pm.user_id),
      role: (pm.role as ProjectMember['role']) || 'member',
      full_name: String(u.full_name),
      email: String(u.email || ''),
      avatar_url: u.avatar_url ? String(u.avatar_url) : null,
      job_title: String(u.job_title || 'Team Member'),
    });
    membersByProj.set(pid, list);
  }

  return projectRows.map((p) => {
    const id = String(p.id);
    const mgr = mgrMap.get(String(p.manager_id));
    const stats = taskStats.get(id) || { total: 0, done: 0 };
    return {
      id,
      workspace_id: String(p.workspace_id),
      name: String(p.name),
      description: String(p.description || ''),
      color: String(p.color || '#1B3B2B'),
      category: String(p.category || 'Product'),
      status: (p.status as Project['status']) || 'in_progress',
      priority: (p.priority as PriorityLevel) || 'medium',
      owner_id: String(p.owner_id),
      manager_id: String(p.manager_id),
      manager_name: mgr ? String(mgr.full_name) : undefined,
      manager_avatar: mgr?.avatar_url ? String(mgr.avatar_url) : null,
      start_date: p.start_date ? String(p.start_date) : null,
      due_date: p.due_date ? String(p.due_date) : null,
      is_pinned: asIntBool(p.is_pinned),
      is_archived: asIntBool(p.is_archived),
      is_demo: asIntBool(p.is_demo),
      deleted_at: p.deleted_at ? String(p.deleted_at) : null,
      created_at: String(p.created_at),
      updated_at: String(p.updated_at),
      total_tasks: stats.total,
      completed_tasks: stats.done,
      progress_pct: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      board_id: boardMap.get(id),
      members: membersByProj.get(id) || [],
    };
  });
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export async function supabaseRequest<T = unknown>(rawUrl: string, options: RequestInit = {}): Promise<T> {
  const client = requireClient();
  const method = (options.method || 'GET').toUpperCase();
  const parsed = new URL(rawUrl, window.location.origin);
  const path = parsed.pathname;
  const query = parsed.searchParams;
  const body = parseBody(options.body);

  // ---------------------------------------------------------------------------
  // AUTH & ACCOUNT
  // ---------------------------------------------------------------------------
  if (path === '/api/auth/me' && method === 'GET') {
    const { authUser } = await getCurrentSessionAndUser();
    return (await ensureSupabaseUserProfile(authUser)) as unknown as T;
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    await client.auth.signOut();
    return { ok: true } as unknown as T;
  }

  if (path === '/api/auth/verify-email' && method === 'POST') {
    const { authUser } = await getCurrentSessionAndUser();
    if (!authUser.email) {
      throw new SupabaseApiError('Account email not available.', 400);
    }
    if (authUser.email_confirmed_at) {
      await client.from('users').update({ email_verified: true, updated_at: new Date().toISOString() }).eq('id', authUser.id);
      return { ok: true } as unknown as T;
    }
    const { error } = await client.auth.resend({ type: 'signup', email: authUser.email });
    if (error) throw new SupabaseApiError(error.message, 400);
    return { ok: true, sent: true } as unknown as T;
  }

  if (path === '/api/account/profile' && method === 'PATCH') {
    const { authUser } = await getCurrentSessionAndUser();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };
    if (body.full_name !== undefined) updates.full_name = String(body.full_name).trim();
    if (body.job_title !== undefined) updates.job_title = String(body.job_title).trim();
    if (body.department !== undefined) updates.department = String(body.department).trim();
    if (body.bio !== undefined) updates.bio = String(body.bio);
    if (body.timezone !== undefined) updates.timezone = String(body.timezone);
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url ? String(body.avatar_url) : null;

    const cleanEmail = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    if (cleanEmail && cleanEmail !== (authUser.email || '').toLowerCase()) {
      const { error: authEmailErr } = await client.auth.updateUser({ email: cleanEmail });
      if (authEmailErr) throw new SupabaseApiError(authEmailErr.message, 400);
      updates.email = cleanEmail;
    }

    if (updates.full_name || updates.avatar_url !== undefined) {
      await client.auth.updateUser({
        data: {
          ...(updates.full_name ? { full_name: updates.full_name } : {}),
          ...(updates.avatar_url !== undefined ? { avatar_url: updates.avatar_url } : {}),
        },
      });
    }

    const { data, error } = await client.from('users').update(updates).eq('id', authUser.id).select('*').single();
    throwIfError(error);
    return { user: mapUserRow(data as Record<string, unknown>) } as unknown as T;
  }

  if (path === '/api/account/preferences' && method === 'PATCH') {
    const { authUser } = await getCurrentSessionAndUser();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.theme !== undefined) updates.theme = body.theme;
    if (body.language !== undefined) updates.language = body.language;
    if (body.date_format !== undefined) updates.date_format = body.date_format;
    if (body.time_format !== undefined) updates.time_format = body.time_format;
    if (body.notify_assignments !== undefined) updates.notify_assignments = Boolean(body.notify_assignments);
    if (body.notify_mentions !== undefined) updates.notify_mentions = Boolean(body.notify_mentions);
    if (body.notify_comments !== undefined) updates.notify_comments = Boolean(body.notify_comments);
    if (body.notify_deadlines !== undefined) updates.notify_deadlines = Boolean(body.notify_deadlines);
    if (body.notify_updates !== undefined) updates.notify_updates = Boolean(body.notify_updates);
    if (body.sidebar_collapsed !== undefined) updates.sidebar_collapsed = Boolean(body.sidebar_collapsed);
    if (Array.isArray(body.pinned_pages)) updates.pinned_pages = body.pinned_pages;

    const { data, error } = await client
      .from('user_preferences')
      .update(updates)
      .eq('user_id', authUser.id)
      .select('*')
      .single();
    throwIfError(error);
    return { preferences: mapPreferencesRow(data as Record<string, unknown>) } as unknown as T;
  }

  if (path === '/api/account/change-password' && method === 'POST') {
    const { authUser } = await getCurrentSessionAndUser();
    const curPass = String(body.current_password || '');
    const newPass = String(body.new_password || '');
    const confPass = String(body.confirm_password || '');
    if (newPass.length < 8) throw new SupabaseApiError('New password must be at least 8 characters.', 400);
    if (newPass !== confPass) throw new SupabaseApiError('Passwords do not match.', 400);
    if (authUser.email) {
      const reauth = await client.auth.signInWithPassword({ email: authUser.email, password: curPass });
      if (reauth.error) throw new SupabaseApiError('Current password is incorrect.', 400);
    }
    const { error } = await client.auth.updateUser({ password: newPass });
    if (error) throw new SupabaseApiError(error.message, 400);
    return { ok: true } as unknown as T;
  }

  if (path === '/api/account/sessions' && method === 'GET') {
    const { data } = await client.auth.getSession();
    const sess = data.session;
    const sessions: SessionInfo[] = sess
      ? [
          {
            id: 'current',
            user_agent: navigator.userAgent,
            ip_address: 'Active Supabase Session',
            created_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            expires_at: sess.expires_at ? new Date(sess.expires_at * 1000).toISOString() : new Date().toISOString(),
            is_current: true,
          },
        ]
      : [];
    return { sessions } as unknown as T;
  }

  if (path.startsWith('/api/account/sessions/') && method === 'DELETE') {
    await client.auth.signOut({ scope: 'others' });
    return { ok: true } as unknown as T;
  }

  if (path === '/api/account' && method === 'DELETE') {
    if (await isAdminProxyAvailable()) {
      try {
        await callAdminProxy('/api/supabase/account', 'DELETE');
        await client.auth.signOut();
        return { ok: true } as unknown as T;
      } catch (err) {
        if (!(err instanceof SupabaseApiError) || (err.status !== 404 && err.status !== 503)) {
          throw err;
        }
      }
    }
    const { authUser } = await getCurrentSessionAndUser();
    const now = new Date().toISOString();
    await client.from('workspaces').update({ deleted_at: now }).eq('owner_id', authUser.id).is('deleted_at', null);
    await client.from('workspace_members').delete().eq('user_id', authUser.id).neq('role', 'owner');
    await client.from('project_members').delete().eq('user_id', authUser.id);
    await client.auth.signOut();
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // WORKSPACES
  // ---------------------------------------------------------------------------
  if (path === '/api/workspaces' && method === 'GET') {
    const { authUser } = await getCurrentSessionAndUser();
    const { data: memRows, error: memErr } = await client
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', authUser.id);
    throwIfError(memErr);
    const memberships = (memRows || []) as Array<{ workspace_id: string; role: WorkspaceRole }>;
    if (memberships.length === 0) return { workspaces: [] } as unknown as T;

    const wsIds = memberships.map((m) => m.workspace_id);
    const roleMap = new Map(memberships.map((m) => [m.workspace_id, m.role]));

    const [wsRes, allMemRes, prjRes] = await Promise.all([
      client.from('workspaces').select('*').in('id', wsIds).is('deleted_at', null).order('created_at', { ascending: true }),
      client.from('workspace_members').select('workspace_id').in('workspace_id', wsIds),
      client.from('projects').select('workspace_id').in('workspace_id', wsIds).is('deleted_at', null),
    ]);
    throwIfError(wsRes.error);

    const memCountMap = new Map<string, number>();
    for (const m of (allMemRes.data || []) as Array<{ workspace_id: string }>) {
      memCountMap.set(m.workspace_id, (memCountMap.get(m.workspace_id) || 0) + 1);
    }
    const prjCountMap = new Map<string, number>();
    for (const p of (prjRes.data || []) as Array<{ workspace_id: string }>) {
      prjCountMap.set(p.workspace_id, (prjCountMap.get(p.workspace_id) || 0) + 1);
    }

    const workspaces: Workspace[] = ((wsRes.data || []) as Array<Record<string, unknown>>).map((w) => ({
      id: String(w.id),
      name: String(w.name),
      slug: String(w.slug),
      description: String(w.description || ''),
      logo_color: String(w.logo_color || '#1B3B2B'),
      logo_initials: String(w.logo_initials || 'TR'),
      owner_id: String(w.owner_id),
      plan: (w.plan as Workspace['plan']) || 'pro',
      role: roleMap.get(String(w.id)) || 'member',
      member_count: memCountMap.get(String(w.id)) || 1,
      project_count: prjCountMap.get(String(w.id)) || 0,
      created_at: String(w.created_at),
      updated_at: String(w.updated_at),
    }));
    return { workspaces } as unknown as T;
  }

  if (path === '/api/workspaces' && method === 'POST') {
    const { authUser } = await getCurrentSessionAndUser();
    const name = String(body.name || '').trim();
    if (!name) throw new SupabaseApiError('Workspace name is required.', 400);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${id.slice(0, 4)}`;
    const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'TR';

    const { data, error } = await client
      .from('workspaces')
      .insert({
        id,
        name,
        slug,
        description: String(body.description || ''),
        logo_color: String(body.logo_color || '#1B3B2B'),
        logo_initials: initials,
        owner_id: authUser.id,
        plan: String(body.plan || 'pro'),
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    throwIfError(error);

    const { error: mErr } = await client.from('workspace_members').insert({
      id: crypto.randomUUID(),
      workspace_id: id,
      user_id: authUser.id,
      role: 'owner',
      joined_at: now,
    });
    throwIfError(mErr);
    await logWorkspaceActivity(id, authUser.id, 'created_workspace', `Created workspace "${name}"`);

    return { workspace: { ...(data as Record<string, unknown>), role: 'owner' } } as unknown as T;
  }

  let match: RegExpMatchArray | null;

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)$/)) && method === 'PATCH') {
    const wsId = match[1];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      updates.name = name;
      updates.logo_initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'TR';
    }
    if (body.description !== undefined) updates.description = String(body.description);
    if (body.logo_color !== undefined) updates.logo_color = String(body.logo_color);
    const { data, error } = await client.from('workspaces').update(updates).eq('id', wsId).select('*').single();
    throwIfError(error);
    return { workspace: data } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)$/)) && method === 'DELETE') {
    const wsId = match[1];
    const { error } = await client.from('workspaces').update({ deleted_at: new Date().toISOString() }).eq('id', wsId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // WORKSPACE MEMBERS & INVITATIONS
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/members$/)) && method === 'GET') {
    const wsId = match[1];
    const [wmRes, invRes, wsProjRes, tskRes] = await Promise.all([
      client.from('workspace_members').select('*').eq('workspace_id', wsId).order('joined_at', { ascending: true }),
      client.from('workspace_invitations').select('*').eq('workspace_id', wsId).eq('status', 'pending').order('created_at', { ascending: false }),
      client.from('projects').select('id').eq('workspace_id', wsId).is('deleted_at', null),
      client.from('tasks').select('id, status, estimated_minutes, workspace_id').eq('workspace_id', wsId).is('deleted_at', null),
    ]);
    throwIfError(wmRes.error);

    const wmRows = (wmRes.data || []) as Array<Record<string, unknown>>;
    const invRows = (invRes.data || []) as Array<Record<string, unknown>>;
    const wsProjIds = ((wsProjRes.data || []) as Array<{ id: string }>).map((p) => p.id);
    const pmRes = wsProjIds.length > 0
      ? await client.from('project_members').select('project_id, user_id').in('project_id', wsProjIds)
      : { data: [] };

    const allUserIds = Array.from(
      new Set([...wmRows.map((m) => String(m.user_id)), ...invRows.map((i) => String(i.invited_by))]),
    );
    const usersRes = allUserIds.length > 0 ? await client.from('users').select('*').in('id', allUserIds) : { data: [] };
    const userMap = new Map<string, Record<string, unknown>>();
    for (const u of (usersRes.data || []) as Array<Record<string, unknown>>) {
      userMap.set(String(u.id), u);
    }

    const wsTaskRows = (tskRes.data || []) as Array<Record<string, unknown>>;
    const wsTaskIds = wsTaskRows.map((t) => String(t.id));
    const taRes = wsTaskIds.length > 0 ? await client.from('task_assignees').select('task_id, user_id').in('task_id', wsTaskIds) : { data: [] };
    const taskMap = new Map(wsTaskRows.map((t) => [String(t.id), t]));
    const wsProjIdSet = new Set(wsProjIds);

    const members: WorkspaceMember[] = wmRows.map((m) => {
      const uid = String(m.user_id);
      const u = userMap.get(uid) || {};
      const assignedProjCount = ((pmRes.data || []) as Array<Record<string, unknown>>).filter(
        (pm) => String(pm.user_id) === uid && wsProjIdSet.has(String(pm.project_id)),
      ).length;
      const myTaskIds = ((taRes.data || []) as Array<Record<string, unknown>>)
        .filter((ta) => String(ta.user_id) === uid)
        .map((ta) => String(ta.task_id));
      let completedCount = 0;
      let workloadMins = 0;
      for (const tid of myTaskIds) {
        const t = taskMap.get(tid);
        if (!t) continue;
        if (t.status === 'completed') completedCount += 1;
        else workloadMins += Number(t.estimated_minutes || 0);
      }

      return {
        id: String(m.id),
        workspace_id: wsId,
        user_id: uid,
        role: (m.role as WorkspaceRole) || 'member',
        joined_at: String(m.joined_at),
        full_name: String(u.full_name || 'User'),
        email: String(u.email || ''),
        avatar_url: u.avatar_url ? String(u.avatar_url) : null,
        job_title: String(u.job_title || 'Team Member'),
        department: String(u.department || 'Product'),
        bio: String(u.bio || ''),
        assigned_projects_count: assignedProjCount,
        assigned_tasks_count: myTaskIds.length,
        completed_tasks_count: completedCount,
        active_workload_minutes: workloadMins,
      };
    });

    const invitations: WorkspaceInvitation[] = invRows.map((inv) => ({
      id: String(inv.id),
      workspace_id: wsId,
      email: String(inv.email),
      role: (inv.role as WorkspaceRole) || 'member',
      status: (inv.status as WorkspaceInvitation['status']) || 'pending',
      invited_by_name: String(userMap.get(String(inv.invited_by))?.full_name || 'Admin'),
      created_at: String(inv.created_at),
    }));

    return { members, invitations } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/invitations$/)) && method === 'POST') {
    const wsId = match[1];
    try {
      if (await isAdminProxyAvailable()) {
        return (await callAdminProxy(`/api/supabase/workspaces/${wsId}/invitations`, 'POST', body)) as T;
      }
      throw new SupabaseApiError('Admin proxy disabled', 503);
    } catch (err) {
      if (!(err instanceof SupabaseApiError) || (err.status !== 404 && err.status !== 503)) {
        throw err;
      }
      // Client-side RLS fallback when admin proxy endpoint is unavailable
      const { authUser } = await getCurrentSessionAndUser();
      const cleanEmail = String(body.email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new SupabaseApiError('Valid email is required.', 400);
      }
      const allowedRoles = ['admin', 'project_manager', 'member', 'guest'];
      const safeRole = allowedRoles.includes(String(body.role)) ? String(body.role) : 'member';
      const now = new Date().toISOString();
      const invId = crypto.randomUUID();
      const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await client.from('workspace_invitations').insert({
        id: invId,
        workspace_id: wsId,
        email: cleanEmail,
        role: safeRole,
        invited_by: authUser.id,
        status: 'pending',
        token: randomHex,
        created_at: now,
      });
      throwIfError(error);
      await logWorkspaceActivity(wsId, authUser.id, 'invited_member', `Invited ${cleanEmail} as ${safeRole}`);
      return { id: invId, status: 'invited' } as unknown as T;
    }
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/invitations\/([^/]+)$/)) && method === 'DELETE') {
    const [, wsId, invId] = match;
    const { error } = await client.from('workspace_invitations').update({ status: 'revoked' }).eq('id', invId).eq('workspace_id', wsId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/)) && method === 'PATCH') {
    const [, wsId, memberId] = match;
    const { data: existing } = await client.from('workspace_members').select('role').eq('id', memberId).eq('workspace_id', wsId).maybeSingle();
    if (existing?.role === 'owner') throw new SupabaseApiError('Cannot change workspace owner role.', 400);
    const { error } = await client.from('workspace_members').update({ role: String(body.role) }).eq('id', memberId).eq('workspace_id', wsId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/)) && method === 'DELETE') {
    const [, wsId, memberId] = match;
    const { data: existing } = await client.from('workspace_members').select('role').eq('id', memberId).eq('workspace_id', wsId).maybeSingle();
    if (existing?.role === 'owner') throw new SupabaseApiError('Cannot remove the workspace owner.', 400);
    const { error } = await client.from('workspace_members').delete().eq('id', memberId).eq('workspace_id', wsId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // PROJECTS
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/projects$/)) && method === 'GET') {
    const wsId = match[1];
    const projects = await getHydratedProjects(wsId, {
      includeArchived: query.get('archived') === '1',
      onlyTrash: query.get('trash') === '1',
    });
    return { projects } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/projects$/)) && method === 'POST') {
    const wsId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const uid = authUser.id;
    const name = String(body.name || '').trim();
    if (!name) throw new SupabaseApiError('Project name is required.', 400);

    const now = new Date().toISOString();
    const prjId = crypto.randomUUID();
    const boardId = crypto.randomUUID();

    let columnsDef: Array<{ name: string; status_key: TaskStatus; color: string }> = [
      { name: 'Backlog', status_key: 'backlog', color: '#64748B' },
      { name: 'To Do', status_key: 'todo', color: '#3B82F6' },
      { name: 'In Progress', status_key: 'in_progress', color: '#C99A4E' },
      { name: 'In Review', status_key: 'in_review', color: '#8B5CF6' },
      { name: 'Completed', status_key: 'completed', color: '#16A34A' },
    ];
    let sampleTasks: ProjectTemplate['sample_tasks'] = [];
    let color = String(body.color || '#1B3B2B');

    if (body.template_id) {
      const { data: tplRow } = await client.from('project_templates').select('*').eq('id', String(body.template_id)).maybeSingle();
      if (tplRow) {
        const tpl = mapTemplateRow(tplRow as Record<string, unknown>);
        if (tpl.columns.length > 0) columnsDef = tpl.columns;
        sampleTasks = tpl.sample_tasks;
        if (!body.color) color = tpl.color;
      }
    }

    const managerId = String(body.manager_id || uid);
    const { error: prjErr } = await client.from('projects').insert({
      id: prjId,
      workspace_id: wsId,
      name,
      description: String(body.description || ''),
      color,
      category: String(body.category || 'Product'),
      status: String(body.status || 'planning'),
      priority: String(body.priority || 'medium'),
      owner_id: uid,
      manager_id: managerId,
      start_date: body.start_date ? String(body.start_date) : null,
      due_date: body.due_date ? String(body.due_date) : null,
      is_pinned: Boolean(body.is_pinned),
      is_archived: false,
      is_demo: false,
      created_at: now,
      updated_at: now,
    });
    throwIfError(prjErr);

    const memberIds = Array.isArray(body.member_ids) && body.member_ids.length > 0
      ? Array.from(new Set([uid, managerId, ...(body.member_ids as string[])]))
      : [uid, ...(managerId !== uid ? [managerId] : [])];

    await client.from('project_members').insert(
      memberIds.map((mId) => ({
        id: crypto.randomUUID(),
        project_id: prjId,
        user_id: mId,
        role: mId === managerId ? 'lead' : 'member',
        added_at: now,
      })),
    );

    await client.from('boards').insert({ id: boardId, project_id: prjId, name: 'Main Board', created_at: now });

    const colLookup: Record<string, string> = {};
    const colRows = columnsDef.map((c, idx) => {
      const cid = crypto.randomUUID();
      if (!colLookup[c.status_key]) colLookup[c.status_key] = cid;
      return { id: cid, board_id: boardId, name: c.name, position: idx, color: c.color, status_key: c.status_key, created_at: now };
    });
    await client.from('board_columns').insert(colRows);
    const fallbackColId = colRows[0]?.id;

    if (sampleTasks.length > 0 && fallbackColId) {
      await client.from('tasks').insert(
        sampleTasks.map((st, idx) => ({
          id: crypto.randomUUID(),
          workspace_id: wsId,
          project_id: prjId,
          board_id: boardId,
          column_id: colLookup[st.status_key] || fallbackColId,
          title: st.title,
          description: '',
          status: st.status_key,
          priority: st.priority || 'medium',
          task_type: 'task',
          position: idx,
          estimated_minutes: st.estimated_minutes || 60,
          labels: st.labels || [],
          is_demo: false,
          is_archived: false,
          created_by: uid,
          created_at: now,
          updated_at: now,
        })),
      );
    }

    await logWorkspaceActivity(wsId, uid, 'created_project', `Created project "${name}"`, prjId);
    return { id: prjId } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)$/)) && method === 'GET') {
    const prjId = match[1];
    const { data: pRow, error } = await client.from('projects').select('*').eq('id', prjId).single();
    throwIfError(error, 404);
    const wsId = String(pRow.workspace_id);

    const [hydratedList, boardRes, msRes, discRes, tasks] = await Promise.all([
      getHydratedProjects(wsId, { includeArchived: Boolean(pRow.is_archived) }),
      client.from('boards').select('*').eq('project_id', prjId).limit(1).maybeSingle(),
      client.from('project_milestones').select('*').eq('project_id', prjId).order('due_date', { ascending: true }),
      client.from('project_discussions').select('*').eq('project_id', prjId).order('created_at', { ascending: false }),
      getHydratedTasks(wsId, { projectId: prjId, includeArchived: Boolean(pRow.is_archived) }),
    ]);

    const project = hydratedList.find((p) => p.id === prjId) || (pRow as unknown as Project);
    const board = boardRes.data;
    const colsRes = board
      ? await client.from('board_columns').select('*').eq('board_id', String(board.id)).order('position', { ascending: true })
      : { data: [] };

    const discRows = (discRes.data || []) as Array<Record<string, unknown>>;
    const discUserIds = Array.from(new Set(discRows.map((d) => String(d.user_id))));
    const discUsersRes = discUserIds.length > 0 ? await client.from('users').select('id, full_name, avatar_url').in('id', discUserIds) : { data: [] };
    const discUserMap = new Map(((discUsersRes.data || []) as Array<Record<string, unknown>>).map((u) => [String(u.id), u]));

    const discussions: ProjectDiscussion[] = discRows.map((d) => {
      const u = discUserMap.get(String(d.user_id));
      return {
        id: String(d.id),
        project_id: prjId,
        user_id: String(d.user_id),
        author_name: u ? String(u.full_name) : 'Member',
        author_avatar: u?.avatar_url ? String(u.avatar_url) : null,
        title: String(d.title),
        body: String(d.body),
        created_at: String(d.created_at),
      };
    });

    const milestones: ProjectMilestone[] = ((msRes.data || []) as Array<Record<string, unknown>>).map((m) => ({
      id: String(m.id),
      project_id: prjId,
      title: String(m.title),
      description: String(m.description || ''),
      due_date: String(m.due_date),
      completed: asIntBool(m.completed),
      created_at: String(m.created_at),
    }));

    const columns: BoardColumn[] = ((colsRes.data || []) as Array<Record<string, unknown>>).map((c) => ({
      id: String(c.id),
      board_id: String(c.board_id),
      name: String(c.name),
      position: Number(c.position || 0),
      color: String(c.color || '#64748B'),
      status_key: (c.status_key as TaskStatus) || 'todo',
    }));

    return {
      project,
      board: board || null,
      columns,
      tasks,
      milestones,
      discussions,
      members: project.members || [],
    } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)$/)) && method === 'PATCH') {
    const prjId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = String(body.description);
    if (body.color !== undefined) updates.color = String(body.color);
    if (body.category !== undefined) updates.category = String(body.category);
    if (body.status !== undefined) updates.status = String(body.status);
    if (body.priority !== undefined) updates.priority = String(body.priority);
    if (body.manager_id !== undefined) updates.manager_id = String(body.manager_id);
    if (body.start_date !== undefined) updates.start_date = body.start_date ? String(body.start_date) : null;
    if (body.due_date !== undefined) updates.due_date = body.due_date ? String(body.due_date) : null;
    if (body.is_pinned !== undefined) updates.is_pinned = Boolean(body.is_pinned);
    if (body.is_archived !== undefined) updates.is_archived = Boolean(body.is_archived);

    const { data, error } = await client.from('projects').update(updates).eq('id', prjId).select('*').single();
    throwIfError(error);

    if (Array.isArray(body.member_ids)) {
      await client.from('project_members').delete().eq('project_id', prjId);
      const ids = Array.from(new Set(body.member_ids as string[]));
      if (ids.length > 0) {
        await client.from('project_members').insert(
          ids.map((mId) => ({
            id: crypto.randomUUID(),
            project_id: prjId,
            user_id: mId,
            role: mId === data.manager_id ? 'lead' : 'member',
            added_at: now,
          })),
        );
      }
    }

    await logWorkspaceActivity(String(data.workspace_id), authUser.id, 'updated_project', `Updated project "${data.name}"`, prjId);
    return { project: data } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)$/)) && method === 'DELETE') {
    const prjId = match[1];
    if (query.get('permanent') === '1') {
      const { error } = await client.from('projects').delete().eq('id', prjId);
      throwIfError(error);
    } else {
      const now = new Date().toISOString();
      const { error } = await client.from('projects').update({ deleted_at: now, updated_at: now }).eq('id', prjId);
      throwIfError(error);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)\/restore$/)) && method === 'POST') {
    const prjId = match[1];
    const { error } = await client
      .from('projects')
      .update({ deleted_at: null, is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', prjId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)\/duplicate$/)) && method === 'POST') {
    const prjId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const { data: src, error } = await client.from('projects').select('*').eq('id', prjId).single();
    throwIfError(error, 404);
    const now = new Date().toISOString();
    const newProjId = crypto.randomUUID();
    const newBoardId = crypto.randomUUID();

    await client.from('projects').insert({
      id: newProjId,
      workspace_id: src.workspace_id,
      name: `${src.name} (Copy)`,
      description: src.description,
      color: src.color,
      category: src.category,
      status: 'planning',
      priority: src.priority,
      owner_id: authUser.id,
      manager_id: src.manager_id,
      start_date: src.start_date,
      due_date: src.due_date,
      is_pinned: false,
      is_archived: false,
      is_demo: false,
      created_at: now,
      updated_at: now,
    });
    await client.from('boards').insert({ id: newBoardId, project_id: newProjId, name: 'Main Board', created_at: now });

    const { data: srcBoard } = await client.from('boards').select('id').eq('project_id', prjId).limit(1).maybeSingle();
    const colMap = new Map<string, string>();
    if (srcBoard) {
      const { data: cols } = await client.from('board_columns').select('*').eq('board_id', srcBoard.id).order('position');
      for (const c of (cols || []) as Array<Record<string, unknown>>) {
        const newCid = crypto.randomUUID();
        colMap.set(String(c.id), newCid);
        await client.from('board_columns').insert({
          id: newCid,
          board_id: newBoardId,
          name: c.name,
          position: c.position,
          color: c.color,
          status_key: c.status_key,
          created_at: now,
        });
      }
    }

    const { data: srcMembers } = await client.from('project_members').select('user_id, role').eq('project_id', prjId);
    if (srcMembers && srcMembers.length > 0) {
      await client.from('project_members').insert(
        srcMembers.map((m) => ({
          id: crypto.randomUUID(),
          project_id: newProjId,
          user_id: m.user_id,
          role: m.role,
          added_at: now,
        })),
      );
    }

    const { data: srcTasks } = await client.from('tasks').select('*').eq('project_id', prjId).is('deleted_at', null);
    for (const t of (srcTasks || []) as Array<Record<string, unknown>>) {
      const targetCol = colMap.get(String(t.column_id));
      if (!targetCol) continue;
      await client.from('tasks').insert({
        id: crypto.randomUUID(),
        workspace_id: src.workspace_id,
        project_id: newProjId,
        board_id: newBoardId,
        column_id: targetCol,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        task_type: t.task_type,
        position: t.position,
        start_date: t.start_date,
        due_date: t.due_date,
        estimated_minutes: t.estimated_minutes,
        labels: t.labels || [],
        is_demo: false,
        is_archived: false,
        created_by: authUser.id,
        created_at: now,
        updated_at: now,
      });
    }

    return { id: newProjId } as unknown as T;
  }

  // Milestones & Discussions
  if ((match = path.match(/^\/api\/projects\/([^/]+)\/milestones$/)) && method === 'POST') {
    const prjId = match[1];
    const id = crypto.randomUUID();
    const { error } = await client.from('project_milestones').insert({
      id,
      project_id: prjId,
      title: String(body.title || 'Milestone').trim(),
      description: String(body.description || ''),
      due_date: String(body.due_date || new Date().toISOString().slice(0, 10)),
      completed: false,
      created_at: new Date().toISOString(),
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/milestones\/([^/]+)$/)) && method === 'PATCH') {
    const msId = match[1];
    const updates: Record<string, unknown> = {};
    if (body.completed !== undefined) updates.completed = Boolean(body.completed);
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.due_date !== undefined) updates.due_date = String(body.due_date);
    const { error } = await client.from('project_milestones').update(updates).eq('id', msId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)\/discussions$/)) && method === 'POST') {
    const prjId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await client.from('project_discussions').insert({
      id,
      project_id: prjId,
      user_id: authUser.id,
      title: String(body.title || '').trim(),
      body: String(body.body || '').trim(),
      created_at: now,
      updated_at: now,
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // BOARD COLUMNS
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/boards\/([^/]+)\/columns$/)) && method === 'POST') {
    const boardId = match[1];
    const { data: existingCols } = await client.from('board_columns').select('position').eq('board_id', boardId).order('position', { ascending: false }).limit(1);
    const nextPos = existingCols && existingCols.length > 0 ? Number(existingCols[0].position) + 1 : 0;
    const id = crypto.randomUUID();
    const { data, error } = await client
      .from('board_columns')
      .insert({
        id,
        board_id: boardId,
        name: String(body.name || 'Column').trim(),
        position: nextPos,
        color: String(body.color || '#64748B'),
        status_key: String(body.status_key || 'todo'),
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    throwIfError(error);
    return { column: data } as unknown as T;
  }

  if ((match = path.match(/^\/api\/boards\/([^/]+)\/columns\/reorder$/)) && method === 'POST') {
    const boardId = match[1];
    const rawIds = body.column_ids ?? body.columnIds;
    const colIds = Array.isArray(rawIds) ? (rawIds as string[]) : [];
    const results = await Promise.all(
      colIds.map((cid, idx) => client.from('board_columns').update({ position: idx }).eq('id', cid).eq('board_id', boardId)),
    );
    for (const res of results) throwIfError(res.error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/columns\/([^/]+)$/)) && method === 'PATCH') {
    const colId = match[1];
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.color !== undefined) updates.color = String(body.color);
    if (body.status_key !== undefined) updates.status_key = String(body.status_key);
    if (body.position !== undefined) updates.position = Number(body.position);
    const { data, error } = await client.from('board_columns').update(updates).eq('id', colId).select('*').single();
    throwIfError(error);
    return { column: data } as unknown as T;
  }

  if ((match = path.match(/^\/api\/columns\/([^/]+)$/)) && method === 'DELETE') {
    const colId = match[1];
    const { data: col, error: cErr } = await client.from('board_columns').select('id, board_id').eq('id', colId).single();
    throwIfError(cErr, 404);
    if (!col) throw new SupabaseApiError('Board column not found.', 404);
    const { data: siblings } = await client
      .from('board_columns')
      .select('id, status_key')
      .eq('board_id', col.board_id)
      .neq('id', colId)
      .order('position', { ascending: true });

    if (!siblings || siblings.length === 0) {
      throw new SupabaseApiError('Cannot delete the last column on a board.', 400);
    }

    const fallback = siblings[0];
    await client.from('tasks').update({ column_id: fallback.id, status: fallback.status_key }).eq('column_id', colId);
    const { error } = await client.from('board_columns').delete().eq('id', colId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // TASKS
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/tasks$/)) && method === 'GET') {
    const wsId = match[1];
    const tasks = await getHydratedTasks(wsId, {
      includeArchived: query.get('archived') === '1',
      onlyTrash: query.get('trash') === '1',
    });
    return { tasks } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/tasks$/)) && method === 'POST') {
    const wsId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const uid = authUser.id;
    const projectId = String(body.project_id || '');
    const title = String(body.title || '').trim();
    if (!projectId || !title) throw new SupabaseApiError('Project and task title are required.', 400);

    const { data: board, error: bErr } = await client.from('boards').select('id').eq('project_id', projectId).limit(1).single();
    throwIfError(bErr, 404);
    if (!board) throw new SupabaseApiError('Project board not found.', 404);

    const { data: cols } = await client.from('board_columns').select('*').eq('board_id', board.id).order('position', { ascending: true });
    const allCols = (cols || []) as Array<Record<string, unknown>>;
    if (allCols.length === 0) throw new SupabaseApiError('Project board has no columns.', 400);

    let columnId = body.column_id ? String(body.column_id) : '';
    let status = body.status ? String(body.status) : 'todo';
    if (columnId) {
      const matched = allCols.find((c) => String(c.id) === columnId);
      if (matched && !body.status) status = String(matched.status_key);
    } else {
      const matched = allCols.find((c) => String(c.status_key) === status) || allCols[0];
      columnId = String(matched.id);
      status = String(matched.status_key);
    }

    const { data: posRows } = await client.from('tasks').select('position').eq('column_id', columnId).order('position', { ascending: false }).limit(1);
    const nextPos = posRows && posRows.length > 0 ? Number(posRows[0].position) + 1 : 0;
    const now = new Date().toISOString();
    const taskId = crypto.randomUUID();

    const { error: tErr } = await client.from('tasks').insert({
      id: taskId,
      workspace_id: wsId,
      project_id: projectId,
      board_id: board.id,
      column_id: columnId,
      title,
      description: String(body.description || ''),
      status,
      priority: String(body.priority || 'medium'),
      task_type: String(body.task_type || 'task'),
      position: nextPos,
      start_date: body.start_date ? String(body.start_date) : null,
      due_date: body.due_date ? String(body.due_date) : null,
      estimated_minutes: Number(body.estimated_minutes || 0),
      labels: Array.isArray(body.labels) ? body.labels : [],
      is_demo: false,
      is_archived: false,
      created_by: uid,
      created_at: now,
      updated_at: now,
    });
    throwIfError(tErr);

    const assigneeIds = Array.isArray(body.assignee_ids) ? (body.assignee_ids as string[]) : [];
    if (assigneeIds.length > 0) {
      await client.from('task_assignees').insert(
        assigneeIds.map((aId, idx) => ({
          id: crypto.randomUUID(),
          task_id: taskId,
          user_id: aId,
          is_primary: idx === 0,
          assigned_at: now,
        })),
      );
      await Promise.all(
        assigneeIds.map((aId) =>
          sendNotification(wsId, aId, uid, 'assignment', 'Assigned to a new task', `You were assigned to "${title}"`, 'task', taskId),
        ),
      );
    }

    await logWorkspaceActivity(wsId, uid, 'created_task', `Created task "${title}"`, projectId, taskId);
    return { id: taskId } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/tasks\/bulk$/)) && method === 'POST') {
    const wsId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const rawTaskIds = body.task_ids ?? body.taskIds;
    const taskIds = Array.isArray(rawTaskIds) ? (rawTaskIds as string[]) : [];
    const action = String(body.action || '');
    const value = body.value !== undefined && body.value !== null ? String(body.value) : '';
    if (taskIds.length === 0) return { ok: true } as unknown as T;

    const now = new Date().toISOString();
    if (action === 'delete') {
      const { error } = await client.from('tasks').update({ deleted_at: now, updated_at: now }).in('id', taskIds).eq('workspace_id', wsId);
      throwIfError(error);
    } else if (action === 'archive') {
      const { error } = await client.from('tasks').update({ is_archived: true, updated_at: now }).in('id', taskIds).eq('workspace_id', wsId);
      throwIfError(error);
    } else if (action === 'priority') {
      const { error } = await client.from('tasks').update({ priority: value, updated_at: now }).in('id', taskIds).eq('workspace_id', wsId);
      throwIfError(error);
    } else if (action === 'due_date') {
      const { error } = await client.from('tasks').update({ due_date: value || null, updated_at: now }).in('id', taskIds).eq('workspace_id', wsId);
      throwIfError(error);
    } else if (action === 'assign' && value) {
      const { data: targetTasks, error: tErr } = await client.from('tasks').select('id, title').in('id', taskIds).eq('workspace_id', wsId);
      throwIfError(tErr);
      const rows = (targetTasks || []) as Array<{ id: string; title: string }>;
      if (rows.length > 0) {
        const { error: aErr } = await client.from('task_assignees').upsert(
          rows.map((t) => ({
            id: crypto.randomUUID(),
            task_id: t.id,
            user_id: value,
            is_primary: true,
            assigned_at: now,
          })),
          { onConflict: 'task_id,user_id', ignoreDuplicates: true },
        );
        throwIfError(aErr);
        await Promise.all(
          rows.map((t) =>
            sendNotification(wsId, value, authUser.id, 'assignment', 'Assigned to task', `You were assigned to "${t.title}"`, 'task', t.id),
          ),
        );
      }
    } else if (action === 'status') {
      const { data: targetTasks, error: tErr } = await client.from('tasks').select('id, board_id').in('id', taskIds).eq('workspace_id', wsId);
      throwIfError(tErr);
      const boardIds = Array.from(new Set(((targetTasks || []) as Array<{ board_id: string }>).map((t) => t.board_id)));
      const { data: cols } = boardIds.length > 0 ? await client.from('board_columns').select('id, board_id, status_key').in('board_id', boardIds) : { data: [] };
      const colByBoard = new Map<string, string>();
      for (const c of (cols || []) as Array<{ id: string; board_id: string; status_key: string }>) {
        if (c.status_key === value) colByBoard.set(c.board_id, c.id);
      }
      const updates = await Promise.all(
        ((targetTasks || []) as Array<{ id: string; board_id: string }>).map((t) =>
          client
            .from('tasks')
            .update({
              status: value,
              ...(colByBoard.has(t.board_id) ? { column_id: colByBoard.get(t.board_id) } : {}),
              updated_at: now,
            })
            .eq('id', t.id),
        ),
      );
      for (const res of updates) throwIfError(res.error);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)$/)) && method === 'GET') {
    const taskId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const { data: tRow, error } = await client.from('tasks').select('*').eq('id', taskId).single();
    throwIfError(error, 404);
    const wsId = String(tRow.workspace_id);
    const hydrated = await getHydratedTasks(wsId, { projectId: String(tRow.project_id), includeArchived: true });
    const baseTask = hydrated.find((t) => t.id === taskId);
    if (!baseTask) throw new SupabaseApiError('Task not found.', 404);

    const [subRes, chkRes, depRes, cmtRes, attRes, teRes, actRes] = await Promise.all([
      client.from('subtasks').select('*').eq('task_id', taskId).order('position', { ascending: true }),
      client.from('checklists').select('*').eq('task_id', taskId).order('position', { ascending: true }),
      client.from('task_dependencies').select('*').eq('task_id', taskId),
      client.from('comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
      client.from('attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
      client.from('time_entries').select('*').eq('task_id', taskId).order('started_at', { ascending: false }),
      client.from('activity_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
    ]);

    const chkRows = (chkRes.data || []) as Array<Record<string, unknown>>;
    const chkIds = chkRows.map((c) => String(c.id));
    const ciRes = chkIds.length > 0 ? await client.from('checklist_items').select('*').in('checklist_id', chkIds).order('position', { ascending: true }) : { data: [] };

    const cmtRows = (cmtRes.data || []) as Array<Record<string, unknown>>;
    const cmtIds = cmtRows.map((c) => String(c.id));
    const reactRes = cmtIds.length > 0 ? await client.from('comment_reactions').select('*').in('comment_id', cmtIds) : { data: [] };

    const depRows = (depRes.data || []) as Array<Record<string, unknown>>;
    const relTaskIds = depRows.map((d) => String(d.related_task_id));
    const relTasksRes = relTaskIds.length > 0 ? await client.from('tasks').select('id, title, status').in('id', relTaskIds) : { data: [] };
    const relTaskMap = new Map(((relTasksRes.data || []) as Array<Record<string, unknown>>).map((t) => [String(t.id), t]));

    const userIdsNeeded = Array.from(
      new Set([
        ...((subRes.data || []) as Array<Record<string, unknown>>).map((s) => s.assignee_id).filter(Boolean).map(String),
        ...cmtRows.map((c) => String(c.user_id)),
        ...((attRes.data || []) as Array<Record<string, unknown>>).map((a) => String(a.uploaded_by)),
        ...((teRes.data || []) as Array<Record<string, unknown>>).map((te) => String(te.user_id)),
        ...((actRes.data || []) as Array<Record<string, unknown>>).map((al) => String(al.user_id)),
      ]),
    );
    const uRes = userIdsNeeded.length > 0 ? await client.from('users').select('id, full_name, avatar_url, job_title').in('id', userIdsNeeded) : { data: [] };
    const uMap = new Map(((uRes.data || []) as Array<Record<string, unknown>>).map((u) => [String(u.id), u]));

    const subtasks: Subtask[] = ((subRes.data || []) as Array<Record<string, unknown>>).map((s) => ({
      id: String(s.id),
      task_id: taskId,
      title: String(s.title),
      completed: asIntBool(s.completed),
      assignee_id: s.assignee_id ? String(s.assignee_id) : null,
      assignee_name: s.assignee_id ? String(uMap.get(String(s.assignee_id))?.full_name || '') : null,
      due_date: s.due_date ? String(s.due_date) : null,
      position: Number(s.position || 0),
    }));

    const checklists: Checklist[] = chkRows.map((c) => ({
      id: String(c.id),
      task_id: taskId,
      title: String(c.title),
      position: Number(c.position || 0),
      items: ((ciRes.data || []) as Array<Record<string, unknown>>)
        .filter((ci) => String(ci.checklist_id) === String(c.id))
        .map((ci): ChecklistItem => ({
          id: String(ci.id),
          checklist_id: String(ci.checklist_id),
          text: String(ci.text),
          completed: asIntBool(ci.completed),
          position: Number(ci.position || 0),
        })),
    }));

    const dependencies = depRows.map((d) => {
      const rt = relTaskMap.get(String(d.related_task_id));
      return {
        id: String(d.id),
        task_id: taskId,
        related_task_id: String(d.related_task_id),
        related_task_title: rt ? String(rt.title) : 'Linked Task',
        related_task_status: (rt?.status as TaskStatus) || 'todo',
        dependency_type: (d.dependency_type as DependencyType) || 'related_to',
      };
    });

    const attachments: Attachment[] = ((attRes.data || []) as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id),
      workspace_id: wsId,
      project_id: a.project_id ? String(a.project_id) : null,
      project_name: baseTask.project_name || null,
      task_id: taskId,
      task_title: baseTask.title,
      comment_id: a.comment_id ? String(a.comment_id) : null,
      uploaded_by: String(a.uploaded_by),
      uploader_name: String(uMap.get(String(a.uploaded_by))?.full_name || 'Member'),
      original_name: String(a.original_name),
      mime_type: String(a.mime_type),
      size_bytes: Number(a.size_bytes || 0),
      created_at: String(a.created_at),
    }));

    const comments: TaskComment[] = cmtRows.map((c) => {
      const author = uMap.get(String(c.user_id));
      const cReacts = ((reactRes.data || []) as Array<Record<string, unknown>>).filter(
        (r) => String(r.comment_id) === String(c.id),
      );
      const emojiMap = new Map<string, { count: number; user_reacted: boolean }>();
      for (const r of cReacts) {
        const em = String(r.emoji);
        const cur = emojiMap.get(em) || { count: 0, user_reacted: false };
        cur.count += 1;
        if (String(r.user_id) === authUser.id) cur.user_reacted = true;
        emojiMap.set(em, cur);
      }
      const reactions: CommentReaction[] = Array.from(emojiMap.entries()).map(([emoji, info]) => ({
        emoji,
        count: info.count,
        user_reacted: info.user_reacted,
      }));
      return {
        id: String(c.id),
        task_id: taskId,
        user_id: String(c.user_id),
        parent_comment_id: c.parent_comment_id ? String(c.parent_comment_id) : null,
        author_name: String(author?.full_name || 'Member'),
        author_avatar: author?.avatar_url ? String(author.avatar_url) : null,
        author_job_title: String(author?.job_title || 'Team Member'),
        body: String(c.body),
        mentions: parseJsonArray<string>(c.mentions),
        reactions,
        attachments: attachments.filter((a) => a.comment_id === String(c.id)),
        created_at: String(c.created_at),
        updated_at: String(c.updated_at),
      };
    });

    const time_entries: TimeEntry[] = ((teRes.data || []) as Array<Record<string, unknown>>).map((te) => ({
      id: String(te.id),
      workspace_id: wsId,
      project_id: String(te.project_id),
      project_name: baseTask.project_name,
      task_id: taskId,
      task_title: baseTask.title,
      user_id: String(te.user_id),
      user_name: String(uMap.get(String(te.user_id))?.full_name || 'Member'),
      description: String(te.description || ''),
      duration_seconds: Number(te.duration_seconds || 0),
      started_at: String(te.started_at),
      ended_at: te.ended_at ? String(te.ended_at) : null,
      is_running: asIntBool(te.is_running),
      created_at: String(te.created_at),
    }));

    const activity_logs: ActivityLog[] = ((actRes.data || []) as Array<Record<string, unknown>>).map((al) => {
      const u = uMap.get(String(al.user_id));
      return {
        id: String(al.id),
        workspace_id: wsId,
        project_id: al.project_id ? String(al.project_id) : null,
        project_name: baseTask.project_name || null,
        task_id: taskId,
        task_title: baseTask.title,
        user_id: String(al.user_id),
        user_name: String(u?.full_name || 'Member'),
        user_avatar: u?.avatar_url ? String(u.avatar_url) : null,
        action: String(al.action),
        details: String(al.details),
        created_at: String(al.created_at),
      };
    });

    const detail: TaskDetail = {
      ...baseTask,
      subtasks,
      checklists,
      dependencies,
      comments,
      attachments,
      time_entries,
      activity_logs,
    };
    return { task: detail } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)$/)) && method === 'PATCH') {
    const taskId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const { data: existing, error: fErr } = await client.from('tasks').select('*').eq('id', taskId).single();
    throwIfError(fErr, 404);

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updated_at: now };

    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.description !== undefined) updates.description = String(body.description);
    if (body.priority !== undefined) updates.priority = String(body.priority);
    if (body.task_type !== undefined) updates.task_type = String(body.task_type);
    if (body.position !== undefined) updates.position = Number(body.position);
    if (body.start_date !== undefined) updates.start_date = body.start_date ? String(body.start_date) : null;
    if (body.due_date !== undefined) updates.due_date = body.due_date ? String(body.due_date) : null;
    if (body.estimated_minutes !== undefined) updates.estimated_minutes = Number(body.estimated_minutes || 0);
    if (Array.isArray(body.labels)) updates.labels = body.labels;
    if (body.is_archived !== undefined) updates.is_archived = Boolean(body.is_archived);

    if (body.column_id !== undefined) {
      updates.column_id = String(body.column_id);
      if (body.status === undefined) {
        const { data: col } = await client.from('board_columns').select('status_key').eq('id', String(body.column_id)).maybeSingle();
        if (col) updates.status = col.status_key;
      }
    }
    if (body.status !== undefined) {
      updates.status = String(body.status);
      if (body.column_id === undefined) {
        const { data: col } = await client
          .from('board_columns')
          .select('id')
          .eq('board_id', existing.board_id)
          .eq('status_key', String(body.status))
          .limit(1)
          .maybeSingle();
        if (col) updates.column_id = col.id;
      }
    }

    const { error: uErr } = await client.from('tasks').update(updates).eq('id', taskId);
    throwIfError(uErr);

    if (Array.isArray(body.assignee_ids)) {
      const nextIds = Array.from(new Set(body.assignee_ids as string[]));
      const { data: prevRows } = await client.from('task_assignees').select('user_id').eq('task_id', taskId);
      const prevSet = new Set(((prevRows || []) as Array<{ user_id: string }>).map((r) => r.user_id));

      await client.from('task_assignees').delete().eq('task_id', taskId);
      if (nextIds.length > 0) {
        await client.from('task_assignees').insert(
          nextIds.map((uid, idx) => ({
            id: crypto.randomUUID(),
            task_id: taskId,
            user_id: uid,
            is_primary: idx === 0,
            assigned_at: now,
          })),
        );
      }
      await Promise.all(
        nextIds
          .filter((uid) => !prevSet.has(uid))
          .map((uid) =>
            sendNotification(
              String(existing.workspace_id),
              uid,
              authUser.id,
              'assignment',
              'Task assigned to you',
              `You were assigned to "${existing.title}"`,
              'task',
              taskId,
            ),
          ),
      );
    }

    if (updates.status && updates.status !== existing.status) {
      await logWorkspaceActivity(
        String(existing.workspace_id),
        authUser.id,
        updates.status === 'completed' ? 'completed_task' : 'updated_status',
        `Moved "${existing.title}" to ${String(updates.status).replace('_', ' ')}`,
        String(existing.project_id),
        taskId,
      );
      const { data: curAssignees } = await client.from('task_assignees').select('user_id').eq('task_id', taskId);
      await Promise.all(
        ((curAssignees || []) as Array<{ user_id: string }>).map((a) =>
          sendNotification(
            String(existing.workspace_id),
            a.user_id,
            authUser.id,
            'status',
            'Task status updated',
            `"${existing.title}" moved to ${String(updates.status).replace('_', ' ')}`,
            'task',
            taskId,
          ),
        ),
      );
    }

    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)$/)) && method === 'DELETE') {
    const taskId = match[1];
    if (query.get('permanent') === '1') {
      const { error } = await client.from('tasks').delete().eq('id', taskId);
      throwIfError(error);
    } else {
      const now = new Date().toISOString();
      const { error } = await client.from('tasks').update({ deleted_at: now, updated_at: now }).eq('id', taskId);
      throwIfError(error);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/restore$/)) && method === 'POST') {
    const taskId = match[1];
    const { error } = await client
      .from('tasks')
      .update({ deleted_at: null, is_archived: false, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // SUBTASKS, CHECKLISTS & DEPENDENCIES
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/subtasks$/)) && method === 'POST') {
    const taskId = match[1];
    const id = crypto.randomUUID();
    const { error } = await client.from('subtasks').insert({
      id,
      task_id: taskId,
      title: String(body.title || '').trim(),
      completed: false,
      position: 0,
      created_at: new Date().toISOString(),
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/subtasks\/([^/]+)$/)) && method === 'PATCH') {
    const subId = match[1];
    const updates: Record<string, unknown> = {};
    if (body.completed !== undefined) updates.completed = Boolean(body.completed);
    if (body.title !== undefined) updates.title = String(body.title).trim();
    const { error } = await client.from('subtasks').update(updates).eq('id', subId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/subtasks\/([^/]+)$/)) && method === 'DELETE') {
    const { error } = await client.from('subtasks').delete().eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/checklists$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    const { error } = await client.from('checklists').insert({
      id,
      task_id: match[1],
      title: String(body.title || 'Checklist').trim(),
      position: 0,
      created_at: new Date().toISOString(),
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/checklists\/([^/]+)\/items$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    const { error } = await client.from('checklist_items').insert({
      id,
      checklist_id: match[1],
      text: String(body.text || '').trim(),
      completed: false,
      position: 0,
      created_at: new Date().toISOString(),
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/checklist-items\/([^/]+)$/)) && method === 'PATCH') {
    const updates: Record<string, unknown> = {};
    if (body.completed !== undefined) updates.completed = Boolean(body.completed);
    if (body.text !== undefined) updates.text = String(body.text).trim();
    const { error } = await client.from('checklist_items').update(updates).eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/checklist-items\/([^/]+)$/)) && method === 'DELETE') {
    const { error } = await client.from('checklist_items').delete().eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/dependencies$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    const { error } = await client.from('task_dependencies').insert({
      id,
      task_id: match[1],
      related_task_id: String(body.related_task_id),
      dependency_type: String(body.dependency_type || 'related_to'),
      created_at: new Date().toISOString(),
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/dependencies\/([^/]+)$/)) && method === 'DELETE') {
    const { error } = await client.from('task_dependencies').delete().eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // COMMENTS & REACTIONS
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/comments$/)) && method === 'POST') {
    const taskId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const commentBody = String(body.body || '').trim();
    if (!commentBody) throw new SupabaseApiError('Comment cannot be empty.', 400);

    const { data: taskRow, error: tErr } = await client
      .from('tasks')
      .select('workspace_id, project_id, title, created_by')
      .eq('id', taskId)
      .single();
    throwIfError(tErr, 404);
    if (!taskRow) throw new SupabaseApiError('Task not found.', 404);

    const mentions = Array.isArray(body.mentions) ? (body.mentions as string[]) : [];
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const { error } = await client.from('comments').insert({
      id,
      task_id: taskId,
      user_id: authUser.id,
      parent_comment_id: body.parent_comment_id ? String(body.parent_comment_id) : null,
      body: commentBody,
      mentions,
      created_at: now,
      updated_at: now,
    });
    throwIfError(error);

    const actorName = String(authUser.user_metadata?.full_name || authUser.email || 'A teammate');
    const wsId = String(taskRow.workspace_id);
    await Promise.all(
      mentions.map((uid) =>
        sendNotification(
          wsId,
          uid,
          authUser.id,
          'mention',
          `${actorName} mentioned you`,
          `Mentioned you on "${taskRow.title}"`,
          'task',
          taskId,
        ),
      ),
    );
    if (taskRow.created_by && !mentions.includes(String(taskRow.created_by))) {
      await sendNotification(
        wsId,
        String(taskRow.created_by),
        authUser.id,
        'comment',
        `New comment on "${taskRow.title}"`,
        `${actorName}: ${commentBody.slice(0, 120)}`,
        'task',
        taskId,
      );
    }

    await logWorkspaceActivity(wsId, authUser.id, 'commented', `Commented on "${taskRow.title}"`, String(taskRow.project_id), taskId);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/comments\/([^/]+)$/)) && method === 'PATCH') {
    const { error } = await client
      .from('comments')
      .update({ body: String(body.body || '').trim(), updated_at: new Date().toISOString() })
      .eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/comments\/([^/]+)$/)) && method === 'DELETE') {
    const { error } = await client.from('comments').delete().eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/comments\/([^/]+)\/reactions$/)) && method === 'POST') {
    const commentId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const emoji = String(body.emoji || '👍');
    const { data: existing } = await client
      .from('comment_reactions')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', authUser.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      await client.from('comment_reactions').delete().eq('id', existing.id);
    } else {
      await client.from('comment_reactions').insert({
        id: crypto.randomUUID(),
        comment_id: commentId,
        user_id: authUser.id,
        emoji,
        created_at: new Date().toISOString(),
      });
    }
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // FILES & STORAGE
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/files$/)) && method === 'GET') {
    const wsId = match[1];
    const { data: rows, error } = await client.from('attachments').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false });
    throwIfError(error);
    const list = (rows || []) as Array<Record<string, unknown>>;
    if (list.length === 0) return { files: [] } as unknown as T;

    const projIds = Array.from(new Set(list.map((f) => f.project_id).filter(Boolean).map(String)));
    const taskIds = Array.from(new Set(list.map((f) => f.task_id).filter(Boolean).map(String)));
    const userIds = Array.from(new Set(list.map((f) => String(f.uploaded_by))));

    const [pRes, tRes, uRes] = await Promise.all([
      projIds.length > 0 ? client.from('projects').select('id, name').in('id', projIds) : { data: [] },
      taskIds.length > 0 ? client.from('tasks').select('id, title').in('id', taskIds) : { data: [] },
      userIds.length > 0 ? client.from('users').select('id, full_name').in('id', userIds) : { data: [] },
    ]);

    const pMap = new Map(((pRes.data || []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));
    const tMap = new Map(((tRes.data || []) as Array<{ id: string; title: string }>).map((t) => [t.id, t.title]));
    const uMap = new Map(((uRes.data || []) as Array<{ id: string; full_name: string }>).map((u) => [u.id, u.full_name]));

    const files: Attachment[] = list.map((f) => ({
      id: String(f.id),
      workspace_id: wsId,
      project_id: f.project_id ? String(f.project_id) : null,
      project_name: f.project_id ? pMap.get(String(f.project_id)) || null : null,
      task_id: f.task_id ? String(f.task_id) : null,
      task_title: f.task_id ? tMap.get(String(f.task_id)) || null : null,
      comment_id: f.comment_id ? String(f.comment_id) : null,
      uploaded_by: String(f.uploaded_by),
      uploader_name: uMap.get(String(f.uploaded_by)) || 'Member',
      original_name: String(f.original_name),
      mime_type: String(f.mime_type),
      size_bytes: Number(f.size_bytes || 0),
      created_at: String(f.created_at),
    }));

    return { files } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/files$/)) && method === 'POST') {
    const wsId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    if (!(options.body instanceof FormData)) {
      throw new SupabaseApiError('Multipart file payload required.', 400);
    }
    const file = options.body.get('file');
    if (!(file instanceof File)) throw new SupabaseApiError('No file provided.', 400);
    if (file.size > MAX_FILE_BYTES) throw new SupabaseApiError('File exceeds 10 MB size limit.', 400);

    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : '';
    if (!ALLOWED_FILE_EXTS.has(ext) && !file.type.startsWith('image/') && !file.type.startsWith('text/')) {
      throw new SupabaseApiError('Unsupported file type. Allowed: PDF, DOC/X, XLS/X, PPT/X, PNG, JPG, SVG, ZIP, TXT, CSV, MD', 400);
    }

    const projectId = options.body.get('project_id') ? String(options.body.get('project_id')) : null;
    const taskId = options.body.get('task_id') ? String(options.body.get('task_id')) : null;
    const safeExt = ext || '';
    const objectPath = `${wsId}/${crypto.randomUUID()}${safeExt}`;
    const resolvedMimeType = resolveUploadMimeType(file, safeExt);

    const { error: upErr } = await client.storage.from(STORAGE_BUCKETS.FILES).upload(objectPath, file, {
      contentType: resolvedMimeType,
      upsert: false,
    });
    if (upErr) throw new SupabaseApiError(upErr.message || 'File upload failed.', 400);

    const attId = crypto.randomUUID();
    const { error: dbErr } = await client.from('attachments').insert({
      id: attId,
      workspace_id: wsId,
      project_id: projectId,
      task_id: taskId,
      comment_id: null,
      uploaded_by: authUser.id,
      original_name: file.name,
      stored_name: objectPath,
      mime_type: resolvedMimeType,
      size_bytes: file.size,
      created_at: new Date().toISOString(),
    });
    if (dbErr) {
      await client.storage.from(STORAGE_BUCKETS.FILES).remove([objectPath]);
      throwIfError(dbErr);
    }

    await logWorkspaceActivity(wsId, authUser.id, 'uploaded_file', `Uploaded "${file.name}"`, projectId, taskId);
    return { id: attId } as unknown as T;
  }

  if ((match = path.match(/^\/api\/files\/([^/]+)$/)) && method === 'PATCH') {
    const fileId = match[1];
    const newName = String(body.original_name || '').trim();
    if (!newName) throw new SupabaseApiError('File name is required.', 400);
    const { error } = await client.from('attachments').update({ original_name: newName }).eq('id', fileId);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/files\/([^/]+)$/)) && method === 'DELETE') {
    const fileId = match[1];
    const { data: att } = await client.from('attachments').select('stored_name').eq('id', fileId).maybeSingle();
    const { error } = await client.from('attachments').delete().eq('id', fileId);
    throwIfError(error);
    if (att?.stored_name) {
      await client.storage.from(STORAGE_BUCKETS.FILES).remove([String(att.stored_name)]);
    }
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // TIME ENTRIES
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/time-entries$/)) && method === 'GET') {
    const wsId = match[1];
    const { data: rows, error } = await client.from('time_entries').select('*').eq('workspace_id', wsId).order('started_at', { ascending: false });
    throwIfError(error);
    const list = (rows || []) as Array<Record<string, unknown>>;
    if (list.length === 0) return { entries: [] } as unknown as T;

    const projIds = Array.from(new Set(list.map((e) => String(e.project_id))));
    const taskIds = Array.from(new Set(list.map((e) => String(e.task_id))));
    const userIds = Array.from(new Set(list.map((e) => String(e.user_id))));
    const [pRes, tRes, uRes] = await Promise.all([
      client.from('projects').select('id, name').in('id', projIds),
      client.from('tasks').select('id, title').in('id', taskIds),
      client.from('users').select('id, full_name').in('id', userIds),
    ]);
    const pMap = new Map(((pRes.data || []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));
    const tMap = new Map(((tRes.data || []) as Array<{ id: string; title: string }>).map((t) => [t.id, t.title]));
    const uMap = new Map(((uRes.data || []) as Array<{ id: string; full_name: string }>).map((u) => [u.id, u.full_name]));

    const entries: TimeEntry[] = list.map((e) => ({
      id: String(e.id),
      workspace_id: wsId,
      project_id: String(e.project_id),
      project_name: pMap.get(String(e.project_id)),
      task_id: String(e.task_id),
      task_title: tMap.get(String(e.task_id)),
      user_id: String(e.user_id),
      user_name: uMap.get(String(e.user_id)),
      description: String(e.description || ''),
      duration_seconds: Number(e.duration_seconds || 0),
      started_at: String(e.started_at),
      ended_at: e.ended_at ? String(e.ended_at) : null,
      is_running: asIntBool(e.is_running),
      created_at: String(e.created_at),
    }));
    return { entries } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/time-entries$/)) && method === 'POST') {
    const taskId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const { data: taskRow, error: tErr } = await client.from('tasks').select('workspace_id, project_id').eq('id', taskId).single();
    throwIfError(tErr, 404);
    if (!taskRow) throw new SupabaseApiError('Task not found.', 404);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isRunning = Boolean(body.is_running);
    const { error } = await client.from('time_entries').insert({
      id,
      workspace_id: taskRow.workspace_id,
      project_id: taskRow.project_id,
      task_id: taskId,
      user_id: authUser.id,
      description: String(body.description || ''),
      duration_seconds: Number(body.duration_seconds || 0),
      started_at: now,
      ended_at: isRunning ? null : now,
      is_running: isRunning,
      created_at: now,
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/time-entries\/([^/]+)$/)) && method === 'PATCH') {
    const updates: Record<string, unknown> = {};
    if (body.duration_seconds !== undefined) updates.duration_seconds = Number(body.duration_seconds);
    if (body.description !== undefined) updates.description = String(body.description);
    if (body.is_running !== undefined) {
      updates.is_running = Boolean(body.is_running);
      if (!body.is_running) updates.ended_at = new Date().toISOString();
    }
    const { error } = await client.from('time_entries').update(updates).eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/time-entries\/([^/]+)$/)) && method === 'DELETE') {
    const { error } = await client.from('time_entries').delete().eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS & ACTIVITY
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/notifications$/)) && method === 'GET') {
    const wsId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    const { data: rows, error } = await client
      .from('notifications')
      .select('*')
      .eq('workspace_id', wsId)
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    throwIfError(error);

    const list = (rows || []) as Array<Record<string, unknown>>;
    const actorIds = Array.from(new Set(list.map((n) => n.actor_id).filter(Boolean).map(String)));
    const aRes = actorIds.length > 0 ? await client.from('users').select('id, full_name, avatar_url').in('id', actorIds) : { data: [] };
    const aMap = new Map(((aRes.data || []) as Array<Record<string, unknown>>).map((u) => [String(u.id), u]));

    const notifications: NotificationItem[] = list.map((n) => {
      const actor = n.actor_id ? aMap.get(String(n.actor_id)) : undefined;
      return {
        id: String(n.id),
        workspace_id: wsId,
        user_id: String(n.user_id),
        actor_id: n.actor_id ? String(n.actor_id) : null,
        actor_name: actor ? String(actor.full_name) : null,
        actor_avatar: actor?.avatar_url ? String(actor.avatar_url) : null,
        category: (n.category as NotificationItem['category']) || 'project',
        title: String(n.title),
        message: String(n.message),
        link_type: n.link_type ? String(n.link_type) : null,
        link_id: n.link_id ? String(n.link_id) : null,
        is_read: asIntBool(n.is_read),
        created_at: String(n.created_at),
      };
    });
    return { notifications } as unknown as T;
  }

  if ((match = path.match(/^\/api\/notifications\/([^/]+)\/read$/)) && method === 'PATCH') {
    const { error } = await client.from('notifications').update({ is_read: Boolean(body.is_read) }).eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/notifications\/mark-all-read$/)) && method === 'POST') {
    const { authUser } = await getCurrentSessionAndUser();
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('workspace_id', match[1])
      .eq('user_id', authUser.id);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/notifications\/([^/]+)$/)) && method === 'DELETE') {
    const { error } = await client.from('notifications').delete().eq('id', match[1]);
    throwIfError(error);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/activity$/)) && method === 'GET') {
    const wsId = match[1];
    const { data: rows, error } = await client
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
      .limit(60);
    throwIfError(error);
    const list = (rows || []) as Array<Record<string, unknown>>;
    if (list.length === 0) return { activity: [] } as unknown as T;

    const projIds = Array.from(new Set(list.map((a) => a.project_id).filter(Boolean).map(String)));
    const taskIds = Array.from(new Set(list.map((a) => a.task_id).filter(Boolean).map(String)));
    const userIds = Array.from(new Set(list.map((a) => String(a.user_id))));
    const [pRes, tRes, uRes] = await Promise.all([
      projIds.length > 0 ? client.from('projects').select('id, name').in('id', projIds) : { data: [] },
      taskIds.length > 0 ? client.from('tasks').select('id, title').in('id', taskIds) : { data: [] },
      userIds.length > 0 ? client.from('users').select('id, full_name, avatar_url').in('id', userIds) : { data: [] },
    ]);
    const pMap = new Map(((pRes.data || []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));
    const tMap = new Map(((tRes.data || []) as Array<{ id: string; title: string }>).map((t) => [t.id, t.title]));
    const uMap = new Map(((uRes.data || []) as Array<Record<string, unknown>>).map((u) => [String(u.id), u]));

    const activity: ActivityLog[] = list.map((a) => {
      const u = uMap.get(String(a.user_id));
      return {
        id: String(a.id),
        workspace_id: wsId,
        project_id: a.project_id ? String(a.project_id) : null,
        project_name: a.project_id ? pMap.get(String(a.project_id)) || null : null,
        task_id: a.task_id ? String(a.task_id) : null,
        task_title: a.task_id ? tMap.get(String(a.task_id)) || null : null,
        user_id: String(a.user_id),
        user_name: u ? String(u.full_name) : 'Member',
        user_avatar: u?.avatar_url ? String(u.avatar_url) : null,
        action: String(a.action),
        details: String(a.details),
        created_at: String(a.created_at),
      };
    });
    return { activity } as unknown as T;
  }

  // ---------------------------------------------------------------------------
  // TEMPLATES & SEARCH
  // ---------------------------------------------------------------------------
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/templates$/)) && method === 'GET') {
    const wsId = match[1];
    const { data, error } = await client
      .from('project_templates')
      .select('*')
      .or(`is_system.eq.true,workspace_id.eq.${wsId}`)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: false });
    throwIfError(error);
    return { templates: ((data || []) as Array<Record<string, unknown>>).map(mapTemplateRow) } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/templates$/)) && method === 'POST') {
    const wsId = match[1];
    const { authUser } = await getCurrentSessionAndUser();
    let columns: ProjectTemplate['columns'] = [
      { name: 'Backlog', status_key: 'backlog', color: '#64748B' },
      { name: 'To Do', status_key: 'todo', color: '#3B82F6' },
      { name: 'In Progress', status_key: 'in_progress', color: '#C99A4E' },
      { name: 'In Review', status_key: 'in_review', color: '#8B5CF6' },
      { name: 'Completed', status_key: 'completed', color: '#16A34A' },
    ];
    let sampleTasks: ProjectTemplate['sample_tasks'] = [];
    let color = String(body.color || '#1B3B2B');

    if (body.project_id) {
      const pid = String(body.project_id);
      const { data: pRow } = await client.from('projects').select('color').eq('id', pid).maybeSingle();
      if (pRow) color = String(pRow.color);
      const { data: board } = await client.from('boards').select('id').eq('project_id', pid).limit(1).maybeSingle();
      if (board) {
        const { data: cols } = await client.from('board_columns').select('name, status_key, color').eq('board_id', board.id).order('position');
        if (cols && cols.length > 0) columns = cols as ProjectTemplate['columns'];
      }
      const { data: pTasks } = await client.from('tasks').select('title, status, priority, labels, estimated_minutes').eq('project_id', pid).is('deleted_at', null).limit(10);
      if (pTasks) {
        sampleTasks = (pTasks as Array<Record<string, unknown>>).map((t) => ({
          title: String(t.title),
          status_key: (t.status as TaskStatus) || 'todo',
          priority: (t.priority as PriorityLevel) || 'medium',
          labels: parseJsonArray<string>(t.labels),
          estimated_minutes: Number(t.estimated_minutes || 60),
        }));
      }
    }

    const id = crypto.randomUUID();
    const { error } = await client.from('project_templates').insert({
      id,
      workspace_id: wsId,
      name: String(body.name || 'Custom Template').trim(),
      category: String(body.category || 'Custom'),
      description: String(body.description || 'Saved custom project template'),
      color,
      columns_json: columns,
      sample_tasks_json: sampleTasks,
      is_system: false,
      created_by: authUser.id,
      created_at: new Date().toISOString(),
    });
    throwIfError(error);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/search$/)) && method === 'GET') {
    const wsId = match[1];
    const q = (query.get('q') || '').replace(/[(),]/g, ' ').trim();
    if (!q) return { projects: [], tasks: [], members: [], comments: [], files: [] } as unknown as T;
    const pat = `%${q}%`;

    const [pRes, tRes, wmRes, fRes] = await Promise.all([
      client.from('projects').select('id, name, category, status, color').eq('workspace_id', wsId).is('deleted_at', null).or(`name.ilike.${pat},description.ilike.${pat}`).limit(8),
      client.from('tasks').select('id, title, status, priority, project_id').eq('workspace_id', wsId).is('deleted_at', null).or(`title.ilike.${pat},description.ilike.${pat}`).limit(12),
      client.from('workspace_members').select('user_id, role').eq('workspace_id', wsId),
      client.from('attachments').select('id, original_name, mime_type, size_bytes, project_id, task_id').eq('workspace_id', wsId).ilike('original_name', pat).limit(8),
    ]);

    const taskList = (tRes.data || []) as Array<Record<string, unknown>>;
    const pIds = Array.from(new Set(taskList.map((t) => String(t.project_id))));
    const pNamesRes = pIds.length > 0 ? await client.from('projects').select('id, name').in('id', pIds) : { data: [] };
    const pNameMap = new Map(((pNamesRes.data || []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));

    const wmIds = ((wmRes.data || []) as Array<{ user_id: string; role: string }>);
    const uIds = wmIds.map((m) => m.user_id);
    const uRes = uIds.length > 0
      ? await client.from('users').select('id, full_name, email, job_title, avatar_url').in('id', uIds).or(`full_name.ilike.${pat},email.ilike.${pat},job_title.ilike.${pat}`).limit(8)
      : { data: [] };
    const roleMap = new Map(wmIds.map((m) => [m.user_id, m.role]));

    // Search comments scoped to workspace tasks
    const { data: wsTasks } = await client.from('tasks').select('id, title').eq('workspace_id', wsId).is('deleted_at', null).limit(200);
    const wsTaskMap = new Map(((wsTasks || []) as Array<{ id: string; title: string }>).map((t) => [t.id, t.title]));
    const wsTaskIds = Array.from(wsTaskMap.keys());
    const cRes = wsTaskIds.length > 0
      ? await client.from('comments').select('id, task_id, body, user_id').in('task_id', wsTaskIds).ilike('body', pat).limit(8)
      : { data: [] };
    const cRows = (cRes.data || []) as Array<Record<string, unknown>>;
    const cUserIds = Array.from(new Set(cRows.map((c) => String(c.user_id))));
    const cuRes = cUserIds.length > 0 ? await client.from('users').select('id, full_name').in('id', cUserIds) : { data: [] };
    const cuMap = new Map(((cuRes.data || []) as Array<{ id: string; full_name: string }>).map((u) => [u.id, u.full_name]));

    return {
      projects: pRes.data || [],
      tasks: taskList.map((t) => ({ ...t, project_name: pNameMap.get(String(t.project_id)) || '' })),
      members: ((uRes.data || []) as Array<Record<string, unknown>>).map((u) => ({ ...u, role: roleMap.get(String(u.id)) || 'member' })),
      comments: cRows.map((c) => ({
        id: c.id,
        task_id: c.task_id,
        body: c.body,
        task_title: wsTaskMap.get(String(c.task_id)) || '',
        author_name: cuMap.get(String(c.user_id)) || 'Member',
      })),
      files: fRes.data || [],
    } as unknown as T;
  }

  throw new SupabaseApiError(`Unhandled Supabase route: ${method} ${path}`, 404);
}
