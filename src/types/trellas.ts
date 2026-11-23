export type WorkspaceRole = 'owner' | 'admin' | 'project_manager' | 'member' | 'guest';
export type ProjectStatus = 'not_started' | 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'completed';
export type TaskType = 'task' | 'bug' | 'feature' | 'milestone' | 'story';
export type DependencyType = 'blocking' | 'blocked_by' | 'related_to';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string;
  department: string;
  bio: string;
  timezone: string;
  email_verified: number;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  theme: ThemeMode;
  language: string;
  date_format: string;
  time_format: string;
  notify_assignments: number;
  notify_mentions: number;
  notify_comments: number;
  notify_deadlines: number;
  notify_updates: number;
  sidebar_collapsed: number;
  pinned_pages: string[];
}

export interface SessionInfo {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
  is_current?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_color: string;
  logo_initials: string;
  owner_id: string;
  plan: 'free' | 'pro' | 'business' | 'enterprise';
  role?: WorkspaceRole;
  member_count?: number;
  project_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  job_title: string;
  department: string;
  bio: string;
  assigned_projects_count?: number;
  assigned_tasks_count?: number;
  completed_tasks_count?: number;
  active_workload_minutes?: number;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted' | 'revoked';
  invited_by_name?: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  color: string;
  category: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  owner_id: string;
  manager_id: string;
  manager_name?: string;
  manager_avatar?: string | null;
  start_date: string | null;
  due_date: string | null;
  is_pinned: number;
  is_archived: number;
  is_demo: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  total_tasks?: number;
  completed_tasks?: number;
  progress_pct?: number;
  board_id?: string;
  members?: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'lead' | 'member' | 'viewer';
  full_name: string;
  email: string;
  avatar_url: string | null;
  job_title: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string;
  due_date: string;
  completed: number;
  created_at: string;
}

export interface ProjectDiscussion {
  id: string;
  project_id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  body: string;
  created_at: string;
}

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color: string;
  status_key: TaskStatus;
}

export interface TaskAssignee {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string;
  is_primary: number;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: number;
  assignee_id: string | null;
  assignee_name?: string | null;
  due_date: string | null;
  position: number;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  text: string;
  completed: number;
  position: number;
}

export interface Checklist {
  id: string;
  task_id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface TaskDependency {
  id: string;
  task_id: string;
  related_task_id: string;
  related_task_title: string;
  related_task_status: TaskStatus;
  dependency_type: DependencyType;
}

export interface CommentReaction {
  emoji: string;
  count: number;
  user_reacted: boolean;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  parent_comment_id: string | null;
  author_name: string;
  author_avatar: string | null;
  author_job_title: string;
  body: string;
  mentions: string[];
  reactions: CommentReaction[];
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  workspace_id: string;
  project_id: string | null;
  project_name?: string | null;
  task_id: string | null;
  task_title?: string | null;
  comment_id: string | null;
  uploaded_by: string;
  uploader_name?: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  workspace_id: string;
  project_id: string;
  project_name?: string;
  task_id: string;
  task_title?: string;
  user_id: string;
  user_name?: string;
  description: string;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  is_running: number;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  project_name?: string;
  project_color?: string;
  board_id: string;
  column_id: string;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityLevel;
  task_type: TaskType;
  position: number;
  start_date: string | null;
  due_date: string | null;
  estimated_minutes: number;
  actual_seconds?: number;
  labels: string[];
  is_demo: number;
  is_archived: number;
  deleted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees: TaskAssignee[];
  comment_count: number;
  attachment_count: number;
  subtask_total: number;
  subtask_completed: number;
  checklist_total: number;
  checklist_completed: number;
}

export interface TaskDetail extends Task {
  subtasks: Subtask[];
  checklists: Checklist[];
  dependencies: TaskDependency[];
  comments: TaskComment[];
  attachments: Attachment[];
  time_entries: TimeEntry[];
  activity_logs: ActivityLog[];
}

export interface NotificationItem {
  id: string;
  workspace_id: string;
  user_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  category: 'assignment' | 'mention' | 'comment' | 'deadline' | 'invitation' | 'status' | 'project';
  title: string;
  message: string;
  link_type: string | null;
  link_id: string | null;
  is_read: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  project_id: string | null;
  project_name?: string | null;
  task_id: string | null;
  task_title?: string | null;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  action: string;
  details: string;
  created_at: string;
}

export interface ProjectTemplate {
  id: string;
  workspace_id: string | null;
  name: string;
  category: string;
  description: string;
  color: string;
  columns: { name: string; status_key: TaskStatus; color: string }[];
  sample_tasks: { title: string; status_key: TaskStatus; priority: PriorityLevel; labels: string[]; estimated_minutes: number }[];
  is_system: number;
  created_at: string;
}
