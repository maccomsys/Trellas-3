import { SYSTEM_TEMPLATES } from '../../server/templates';
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

const STORAGE_KEY = 'trellas_local_workspace_db_v1';
const SESSION_KEY = 'trellas_local_session_v1';

export class LocalApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface StoredUser extends User {
  password: string;
}

interface StoredBoard {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
}

interface StoredTask {
  id: string;
  workspace_id: string;
  project_id: string;
  board_id: string;
  column_id: string;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityLevel;
  task_type: Task['task_type'];
  position: number;
  start_date: string | null;
  due_date: string | null;
  estimated_minutes: number;
  labels: string[];
  is_demo: number;
  is_archived: number;
  deleted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface StoredTaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  is_primary: number;
  assigned_at: string;
}

interface StoredProject {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  color: string;
  category: string;
  status: Project['status'];
  priority: PriorityLevel;
  owner_id: string;
  manager_id: string;
  start_date: string | null;
  due_date: string | null;
  is_pinned: number;
  is_archived: number;
  is_demo: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'lead' | 'member' | 'viewer';
  added_at: string;
}

interface StoredWorkspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_color: string;
  logo_initials: string;
  owner_id: string;
  plan: Workspace['plan'];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredWorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
}

interface StoredInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  status: WorkspaceInvitation['status'];
  token: string;
  created_at: string;
}

interface StoredDiscussion {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface StoredDependency {
  id: string;
  task_id: string;
  related_task_id: string;
  dependency_type: DependencyType;
  created_at: string;
}

interface StoredComment {
  id: string;
  task_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
}

interface StoredCommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface StoredAttachment {
  id: string;
  workspace_id: string;
  project_id: string | null;
  task_id: string | null;
  comment_id: string | null;
  uploaded_by: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  data_url: string;
  created_at: string;
}

interface StoredChecklist {
  id: string;
  task_id: string;
  title: string;
  position: number;
  created_at: string;
}

interface StoredDb {
  users: StoredUser[];
  preferences: UserPreferences[];
  workspaces: StoredWorkspace[];
  workspace_members: StoredWorkspaceMember[];
  workspace_invitations: StoredInvitation[];
  projects: StoredProject[];
  project_members: StoredProjectMember[];
  project_milestones: ProjectMilestone[];
  project_discussions: StoredDiscussion[];
  boards: StoredBoard[];
  board_columns: BoardColumn[];
  tasks: StoredTask[];
  task_assignees: StoredTaskAssignee[];
  subtasks: Subtask[];
  checklists: StoredChecklist[];
  checklist_items: ChecklistItem[];
  task_dependencies: StoredDependency[];
  comments: StoredComment[];
  comment_reactions: StoredCommentReaction[];
  attachments: StoredAttachment[];
  time_entries: TimeEntry[];
  notifications: NotificationItem[];
  activity_logs: ActivityLog[];
  project_templates: ProjectTemplate[];
  reset_codes: Record<string, string>;
}

interface LocalSessionState {
  token: string;
  user_id: string;
  created_at: string;
}

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

function toPublicUser(u: StoredUser): User {
  const { password: _pw, ...rest } = u;
  return rest;
}

function buildInitialDb(): StoredDb {
  const now = new Date().toISOString();
  const mayaId = 'usr-maya';
  const julianId = 'usr-julian';
  const priyaId = 'usr-priya';
  const theoId = 'usr-theo';

  const users: StoredUser[] = [
    {
      id: mayaId,
      email: 'maya@trellas.app',
      password: 'TrellasDemo2026!',
      full_name: 'Maya Chen',
      avatar_url: '/src/assets/images/avatar_maya_chen_1795389987021.jpg',
      job_title: 'Head of Product Design',
      department: 'Design',
      bio: 'Designing calm, focused productivity software and leading design systems at Northstar Studio.',
      timezone: 'America/Los_Angeles',
      email_verified: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: julianId,
      email: 'julian@trellas.app',
      password: 'TrellasDemo2026!',
      full_name: 'Julian Wright',
      avatar_url: '/src/assets/images/avatar_julian_wright_1795389986590.jpg',
      job_title: 'Staff Frontend Engineer',
      department: 'Engineering',
      bio: 'Focused on web performance, accessible UI components, and real-time collaboration interfaces.',
      timezone: 'Europe/London',
      email_verified: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: priyaId,
      email: 'priya@trellas.app',
      password: 'TrellasDemo2026!',
      full_name: 'Priya Rao',
      avatar_url: '/src/assets/images/avatar_priya_rao_1795389986691.jpg',
      job_title: 'Engineering Manager',
      department: 'Engineering',
      bio: 'Leading platform reliability, delivery cadence, and cross-functional engineering squads.',
      timezone: 'America/New_York',
      email_verified: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: theoId,
      email: 'theo@trellas.app',
      password: 'TrellasDemo2026!',
      full_name: 'Theo Silva',
      avatar_url: '/src/assets/images/avatar_theo_silva_1795389986722.jpg',
      job_title: 'Product Marketing Lead',
      department: 'Marketing',
      bio: 'Bringing clarity to product launches, customer storytelling, and GTM operations.',
      timezone: 'America/Chicago',
      email_verified: 1,
      created_at: now,
      updated_at: now,
    },
  ];

  const preferences: UserPreferences[] = users.map((u) => ({
    user_id: u.id,
    theme: 'light',
    language: 'en-US',
    date_format: 'MMM d, yyyy',
    time_format: '12h',
    notify_assignments: 1,
    notify_mentions: 1,
    notify_comments: 1,
    notify_deadlines: 1,
    notify_updates: 1,
    sidebar_collapsed: 0,
    pinned_pages: ['dashboard', 'my-tasks', 'projects', 'reports'],
  }));

  const workspaces: StoredWorkspace[] = [
    {
      id: 'ws-northstar',
      name: 'Northstar Studio',
      slug: 'northstar-studio',
      description: 'Primary product, design, and engineering studio workspace.',
      logo_color: '#1B3B2B',
      logo_initials: 'NS',
      owner_id: mayaId,
      plan: 'business',
      deleted_at: null,
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
      deleted_at: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const workspace_members: StoredWorkspaceMember[] = [
    { id: 'wm-1', workspace_id: 'ws-northstar', user_id: mayaId, role: 'owner', joined_at: now },
    { id: 'wm-2', workspace_id: 'ws-northstar', user_id: priyaId, role: 'admin', joined_at: now },
    { id: 'wm-3', workspace_id: 'ws-northstar', user_id: julianId, role: 'project_manager', joined_at: now },
    { id: 'wm-4', workspace_id: 'ws-northstar', user_id: theoId, role: 'member', joined_at: now },
    { id: 'wm-5', workspace_id: 'ws-personal', user_id: mayaId, role: 'owner', joined_at: now },
  ];

  const workspace_invitations: StoredInvitation[] = [
    {
      id: 'inv-1',
      workspace_id: 'ws-northstar',
      email: 'elena.vance@northstar.io',
      role: 'member',
      invited_by: mayaId,
      status: 'pending',
      token: 'demo-inv-token-1',
      created_at: now,
    },
  ];

  const projects: StoredProject[] = [
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
      is_pinned: 1,
      is_archived: 0,
      is_demo: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
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
      is_pinned: 1,
      is_archived: 0,
      is_demo: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
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
      is_pinned: 0,
      is_archived: 0,
      is_demo: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
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
      is_pinned: 0,
      is_archived: 0,
      is_demo: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
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
      is_pinned: 0,
      is_archived: 0,
      is_demo: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
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
      is_pinned: 1,
      is_archived: 0,
      is_demo: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const defaultCols: Array<{ suffix: TaskStatus; name: string; pos: number; color: string }> = [
    { suffix: 'backlog', name: 'Backlog', pos: 0, color: '#64748B' },
    { suffix: 'todo', name: 'To Do', pos: 1, color: '#3B82F6' },
    { suffix: 'in_progress', name: 'In Progress', pos: 2, color: '#C99A4E' },
    { suffix: 'in_review', name: 'In Review', pos: 3, color: '#8B5CF6' },
    { suffix: 'completed', name: 'Completed', pos: 4, color: '#16A34A' },
  ];

  const boards: StoredBoard[] = [];
  const board_columns: BoardColumn[] = [];
  const project_members: StoredProjectMember[] = [];
  const colLookup: Record<string, Record<string, string>> = {};

  for (const p of projects) {
    const boardId = `brd-${p.id}`;
    boards.push({ id: boardId, project_id: p.id, name: 'Main Board', created_at: now });
    colLookup[p.id] = {};
    for (const c of defaultCols) {
      const colId = `col-${p.id}-${c.suffix}`;
      board_columns.push({
        id: colId,
        board_id: boardId,
        name: c.name,
        position: c.pos,
        color: c.color,
        status_key: c.suffix,
      });
      colLookup[p.id][c.suffix] = colId;
    }
    if (p.workspace_id === 'ws-northstar') {
      project_members.push(
        { id: `pm-${p.id}-maya`, project_id: p.id, user_id: mayaId, role: p.manager_id === mayaId ? 'lead' : 'member', added_at: now },
        { id: `pm-${p.id}-julian`, project_id: p.id, user_id: julianId, role: p.manager_id === julianId ? 'lead' : 'member', added_at: now },
        { id: `pm-${p.id}-priya`, project_id: p.id, user_id: priyaId, role: p.manager_id === priyaId ? 'lead' : 'member', added_at: now },
        { id: `pm-${p.id}-theo`, project_id: p.id, user_id: theoId, role: p.manager_id === theoId ? 'lead' : 'member', added_at: now },
      );
    } else {
      project_members.push({ id: `pm-${p.id}-maya`, project_id: p.id, user_id: mayaId, role: 'lead', added_at: now });
    }
  }

  const project_milestones: ProjectMilestone[] = [
    { id: 'ms-1', project_id: 'prj-website', title: 'Design System Freeze', description: 'Final sign-off on typography, color tokens, and landing components.', due_date: isoDayOffset(-3), completed: 1, created_at: now },
    { id: 'ms-2', project_id: 'prj-website', title: 'Public Website Cutover', description: 'DNS switch, redirects verified, and production smoke test.', due_date: isoDayOffset(12), completed: 0, created_at: now },
    { id: 'ms-3', project_id: 'prj-mobile', title: 'TestFlight Beta Release', description: 'Internal dogfooding build distributed to all team members.', due_date: isoDayOffset(9), completed: 0, created_at: now },
    { id: 'ms-4', project_id: 'prj-marketing', title: 'Campaign Launch Day', description: 'Email sequences, landing pages, and social announcements live.', due_date: isoDayOffset(14), completed: 0, created_at: now },
  ];

  const project_discussions: StoredDiscussion[] = [
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
  ];

  const demoTaskSpecs: Array<{
    id: string;
    workspace_id: string;
    project_id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: PriorityLevel;
    task_type: Task['task_type'];
    position: number;
    start_date: string;
    due_date: string;
    estimated_minutes: number;
    labels: string[];
    assignees: string[];
    created_by: string;
  }> = [
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

  const tasks: StoredTask[] = demoTaskSpecs.map((t) => ({
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
    is_demo: 1,
    is_archived: 0,
    deleted_at: null,
    created_by: t.created_by,
    created_at: now,
    updated_at: now,
  }));

  const task_assignees: StoredTaskAssignee[] = [];
  for (const t of demoTaskSpecs) {
    t.assignees.forEach((uid, idx) => {
      task_assignees.push({
        id: `ta-${t.id}-${idx}`,
        task_id: t.id,
        user_id: uid,
        is_primary: idx === 0 ? 1 : 0,
        assigned_at: now,
      });
    });
  }

  const subtasks: Subtask[] = [
    { id: 'sub-1', task_id: 'tsk-3', title: 'Implement desktop mega-menu keyboard Escape handler', completed: 1, assignee_id: julianId, due_date: isoDayOffset(0), position: 0 },
    { id: 'sub-2', task_id: 'tsk-3', title: 'Verify mobile slide-over drawer scroll lock', completed: 1, assignee_id: mayaId, due_date: isoDayOffset(0), position: 1 },
    { id: 'sub-3', task_id: 'tsk-3', title: 'Add reduced-motion transition fallback', completed: 0, assignee_id: julianId, due_date: isoDayOffset(0), position: 2 },
    { id: 'sub-4', task_id: 'tsk-5', title: 'Export updated hero preview snapshot', completed: 1, assignee_id: mayaId, due_date: isoDayOffset(0), position: 0 },
    { id: 'sub-5', task_id: 'tsk-5', title: 'Finalize Business vs Enterprise plan copy', completed: 0, assignee_id: theoId, due_date: isoDayOffset(1), position: 1 },
  ];

  const checklists: StoredChecklist[] = [
    { id: 'chk-1', task_id: 'tsk-3', title: 'Accessibility & Viewport Checks', position: 0, created_at: now },
    { id: 'chk-2', task_id: 'tsk-5', title: 'Pricing Section Readiness', position: 0, created_at: now },
  ];

  const checklist_items: ChecklistItem[] = [
    { id: 'ci-1', checklist_id: 'chk-1', text: '44px minimum touch target on mobile menu toggle', completed: 1, position: 0 },
    { id: 'ci-2', checklist_id: 'chk-1', text: 'Visible focus-visible outline on all nav links', completed: 1, position: 1 },
    { id: 'ci-3', checklist_id: 'chk-1', text: 'Zero horizontal overflow at 375px width', completed: 0, position: 2 },
    { id: 'ci-4', checklist_id: 'chk-2', text: 'Display Free, Pro, Business, and Enterprise tiers', completed: 1, position: 0 },
    { id: 'ci-5', checklist_id: 'chk-2', text: 'Verify FAQ accordion contrast in dark mode', completed: 1, position: 1 },
  ];

  const task_dependencies: StoredDependency[] = [
    { id: 'dep-1', task_id: 'tsk-2', related_task_id: 'tsk-3', dependency_type: 'blocked_by', created_at: now },
    { id: 'dep-2', task_id: 'tsk-3', related_task_id: 'tsk-2', dependency_type: 'blocking', created_at: now },
    { id: 'dep-3', task_id: 'tsk-1', related_task_id: 'tsk-4', dependency_type: 'related_to', created_at: now },
  ];

  const comments: StoredComment[] = [
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
  ];

  const comment_reactions: StoredCommentReaction[] = [
    { id: 'cr-1', comment_id: 'cmt-2', user_id: mayaId, emoji: '👍', created_at: isoHourOffset(-1) },
  ];

  const sampleBriefBody =
    'Trellas Website Redesign — Architecture Brief\n\n1. Warm alabaster canvas (#FAF9F6) with deep forest emerald primary accents (#1B3B2B).\n2. Fraunces editorial headlines paired with Plus Jakarta Sans UI controls.\n3. Full keyboard accessibility and dark mode parity.\n';
  const attachments: StoredAttachment[] = [
    {
      id: 'att-1',
      workspace_id: 'ws-northstar',
      project_id: 'prj-website',
      task_id: 'tsk-5',
      comment_id: null,
      uploaded_by: mayaId,
      original_name: 'sample_website_architecture_brief.txt',
      mime_type: 'text/plain',
      size_bytes: sampleBriefBody.length,
      data_url: `data:text/plain;charset=utf-8,${encodeURIComponent(sampleBriefBody)}`,
      created_at: isoHourOffset(-12),
    },
  ];

  const time_entries: TimeEntry[] = [
    { id: 'te-1', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-3', user_id: julianId, description: 'Implemented responsive navigation drawer', duration_seconds: 5400, started_at: isoHourOffset(-8), ended_at: isoHourOffset(-6), is_running: 0, created_at: now },
    { id: 'te-2', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-5', user_id: mayaId, description: 'Hero layout & pricing table refinement', duration_seconds: 4500, started_at: isoHourOffset(-14), ended_at: isoHourOffset(-12), is_running: 0, created_at: now },
    { id: 'te-3', workspace_id: 'ws-northstar', project_id: 'prj-mobile', task_id: 'tsk-8', user_id: priyaId, description: 'Reviewed offline sync conflict strategy', duration_seconds: 3600, started_at: isoHourOffset(-24), ended_at: isoHourOffset(-23), is_running: 0, created_at: now },
  ];

  const notifications: NotificationItem[] = [
    { id: 'ntf-1', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: julianId, actor_name: 'Julian Wright', actor_avatar: '/src/assets/images/avatar_julian_wright_1795389986590.jpg', category: 'mention', title: 'Julian Wright mentioned you', message: 'Mentioned you on "Build the responsive navigation"', link_type: 'task', link_id: 'tsk-3', is_read: 0, created_at: isoHourOffset(-2) },
    { id: 'ntf-2', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: theoId, actor_name: 'Theo Silva', actor_avatar: '/src/assets/images/avatar_theo_silva_1795389986722.jpg', category: 'comment', title: 'New comment on Wireframe homepage', message: 'Theo Silva commented on "Wireframe homepage and pricing"', link_type: 'task', link_id: 'tsk-5', is_read: 0, created_at: isoHourOffset(-3) },
    { id: 'ntf-3', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: priyaId, actor_name: 'Priya Rao', actor_avatar: '/src/assets/images/avatar_priya_rao_1795389986691.jpg', category: 'deadline', title: 'Task due today', message: '"Build the responsive navigation" is scheduled for today', link_type: 'task', link_id: 'tsk-3', is_read: 0, created_at: isoHourOffset(-5) },
    { id: 'ntf-4', workspace_id: 'ws-northstar', user_id: mayaId, actor_id: priyaId, actor_name: 'Priya Rao', actor_avatar: '/src/assets/images/avatar_priya_rao_1795389986691.jpg', category: 'assignment', title: 'Assigned to Product Launch task', message: 'Priya Rao assigned you to "Prepare v2.4 release notes & migration guide"', link_type: 'task', link_id: 'tsk-15', is_read: 1, created_at: isoHourOffset(-20) },
  ];

  const activity_logs: ActivityLog[] = [
    { id: 'act-1', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-3', user_id: julianId, user_name: 'Julian Wright', user_avatar: '/src/assets/images/avatar_julian_wright_1795389986590.jpg', action: 'commented', details: 'Posted an update on "Build the responsive navigation"', created_at: isoHourOffset(-2) },
    { id: 'act-2', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-5', user_id: theoId, user_name: 'Theo Silva', user_avatar: '/src/assets/images/avatar_theo_silva_1795389986722.jpg', action: 'commented', details: 'Reviewed pricing tier copy on "Wireframe homepage and pricing"', created_at: isoHourOffset(-3) },
    { id: 'act-3', workspace_id: 'ws-northstar', project_id: 'prj-website', task_id: 'tsk-6', user_id: julianId, user_name: 'Julian Wright', user_avatar: '/src/assets/images/avatar_julian_wright_1795389986590.jpg', action: 'completed_task', details: 'Marked "Audit Core Web Vitals & font loading" as Completed', created_at: isoHourOffset(-10) },
    { id: 'act-4', workspace_id: 'ws-northstar', project_id: 'prj-ops', task_id: 'tsk-18', user_id: priyaId, user_name: 'Priya Rao', user_avatar: '/src/assets/images/avatar_priya_rao_1795389986691.jpg', action: 'completed_project', details: 'Completed project "Business Operations"', created_at: isoHourOffset(-24) },
    { id: 'act-5', workspace_id: 'ws-northstar', project_id: 'prj-launch', task_id: null, user_id: mayaId, user_name: 'Maya Chen', user_avatar: '/src/assets/images/avatar_maya_chen_1795389987021.jpg', action: 'created_project', details: 'Created project "Product Launch"', created_at: isoHourOffset(-36) },
  ];

  const project_templates: ProjectTemplate[] = SYSTEM_TEMPLATES.map((t) => ({
    id: t.id,
    workspace_id: null,
    name: t.name,
    category: t.category,
    description: t.description,
    color: t.color,
    columns: t.columns as ProjectTemplate['columns'],
    sample_tasks: t.sample_tasks as ProjectTemplate['sample_tasks'],
    is_system: 1,
    created_at: now,
  }));

  return {
    users,
    preferences,
    workspaces,
    workspace_members,
    workspace_invitations,
    projects,
    project_members,
    project_milestones,
    project_discussions,
    boards,
    board_columns,
    tasks,
    task_assignees,
    subtasks,
    checklists,
    checklist_items,
    task_dependencies,
    comments,
    comment_reactions,
    attachments,
    time_entries,
    notifications,
    activity_logs,
    project_templates,
    reset_codes: {},
  };
}

function loadDb(): StoredDb {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredDb;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.workspaces)) {
        return parsed;
      }
    }
  } catch {
    // fallback to seed
  }
  const initial = buildInitialDb();
  saveDb(initial);
  return initial;
}

function saveDb(db: StoredDb): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore storage quota errors gracefully
  }
}

function loadSession(): LocalSessionState | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSessionState;
    return parsed?.user_id && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function saveSession(session: LocalSessionState | null): void {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_KEY);
    } else {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore
  }
}

function getActiveUser(db: StoredDb): StoredUser {
  const session = loadSession();
  if (!session) throw new LocalApiError('Authentication required', 401);
  const user = db.users.find((u) => u.id === session.user_id);
  if (!user) throw new LocalApiError('Session expired. Please sign in again.', 401);
  return user;
}

function getOrCreatePrefs(db: StoredDb, userId: string): UserPreferences {
  let pref = db.preferences.find((p) => p.user_id === userId);
  if (!pref) {
    pref = {
      user_id: userId,
      theme: 'light',
      language: 'en-US',
      date_format: 'MMM d, yyyy',
      time_format: '12h',
      notify_assignments: 1,
      notify_mentions: 1,
      notify_comments: 1,
      notify_deadlines: 1,
      notify_updates: 1,
      sidebar_collapsed: 0,
      pinned_pages: ['dashboard', 'my-tasks', 'projects', 'reports'],
    };
    db.preferences.push(pref);
    saveDb(db);
  }
  return pref;
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

function logActivity(
  db: StoredDb,
  workspaceId: string,
  user: StoredUser,
  action: string,
  details: string,
  projectId: string | null = null,
  taskId: string | null = null,
): void {
  db.activity_logs.unshift({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    project_id: projectId,
    task_id: taskId,
    user_id: user.id,
    user_name: user.full_name,
    user_avatar: user.avatar_url,
    action,
    details,
    created_at: new Date().toISOString(),
  });
}

function pushNotification(
  db: StoredDb,
  workspaceId: string,
  userId: string,
  actor: StoredUser | null,
  category: NotificationItem['category'],
  title: string,
  message: string,
  linkType: string | null = null,
  linkId: string | null = null,
): void {
  if (actor && actor.id === userId) return;
  db.notifications.unshift({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    user_id: userId,
    actor_id: actor?.id || null,
    actor_name: actor?.full_name || null,
    actor_avatar: actor?.avatar_url || null,
    category,
    title,
    message,
    link_type: linkType,
    link_id: linkId,
    is_read: 0,
    created_at: new Date().toISOString(),
  });
}

function hydrateProjects(
  db: StoredDb,
  workspaceId: string,
  opts: { includeArchived?: boolean; onlyTrash?: boolean } = {},
): Project[] {
  const filtered = db.projects
    .filter((p) => {
      if (p.workspace_id !== workspaceId) return false;
      if (opts.onlyTrash) return p.deleted_at !== null;
      if (p.deleted_at !== null) return false;
      return Boolean(p.is_archived) === Boolean(opts.includeArchived);
    })
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at));

  return filtered.map((p) => {
    const mgr = db.users.find((u) => u.id === p.manager_id);
    const board = db.boards.find((b) => b.project_id === p.id);
    const projTasks = db.tasks.filter((t) => t.project_id === p.id && !t.deleted_at);
    const total = projTasks.length;
    const completed = projTasks.filter((t) => t.status === 'completed').length;
    const members: ProjectMember[] = db.project_members
      .filter((pm) => pm.project_id === p.id)
      .map((pm) => {
        const u = db.users.find((x) => x.id === pm.user_id);
        if (!u) return null;
        return {
          id: pm.id,
          project_id: p.id,
          user_id: pm.user_id,
          role: pm.role,
          full_name: u.full_name,
          email: u.email,
          avatar_url: u.avatar_url,
          job_title: u.job_title,
        };
      })
      .filter((x): x is ProjectMember => Boolean(x));

    return {
      ...p,
      manager_name: mgr?.full_name,
      manager_avatar: mgr?.avatar_url || null,
      total_tasks: total,
      completed_tasks: completed,
      progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      board_id: board?.id,
      members,
    };
  });
}

function hydrateTasks(
  db: StoredDb,
  workspaceId: string,
  opts: { projectId?: string; includeArchived?: boolean; onlyTrash?: boolean } = {},
): Task[] {
  const filtered = db.tasks
    .filter((t) => {
      if (t.workspace_id !== workspaceId) return false;
      if (opts.onlyTrash) {
        if (!t.deleted_at) return false;
      } else {
        if (t.deleted_at) return false;
        if (!opts.includeArchived && t.is_archived) return false;
      }
      if (opts.projectId && t.project_id !== opts.projectId) return false;
      return true;
    })
    .sort((a, b) => a.position - b.position || b.created_at.localeCompare(a.created_at));

  return filtered.map((t) => {
    const proj = db.projects.find((p) => p.id === t.project_id);
    const assignees: TaskAssignee[] = db.task_assignees
      .filter((ta) => ta.task_id === t.id)
      .map((ta) => {
        const u = db.users.find((x) => x.id === ta.user_id);
        if (!u) return null;
        return {
          user_id: u.id,
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          job_title: u.job_title,
          is_primary: ta.is_primary,
        };
      })
      .filter((x): x is TaskAssignee => Boolean(x));

    const subs = db.subtasks.filter((s) => s.task_id === t.id);
    const chks = db.checklists.filter((c) => c.task_id === t.id).map((c) => c.id);
    const chkItems = db.checklist_items.filter((ci) => chks.includes(ci.checklist_id));
    const commentCount = db.comments.filter((c) => c.task_id === t.id).length;
    const attachmentCount = db.attachments.filter((a) => a.task_id === t.id).length;
    const actualSeconds = db.time_entries
      .filter((te) => te.task_id === t.id)
      .reduce((acc, te) => acc + Number(te.duration_seconds || 0), 0);

    return {
      ...t,
      project_name: proj?.name || '',
      project_color: proj?.color || '#1B3B2B',
      actual_seconds: actualSeconds,
      assignees,
      comment_count: commentCount,
      attachment_count: attachmentCount,
      subtask_total: subs.length,
      subtask_completed: subs.filter((s) => s.completed).length,
      checklist_total: chkItems.length,
      checklist_completed: chkItems.filter((ci) => ci.completed).length,
    };
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new LocalApiError('Unable to read file', 400));
    reader.readAsDataURL(file);
  });
}

// -----------------------------------------------------------------------------
// PUBLIC AUTH & FILE HELPERS (LOCAL MODE)
// -----------------------------------------------------------------------------

export async function localGetCurrentSession(): Promise<{
  token: string;
  user: User;
  preferences: UserPreferences;
  workspaces: Workspace[];
} | null> {
  const session = loadSession();
  if (!session) return null;
  const db = loadDb();
  const user = db.users.find((u) => u.id === session.user_id);
  if (!user) {
    saveSession(null);
    return null;
  }
  const preferences = getOrCreatePrefs(db, user.id);
  const { workspaces } = await localRequest<{ workspaces: Workspace[] }>('/api/workspaces');
  return {
    token: session.token,
    user: toPublicUser(user),
    preferences,
    workspaces,
  };
}

export async function localLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: User; preferences: UserPreferences }> {
  const db = loadDb();
  const cleanEmail = email.trim().toLowerCase();
  const found = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!found || found.password !== password) {
    throw new LocalApiError('Invalid email or password.', 401);
  }
  const token = `local_${crypto.randomUUID()}`;
  saveSession({ token, user_id: found.id, created_at: new Date().toISOString() });
  const preferences = getOrCreatePrefs(db, found.id);
  return { token, user: toPublicUser(found), preferences };
}

export async function localDemoLogin(): Promise<{ token: string; user: User; preferences: UserPreferences }> {
  let db = loadDb();
  let maya = db.users.find((u) => u.email.toLowerCase() === 'maya@trellas.app');
  if (!maya) {
    db = buildInitialDb();
    saveDb(db);
    maya = db.users.find((u) => u.email.toLowerCase() === 'maya@trellas.app')!;
  }
  const token = `local_${crypto.randomUUID()}`;
  saveSession({ token, user_id: maya.id, created_at: new Date().toISOString() });
  const preferences = getOrCreatePrefs(db, maya.id);
  return { token, user: toPublicUser(maya), preferences };
}

export async function localRegister(input: {
  full_name: string;
  email: string;
  password: string;
  workspace_name?: string;
  include_sample_data?: boolean;
}): Promise<{ token: string; user: User; preferences: UserPreferences }> {
  const db = loadDb();
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new LocalApiError('Please provide a valid email address.', 400);
  }
  if (input.password.length < 8) {
    throw new LocalApiError('Password must be at least 8 characters.', 400);
  }
  if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new LocalApiError('An account with this email already exists.', 409);
  }

  const now = new Date().toISOString();
  const uid = crypto.randomUUID();
  const fullName = input.full_name.trim() || cleanEmail.split('@')[0] || 'Trellas User';
  const newUser: StoredUser = {
    id: uid,
    email: cleanEmail,
    password: input.password,
    full_name: fullName,
    avatar_url: null,
    job_title: 'Workspace Owner',
    department: 'Product',
    bio: '',
    timezone: 'America/Los_Angeles',
    email_verified: 1,
    created_at: now,
    updated_at: now,
  };
  db.users.push(newUser);
  const preferences = getOrCreatePrefs(db, uid);

  // Accept any pending invitations for this email
  const pendingInvs = db.workspace_invitations.filter(
    (inv) => inv.email.toLowerCase() === cleanEmail && inv.status === 'pending',
  );
  for (const inv of pendingInvs) {
    inv.status = 'accepted';
    db.workspace_members.push({
      id: crypto.randomUUID(),
      workspace_id: inv.workspace_id,
      user_id: uid,
      role: inv.role,
      joined_at: now,
    });
  }

  // Create initial workspace
  const rawWsName = (input.workspace_name || '').trim();
  const wsName = rawWsName || `${fullName.split(' ')[0]}'s Workspace`;
  const slugBase = wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const initials = wsName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'TR';
  const wsId = crypto.randomUUID();

  db.workspaces.push({
    id: wsId,
    name: wsName,
    slug: `${slugBase}-${wsId.slice(0, 4)}`,
    description: 'Workspace created during Trellas onboarding.',
    logo_color: '#1B3B2B',
    logo_initials: initials,
    owner_id: uid,
    plan: 'pro',
    deleted_at: null,
    created_at: now,
    updated_at: now,
  });
  db.workspace_members.push({
    id: crypto.randomUUID(),
    workspace_id: wsId,
    user_id: uid,
    role: 'owner',
    joined_at: now,
  });

  if (input.include_sample_data !== false) {
    const prjId = crypto.randomUUID();
    const boardId = crypto.randomUUID();
    db.projects.push({
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
      is_pinned: 1,
      is_archived: 0,
      is_demo: 1,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    db.project_members.push({ id: crypto.randomUUID(), project_id: prjId, user_id: uid, role: 'lead', added_at: now });
    db.boards.push({ id: boardId, project_id: prjId, name: 'Main Board', created_at: now });

    const colDefs: Array<{ name: string; status_key: TaskStatus; color: string }> = [
      { name: 'Backlog', status_key: 'backlog', color: '#64748B' },
      { name: 'To Do', status_key: 'todo', color: '#3B82F6' },
      { name: 'In Progress', status_key: 'in_progress', color: '#C99A4E' },
      { name: 'In Review', status_key: 'in_review', color: '#8B5CF6' },
      { name: 'Completed', status_key: 'completed', color: '#16A34A' },
    ];
    const cols: Record<string, string> = {};
    colDefs.forEach((c, idx) => {
      const cid = crypto.randomUUID();
      cols[c.status_key] = cid;
      db.board_columns.push({ id: cid, board_id: boardId, name: c.name, position: idx, color: c.color, status_key: c.status_key });
    });

    const starters: Array<{ title: string; status: TaskStatus; priority: PriorityLevel; due: number }> = [
      { title: 'Customize your workspace branding & invite teammates', status: 'todo', priority: 'high', due: 2 },
      { title: 'Explore Kanban drag-and-drop, List, and Calendar views', status: 'in_progress', priority: 'medium', due: 0 },
      { title: 'Create your Trellas account', status: 'completed', priority: 'low', due: 0 },
    ];
    starters.forEach((st, idx) => {
      const tid = crypto.randomUUID();
      db.tasks.push({
        id: tid,
        workspace_id: wsId,
        project_id: prjId,
        board_id: boardId,
        column_id: cols[st.status],
        parent_task_id: null,
        title: st.title,
        description: 'Sample starter task you can edit, reassign, or move across columns.',
        status: st.status,
        priority: st.priority,
        task_type: 'task',
        position: idx,
        start_date: isoDayOffset(0),
        due_date: isoDayOffset(st.due),
        estimated_minutes: 30,
        labels: ['Starter'],
        is_demo: 1,
        is_archived: 0,
        deleted_at: null,
        created_by: uid,
        created_at: now,
        updated_at: now,
      });
      db.task_assignees.push({ id: crypto.randomUUID(), task_id: tid, user_id: uid, is_primary: 1, assigned_at: now });
    });
  }

  saveDb(db);
  const token = `local_${crypto.randomUUID()}`;
  saveSession({ token, user_id: uid, created_at: now });
  return { token, user: toPublicUser(newUser), preferences };
}

export async function localRequestPasswordReset(email: string): Promise<{ code: string }> {
  const db = loadDb();
  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    throw new LocalApiError('No account found with that email address.', 404);
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.reset_codes[cleanEmail] = code;
  saveDb(db);
  return { code };
}

export async function localResetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const db = loadDb();
  const cleanEmail = email.trim().toLowerCase();
  if (newPassword.length < 8) {
    throw new LocalApiError('Password must be at least 8 characters.', 400);
  }
  const expected = db.reset_codes[cleanEmail];
  if (!expected || expected !== code.trim()) {
    throw new LocalApiError('Invalid or expired password reset code.', 400);
  }
  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) throw new LocalApiError('Account not found.', 404);
  user.password = newPassword;
  user.updated_at = new Date().toISOString();
  delete db.reset_codes[cleanEmail];
  saveDb(db);
}

export async function localVerifyEmail(email: string): Promise<void> {
  const db = loadDb();
  const cleanEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) throw new LocalApiError('No account found with that email address.', 404);
  user.email_verified = 1;
  user.updated_at = new Date().toISOString();
  saveDb(db);
}

export async function localLogout(): Promise<void> {
  saveSession(null);
}

export async function localUploadUserAvatar(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new LocalApiError('Avatar image must be 5 MB or smaller.', 400);
  }
  return readFileAsDataUrl(file);
}

export async function localGetAttachmentSignedUrl(attachmentId: string): Promise<string> {
  const db = loadDb();
  const att = db.attachments.find((a) => a.id === attachmentId);
  if (!att) throw new LocalApiError('Attachment not found.', 404);
  return att.data_url;
}

export async function localTriggerAttachmentDownload(attachment: Attachment): Promise<void> {
  const url = await localGetAttachmentSignedUrl(attachment.id);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.original_name;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// -----------------------------------------------------------------------------
// API ROUTER (LOCAL MODE)
// -----------------------------------------------------------------------------

export async function localRequest<T = unknown>(rawUrl: string, options: RequestInit = {}): Promise<T> {
  const db = loadDb();
  const method = (options.method || 'GET').toUpperCase();
  const parsed = new URL(rawUrl, window.location.origin);
  const path = parsed.pathname;
  const query = parsed.searchParams;
  const body = parseBody(options.body);
  let match: RegExpMatchArray | null;

  // AUTH & ACCOUNT
  if (path === '/api/auth/me' && method === 'GET') {
    const user = getActiveUser(db);
    return { user: toPublicUser(user), preferences: getOrCreatePrefs(db, user.id) } as unknown as T;
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    saveSession(null);
    return { ok: true } as unknown as T;
  }

  if (path === '/api/auth/verify-email' && method === 'POST') {
    const user = getActiveUser(db);
    user.email_verified = 1;
    user.updated_at = new Date().toISOString();
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (path === '/api/account/profile' && method === 'PATCH') {
    const user = getActiveUser(db);
    if (body.full_name !== undefined) user.full_name = String(body.full_name).trim();
    if (body.email !== undefined) user.email = String(body.email).trim().toLowerCase();
    if (body.job_title !== undefined) user.job_title = String(body.job_title).trim();
    if (body.department !== undefined) user.department = String(body.department).trim();
    if (body.bio !== undefined) user.bio = String(body.bio);
    if (body.timezone !== undefined) user.timezone = String(body.timezone);
    if (body.avatar_url !== undefined) user.avatar_url = body.avatar_url ? String(body.avatar_url) : null;
    user.updated_at = new Date().toISOString();
    saveDb(db);
    return { user: toPublicUser(user) } as unknown as T;
  }

  if (path === '/api/account/preferences' && method === 'PATCH') {
    const user = getActiveUser(db);
    const prefs = getOrCreatePrefs(db, user.id);
    if (body.theme !== undefined) prefs.theme = body.theme as UserPreferences['theme'];
    if (body.language !== undefined) prefs.language = String(body.language);
    if (body.date_format !== undefined) prefs.date_format = String(body.date_format);
    if (body.time_format !== undefined) prefs.time_format = String(body.time_format);
    if (body.notify_assignments !== undefined) prefs.notify_assignments = body.notify_assignments ? 1 : 0;
    if (body.notify_mentions !== undefined) prefs.notify_mentions = body.notify_mentions ? 1 : 0;
    if (body.notify_comments !== undefined) prefs.notify_comments = body.notify_comments ? 1 : 0;
    if (body.notify_deadlines !== undefined) prefs.notify_deadlines = body.notify_deadlines ? 1 : 0;
    if (body.notify_updates !== undefined) prefs.notify_updates = body.notify_updates ? 1 : 0;
    if (body.sidebar_collapsed !== undefined) prefs.sidebar_collapsed = body.sidebar_collapsed ? 1 : 0;
    if (Array.isArray(body.pinned_pages)) prefs.pinned_pages = body.pinned_pages as string[];
    saveDb(db);
    return { preferences: prefs } as unknown as T;
  }

  if (path === '/api/account/change-password' && method === 'POST') {
    const user = getActiveUser(db);
    const curPass = String(body.current_password || '');
    const newPass = String(body.new_password || '');
    const confPass = String(body.confirm_password || '');
    if (user.password !== curPass) throw new LocalApiError('Current password is incorrect.', 400);
    if (newPass.length < 8) throw new LocalApiError('New password must be at least 8 characters.', 400);
    if (newPass !== confPass) throw new LocalApiError('Passwords do not match.', 400);
    user.password = newPass;
    user.updated_at = new Date().toISOString();
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if (path === '/api/account/sessions' && method === 'GET') {
    const sess = loadSession();
    const sessions: SessionInfo[] = sess
      ? [
          {
            id: 'current',
            user_agent: navigator.userAgent,
            ip_address: 'Local Browser Session',
            created_at: sess.created_at,
            last_active_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
            is_current: true,
          },
        ]
      : [];
    return { sessions } as unknown as T;
  }

  if (path.startsWith('/api/account/sessions/') && method === 'DELETE') {
    return { ok: true } as unknown as T;
  }

  if (path === '/api/account' && method === 'DELETE') {
    const user = getActiveUser(db);
    const now = new Date().toISOString();
    db.workspaces.forEach((w) => {
      if (w.owner_id === user.id && !w.deleted_at) w.deleted_at = now;
    });
    db.workspace_members = db.workspace_members.filter((m) => m.user_id !== user.id);
    db.project_members = db.project_members.filter((m) => m.user_id !== user.id);
    db.users = db.users.filter((u) => u.id !== user.id);
    saveDb(db);
    saveSession(null);
    return { ok: true } as unknown as T;
  }

  // WORKSPACES
  if (path === '/api/workspaces' && method === 'GET') {
    const user = getActiveUser(db);
    const myMemberships = db.workspace_members.filter((m) => m.user_id === user.id);
    const roleMap = new Map(myMemberships.map((m) => [m.workspace_id, m.role]));
    const workspaces: Workspace[] = db.workspaces
      .filter((w) => !w.deleted_at && roleMap.has(w.id))
      .map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        description: w.description,
        logo_color: w.logo_color,
        logo_initials: w.logo_initials,
        owner_id: w.owner_id,
        plan: w.plan,
        role: roleMap.get(w.id) || 'member',
        member_count: db.workspace_members.filter((m) => m.workspace_id === w.id).length,
        project_count: db.projects.filter((p) => p.workspace_id === w.id && !p.deleted_at).length,
        created_at: w.created_at,
        updated_at: w.updated_at,
      }));
    return { workspaces } as unknown as T;
  }

  if (path === '/api/workspaces' && method === 'POST') {
    const user = getActiveUser(db);
    const name = String(body.name || '').trim();
    if (!name) throw new LocalApiError('Workspace name is required.', 400);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${id.slice(0, 4)}`;
    const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'TR';
    const ws: StoredWorkspace = {
      id,
      name,
      slug,
      description: String(body.description || ''),
      logo_color: String(body.logo_color || '#1B3B2B'),
      logo_initials: initials,
      owner_id: user.id,
      plan: (body.plan as Workspace['plan']) || 'pro',
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    db.workspaces.push(ws);
    db.workspace_members.push({ id: crypto.randomUUID(), workspace_id: id, user_id: user.id, role: 'owner', joined_at: now });
    logActivity(db, id, user, 'created_workspace', `Created workspace "${name}"`);
    saveDb(db);
    return { workspace: { ...ws, role: 'owner' } } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)$/)) && method === 'PATCH') {
    const ws = db.workspaces.find((w) => w.id === match![1]);
    if (!ws) throw new LocalApiError('Workspace not found.', 404);
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      ws.name = name;
      ws.logo_initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'TR';
    }
    if (body.description !== undefined) ws.description = String(body.description);
    if (body.logo_color !== undefined) ws.logo_color = String(body.logo_color);
    ws.updated_at = new Date().toISOString();
    saveDb(db);
    return { workspace: ws } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)$/)) && method === 'DELETE') {
    const ws = db.workspaces.find((w) => w.id === match![1]);
    if (ws) ws.deleted_at = new Date().toISOString();
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/members$/)) && method === 'GET') {
    const wsId = match[1];
    const wsProjIds = new Set(db.projects.filter((p) => p.workspace_id === wsId && !p.deleted_at).map((p) => p.id));
    const wsTasks = new Map(db.tasks.filter((t) => t.workspace_id === wsId && !t.deleted_at).map((t) => [t.id, t]));
    const members: WorkspaceMember[] = db.workspace_members
      .filter((m) => m.workspace_id === wsId)
      .map((m) => {
        const u = db.users.find((x) => x.id === m.user_id);
        const myTaskIds = db.task_assignees.filter((ta) => ta.user_id === m.user_id).map((ta) => ta.task_id);
        let completedCount = 0;
        let workloadMins = 0;
        for (const tid of myTaskIds) {
          const t = wsTasks.get(tid);
          if (!t) continue;
          if (t.status === 'completed') completedCount += 1;
          else workloadMins += Number(t.estimated_minutes || 0);
        }
        return {
          id: m.id,
          workspace_id: wsId,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          full_name: u?.full_name || 'User',
          email: u?.email || '',
          avatar_url: u?.avatar_url || null,
          job_title: u?.job_title || 'Team Member',
          department: u?.department || 'Product',
          bio: u?.bio || '',
          assigned_projects_count: db.project_members.filter((pm) => pm.user_id === m.user_id && wsProjIds.has(pm.project_id)).length,
          assigned_tasks_count: myTaskIds.filter((tid) => wsTasks.has(tid)).length,
          completed_tasks_count: completedCount,
          active_workload_minutes: workloadMins,
        };
      });

    const invitations: WorkspaceInvitation[] = db.workspace_invitations
      .filter((inv) => inv.workspace_id === wsId && inv.status === 'pending')
      .map((inv) => ({
        id: inv.id,
        workspace_id: wsId,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        invited_by_name: db.users.find((u) => u.id === inv.invited_by)?.full_name || 'Admin',
        created_at: inv.created_at,
      }));
    return { members, invitations } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/invitations$/)) && method === 'POST') {
    const wsId = match[1];
    const user = getActiveUser(db);
    const cleanEmail = String(body.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) throw new LocalApiError('Valid email is required.', 400);
    const allowedRoles: WorkspaceRole[] = ['admin', 'project_manager', 'member', 'guest'];
    const safeRole = allowedRoles.includes(body.role as WorkspaceRole) ? (body.role as WorkspaceRole) : 'member';
    const now = new Date().toISOString();

    const existingUser = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingUser) {
      if (db.workspace_members.some((m) => m.workspace_id === wsId && m.user_id === existingUser.id)) {
        throw new LocalApiError('User is already a workspace member.', 409);
      }
      db.workspace_members.push({ id: crypto.randomUUID(), workspace_id: wsId, user_id: existingUser.id, role: safeRole, joined_at: now });
      pushNotification(db, wsId, existingUser.id, user, 'invitation', 'Added to workspace', `You were added to the workspace as ${safeRole}.`, 'team', wsId);
      logActivity(db, wsId, user, 'added_member', `Added ${existingUser.full_name} (${cleanEmail}) as ${safeRole}`);
      saveDb(db);
      return { status: 'added_directly', user_id: existingUser.id } as unknown as T;
    }

    const id = crypto.randomUUID();
    db.workspace_invitations.push({
      id,
      workspace_id: wsId,
      email: cleanEmail,
      role: safeRole,
      invited_by: user.id,
      status: 'pending',
      token: crypto.randomUUID(),
      created_at: now,
    });
    logActivity(db, wsId, user, 'invited_member', `Invited ${cleanEmail} as ${safeRole}`);
    saveDb(db);
    return { id, status: 'invited' } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/invitations\/([^/]+)$/)) && method === 'DELETE') {
    const inv = db.workspace_invitations.find((i) => i.id === match![2] && i.workspace_id === match![1]);
    if (inv) inv.status = 'revoked';
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/)) && method === 'PATCH') {
    const mem = db.workspace_members.find((m) => m.id === match![2] && m.workspace_id === match![1]);
    if (!mem) throw new LocalApiError('Member not found.', 404);
    if (mem.role === 'owner') throw new LocalApiError('Cannot change workspace owner role.', 400);
    mem.role = String(body.role) as WorkspaceRole;
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/)) && method === 'DELETE') {
    const mem = db.workspace_members.find((m) => m.id === match![2] && m.workspace_id === match![1]);
    if (mem?.role === 'owner') throw new LocalApiError('Cannot remove the workspace owner.', 400);
    db.workspace_members = db.workspace_members.filter((m) => !(m.id === match![2] && m.workspace_id === match![1]));
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // PROJECTS
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/projects$/)) && method === 'GET') {
    const projects = hydrateProjects(db, match[1], {
      includeArchived: query.get('archived') === '1',
      onlyTrash: query.get('trash') === '1',
    });
    return { projects } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/projects$/)) && method === 'POST') {
    const wsId = match[1];
    const user = getActiveUser(db);
    const name = String(body.name || '').trim();
    if (!name) throw new LocalApiError('Project name is required.', 400);
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
      const tpl = db.project_templates.find((t) => t.id === String(body.template_id));
      if (tpl) {
        if (tpl.columns.length > 0) columnsDef = tpl.columns;
        sampleTasks = tpl.sample_tasks;
        if (!body.color) color = tpl.color;
      }
    }

    const managerId = String(body.manager_id || user.id);
    db.projects.push({
      id: prjId,
      workspace_id: wsId,
      name,
      description: String(body.description || ''),
      color,
      category: String(body.category || 'Product'),
      status: (body.status as Project['status']) || 'planning',
      priority: (body.priority as PriorityLevel) || 'medium',
      owner_id: user.id,
      manager_id: managerId,
      start_date: body.start_date ? String(body.start_date) : null,
      due_date: body.due_date ? String(body.due_date) : null,
      is_pinned: body.is_pinned ? 1 : 0,
      is_archived: 0,
      is_demo: 0,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });

    const memberIds = Array.isArray(body.member_ids) && body.member_ids.length > 0
      ? Array.from(new Set([user.id, managerId, ...(body.member_ids as string[])]))
      : [user.id, ...(managerId !== user.id ? [managerId] : [])];
    memberIds.forEach((mId) => {
      db.project_members.push({
        id: crypto.randomUUID(),
        project_id: prjId,
        user_id: mId,
        role: mId === managerId ? 'lead' : 'member',
        added_at: now,
      });
    });

    db.boards.push({ id: boardId, project_id: prjId, name: 'Main Board', created_at: now });
    const colLookup: Record<string, string> = {};
    let fallbackColId = '';
    columnsDef.forEach((c, idx) => {
      const cid = crypto.randomUUID();
      if (!fallbackColId) fallbackColId = cid;
      if (!colLookup[c.status_key]) colLookup[c.status_key] = cid;
      db.board_columns.push({ id: cid, board_id: boardId, name: c.name, position: idx, color: c.color, status_key: c.status_key });
    });

    sampleTasks.forEach((st, idx) => {
      db.tasks.push({
        id: crypto.randomUUID(),
        workspace_id: wsId,
        project_id: prjId,
        board_id: boardId,
        column_id: colLookup[st.status_key] || fallbackColId,
        parent_task_id: null,
        title: st.title,
        description: '',
        status: st.status_key,
        priority: st.priority || 'medium',
        task_type: 'task',
        position: idx,
        start_date: null,
        due_date: null,
        estimated_minutes: st.estimated_minutes || 60,
        labels: st.labels || [],
        is_demo: 0,
        is_archived: 0,
        deleted_at: null,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      });
    });

    logActivity(db, wsId, user, 'created_project', `Created project "${name}"`, prjId);
    saveDb(db);
    return { id: prjId } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)$/)) && method === 'GET') {
    const prjId = match[1];
    const rawProj = db.projects.find((p) => p.id === prjId);
    if (!rawProj) throw new LocalApiError('Project not found.', 404);
    const hydrated = hydrateProjects(db, rawProj.workspace_id, { includeArchived: Boolean(rawProj.is_archived) });
    const project = hydrated.find((p) => p.id === prjId) || rawProj;
    const board = db.boards.find((b) => b.project_id === prjId) || null;
    const columns = board
      ? db.board_columns.filter((c) => c.board_id === board.id).sort((a, b) => a.position - b.position)
      : [];
    const tasks = hydrateTasks(db, rawProj.workspace_id, { projectId: prjId, includeArchived: Boolean(rawProj.is_archived) });
    const milestones = db.project_milestones
      .filter((m) => m.project_id === prjId)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const discussions: ProjectDiscussion[] = db.project_discussions
      .filter((d) => d.project_id === prjId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((d) => {
        const u = db.users.find((x) => x.id === d.user_id);
        return {
          id: d.id,
          project_id: prjId,
          user_id: d.user_id,
          author_name: u?.full_name || 'Member',
          author_avatar: u?.avatar_url || null,
          title: d.title,
          body: d.body,
          created_at: d.created_at,
        };
      });
    return { project, board, columns, tasks, milestones, discussions, members: (project as Project).members || [] } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)$/)) && method === 'PATCH') {
    const prjId = match[1];
    const user = getActiveUser(db);
    const proj = db.projects.find((p) => p.id === prjId);
    if (!proj) throw new LocalApiError('Project not found.', 404);
    const now = new Date().toISOString();
    if (body.name !== undefined) proj.name = String(body.name).trim();
    if (body.description !== undefined) proj.description = String(body.description);
    if (body.color !== undefined) proj.color = String(body.color);
    if (body.category !== undefined) proj.category = String(body.category);
    if (body.status !== undefined) proj.status = body.status as Project['status'];
    if (body.priority !== undefined) proj.priority = body.priority as PriorityLevel;
    if (body.manager_id !== undefined) proj.manager_id = String(body.manager_id);
    if (body.start_date !== undefined) proj.start_date = body.start_date ? String(body.start_date) : null;
    if (body.due_date !== undefined) proj.due_date = body.due_date ? String(body.due_date) : null;
    if (body.is_pinned !== undefined) proj.is_pinned = body.is_pinned ? 1 : 0;
    if (body.is_archived !== undefined) proj.is_archived = body.is_archived ? 1 : 0;
    proj.updated_at = now;

    if (Array.isArray(body.member_ids)) {
      db.project_members = db.project_members.filter((pm) => pm.project_id !== prjId);
      Array.from(new Set(body.member_ids as string[])).forEach((mId) => {
        db.project_members.push({
          id: crypto.randomUUID(),
          project_id: prjId,
          user_id: mId,
          role: mId === proj.manager_id ? 'lead' : 'member',
          added_at: now,
        });
      });
    }

    logActivity(db, proj.workspace_id, user, 'updated_project', `Updated project "${proj.name}"`, prjId);
    saveDb(db);
    return { project: proj } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)$/)) && method === 'DELETE') {
    const prjId = match[1];
    if (query.get('permanent') === '1') {
      db.projects = db.projects.filter((p) => p.id !== prjId);
      db.tasks = db.tasks.filter((t) => t.project_id !== prjId);
    } else {
      const proj = db.projects.find((p) => p.id === prjId);
      if (proj) {
        const now = new Date().toISOString();
        proj.deleted_at = now;
        proj.updated_at = now;
      }
    }
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)\/restore$/)) && method === 'POST') {
    const proj = db.projects.find((p) => p.id === match![1]);
    if (proj) {
      proj.deleted_at = null;
      proj.is_archived = 0;
      proj.updated_at = new Date().toISOString();
    }
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)\/duplicate$/)) && method === 'POST') {
    const prjId = match[1];
    const user = getActiveUser(db);
    const src = db.projects.find((p) => p.id === prjId);
    if (!src) throw new LocalApiError('Project not found.', 404);
    const now = new Date().toISOString();
    const newProjId = crypto.randomUUID();
    const newBoardId = crypto.randomUUID();

    db.projects.push({
      ...src,
      id: newProjId,
      name: `${src.name} (Copy)`,
      status: 'planning',
      owner_id: user.id,
      is_pinned: 0,
      is_archived: 0,
      is_demo: 0,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    db.boards.push({ id: newBoardId, project_id: newProjId, name: 'Main Board', created_at: now });

    const srcBoard = db.boards.find((b) => b.project_id === prjId);
    const colMap = new Map<string, string>();
    if (srcBoard) {
      db.board_columns
        .filter((c) => c.board_id === srcBoard.id)
        .sort((a, b) => a.position - b.position)
        .forEach((c) => {
          const newCid = crypto.randomUUID();
          colMap.set(c.id, newCid);
          db.board_columns.push({ ...c, id: newCid, board_id: newBoardId });
        });
    }

    db.project_members
      .filter((pm) => pm.project_id === prjId)
      .forEach((pm) => {
        db.project_members.push({ ...pm, id: crypto.randomUUID(), project_id: newProjId, added_at: now });
      });

    db.tasks
      .filter((t) => t.project_id === prjId && !t.deleted_at)
      .forEach((t) => {
        const targetCol = colMap.get(t.column_id);
        if (!targetCol) return;
        db.tasks.push({
          ...t,
          id: crypto.randomUUID(),
          project_id: newProjId,
          board_id: newBoardId,
          column_id: targetCol,
          is_demo: 0,
          is_archived: 0,
          created_by: user.id,
          created_at: now,
          updated_at: now,
        });
      });

    saveDb(db);
    return { id: newProjId } as unknown as T;
  }

  // MILESTONES & DISCUSSIONS
  if ((match = path.match(/^\/api\/projects\/([^/]+)\/milestones$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    db.project_milestones.push({
      id,
      project_id: match[1],
      title: String(body.title || 'Milestone').trim(),
      description: String(body.description || ''),
      due_date: String(body.due_date || new Date().toISOString().slice(0, 10)),
      completed: 0,
      created_at: new Date().toISOString(),
    });
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/milestones\/([^/]+)$/)) && method === 'PATCH') {
    const ms = db.project_milestones.find((m) => m.id === match![1]);
    if (ms) {
      if (body.completed !== undefined) ms.completed = body.completed ? 1 : 0;
      if (body.title !== undefined) ms.title = String(body.title).trim();
      if (body.due_date !== undefined) ms.due_date = String(body.due_date);
      saveDb(db);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/projects\/([^/]+)\/discussions$/)) && method === 'POST') {
    const user = getActiveUser(db);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.project_discussions.push({
      id,
      project_id: match[1],
      user_id: user.id,
      title: String(body.title || '').trim(),
      body: String(body.body || '').trim(),
      created_at: now,
      updated_at: now,
    });
    saveDb(db);
    return { id } as unknown as T;
  }

  // BOARD COLUMNS
  if ((match = path.match(/^\/api\/boards\/([^/]+)\/columns$/)) && method === 'POST') {
    const boardId = match[1];
    const existing = db.board_columns.filter((c) => c.board_id === boardId);
    const nextPos = existing.length > 0 ? Math.max(...existing.map((c) => c.position)) + 1 : 0;
    const col: BoardColumn = {
      id: crypto.randomUUID(),
      board_id: boardId,
      name: String(body.name || 'Column').trim(),
      position: nextPos,
      color: String(body.color || '#64748B'),
      status_key: (body.status_key as TaskStatus) || 'todo',
    };
    db.board_columns.push(col);
    saveDb(db);
    return { column: col } as unknown as T;
  }

  if ((match = path.match(/^\/api\/boards\/([^/]+)\/columns\/reorder$/)) && method === 'POST') {
    const boardId = match[1];
    const colIds = Array.isArray(body.column_ids ?? body.columnIds) ? ((body.column_ids ?? body.columnIds) as string[]) : [];
    colIds.forEach((cid, idx) => {
      const c = db.board_columns.find((x) => x.id === cid && x.board_id === boardId);
      if (c) c.position = idx;
    });
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/columns\/([^/]+)$/)) && method === 'PATCH') {
    const col = db.board_columns.find((c) => c.id === match![1]);
    if (!col) throw new LocalApiError('Board column not found.', 404);
    if (body.name !== undefined) col.name = String(body.name).trim();
    if (body.color !== undefined) col.color = String(body.color);
    if (body.status_key !== undefined) col.status_key = body.status_key as TaskStatus;
    if (body.position !== undefined) col.position = Number(body.position);
    saveDb(db);
    return { column: col } as unknown as T;
  }

  if ((match = path.match(/^\/api\/columns\/([^/]+)$/)) && method === 'DELETE') {
    const colId = match[1];
    const col = db.board_columns.find((c) => c.id === colId);
    if (!col) throw new LocalApiError('Board column not found.', 404);
    const siblings = db.board_columns.filter((c) => c.board_id === col.board_id && c.id !== colId).sort((a, b) => a.position - b.position);
    if (siblings.length === 0) throw new LocalApiError('Cannot delete the last column on a board.', 400);
    const fallback = siblings[0];
    db.tasks.forEach((t) => {
      if (t.column_id === colId) {
        t.column_id = fallback.id;
        t.status = fallback.status_key;
      }
    });
    db.board_columns = db.board_columns.filter((c) => c.id !== colId);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // TASKS
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/tasks$/)) && method === 'GET') {
    const tasks = hydrateTasks(db, match[1], {
      includeArchived: query.get('archived') === '1',
      onlyTrash: query.get('trash') === '1',
    });
    return { tasks } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/tasks$/)) && method === 'POST') {
    const wsId = match[1];
    const user = getActiveUser(db);
    const projectId = String(body.project_id || '');
    const title = String(body.title || '').trim();
    if (!projectId || !title) throw new LocalApiError('Project and task title are required.', 400);

    const board = db.boards.find((b) => b.project_id === projectId);
    if (!board) throw new LocalApiError('Project board not found.', 404);
    const cols = db.board_columns.filter((c) => c.board_id === board.id).sort((a, b) => a.position - b.position);
    if (cols.length === 0) throw new LocalApiError('Project board has no columns.', 400);

    let columnId = body.column_id ? String(body.column_id) : '';
    let status: TaskStatus = (body.status as TaskStatus) || 'todo';
    if (columnId) {
      const matched = cols.find((c) => c.id === columnId);
      if (matched && !body.status) status = matched.status_key;
    } else {
      const matched = cols.find((c) => c.status_key === status) || cols[0];
      columnId = matched.id;
      status = matched.status_key;
    }

    const colTasks = db.tasks.filter((t) => t.column_id === columnId);
    const nextPos = colTasks.length > 0 ? Math.max(...colTasks.map((t) => t.position)) + 1 : 0;
    const now = new Date().toISOString();
    const taskId = crypto.randomUUID();

    db.tasks.push({
      id: taskId,
      workspace_id: wsId,
      project_id: projectId,
      board_id: board.id,
      column_id: columnId,
      parent_task_id: null,
      title,
      description: String(body.description || ''),
      status,
      priority: (body.priority as PriorityLevel) || 'medium',
      task_type: (body.task_type as Task['task_type']) || 'task',
      position: nextPos,
      start_date: body.start_date ? String(body.start_date) : null,
      due_date: body.due_date ? String(body.due_date) : null,
      estimated_minutes: Number(body.estimated_minutes || 0),
      labels: Array.isArray(body.labels) ? (body.labels as string[]) : [],
      is_demo: 0,
      is_archived: 0,
      deleted_at: null,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    });

    const assigneeIds = Array.isArray(body.assignee_ids) ? (body.assignee_ids as string[]) : [];
    assigneeIds.forEach((aId, idx) => {
      db.task_assignees.push({ id: crypto.randomUUID(), task_id: taskId, user_id: aId, is_primary: idx === 0 ? 1 : 0, assigned_at: now });
      pushNotification(db, wsId, aId, user, 'assignment', 'Assigned to a new task', `You were assigned to "${title}"`, 'task', taskId);
    });

    logActivity(db, wsId, user, 'created_task', `Created task "${title}"`, projectId, taskId);
    saveDb(db);
    return { id: taskId } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/tasks\/bulk$/)) && method === 'POST') {
    const wsId = match[1];
    const user = getActiveUser(db);
    const taskIds = Array.isArray(body.task_ids ?? body.taskIds) ? ((body.task_ids ?? body.taskIds) as string[]) : [];
    const action = String(body.action || '');
    const value = body.value !== undefined && body.value !== null ? String(body.value) : '';
    const now = new Date().toISOString();

    for (const t of db.tasks) {
      if (t.workspace_id !== wsId || !taskIds.includes(t.id)) continue;
      if (action === 'delete') t.deleted_at = now;
      else if (action === 'archive') t.is_archived = 1;
      else if (action === 'priority') t.priority = value as PriorityLevel;
      else if (action === 'due_date') t.due_date = value || null;
      else if (action === 'status') {
        t.status = value as TaskStatus;
        const col = db.board_columns.find((c) => c.board_id === t.board_id && c.status_key === value);
        if (col) t.column_id = col.id;
      } else if (action === 'assign' && value) {
        if (!db.task_assignees.some((ta) => ta.task_id === t.id && ta.user_id === value)) {
          db.task_assignees.push({ id: crypto.randomUUID(), task_id: t.id, user_id: value, is_primary: 1, assigned_at: now });
          pushNotification(db, wsId, value, user, 'assignment', 'Assigned to task', `You were assigned to "${t.title}"`, 'task', t.id);
        }
      }
      t.updated_at = now;
    }
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)$/)) && method === 'GET') {
    const taskId = match[1];
    const user = getActiveUser(db);
    const tRow = db.tasks.find((t) => t.id === taskId);
    if (!tRow) throw new LocalApiError('Task not found.', 404);
    const baseTask = hydrateTasks(db, tRow.workspace_id, { projectId: tRow.project_id, includeArchived: true }).find((t) => t.id === taskId);
    if (!baseTask) throw new LocalApiError('Task not found.', 404);

    const subtasks = db.subtasks
      .filter((s) => s.task_id === taskId)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        ...s,
        assignee_name: s.assignee_id ? db.users.find((u) => u.id === s.assignee_id)?.full_name || null : null,
      }));

    const checklists: Checklist[] = db.checklists
      .filter((c) => c.task_id === taskId)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        task_id: c.task_id,
        title: c.title,
        position: c.position,
        items: db.checklist_items.filter((ci) => ci.checklist_id === c.id).sort((a, b) => a.position - b.position),
      }));

    const dependencies = db.task_dependencies
      .filter((d) => d.task_id === taskId)
      .map((d) => {
        const rt = db.tasks.find((x) => x.id === d.related_task_id);
        return {
          id: d.id,
          task_id: taskId,
          related_task_id: d.related_task_id,
          related_task_title: rt?.title || 'Linked Task',
          related_task_status: rt?.status || 'todo',
          dependency_type: d.dependency_type,
        };
      });

    const attachments: Attachment[] = db.attachments
      .filter((a) => a.task_id === taskId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({
        id: a.id,
        workspace_id: a.workspace_id,
        project_id: a.project_id,
        project_name: baseTask.project_name || null,
        task_id: taskId,
        task_title: baseTask.title,
        comment_id: a.comment_id,
        uploaded_by: a.uploaded_by,
        uploader_name: db.users.find((u) => u.id === a.uploaded_by)?.full_name || 'Member',
        original_name: a.original_name,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        created_at: a.created_at,
      }));

    const comments: TaskComment[] = db.comments
      .filter((c) => c.task_id === taskId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => {
        const author = db.users.find((u) => u.id === c.user_id);
        const cReacts = db.comment_reactions.filter((r) => r.comment_id === c.id);
        const emojiMap = new Map<string, { count: number; user_reacted: boolean }>();
        cReacts.forEach((r) => {
          const cur = emojiMap.get(r.emoji) || { count: 0, user_reacted: false };
          cur.count += 1;
          if (r.user_id === user.id) cur.user_reacted = true;
          emojiMap.set(r.emoji, cur);
        });
        const reactions: CommentReaction[] = Array.from(emojiMap.entries()).map(([emoji, info]) => ({
          emoji,
          count: info.count,
          user_reacted: info.user_reacted,
        }));
        return {
          id: c.id,
          task_id: taskId,
          user_id: c.user_id,
          parent_comment_id: c.parent_comment_id,
          author_name: author?.full_name || 'Member',
          author_avatar: author?.avatar_url || null,
          author_job_title: author?.job_title || 'Team Member',
          body: c.body,
          mentions: c.mentions,
          reactions,
          attachments: attachments.filter((a) => a.comment_id === c.id),
          created_at: c.created_at,
          updated_at: c.updated_at,
        };
      });

    const time_entries: TimeEntry[] = db.time_entries
      .filter((te) => te.task_id === taskId)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map((te) => ({
        ...te,
        project_name: baseTask.project_name,
        task_title: baseTask.title,
        user_name: db.users.find((u) => u.id === te.user_id)?.full_name || 'Member',
      }));

    const activity_logs: ActivityLog[] = db.activity_logs
      .filter((al) => al.task_id === taskId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

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
    const user = getActiveUser(db);
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) throw new LocalApiError('Task not found.', 404);
    const prevStatus = task.status;
    const now = new Date().toISOString();

    if (body.title !== undefined) task.title = String(body.title).trim();
    if (body.description !== undefined) task.description = String(body.description);
    if (body.priority !== undefined) task.priority = body.priority as PriorityLevel;
    if (body.task_type !== undefined) task.task_type = body.task_type as Task['task_type'];
    if (body.position !== undefined) task.position = Number(body.position);
    if (body.start_date !== undefined) task.start_date = body.start_date ? String(body.start_date) : null;
    if (body.due_date !== undefined) task.due_date = body.due_date ? String(body.due_date) : null;
    if (body.estimated_minutes !== undefined) task.estimated_minutes = Number(body.estimated_minutes || 0);
    if (Array.isArray(body.labels)) task.labels = body.labels as string[];
    if (body.is_archived !== undefined) task.is_archived = body.is_archived ? 1 : 0;

    if (body.column_id !== undefined) {
      task.column_id = String(body.column_id);
      if (body.status === undefined) {
        const col = db.board_columns.find((c) => c.id === String(body.column_id));
        if (col) task.status = col.status_key;
      }
    }
    if (body.status !== undefined) {
      task.status = body.status as TaskStatus;
      if (body.column_id === undefined) {
        const col = db.board_columns.find((c) => c.board_id === task.board_id && c.status_key === String(body.status));
        if (col) task.column_id = col.id;
      }
    }
    task.updated_at = now;

    if (Array.isArray(body.assignee_ids)) {
      const nextIds = Array.from(new Set(body.assignee_ids as string[]));
      const prevSet = new Set(db.task_assignees.filter((ta) => ta.task_id === taskId).map((ta) => ta.user_id));
      db.task_assignees = db.task_assignees.filter((ta) => ta.task_id !== taskId);
      nextIds.forEach((uid, idx) => {
        db.task_assignees.push({ id: crypto.randomUUID(), task_id: taskId, user_id: uid, is_primary: idx === 0 ? 1 : 0, assigned_at: now });
        if (!prevSet.has(uid)) {
          pushNotification(db, task.workspace_id, uid, user, 'assignment', 'Task assigned to you', `You were assigned to "${task.title}"`, 'task', taskId);
        }
      });
    }

    if (task.status !== prevStatus) {
      logActivity(
        db,
        task.workspace_id,
        user,
        task.status === 'completed' ? 'completed_task' : 'updated_status',
        `Moved "${task.title}" to ${task.status.replace('_', ' ')}`,
        task.project_id,
        taskId,
      );
      db.task_assignees
        .filter((ta) => ta.task_id === taskId)
        .forEach((ta) =>
          pushNotification(
            db,
            task.workspace_id,
            ta.user_id,
            user,
            'status',
            'Task status updated',
            `"${task.title}" moved to ${task.status.replace('_', ' ')}`,
            'task',
            taskId,
          ),
        );
    }

    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)$/)) && method === 'DELETE') {
    const taskId = match[1];
    if (query.get('permanent') === '1') {
      db.tasks = db.tasks.filter((t) => t.id !== taskId);
    } else {
      const task = db.tasks.find((t) => t.id === taskId);
      if (task) {
        const now = new Date().toISOString();
        task.deleted_at = now;
        task.updated_at = now;
      }
    }
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/restore$/)) && method === 'POST') {
    const task = db.tasks.find((t) => t.id === match![1]);
    if (task) {
      task.deleted_at = null;
      task.is_archived = 0;
      task.updated_at = new Date().toISOString();
    }
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // SUBTASKS, CHECKLISTS & DEPENDENCIES
  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/subtasks$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    db.subtasks.push({
      id,
      task_id: match[1],
      title: String(body.title || '').trim(),
      completed: 0,
      assignee_id: null,
      due_date: null,
      position: 0,
    });
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/subtasks\/([^/]+)$/)) && method === 'PATCH') {
    const sub = db.subtasks.find((s) => s.id === match![1]);
    if (sub) {
      if (body.completed !== undefined) sub.completed = body.completed ? 1 : 0;
      if (body.title !== undefined) sub.title = String(body.title).trim();
      saveDb(db);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/subtasks\/([^/]+)$/)) && method === 'DELETE') {
    db.subtasks = db.subtasks.filter((s) => s.id !== match![1]);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/checklists$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    db.checklists.push({ id, task_id: match[1], title: String(body.title || 'Checklist').trim(), position: 0, created_at: new Date().toISOString() });
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/checklists\/([^/]+)\/items$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    db.checklist_items.push({ id, checklist_id: match[1], text: String(body.text || '').trim(), completed: 0, position: 0 });
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/checklist-items\/([^/]+)$/)) && method === 'PATCH') {
    const ci = db.checklist_items.find((x) => x.id === match![1]);
    if (ci) {
      if (body.completed !== undefined) ci.completed = body.completed ? 1 : 0;
      if (body.text !== undefined) ci.text = String(body.text).trim();
      saveDb(db);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/checklist-items\/([^/]+)$/)) && method === 'DELETE') {
    db.checklist_items = db.checklist_items.filter((x) => x.id !== match![1]);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/dependencies$/)) && method === 'POST') {
    const id = crypto.randomUUID();
    db.task_dependencies.push({
      id,
      task_id: match[1],
      related_task_id: String(body.related_task_id),
      dependency_type: (body.dependency_type as DependencyType) || 'related_to',
      created_at: new Date().toISOString(),
    });
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/dependencies\/([^/]+)$/)) && method === 'DELETE') {
    db.task_dependencies = db.task_dependencies.filter((d) => d.id !== match![1]);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // COMMENTS & REACTIONS
  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/comments$/)) && method === 'POST') {
    const taskId = match[1];
    const user = getActiveUser(db);
    const commentBody = String(body.body || '').trim();
    if (!commentBody) throw new LocalApiError('Comment cannot be empty.', 400);
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) throw new LocalApiError('Task not found.', 404);
    const mentions = Array.isArray(body.mentions) ? (body.mentions as string[]) : [];
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    db.comments.push({
      id,
      task_id: taskId,
      user_id: user.id,
      parent_comment_id: body.parent_comment_id ? String(body.parent_comment_id) : null,
      body: commentBody,
      mentions,
      created_at: now,
      updated_at: now,
    });
    mentions.forEach((uid) =>
      pushNotification(db, task.workspace_id, uid, user, 'mention', `${user.full_name} mentioned you`, `Mentioned you on "${task.title}"`, 'task', taskId),
    );
    if (task.created_by && !mentions.includes(task.created_by)) {
      pushNotification(db, task.workspace_id, task.created_by, user, 'comment', `New comment on "${task.title}"`, `${user.full_name}: ${commentBody.slice(0, 120)}`, 'task', taskId);
    }
    logActivity(db, task.workspace_id, user, 'commented', `Commented on "${task.title}"`, task.project_id, taskId);
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/comments\/([^/]+)$/)) && method === 'PATCH') {
    const c = db.comments.find((x) => x.id === match![1]);
    if (c) {
      c.body = String(body.body || '').trim();
      c.updated_at = new Date().toISOString();
      saveDb(db);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/comments\/([^/]+)$/)) && method === 'DELETE') {
    db.comments = db.comments.filter((x) => x.id !== match![1]);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/comments\/([^/]+)\/reactions$/)) && method === 'POST') {
    const commentId = match[1];
    const user = getActiveUser(db);
    const emoji = String(body.emoji || '👍');
    const existing = db.comment_reactions.find((r) => r.comment_id === commentId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      db.comment_reactions = db.comment_reactions.filter((r) => r.id !== existing.id);
    } else {
      db.comment_reactions.push({ id: crypto.randomUUID(), comment_id: commentId, user_id: user.id, emoji, created_at: new Date().toISOString() });
    }
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // FILES
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/files$/)) && method === 'GET') {
    const wsId = match[1];
    const files: Attachment[] = db.attachments
      .filter((a) => a.workspace_id === wsId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({
        id: a.id,
        workspace_id: a.workspace_id,
        project_id: a.project_id,
        project_name: a.project_id ? db.projects.find((p) => p.id === a.project_id)?.name || null : null,
        task_id: a.task_id,
        task_title: a.task_id ? db.tasks.find((t) => t.id === a.task_id)?.title || null : null,
        comment_id: a.comment_id,
        uploaded_by: a.uploaded_by,
        uploader_name: db.users.find((u) => u.id === a.uploaded_by)?.full_name || 'Member',
        original_name: a.original_name,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
        created_at: a.created_at,
      }));
    return { files } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/files$/)) && method === 'POST') {
    const wsId = match[1];
    const user = getActiveUser(db);
    if (!(options.body instanceof FormData)) throw new LocalApiError('Multipart file payload required.', 400);
    const file = options.body.get('file');
    if (!(file instanceof File)) throw new LocalApiError('No file provided.', 400);
    if (file.size > 10 * 1024 * 1024) throw new LocalApiError('File exceeds 10 MB limit.', 400);

    const dataUrl = await readFileAsDataUrl(file);
    const projectId = options.body.get('project_id') ? String(options.body.get('project_id')) : null;
    const taskId = options.body.get('task_id') ? String(options.body.get('task_id')) : null;
    const id = crypto.randomUUID();
    db.attachments.push({
      id,
      workspace_id: wsId,
      project_id: projectId,
      task_id: taskId,
      comment_id: null,
      uploaded_by: user.id,
      original_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      data_url: dataUrl,
      created_at: new Date().toISOString(),
    });
    logActivity(db, wsId, user, 'uploaded_file', `Uploaded "${file.name}"`, projectId, taskId);
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/files\/([^/]+)$/)) && method === 'PATCH') {
    const f = db.attachments.find((a) => a.id === match![1]);
    if (f) {
      f.original_name = String(body.original_name || '').trim() || f.original_name;
      saveDb(db);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/files\/([^/]+)$/)) && method === 'DELETE') {
    db.attachments = db.attachments.filter((a) => a.id !== match![1]);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // TIME ENTRIES
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/time-entries$/)) && method === 'GET') {
    const wsId = match[1];
    const entries: TimeEntry[] = db.time_entries
      .filter((te) => te.workspace_id === wsId)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map((te) => ({
        ...te,
        project_name: db.projects.find((p) => p.id === te.project_id)?.name,
        task_title: db.tasks.find((t) => t.id === te.task_id)?.title,
        user_name: db.users.find((u) => u.id === te.user_id)?.full_name,
      }));
    return { entries } as unknown as T;
  }

  if ((match = path.match(/^\/api\/tasks\/([^/]+)\/time-entries$/)) && method === 'POST') {
    const taskId = match[1];
    const user = getActiveUser(db);
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) throw new LocalApiError('Task not found.', 404);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isRunning = body.is_running ? 1 : 0;
    db.time_entries.push({
      id,
      workspace_id: task.workspace_id,
      project_id: task.project_id,
      task_id: taskId,
      user_id: user.id,
      description: String(body.description || ''),
      duration_seconds: Number(body.duration_seconds || 0),
      started_at: now,
      ended_at: isRunning ? null : now,
      is_running: isRunning,
      created_at: now,
    });
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/time-entries\/([^/]+)$/)) && method === 'PATCH') {
    const te = db.time_entries.find((x) => x.id === match![1]);
    if (te) {
      if (body.duration_seconds !== undefined) te.duration_seconds = Number(body.duration_seconds);
      if (body.description !== undefined) te.description = String(body.description);
      if (body.is_running !== undefined) {
        te.is_running = body.is_running ? 1 : 0;
        if (!body.is_running) te.ended_at = new Date().toISOString();
      }
      saveDb(db);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/time-entries\/([^/]+)$/)) && method === 'DELETE') {
    db.time_entries = db.time_entries.filter((x) => x.id !== match![1]);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  // NOTIFICATIONS & ACTIVITY
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/notifications$/)) && method === 'GET') {
    const user = getActiveUser(db);
    const notifications = db.notifications
      .filter((n) => n.workspace_id === match![1] && n.user_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50);
    return { notifications } as unknown as T;
  }

  if ((match = path.match(/^\/api\/notifications\/([^/]+)\/read$/)) && method === 'PATCH') {
    const n = db.notifications.find((x) => x.id === match![1]);
    if (n) {
      n.is_read = body.is_read ? 1 : 0;
      saveDb(db);
    }
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/notifications\/mark-all-read$/)) && method === 'POST') {
    const user = getActiveUser(db);
    db.notifications.forEach((n) => {
      if (n.workspace_id === match![1] && n.user_id === user.id) n.is_read = 1;
    });
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/notifications\/([^/]+)$/)) && method === 'DELETE') {
    db.notifications = db.notifications.filter((n) => n.id !== match![1]);
    saveDb(db);
    return { ok: true } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/activity$/)) && method === 'GET') {
    const activity = db.activity_logs
      .filter((a) => a.workspace_id === match![1])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 60)
      .map((a) => ({
        ...a,
        project_name: a.project_id ? db.projects.find((p) => p.id === a.project_id)?.name || null : null,
        task_title: a.task_id ? db.tasks.find((t) => t.id === a.task_id)?.title || null : null,
      }));
    return { activity } as unknown as T;
  }

  // TEMPLATES & SEARCH
  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/templates$/)) && method === 'GET') {
    const wsId = match[1];
    const templates = db.project_templates
      .filter((t) => t.is_system === 1 || t.workspace_id === wsId)
      .sort((a, b) => b.is_system - a.is_system || b.created_at.localeCompare(a.created_at));
    return { templates } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/templates$/)) && method === 'POST') {
    const wsId = match[1];
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
      const proj = db.projects.find((p) => p.id === pid);
      if (proj) color = proj.color;
      const board = db.boards.find((b) => b.project_id === pid);
      if (board) {
        const cols = db.board_columns.filter((c) => c.board_id === board.id).sort((a, b) => a.position - b.position);
        if (cols.length > 0) columns = cols.map((c) => ({ name: c.name, status_key: c.status_key, color: c.color }));
      }
      sampleTasks = db.tasks
        .filter((t) => t.project_id === pid && !t.deleted_at)
        .slice(0, 10)
        .map((t) => ({
          title: t.title,
          status_key: t.status,
          priority: t.priority,
          labels: t.labels,
          estimated_minutes: t.estimated_minutes,
        }));
    }

    const id = crypto.randomUUID();
    db.project_templates.push({
      id,
      workspace_id: wsId,
      name: String(body.name || 'Custom Template').trim(),
      category: String(body.category || 'Custom'),
      description: String(body.description || 'Saved custom project template'),
      color,
      columns,
      sample_tasks: sampleTasks,
      is_system: 0,
      created_at: new Date().toISOString(),
    });
    saveDb(db);
    return { id } as unknown as T;
  }

  if ((match = path.match(/^\/api\/workspaces\/([^/]+)\/search$/)) && method === 'GET') {
    const wsId = match[1];
    const q = (query.get('q') || '').trim().toLowerCase();
    if (!q) return { projects: [], tasks: [], members: [], comments: [], files: [] } as unknown as T;

    const projects = db.projects
      .filter((p) => p.workspace_id === wsId && !p.deleted_at && (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((p) => ({ id: p.id, name: p.name, category: p.category, status: p.status, color: p.color }));

    const tasks = db.tasks
      .filter((t) => t.workspace_id === wsId && !t.deleted_at && (t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)))
      .slice(0, 12)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        project_id: t.project_id,
        project_name: db.projects.find((p) => p.id === t.project_id)?.name || '',
      }));

    const members = db.workspace_members
      .filter((m) => m.workspace_id === wsId)
      .map((m) => {
        const u = db.users.find((x) => x.id === m.user_id);
        if (!u) return null;
        if (!u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !u.job_title.toLowerCase().includes(q)) return null;
        return { id: u.id, full_name: u.full_name, email: u.email, job_title: u.job_title, avatar_url: u.avatar_url, role: m.role };
      })
      .filter(Boolean)
      .slice(0, 8);

    const wsTaskMap = new Map(db.tasks.filter((t) => t.workspace_id === wsId && !t.deleted_at).map((t) => [t.id, t.title]));
    const comments = db.comments
      .filter((c) => wsTaskMap.has(c.task_id) && c.body.toLowerCase().includes(q))
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        task_id: c.task_id,
        body: c.body,
        task_title: wsTaskMap.get(c.task_id) || '',
        author_name: db.users.find((u) => u.id === c.user_id)?.full_name || 'Member',
      }));

    const files = db.attachments
      .filter((f) => f.workspace_id === wsId && f.original_name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((f) => ({ id: f.id, original_name: f.original_name, mime_type: f.mime_type, size_bytes: f.size_bytes, project_id: f.project_id, task_id: f.task_id }));

    return { projects, tasks, members, comments, files } as unknown as T;
  }

  throw new LocalApiError(`Unhandled route: ${method} ${path}`, 404);
}
