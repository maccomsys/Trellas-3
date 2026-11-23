import { createClient, type SupabaseClient, type User as SupabaseAuthUser } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { SYSTEM_TEMPLATES } from './templates.ts';

function isoDayOffset(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoHourOffset(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export interface AdminResult<T = Record<string, unknown>> {
  status: number;
  data: T | { error: string };
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export interface SupabaseAuthedRequest extends Request {
  supabaseUser?: SupabaseAuthUser;
  supabaseAdmin?: SupabaseClient;
}

export async function verifySupabaseAccessToken(
  authHeader: string | null | undefined,
): Promise<{ admin: SupabaseClient; user: SupabaseAuthUser } | { errorStatus: number; error: string }> {
  const header = authHeader || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return { errorStatus: 401, error: 'Authentication required' };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      errorStatus: 503,
      error: 'Supabase server credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are not configured.',
    };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { errorStatus: 401, error: 'Invalid or expired Supabase session' };
  }

  return { admin, user: data.user };
}

async function requireSupabaseJwt(req: SupabaseAuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const verified = await verifySupabaseAccessToken(req.headers.authorization);
  if ('error' in verified) {
    res.status(verified.errorStatus).json({ error: verified.error });
    return;
  }
  req.supabaseUser = verified.user;
  req.supabaseAdmin = verified.admin;
  next();
}

async function findOrCreateAuthUser(
  admin: SupabaseClient,
  spec: {
    email: string;
    password: string;
    full_name: string;
    avatar_url: string;
  },
): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: {
      full_name: spec.full_name,
      avatar_url: spec.avatar_url,
    },
  });

  if (created.data?.user?.id) {
    return created.data.user.id;
  }

  // If user already exists, look up by listing users
  let page = 1;
  while (page <= 10) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const match = listed.data?.users?.find((u) => (u.email || '').toLowerCase() === spec.email.toLowerCase());
    if (match) {
      await admin.auth.admin.updateUserById(match.id, {
        email_confirm: true,
        password: spec.password,
        user_metadata: { full_name: spec.full_name, avatar_url: spec.avatar_url },
      });
      return match.id;
    }
    if (!listed.data?.users || listed.data.users.length < 200) break;
    page += 1;
  }

  throw new Error(created.error?.message || `Unable to provision demo user ${spec.email}`);
}

export function getSupabaseStatusPayload(): { clientConfigured: boolean; serverConfigured: boolean } {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anon = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return {
    clientConfigured: Boolean(url && anon),
    serverConfigured: Boolean(url && service),
  };
}

export async function seedDemoWorkspaceAdmin(): Promise<AdminResult<{ seeded: boolean; alreadyPresent?: boolean }>> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      status: 503,
      data: {
        error: 'Supabase server credentials are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment secrets.',
      },
    };
  }

  try {
    const now = new Date().toISOString();
    const demoSpecs = [
      {
        key: 'usr-maya',
        email: 'maya@trellas.app',
        full_name: 'Maya Chen',
        avatar_url: '/src/assets/images/avatar_maya_chen_1795389987021.jpg',
        job_title: 'Head of Product Design',
        department: 'Design',
        bio: 'Designing calm, focused productivity software and leading design systems at Northstar Studio.',
        timezone: 'America/Los_Angeles',
      },
      {
        key: 'usr-julian',
        email: 'julian@trellas.app',
        full_name: 'Julian Wright',
        avatar_url: '/src/assets/images/avatar_julian_wright_1795389986590.jpg',
        job_title: 'Staff Frontend Engineer',
        department: 'Engineering',
        bio: 'Focused on web performance, accessible UI components, and real-time collaboration interfaces.',
        timezone: 'Europe/London',
      },
      {
        key: 'usr-priya',
        email: 'priya@trellas.app',
        full_name: 'Priya Rao',
        avatar_url: '/src/assets/images/avatar_priya_rao_1795389986691.jpg',
        job_title: 'Engineering Manager',
        department: 'Engineering',
        bio: 'Leading platform reliability, delivery cadence, and cross-functional engineering squads.',
        timezone: 'America/New_York',
      },
      {
        key: 'usr-theo',
        email: 'theo@trellas.app',
        full_name: 'Theo Silva',
        avatar_url: '/src/assets/images/avatar_theo_silva_1795389986722.jpg',
        job_title: 'Product Marketing Lead',
        department: 'Marketing',
        bio: 'Bringing clarity to product launches, customer storytelling, and GTM operations.',
        timezone: 'America/Chicago',
      },
    ];

    const idMap: Record<string, string> = {};
    for (const spec of demoSpecs) {
      idMap[spec.key] = await findOrCreateAuthUser(admin, {
        email: spec.email,
        password: 'TrellasDemo2026!',
        full_name: spec.full_name,
        avatar_url: spec.avatar_url,
      });
    }

    const mayaId = idMap['usr-maya'];
    const julianId = idMap['usr-julian'];
    const priyaId = idMap['usr-priya'];
    const theoId = idMap['usr-theo'];

    const { error: uErr } = await admin.from('users').upsert(
      demoSpecs.map((s) => ({
        id: idMap[s.key],
        email: s.email,
        full_name: s.full_name,
        avatar_url: s.avatar_url,
        job_title: s.job_title,
        department: s.department,
        bio: s.bio,
        timezone: s.timezone,
        email_verified: true,
        created_at: now,
        updated_at: now,
      })),
      { onConflict: 'id' },
    );
    if (uErr) throw uErr;

    const { error: pErr } = await admin.from('user_preferences').upsert(
      demoSpecs.map((s) => ({
        user_id: idMap[s.key],
        theme: 'light',
        language: 'en-US',
        date_format: 'MMM d, yyyy',
        time_format: '12h',
        notify_assignments: true,
        notify_mentions: true,
        notify_comments: true,
        notify_deadlines: true,
        notify_updates: true,
        sidebar_collapsed: false,
        pinned_pages: ['dashboard', 'my-tasks', 'projects', 'reports'],
        updated_at: now,
      })),
      { onConflict: 'user_id' },
    );
    if (pErr) throw pErr;

    await admin.from('project_templates').upsert(
      SYSTEM_TEMPLATES.map((t) => ({
        id: t.id,
        workspace_id: null,
        name: t.name,
        category: t.category,
        description: t.description,
        color: t.color,
        columns_json: t.columns,
        sample_tasks_json: t.sample_tasks,
        is_system: true,
        created_by: null,
        created_at: now,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );

    const { data: existingWs } = await admin
      .from('workspaces')
      .select('id')
      .eq('id', 'ws-northstar')
      .maybeSingle();

    if (existingWs) {
      await admin.from('workspace_members').upsert(
        [
          { id: 'wm-1', workspace_id: 'ws-northstar', user_id: mayaId, role: 'owner', joined_at: now },
          { id: 'wm-2', workspace_id: 'ws-northstar', user_id: priyaId, role: 'admin', joined_at: now },
          { id: 'wm-3', workspace_id: 'ws-northstar', user_id: julianId, role: 'project_manager', joined_at: now },
          { id: 'wm-4', workspace_id: 'ws-northstar', user_id: theoId, role: 'member', joined_at: now },
        ],
        { onConflict: 'workspace_id,user_id', ignoreDuplicates: true },
      );
      return { status: 200, data: { seeded: false, alreadyPresent: true } };
    }

    const { error: wsErr } = await admin.from('workspaces').upsert(
      [
        {
          id: 'ws-northstar',
          name: 'Northstar Studio',
          slug: 'northstar-studio',
          description: 'Primary product, design, and engineering studio workspace.',
          logo_color: '#1B3B2B',
          logo_initials: 'NS',
          owner_id: mayaId,
          plan: 'business',
          created_at: now,
          updated_at: now,
        },
        {
          id: 'ws-personal',
          name: 'Personal Focus',
          slug: 'personal-focus',
          description: 'Maya personal planning and side-project sandbox.',
          logo_color: '#3B5998',
          logo_initials: 'PF',
          owner_id: mayaId,
          plan: 'pro',
          created_at: now,
          updated_at: now,
        },
      ],
      { onConflict: 'id' },
    );
    if (wsErr) throw wsErr;

    await admin.from('workspace_members').upsert(
      [
        { id: 'wm-1', workspace_id: 'ws-northstar', user_id: mayaId, role: 'owner', joined_at: now },
        { id: 'wm-2', workspace_id: 'ws-northstar', user_id: priyaId, role: 'admin', joined_at: now },
        { id: 'wm-3', workspace_id: 'ws-northstar', user_id: julianId, role: 'project_manager', joined_at: now },
        { id: 'wm-4', workspace_id: 'ws-northstar', user_id: theoId, role: 'member', joined_at: now },
        { id: 'wm-5', workspace_id: 'ws-personal', user_id: mayaId, role: 'owner', joined_at: now },
      ],
      { onConflict: 'id' },
    );

    await admin.from('workspace_invitations').upsert(
      [
        {
          id: 'inv-1',
          workspace_id: 'ws-northstar',
          email: 'elena.vance@northstar.io',
          role: 'member',
          invited_by: mayaId,
          status: 'pending',
          token: crypto.randomBytes(12).toString('hex'),
          created_at: now,
        },
      ],
      { onConflict: 'id' },
    );

    const projects = [
      {
        id: 'prj-website',
        workspace_id: 'ws-northstar',
        name: 'Website Redesign',
        description: 'Complete marketing site relaunch with calm editorial typography, updated pricing, and interactive product tours.',
        color: '#1B3B2B',
        category: 'Design & Web',
        status: 'in_progress',
        priority: 'urgent',
        owner_id: mayaId,
        manager_id: mayaId,
        start_date: isoDayOffset(-18),
        due_date: isoDayOffset(12),
        is_pinned: true,
      },
      {
        id: 'prj-mobile',
        workspace_id: 'ws-northstar',
        name: 'Mobile Application Development',
        description: 'Native iOS and Android companion app supporting offline task capture, push alerts, and quick board triage.',
        color: '#2563EB',
        category: 'Engineering',
        status: 'in_progress',
        priority: 'high',
        owner_id: priyaId,
        manager_id: julianId,
        start_date: isoDayOffset(-25),
        due_date: isoDayOffset(28),
        is_pinned: true,
      },
      {
        id: 'prj-marketing',
        workspace_id: 'ws-northstar',
        name: 'Marketing Campaign',
        description: 'Q4 customer acquisition push across organic editorial, partner webinars, and lifecycle onboarding emails.',
        color: '#7C3AED',
        category: 'Marketing',
        status: 'in_progress',
        priority: 'high',
        owner_id: theoId,
        manager_id: theoId,
        start_date: isoDayOffset(-10),
        due_date: isoDayOffset(18),
        is_pinned: false,
      },
      {
        id: 'prj-launch',
        workspace_id: 'ws-northstar',
        name: 'Product Launch',
        description: 'Coordinated v2.4 workspace release across customer docs, changelog announcements, and beta migration.',
        color: '#C99A4E',
        category: 'Product',
        status: 'planning',
        priority: 'medium',
        owner_id: mayaId,
        manager_id: priyaId,
        start_date: isoDayOffset(-4),
        due_date: isoDayOffset(35),
        is_pinned: false,
      },
      {
        id: 'prj-ops',
        workspace_id: 'ws-northstar',
        name: 'Business Operations',
        description: 'SOC2 readiness documentation, quarterly vendor audits, and new-hire workspace onboarding playbooks.',
        color: '#0F766E',
        category: 'Operations',
        status: 'completed',
        priority: 'low',
        owner_id: priyaId,
        manager_id: priyaId,
        start_date: isoDayOffset(-45),
        due_date: isoDayOffset(-3),
        is_pinned: false,
      },
      {
        id: 'prj-personal-1',
        workspace_id: 'ws-personal',
        name: 'Q4 Reading & Deep Work',
        description: 'Personal research notes, design book highlights, and weekly reflection routines.',
        color: '#1B3B2B',
        category: 'Personal',
        status: 'in_progress',
        priority: 'medium',
        owner_id: mayaId,
        manager_id: mayaId,
        start_date: isoDayOffset(-7),
        due_date: isoDayOffset(21),
        is_pinned: true,
      },
    ];

    await admin.from('projects').upsert(
      projects.map((p) => ({ ...p, is_archived: false, is_demo: true, created_at: now, updated_at: now })),
      { onConflict: 'id' },
    );

    const defaultCols = [
      { suffix: 'backlog', name: 'Backlog', pos: 0, color: '#64748B', status_key: 'backlog' },
      { suffix: 'todo', name: 'To Do', pos: 1, color: '#3B82F6', status_key: 'todo' },
      { suffix: 'in_progress', name: 'In Progress', pos: 2, color: '#C99A4E', status_key: 'in_progress' },
      { suffix: 'in_review', name: 'In Review', pos: 3, color: '#8B5CF6', status_key: 'in_review' },
      { suffix: 'completed', name: 'Completed', pos: 4, color: '#16A34A', status_key: 'completed' },
    ];

    const boardsRows: Array<Record<string, unknown>> = [];
    const colRows: Array<Record<string, unknown>> = [];
    const pmRows: Array<Record<string, unknown>> = [];
    const colLookup: Record<string, Record<string, string>> = {};

    for (const p of projects) {
      const boardId = `brd-${p.id}`;
      boardsRows.push({ id: boardId, project_id: p.id, name: 'Main Board', created_at: now });
      colLookup[p.id] = {};
      for (const c of defaultCols) {
        const colId = `col-${p.id}-${c.suffix}`;
        colRows.push({
          id: colId,
          board_id: boardId,
          name: c.name,
          position: c.pos,
          color: c.color,
          status_key: c.status_key,
          created_at: now,
        });
        colLookup[p.id][c.status_key] = colId;
      }
      if (p.workspace_id === 'ws-northstar') {
        pmRows.push(
          { id: `pm-${p.id}-maya`, project_id: p.id, user_id: mayaId, role: p.manager_id === mayaId ? 'lead' : 'member', added_at: now },
          { id: `pm-${p.id}-julian`, project_id: p.id, user_id: julianId, role: p.manager_id === julianId ? 'lead' : 'member', added_at: now },
          { id: `pm-${p.id}-priya`, project_id: p.id, user_id: priyaId, role: p.manager_id === priyaId ? 'lead' : 'member', added_at: now },
          { id: `pm-${p.id}-theo`, project_id: p.id, user_id: theoId, role: p.manager_id === theoId ? 'lead' : 'member', added_at: now },
        );
      } else {
        pmRows.push({ id: `pm-${p.id}-maya`, project_id: p.id, user_id: mayaId, role: 'lead', added_at: now });
      }
    }

    await admin.from('boards').upsert(boardsRows, { onConflict: 'id' });
    await admin.from('board_columns').upsert(colRows, { onConflict: 'id' });
    await admin.from('project_members').upsert(pmRows, { onConflict: 'id' });

    await admin.from('project_milestones').upsert(
      [
        { id: 'ms-1', project_id: 'prj-website', title: 'Design System Freeze', description: 'Final sign-off on typography, color tokens, and landing components.', due_date: isoDayOffset(-3), completed: true, created_at: now },
        { id: 'ms-2', project_id: 'prj-website', title: 'Public Website Cutover', description: 'DNS switch, redirects verified, and production smoke test.', due_date: isoDayOffset(12), completed: false, created_at: now },
        { id: 'ms-3', project_id: 'prj-mobile', title: 'TestFlight Beta Release', description: 'Internal dogfooding build distributed to all team members.', due_date: isoDayOffset(9), completed: false, created_at: now },
        { id: 'ms-4', project_id: 'prj-marketing', title: 'Campaign Launch Day', description: 'Email sequences, landing pages, and social announcements live.', due_date: isoDayOffset(14), completed: false, created_at: now },
      ],
      { onConflict: 'id' },
    );

    await admin.from('project_discussions').upsert(
      [
        {
          id: 'disc-1',
          project_id: 'prj-website',
          user_id: mayaId,
          title: 'Editorial typography & contrast verification',
          body: 'We settled on Fraunces for hero headlines paired with Plus Jakarta Sans for interface controls. Contrast ratios across both light ivory and dark charcoal modes pass 4.5:1.',
          created_at: isoHourOffset(-28),
          updated_at: isoHourOffset(-28),
        },
        {
          id: 'disc-2',
          project_id: 'prj-website',
          user_id: julianId,
          title: 'Redirect map for legacy /blog URLs',
          body: 'All 48 legacy marketing URLs have been mapped to the new /journal routes. QA pass on Safari and mobile viewport will wrap up today.',
          created_at: isoHourOffset(-6),
          updated_at: isoHourOffset(-6),
        },
      ],
      { onConflict: 'id' },
    );

    const demoTasks = [
      { id: 'tsk-1', workspace_id: 'ws-northstar', project_id: 'prj-website', title: 'Migrate blog content to the new CMS', description: 'Export 42 existing editorial posts, normalize frontmatter tags, and verify canonical image paths in the new CMS.', status: 'todo', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(-1), due_date: isoDayOffset(3), estimated_minutes: 180, labels: ['Content', 'CMS'], assignees: [theoId, mayaId], created_by: mayaId },
      { id: 'tsk-2', workspace_id: 'ws-northstar', project_id: 'prj-website', title: 'QA pass on Safari and mobile', description: 'Test sticky navigation height, drawer transitions, and touch targets at 390px and 768px breakpoints.', status: 'todo', priority: 'high', task_type: 'bug', position: 1, start_date: isoDayOffset(-4), due_date: isoDayOffset(-1), estimated_minutes: 120, labels: ['Bug', 'QA'], assignees: [julianId], created_by: priyaId },
      { id: 'tsk-3', workspace_id: 'ws-northstar', project_id: 'prj-website', title: 'Build the responsive navigation', description: 'Implement collapsible mobile drawer, keyboard focus trap, and crisp single-line top bar contract.', status: 'in_progress', priority: 'urgent', task_type: 'feature', position: 0, start_date: isoDayOffset(-2), due_date: isoDayOffset(0), estimated_minutes: 240, labels: ['Engineering', 'UI'], assignees: [julianId, mayaId], created_by: mayaId },
      { id: 'tsk-4', workspace_id: 'ws-northstar', project_id: 'prj-website', title: 'Set up the redirect map', description: 'Configure 301 redirect rules for legacy landing pages and verify zero 404 regressions.', status: 'in_progress', priority: 'low', task_type: 'task', position: 1, start_date: isoDayOffset(-1), due_date: isoDayOffset(2), estimated_minutes: 90, labels: ['Engineering', 'SEO'], assignees: [priyaId], created_by: julianId },
      { id: 'tsk-5', workspace_id: 'ws-northstar', project_id: 'prj-website', title: 'Wireframe homepage and pricing', description: 'Finalize hero interactive preview layout, pricing tier comparison table, and FAQ accordion copy.', status: 'in_review', priority: 'high', task_type: 'feature', position: 0, start_date: isoDayOffset(-5), due_date: isoDayOffset(0), estimated_minutes: 210, labels: ['Design'], assignees: [mayaId], created_by: mayaId },
      { id: 'tsk-6', workspace_id: 'ws-northstar', project_id: 'prj-website', title: 'Audit Core Web Vitals & font loading', description: 'Preconnect Google Fonts, eliminate layout shift on hero card render, and verify <1.2s LCP.', status: 'completed', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(-8), due_date: isoDayOffset(-2), estimated_minutes: 120, labels: ['Performance'], assignees: [julianId], created_by: priyaId },
      { id: 'tsk-7', workspace_id: 'ws-northstar', project_id: 'prj-website', title: 'Draft privacy & cookie preference modal', description: 'Create calm, accessible consent banner matching the warm ivory visual language.', status: 'backlog', priority: 'low', task_type: 'task', position: 0, start_date: isoDayOffset(4), due_date: isoDayOffset(9), estimated_minutes: 90, labels: ['Legal', 'UI'], assignees: [theoId], created_by: mayaId },
      { id: 'tsk-8', workspace_id: 'ws-northstar', project_id: 'prj-mobile', title: 'Implement offline SQLite task cache sync', description: 'Queue optimistic task status changes while offline and reconcile with server timestamps upon reconnect.', status: 'in_progress', priority: 'urgent', task_type: 'feature', position: 0, start_date: isoDayOffset(-3), due_date: isoDayOffset(0), estimated_minutes: 360, labels: ['Mobile', 'Sync'], assignees: [julianId, priyaId], created_by: priyaId },
      { id: 'tsk-9', workspace_id: 'ws-northstar', project_id: 'prj-mobile', title: 'Design swipe-to-complete gesture interactions', description: 'Prototype tactile card swipe physics and haptic confirmation thresholds for iOS and Android.', status: 'in_review', priority: 'high', task_type: 'feature', position: 0, start_date: isoDayOffset(-6), due_date: isoDayOffset(-2), estimated_minutes: 180, labels: ['Design', 'Mobile'], assignees: [mayaId], created_by: mayaId },
      { id: 'tsk-10', workspace_id: 'ws-northstar', project_id: 'prj-mobile', title: 'Configure APNs & FCM push notification keys', description: 'Provision notification certificates and test deep linking directly into task detail drawers.', status: 'todo', priority: 'high', task_type: 'task', position: 0, start_date: isoDayOffset(1), due_date: isoDayOffset(5), estimated_minutes: 150, labels: ['Infra', 'Mobile'], assignees: [priyaId], created_by: priyaId },
      { id: 'tsk-11', workspace_id: 'ws-northstar', project_id: 'prj-mobile', title: 'App Store & Play Store screenshot kit', description: 'Render device showcase frames highlighting Board, Calendar, and Inbox views.', status: 'backlog', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(6), due_date: isoDayOffset(15), estimated_minutes: 180, labels: ['Design', 'Marketing'], assignees: [mayaId, theoId], created_by: theoId },
      { id: 'tsk-12', workspace_id: 'ws-northstar', project_id: 'prj-marketing', title: 'Publish customer spotlight interview series', description: 'Edit and schedule 3 founder stories showing how small studios replaced 5 tools with Trellas.', status: 'in_progress', priority: 'high', task_type: 'story', position: 0, start_date: isoDayOffset(-2), due_date: isoDayOffset(1), estimated_minutes: 240, labels: ['Content', 'Campaign'], assignees: [theoId], created_by: theoId },
      { id: 'tsk-13', workspace_id: 'ws-northstar', project_id: 'prj-marketing', title: 'Set up lifecycle onboarding email drip', description: 'Write 4 concise emails guiding new workspace owners from template setup to first team invite.', status: 'todo', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(0), due_date: isoDayOffset(4), estimated_minutes: 150, labels: ['Email', 'Growth'], assignees: [theoId, mayaId], created_by: mayaId },
      { id: 'tsk-14', workspace_id: 'ws-northstar', project_id: 'prj-marketing', title: 'Review Q4 paid search keyword exclusions', description: 'Eliminate low-intent broad match terms and reallocate budget to project template queries.', status: 'completed', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(-10), due_date: isoDayOffset(-4), estimated_minutes: 90, labels: ['Analytics'], assignees: [theoId], created_by: theoId },
      { id: 'tsk-15', workspace_id: 'ws-northstar', project_id: 'prj-launch', title: 'Prepare v2.4 release notes & migration guide', description: 'Document new Gantt timeline dragging, bulk task actions, and workspace role permissions.', status: 'todo', priority: 'high', task_type: 'task', position: 0, start_date: isoDayOffset(2), due_date: isoDayOffset(8), estimated_minutes: 120, labels: ['Docs', 'Launch'], assignees: [mayaId, theoId], created_by: priyaId },
      { id: 'tsk-16', workspace_id: 'ws-northstar', project_id: 'prj-launch', title: 'Run load test on real-time board endpoints', description: 'Verify P95 latency stays below 80ms under 500 concurrent board updates.', status: 'in_progress', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(-1), due_date: isoDayOffset(6), estimated_minutes: 180, labels: ['Engineering', 'QA'], assignees: [priyaId, julianId], created_by: priyaId },
      { id: 'tsk-17', workspace_id: 'ws-northstar', project_id: 'prj-ops', title: 'Complete Q4 SaaS vendor cost review', description: 'Consolidate duplicate subscriptions and archive unused team seats.', status: 'completed', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(-20), due_date: isoDayOffset(-7), estimated_minutes: 120, labels: ['Finance'], assignees: [priyaId], created_by: priyaId },
      { id: 'tsk-18', workspace_id: 'ws-northstar', project_id: 'prj-ops', title: 'Update security incident response checklist', description: 'Verify escalation contacts and quarterly tabletop drill schedule.', status: 'completed', priority: 'high', task_type: 'task', position: 1, start_date: isoDayOffset(-15), due_date: isoDayOffset(-5), estimated_minutes: 90, labels: ['Security'], assignees: [priyaId, julianId], created_by: priyaId },
      { id: 'tsk-19', workspace_id: 'ws-personal', project_id: 'prj-personal-1', title: 'Summarize notes from Designing Calm Interfaces', description: 'Extract top 5 typography and spacing heuristics for next studio critique.', status: 'in_progress', priority: 'medium', task_type: 'task', position: 0, start_date: isoDayOffset(0), due_date: isoDayOffset(3), estimated_minutes: 60, labels: ['Reading'], assignees: [mayaId], created_by: mayaId },
    ];

    await admin.from('tasks').upsert(
      demoTasks.map((t) => ({
        id: t.id,
        workspace_id: t.workspace_id,
        project_id: t.project_id,
        board_id: `brd-${t.project_id}`,
        column_id: colLookup[t.project_id][t.status],
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
        created_by: t.created_by,
        created_at: now,
        updated_at: now,
      })),
      { onConflict: 'id' },
    );

    const taRows: Array<Record<string, unknown>> = [];
    for (const t of demoTasks) {
      t.assignees.forEach((uid, idx) => {
        taRows.push({
          id: `ta-${t.id}-${idx}`,
          task_id: t.id,
          user_id: uid,
          is_primary: idx === 0,
          assigned_at: now,
        });
      });
    }
    await admin.from('task_assignees').upsert(taRows, { onConflict: 'id' });

    await admin.from('subtasks').upsert(
      [
        { id: 'sub-1', task_id: 'tsk-3', title: 'Implement desktop mega-menu keyboard Escape handler', completed: true, assignee_id: julianId, due_date: isoDayOffset(0), position: 0, created_at: now },
        { id: 'sub-2', task_id: 'tsk-3', title: 'Verify mobile slide-over drawer scroll lock', completed: true, assignee_id: mayaId, due_date: isoDayOffset(0), position: 1, created_at: now },
        { id: 'sub-3', task_id: 'tsk-3', title: 'Add reduced-motion transition fallback', completed: false, assignee_id: julianId, due_date: isoDayOffset(0), position: 2, created_at: now },
        { id: 'sub-4', task_id: 'tsk-5', title: 'Export updated hero preview snapshot', completed: true, assignee_id: mayaId, due_date: isoDayOffset(0), position: 0, created_at: now },
        { id: 'sub-5', task_id: 'tsk-5', title: 'Finalize Business vs Enterprise plan copy', completed: false, assignee_id: theoId, due_date: isoDayOffset(1), position: 1, created_at: now },
      ],
      { onConflict: 'id' },
    );

    await admin.from('checklists').upsert(
      [
        { id: 'chk-1', task_id: 'tsk-3', title: 'Accessibility & Viewport Checks', position: 0, created_at: now },
        { id: 'chk-2', task_id: 'tsk-5', title: 'Pricing Section Readiness', position: 0, created_at: now },
      ],
      { onConflict: 'id' },
    );

    await admin.from('checklist_items').upsert(
      [
        { id: 'ci-1', checklist_id: 'chk-1', text: '44px minimum touch target on mobile menu toggle', completed: true, position: 0, created_at: now },
        { id: 'ci-2', checklist_id: 'chk-1', text: 'Visible focus-visible outline on all nav links', completed: true, position: 1, created_at: now },
        { id: 'ci-3', checklist_id: 'chk-1', text: 'Zero horizontal overflow at 375px width', completed: false, position: 2, created_at: now },
        { id: 'ci-4', checklist_id: 'chk-2', text: 'Display Free, Pro, Business, and Enterprise tiers', completed: true, position: 0, created_at: now },
        { id: 'ci-5', checklist_id: 'chk-2', text: 'Verify FAQ accordion contrast in dark mode', completed: true, position: 1, created_at: now },
      ],
      { onConflict: 'id' },
    );

    await admin.from('task_dependencies').upsert(
      [
        { id: 'dep-1', task_id: 'tsk-2', related_task_id: 'tsk-3', dependency_type: 'blocked_by', created_at: now },
        { id: 'dep-2', task_id: 'tsk-3', related_task_id: 'tsk-2', dependency_type: 'blocking', created_at: now },
        { id: 'dep-3', task_id: 'tsk-1', related_task_id: 'tsk-4', dependency_type: 'related_to', created_at: now },
      ],
      { onConflict: 'id' },
    );

    await admin.from('comments').upsert(
      [
        {
          id: 'cmt-1',
          task_id: 'tsk-3',
          user_id: mayaId,
          parent_comment_id: null,
          body: '@Julian Wright the spacing on the top navigation bar looks super clean now. Let us double check the mobile drawer backdrop opacity.',
          mentions: [julianId],
          created_at: isoHourOffset(-5),
          updated_at: isoHourOffset(-5),
        },
        {
          id: 'cmt-2',
          task_id: 'tsk-3',
          user_id: julianId,
          parent_comment_id: null,
          body: 'Updated the backdrop blur and reduced-motion preference check. Ready for final look @Maya Chen.',
          mentions: [mayaId],
          created_at: isoHourOffset(-2),
          updated_at: isoHourOffset(-2),
        },
        {
          id: 'cmt-3',
          task_id: 'tsk-5',
          user_id: theoId,
          parent_comment_id: null,
          body: 'Reviewed the Enterprise plan wording — feels clear and grounded.',
          mentions: [],
          created_at: isoHourOffset(-3),
          updated_at: isoHourOffset(-3),
        },
      ],
      { onConflict: 'id' },
    );

    await admin.from('comment_reactions').upsert(
      [{ id: 'cr-1', comment_id: 'cmt-2', user_id: mayaId, emoji: '👍', created_at: isoHourOffset(-1) }],
      { onConflict: 'id' },
    );

    const sampleBriefBody =
      'Trellas Website Redesign — Architecture Brief\n\n1. Warm alabaster canvas (#FAF9F6) with deep forest emerald primary accents (#1B3B2B).\n2. Fraunces editorial headlines paired with Plus Jakarta Sans UI controls.\n3. Full keyboard accessibility and dark mode parity.\n';
    const sampleBriefBytes = new TextEncoder().encode(sampleBriefBody);
    const storagePath = 'ws-northstar/seed-website-brief.txt';
    await admin.storage.from('trellas-files').upload(storagePath, sampleBriefBytes, {
      contentType: 'text/plain',
      upsert: true,
    });

    await admin.from('attachments').upsert(
      [
        {
          id: 'att-1',
          workspace_id: 'ws-northstar',
          project_id: 'prj-website',
          task_id: 'tsk-5',
          comment_id: null,
          uploaded_by: mayaId,
          original_name: 'sample_website_architecture_brief.txt',
          stored_name: storagePath,
          mime_type: 'text/plain',
          size_bytes: sampleBriefBytes.length,
          created_at: isoHourOffset(-12),
        },
      ],
      { onConflict: 'id' },
    );

    await admin.from('time_entries').upsert(
      [
        { id: 'te-1', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-3', user_id: julianId, description: 'Implemented responsive navigation drawer', duration_seconds: 5400, started_at: isoHourOffset(-8), ended_at: isoHourOffset(-6), is_running: false, created_at: now },
        { id: 'te-2', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-5', user_id: mayaId, description: 'Hero layout & pricing table refinement', duration_seconds: 4500, started_at: isoHourOffset(-14), ended_at: isoHourOffset(-12), is_running: false, created_at: now },
        { id: 'te-3', workspace_id: 'ws-northstar', project_id: 'prj-mobile', task_id: 'tsk-8', user_id: priyaId, description: 'Reviewed offline sync conflict strategy', duration_seconds: 3600, started_at: isoHourOffset(-24), ended_at: isoHourOffset(-23), is_running: false, created_at: now },
      ],
      { onConflict: 'id' },
    );

    await admin.from('notifications').upsert(
      [
        { id: 'ntf-1', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: julianId, category: 'mention', title: 'Julian Wright mentioned you', message: 'Mentioned you on "Build the responsive navigation"', link_type: 'task', link_id: 'tsk-3', is_read: false, created_at: isoHourOffset(-2) },
        { id: 'ntf-2', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: theoId, category: 'comment', title: 'New comment on Wireframe homepage', message: 'Theo Silva commented on "Wireframe homepage and pricing"', link_type: 'task', link_id: 'tsk-5', is_read: false, created_at: isoHourOffset(-3) },
        { id: 'ntf-3', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: priyaId, category: 'deadline', title: 'Task due today', message: '"Build the responsive navigation" is scheduled for today', link_type: 'task', link_id: 'tsk-3', is_read: false, created_at: isoHourOffset(-5) },
        { id: 'ntf-4', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: priyaId, category: 'assignment', title: 'Assigned to Product Launch task', message: 'Priya Rao assigned you to "Prepare v2.4 release notes & migration guide"', link_type: 'task', link_id: 'tsk-15', is_read: true, created_at: isoHourOffset(-20) },
      ],
      { onConflict: 'id' },
    );

    await admin.from('activity_logs').upsert(
      [
        { id: 'act-1', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-3', user_id: julianId, action: 'commented', details: 'Posted an update on "Build the responsive navigation"', created_at: isoHourOffset(-2) },
        { id: 'act-2', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-5', user_id: theoId, action: 'commented', details: 'Reviewed pricing tier copy on "Wireframe homepage and pricing"', created_at: isoHourOffset(-3) },
        { id: 'act-3', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-6', user_id: julianId, action: 'completed_task', details: 'Marked "Audit Core Web Vitals & font loading" as Completed', created_at: isoHourOffset(-10) },
        { id: 'act-4', workspace_id: 'ws-northstar', project_id: 'prj-ops', task_id: 'tsk-18', user_id: priyaId, action: 'completed_project', details: 'Completed project "Business Operations"', created_at: isoHourOffset(-24) },
        { id: 'act-5', workspace_id: 'ws-northstar', project_id: 'prj-launch', task_id: null, user_id: mayaId, action: 'created_project', details: 'Created project "Product Launch"', created_at: isoHourOffset(-36) },
      ],
      { onConflict: 'id' },
    );

    return { status: 200, data: { seeded: true } };
  } catch (err) {
    console.error('Supabase demo seed failed:', err);
    return { status: 500, data: { error: err instanceof Error ? err.message : 'Demo workspace seeding failed' } };
  }
}

export async function onboardSupabaseUserAdmin(
  admin: SupabaseClient,
  authUser: SupabaseAuthUser,
  body: Record<string, unknown> = {},
): Promise<AdminResult<{ created: boolean; workspace_id: string }>> {
  const uid = authUser.id;
  const email = (authUser.email || '').trim().toLowerCase();
  const now = new Date().toISOString();

  try {
    const fullName =
      String(body?.full_name || authUser.user_metadata?.full_name || email.split('@')[0] || 'Trellas User').trim();

    await admin.from('users').upsert(
      {
        id: uid,
        email,
        full_name: fullName,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        email_verified: Boolean(authUser.email_confirmed_at),
        created_at: now,
        updated_at: now,
      },
      { onConflict: 'id' },
    );
    await admin.from('user_preferences').upsert(
      {
        user_id: uid,
        updated_at: now,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

    if (email) {
      const { data: pendingInvs } = await admin
        .from('workspace_invitations')
        .select('id, workspace_id, role')
        .ilike('email', email)
        .eq('status', 'pending');

      if (pendingInvs && pendingInvs.length > 0) {
        for (const inv of pendingInvs) {
          await admin.from('workspace_members').upsert(
            {
              id: crypto.randomUUID(),
              workspace_id: inv.workspace_id,
              user_id: uid,
              role: inv.role,
              joined_at: now,
            },
            { onConflict: 'workspace_id,user_id', ignoreDuplicates: true },
          );
          await admin.from('workspace_invitations').update({ status: 'accepted' }).eq('id', inv.id);
        }
      }
    }

    const { data: memberships } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', uid);

    if (memberships && memberships.length > 0 && !body?.force_create) {
      return { status: 200, data: { created: false, workspace_id: memberships[0].workspace_id } };
    }

    const rawWsName = String(body?.workspace_name || authUser.user_metadata?.workspace_name || '').trim();
    const wsName = rawWsName || `${fullName.split(' ')[0]}'s Workspace`;
    const slugBase = wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    const initials = wsName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'TR';
    const wsId = crypto.randomUUID();

    const { error: wsErr } = await admin.from('workspaces').insert({
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
    if (wsErr) throw wsErr;

    await admin.from('workspace_members').insert({
      id: crypto.randomUUID(),
      workspace_id: wsId,
      user_id: uid,
      role: 'owner',
      joined_at: now,
    });

    const includeSample =
      body?.include_sample_data !== undefined
        ? Boolean(body.include_sample_data)
        : authUser.user_metadata?.include_sample_data !== false;

    if (includeSample) {
      const prjId = crypto.randomUUID();
      const boardId = crypto.randomUUID();
      await admin.from('projects').insert({
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
        start_date: isoDayOffset(0),
        due_date: isoDayOffset(14),
        is_pinned: true,
        is_demo: true,
        created_at: now,
        updated_at: now,
      });
      await admin.from('project_members').insert({
        id: crypto.randomUUID(),
        project_id: prjId,
        user_id: uid,
        role: 'lead',
        added_at: now,
      });
      await admin.from('boards').insert({ id: boardId, project_id: prjId, name: 'Main Board', created_at: now });

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
      await admin.from('board_columns').insert(colInserts);

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

      await admin.from('tasks').insert(
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
          start_date: isoDayOffset(0),
          due_date: isoDayOffset(st.due),
          estimated_minutes: 30,
          labels: ['Starter'],
          is_demo: true,
          created_by: uid,
          created_at: now,
          updated_at: now,
        })),
      );
      await admin.from('task_assignees').insert(
        starterTasks.map((st) => ({
          id: crypto.randomUUID(),
          task_id: st.id,
          user_id: uid,
          is_primary: true,
          assigned_at: now,
        })),
      );
    }

    return { status: 201, data: { created: true, workspace_id: wsId } };
  } catch (err) {
    console.error('Supabase onboarding failed:', err);
    return { status: 500, data: { error: err instanceof Error ? err.message : 'Workspace onboarding failed' } };
  }
}

export async function inviteWorkspaceMemberAdmin(
  admin: SupabaseClient,
  uid: string,
  workspaceId: string,
  body: Record<string, unknown> = {},
): Promise<AdminResult<{ id?: string; status: string; user_id?: string }>> {
  const { email, role = 'member' } = body;

  try {
    const { data: callerMem } = await admin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', uid)
      .maybeSingle();

    if (!callerMem || !['owner', 'admin'].includes(callerMem.role)) {
      return { status: 403, data: { error: 'Only workspace admins can invite members' } };
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { status: 400, data: { error: 'Valid email is required' } };
    }
    const allowedRoles = ['admin', 'project_manager', 'member', 'guest'];
    const safeRole = allowedRoles.includes(String(role)) ? String(role) : 'member';
    const now = new Date().toISOString();

    const { data: existingUser } = await admin
      .from('users')
      .select('id, full_name')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingUser) {
      const { data: existingMem } = await admin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (existingMem) {
        return { status: 409, data: { error: 'User is already a workspace member' } };
      }

      await admin.from('workspace_members').insert({
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        user_id: existingUser.id,
        role: safeRole,
        joined_at: now,
      });

      await admin.from('notifications').insert({
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        user_id: existingUser.id,
        actor_id: uid,
        category: 'invitation',
        title: 'Added to workspace',
        message: `You were added to the workspace as ${safeRole}.`,
        link_type: 'team',
        link_id: workspaceId,
        is_read: false,
        created_at: now,
      });

      await admin.from('activity_logs').insert({
        id: crypto.randomUUID(),
        workspace_id: workspaceId,
        user_id: uid,
        action: 'added_member',
        details: `Added ${existingUser.full_name} (${cleanEmail}) as ${safeRole}`,
        created_at: now,
      });

      return { status: 201, data: { status: 'added_directly', user_id: existingUser.id } };
    }

    const invId = crypto.randomUUID();
    await admin.from('workspace_invitations').insert({
      id: invId,
      workspace_id: workspaceId,
      email: cleanEmail,
      role: safeRole,
      invited_by: uid,
      status: 'pending',
      token: crypto.randomBytes(16).toString('hex'),
      created_at: now,
    });

    await admin.from('activity_logs').insert({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      user_id: uid,
      action: 'invited_member',
      details: `Invited ${cleanEmail} as ${safeRole}`,
      created_at: now,
    });

    return { status: 201, data: { id: invId, status: 'invited' } };
  } catch (err) {
    return { status: 500, data: { error: err instanceof Error ? err.message : 'Invitation failed' } };
  }
}

export async function deleteSupabaseUserAccountAdmin(
  admin: SupabaseClient,
  uid: string,
): Promise<AdminResult<{ ok: boolean }>> {
  const now = new Date().toISOString();

  try {
    await admin.from('workspaces').update({ deleted_at: now }).eq('owner_id', uid).is('deleted_at', null);
    await admin.from('workspace_members').delete().eq('user_id', uid);
    await admin.from('project_members').delete().eq('user_id', uid);
    await admin.from('users').update({ email: `deleted-${uid}@deleted.trellas.app`, updated_at: now }).eq('id', uid);

    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw error;

    return { status: 200, data: { ok: true } };
  } catch (err) {
    return { status: 500, data: { error: err instanceof Error ? err.message : 'Account deletion failed' } };
  }
}

export function registerSupabaseAdminRoutes(app: Express): void {
  // Status check (never leaks secret values)
  app.get('/api/supabase/status', (_req, res) => {
    res.json(getSupabaseStatusPayload());
  });

  // Idempotent Demo Workspace Seeder for Supabase Auth + Postgres + Storage
  app.post('/api/supabase/seed-demo', async (_req, res) => {
    const result = await seedDemoWorkspaceAdmin();
    res.status(result.status).json(result.data);
  });

  // First-time user onboarding (accept pending invitations or scaffold workspace + optional sample project)
  app.post('/api/supabase/onboarding', requireSupabaseJwt, async (req: SupabaseAuthedRequest, res) => {
    const result = await onboardSupabaseUserAdmin(
      req.supabaseAdmin!,
      req.supabaseUser!,
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(result.status).json(result.data);
  });

  // Invite or directly add member to workspace (looks up existing account via service role)
  app.post('/api/supabase/workspaces/:workspaceId/invitations', requireSupabaseJwt, async (req: SupabaseAuthedRequest, res) => {
    const result = await inviteWorkspaceMemberAdmin(
      req.supabaseAdmin!,
      req.supabaseUser!.id,
      req.params.workspaceId,
      (req.body || {}) as Record<string, unknown>,
    );
    res.status(result.status).json(result.data);
  });

  // Permanent account deletion (soft-deletes owned workspaces and removes Auth user)
  app.delete('/api/supabase/account', requireSupabaseJwt, async (req: SupabaseAuthedRequest, res) => {
    const result = await deleteSupabaseUserAccountAdmin(req.supabaseAdmin!, req.supabaseUser!.id);
    res.status(result.status).json(result.data);
  });
}
