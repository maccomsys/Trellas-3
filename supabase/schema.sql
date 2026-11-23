-- =============================================================================
-- Trellas Workspace — Complete Production Supabase PostgreSQL Schema
-- Execute this entire script once in Supabase Dashboard -> SQL Editor.
-- Covers: Core Tables, Constraints, Indexes, Auth & Timestamp Triggers,
-- Non-Recursive RLS Helpers & Policies, Storage Buckets/Policies,
-- System Project Templates Seed, and Realtime Publication.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. CORE TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  job_title TEXT NOT NULL DEFAULT 'Team Member',
  department TEXT NOT NULL DEFAULT 'Product',
  bio TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT NOT NULL DEFAULT 'en-US',
  date_format TEXT NOT NULL DEFAULT 'MMM d, yyyy',
  time_format TEXT NOT NULL DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
  notify_assignments BOOLEAN NOT NULL DEFAULT TRUE,
  notify_mentions BOOLEAN NOT NULL DEFAULT TRUE,
  notify_comments BOOLEAN NOT NULL DEFAULT TRUE,
  notify_deadlines BOOLEAN NOT NULL DEFAULT TRUE,
  notify_updates BOOLEAN NOT NULL DEFAULT TRUE,
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
  pinned_pages JSONB NOT NULL DEFAULT '["dashboard","my-tasks","projects","reports"]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  logo_color TEXT NOT NULL DEFAULT '#1B3B2B',
  logo_initials TEXT NOT NULL DEFAULT 'TR',
  owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('free', 'pro', 'business', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'project_manager', 'member', 'guest')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'project_manager', 'member', 'guest')),
  invited_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#1B3B2B',
  category TEXT NOT NULL DEFAULT 'Product',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started', 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  manager_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  start_date TEXT,
  due_date TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_discussions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.boards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Board',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.board_columns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  board_id TEXT NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  color TEXT NOT NULL DEFAULT '#64748B',
  status_key TEXT NOT NULL DEFAULT 'todo' CHECK (status_key IN ('backlog', 'todo', 'in_progress', 'in_review', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES public.board_columns(id) ON DELETE CASCADE,
  parent_task_id TEXT REFERENCES public.tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  task_type TEXT NOT NULL DEFAULT 'task' CHECK (task_type IN ('task', 'bug', 'feature', 'milestone', 'story')),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  start_date TEXT,
  due_date TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
  labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_assignees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.subtasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  assignee_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  due_date TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checklists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  checklist_id TEXT NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  related_task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'related_to' CHECK (dependency_type IN ('blocking', 'blocked_by', 'related_to')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (task_id <> related_task_id),
  UNIQUE (task_id, related_task_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_comment_id TEXT REFERENCES public.comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  comment_id TEXT NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES public.comments(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_running BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('assignment', 'mention', 'comment', 'deadline', 'invitation', 'status', 'project')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_type TEXT,
  link_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1B3B2B',
  columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_tasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_slug_active ON public.workspaces(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_winv_ws_email ON public.workspace_invitations(workspace_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_winv_status ON public.workspace_invitations(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_ws ON public.projects(workspace_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_pm_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ms_project ON public.project_milestones(project_id, due_date);
CREATE INDEX IF NOT EXISTS idx_disc_project ON public.project_discussions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boards_project ON public.boards(project_id);
CREATE INDEX IF NOT EXISTS idx_board_cols_board ON public.board_columns(board_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON public.tasks(workspace_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON public.tasks(column_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON public.subtasks(task_id, position);
CREATE INDEX IF NOT EXISTS idx_checklists_task ON public.checklists(task_id, position);
CREATE INDEX IF NOT EXISTS idx_ci_checklist ON public.checklist_items(checklist_id, position);
CREATE INDEX IF NOT EXISTS idx_deps_task ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_deps_related ON public.task_dependencies(related_task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON public.comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cr_comment ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_att_ws ON public.attachments(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_att_project ON public.attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_att_task ON public.attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_att_comment ON public.attachments(comment_id);
CREATE INDEX IF NOT EXISTS idx_te_ws ON public.time_entries(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_te_task ON public.time_entries(task_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_ws_user ON public.notifications(workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_ws ON public.activity_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_task ON public.activity_logs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpl_ws ON public.project_templates(workspace_id, is_system);

-- -----------------------------------------------------------------------------
-- 3. TIMESTAMP MANAGEMENT & SUPABASE AUTH SYNC TRIGGERS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_project_discussions_updated_at ON public.project_discussions;
CREATE TRIGGER trg_project_discussions_updated_at
  BEFORE UPDATE ON public.project_discussions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    SPLIT_PART(COALESCE(NEW.email, 'User'), '@', 1)
  );

  INSERT INTO public.users (id, email, full_name, avatar_url, email_verified, created_at, updated_at)
  VALUES (
    NEW.id::text,
    LOWER(COALESCE(NEW.email, '')),
    v_name,
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    (NEW.email_confirmed_at IS NOT NULL),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = (NEW.email_confirmed_at IS NOT NULL),
    updated_at = NOW();

  INSERT INTO public.user_preferences (user_id, updated_at)
  VALUES (NEW.id::text, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    email = LOWER(COALESCE(NEW.email, email)),
    email_verified = (NEW.email_confirmed_at IS NOT NULL),
    updated_at = NOW()
  WHERE id = NEW.id::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();

-- -----------------------------------------------------------------------------
-- 4. SECURITY DEFINER RLS HELPER FUNCTIONS (No RLS recursion)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = auth.uid()::text
      AND w.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(ws_id TEXT, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = auth.uid()::text
      AND w.deleted_at IS NULL
      AND wm.role = ANY(allowed_roles)
  );
$$;

-- Used inside workspaces_update WITH CHECK so workspace soft-delete succeeds cleanly
CREATE OR REPLACE FUNCTION public.has_workspace_role_raw(ws_id TEXT, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = auth.uid()::text
      AND wm.role = ANY(allowed_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_workspace_with(target_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm_self
    JOIN public.workspace_members wm_other ON wm_other.workspace_id = wm_self.workspace_id
    JOIN public.workspaces w ON w.id = wm_self.workspace_id
    WHERE wm_self.user_id = auth.uid()::text
      AND wm_other.user_id = target_user_id
      AND w.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.project_workspace_id(proj_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.projects WHERE id = proj_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.board_workspace_id(brd_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.workspace_id
  FROM public.boards b
  JOIN public.projects p ON p.id = b.project_id
  WHERE b.id = brd_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.task_workspace_id(t_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.tasks WHERE id = t_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.checklist_workspace_id(chk_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.workspace_id
  FROM public.checklists c
  JOIN public.tasks t ON t.id = c.task_id
  WHERE c.id = chk_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.comment_workspace_id(c_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.workspace_id
  FROM public.comments c
  JOIN public.tasks t ON t.id = c.task_id
  WHERE c.id = c_id
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY & POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

-- users
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid()::text OR public.shares_workspace_with(id));

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);

-- user_preferences
DROP POLICY IF EXISTS "prefs_all_self" ON public.user_preferences;
CREATE POLICY "prefs_all_self" ON public.user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

-- workspaces
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (owner_id = auth.uid()::text OR public.is_workspace_member(id)));

DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
CREATE POLICY "workspaces_insert" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
CREATE POLICY "workspaces_update" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_workspace_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (
    public.has_workspace_role_raw(id, ARRAY['owner', 'admin'])
    AND (
      deleted_at IS NULL
      OR owner_id = auth.uid()::text
      OR public.has_workspace_role_raw(id, ARRAY['owner'])
    )
  );

DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;
CREATE POLICY "workspaces_delete" ON public.workspaces FOR DELETE TO authenticated
  USING (owner_id = auth.uid()::text OR public.has_workspace_role_raw(id, ARRAY['owner']));

-- workspace_members
DROP POLICY IF EXISTS "wm_select" ON public.workspace_members;
CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "wm_insert" ON public.workspace_members;
CREATE POLICY "wm_insert" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    public.has_workspace_role(workspace_members.workspace_id, ARRAY['owner', 'admin'])
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_members.workspace_id
        AND w.owner_id = auth.uid()::text
        AND w.deleted_at IS NULL
    )
    OR (
      workspace_members.user_id = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.workspace_invitations inv
        WHERE inv.workspace_id = workspace_members.workspace_id
          AND inv.status = 'pending'
          AND inv.role = workspace_members.role
          AND LOWER(inv.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
    )
  );

DROP POLICY IF EXISTS "wm_update" ON public.workspace_members;
CREATE POLICY "wm_update" ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']) AND role <> 'owner')
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
    AND role <> 'owner'
  );

DROP POLICY IF EXISTS "wm_delete" ON public.workspace_members;
CREATE POLICY "wm_delete" ON public.workspace_members FOR DELETE TO authenticated
  USING (
    role <> 'owner'
    AND (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']) OR user_id = auth.uid()::text)
  );

-- workspace_invitations
DROP POLICY IF EXISTS "winv_select" ON public.workspace_invitations;
CREATE POLICY "winv_select" ON public.workspace_invitations FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(workspace_id)
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "winv_insert" ON public.workspace_invitations;
CREATE POLICY "winv_insert" ON public.workspace_invitations FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "winv_update" ON public.workspace_invitations;
CREATE POLICY "winv_update" ON public.workspace_invitations FOR UPDATE TO authenticated
  USING (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin'])
    OR (
      LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "winv_delete" ON public.workspace_invitations;
CREATE POLICY "winv_delete" ON public.workspace_invitations FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- projects (members can create, edit, pin, archive, restore; only owner/admin/project_manager can trash or permanently delete)
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']));

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (
    public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member'])
    AND (
      deleted_at IS NULL
      OR public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager'])
    )
  );

DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager']));

-- project_members
DROP POLICY IF EXISTS "pm_select" ON public.project_members;
CREATE POLICY "pm_select" ON public.project_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.project_workspace_id(project_id)));

DROP POLICY IF EXISTS "pm_write" ON public.project_members;
CREATE POLICY "pm_write" ON public.project_members FOR ALL TO authenticated
  USING (public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- project_milestones
DROP POLICY IF EXISTS "ms_select" ON public.project_milestones;
CREATE POLICY "ms_select" ON public.project_milestones FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.project_workspace_id(project_id)));

DROP POLICY IF EXISTS "ms_write" ON public.project_milestones;
CREATE POLICY "ms_write" ON public.project_milestones FOR ALL TO authenticated
  USING (public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- project_discussions
DROP POLICY IF EXISTS "disc_select" ON public.project_discussions;
CREATE POLICY "disc_select" ON public.project_discussions FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.project_workspace_id(project_id)));

DROP POLICY IF EXISTS "disc_insert" ON public.project_discussions;
CREATE POLICY "disc_insert" ON public.project_discussions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()::text
    AND public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin', 'project_manager', 'member'])
  );

DROP POLICY IF EXISTS "disc_update" ON public.project_discussions;
CREATE POLICY "disc_update" ON public.project_discussions FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()::text
    OR public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "disc_delete" ON public.project_discussions;
CREATE POLICY "disc_delete" ON public.project_discussions FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()::text
    OR public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin'])
  );

-- boards
DROP POLICY IF EXISTS "boards_select" ON public.boards;
CREATE POLICY "boards_select" ON public.boards FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.project_workspace_id(project_id)));

DROP POLICY IF EXISTS "boards_write" ON public.boards;
CREATE POLICY "boards_write" ON public.boards FOR ALL TO authenticated
  USING (public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.project_workspace_id(project_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- board_columns
DROP POLICY IF EXISTS "cols_select" ON public.board_columns;
CREATE POLICY "cols_select" ON public.board_columns FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.board_workspace_id(board_id)));

DROP POLICY IF EXISTS "cols_write" ON public.board_columns;
CREATE POLICY "cols_write" ON public.board_columns FOR ALL TO authenticated
  USING (public.has_workspace_role(public.board_workspace_id(board_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.board_workspace_id(board_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- tasks
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "tasks_write" ON public.tasks;
CREATE POLICY "tasks_write" ON public.tasks FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']));

-- task_assignees
DROP POLICY IF EXISTS "ta_select" ON public.task_assignees;
CREATE POLICY "ta_select" ON public.task_assignees FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.task_workspace_id(task_id)));

DROP POLICY IF EXISTS "ta_write" ON public.task_assignees;
CREATE POLICY "ta_write" ON public.task_assignees FOR ALL TO authenticated
  USING (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- subtasks
DROP POLICY IF EXISTS "subtasks_select" ON public.subtasks;
CREATE POLICY "subtasks_select" ON public.subtasks FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.task_workspace_id(task_id)));

DROP POLICY IF EXISTS "subtasks_write" ON public.subtasks;
CREATE POLICY "subtasks_write" ON public.subtasks FOR ALL TO authenticated
  USING (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- checklists
DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
CREATE POLICY "checklists_select" ON public.checklists FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.task_workspace_id(task_id)));

DROP POLICY IF EXISTS "checklists_write" ON public.checklists;
CREATE POLICY "checklists_write" ON public.checklists FOR ALL TO authenticated
  USING (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- checklist_items
DROP POLICY IF EXISTS "checklist_items_select" ON public.checklist_items;
CREATE POLICY "checklist_items_select" ON public.checklist_items FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.checklist_workspace_id(checklist_id)));

DROP POLICY IF EXISTS "checklist_items_write" ON public.checklist_items;
CREATE POLICY "checklist_items_write" ON public.checklist_items FOR ALL TO authenticated
  USING (public.has_workspace_role(public.checklist_workspace_id(checklist_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.checklist_workspace_id(checklist_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- task_dependencies
DROP POLICY IF EXISTS "deps_select" ON public.task_dependencies;
CREATE POLICY "deps_select" ON public.task_dependencies FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.task_workspace_id(task_id)));

DROP POLICY IF EXISTS "deps_write" ON public.task_dependencies;
CREATE POLICY "deps_write" ON public.task_dependencies FOR ALL TO authenticated
  USING (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member']));

-- comments
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.task_workspace_id(task_id)));

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()::text
    AND public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin', 'project_manager', 'member'])
  );

DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()::text
    OR public.has_workspace_role(public.task_workspace_id(task_id), ARRAY['owner', 'admin'])
  );

-- comment_reactions
DROP POLICY IF EXISTS "cr_select" ON public.comment_reactions;
CREATE POLICY "cr_select" ON public.comment_reactions FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.comment_workspace_id(comment_id)));

DROP POLICY IF EXISTS "cr_write_own" ON public.comment_reactions;
CREATE POLICY "cr_write_own" ON public.comment_reactions FOR ALL TO authenticated
  USING (
    user_id = auth.uid()::text
    AND public.has_workspace_role(public.comment_workspace_id(comment_id), ARRAY['owner', 'admin', 'project_manager', 'member'])
  )
  WITH CHECK (
    user_id = auth.uid()::text
    AND public.has_workspace_role(public.comment_workspace_id(comment_id), ARRAY['owner', 'admin', 'project_manager', 'member'])
  );

-- attachments
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
CREATE POLICY "attachments_select" ON public.attachments FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "attachments_write" ON public.attachments;
CREATE POLICY "attachments_write" ON public.attachments FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']));

-- time_entries
DROP POLICY IF EXISTS "time_select" ON public.time_entries;
CREATE POLICY "time_select" ON public.time_entries FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "time_insert" ON public.time_entries;
CREATE POLICY "time_insert" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()::text
    AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member'])
  );

DROP POLICY IF EXISTS "time_update" ON public.time_entries;
CREATE POLICY "time_update" ON public.time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text OR public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']))
  WITH CHECK (user_id = auth.uid()::text OR public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "time_delete" ON public.time_entries;
CREATE POLICY "time_delete" ON public.time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text OR public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']));

-- notifications
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']));

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

-- activity_logs
DROP POLICY IF EXISTS "act_select" ON public.activity_logs;
CREATE POLICY "act_select" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "act_insert" ON public.activity_logs;
CREATE POLICY "act_insert" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']));

-- project_templates
DROP POLICY IF EXISTS "tpl_select" ON public.project_templates;
CREATE POLICY "tpl_select" ON public.project_templates FOR SELECT TO authenticated
  USING (is_system = TRUE OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)));

DROP POLICY IF EXISTS "tpl_write" ON public.project_templates;
CREATE POLICY "tpl_write" ON public.project_templates FOR ALL TO authenticated
  USING (is_system = FALSE AND workspace_id IS NOT NULL AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']))
  WITH CHECK (is_system = FALSE AND workspace_id IS NOT NULL AND public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'project_manager', 'member']));

-- -----------------------------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKETS & POLICIES
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trellas-files',
  'trellas-files',
  FALSE,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'text/csv',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trellas-avatars',
  'trellas-avatars',
  TRUE,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "trellas_files_select" ON storage.objects;
CREATE POLICY "trellas_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trellas-files' AND public.is_workspace_member((storage.foldername(name))[1]));

DROP POLICY IF EXISTS "trellas_files_insert" ON storage.objects;
CREATE POLICY "trellas_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trellas-files'
    AND public.has_workspace_role((storage.foldername(name))[1], ARRAY['owner', 'admin', 'project_manager', 'member'])
  );

DROP POLICY IF EXISTS "trellas_files_update" ON storage.objects;
CREATE POLICY "trellas_files_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'trellas-files'
    AND public.has_workspace_role((storage.foldername(name))[1], ARRAY['owner', 'admin', 'project_manager', 'member'])
  )
  WITH CHECK (
    bucket_id = 'trellas-files'
    AND public.has_workspace_role((storage.foldername(name))[1], ARRAY['owner', 'admin', 'project_manager', 'member'])
  );

DROP POLICY IF EXISTS "trellas_files_delete" ON storage.objects;
CREATE POLICY "trellas_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trellas-files'
    AND public.has_workspace_role((storage.foldername(name))[1], ARRAY['owner', 'admin', 'project_manager', 'member'])
  );

DROP POLICY IF EXISTS "trellas_avatars_select" ON storage.objects;
CREATE POLICY "trellas_avatars_select" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'trellas-avatars');

DROP POLICY IF EXISTS "trellas_avatars_insert" ON storage.objects;
CREATE POLICY "trellas_avatars_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trellas-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "trellas_avatars_update" ON storage.objects;
CREATE POLICY "trellas_avatars_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trellas-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'trellas-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "trellas_avatars_delete" ON storage.objects;
CREATE POLICY "trellas_avatars_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trellas-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 7. SEED SYSTEM TEMPLATES
-- -----------------------------------------------------------------------------

INSERT INTO public.project_templates (id, workspace_id, name, category, description, color, columns_json, sample_tasks_json, is_system, created_by)
VALUES
(
  'tpl-website-dev', NULL, 'Website Development', 'Design & Web',
  'End-to-end site architecture, CMS migration, QA passes, and launch checklist.', '#1B3B2B',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Information architecture & sitemap sign-off","status_key":"completed","priority":"high","labels":["Strategy"],"estimated_minutes":120},{"title":"Wireframe homepage and pricing matrix","status_key":"in_review","priority":"high","labels":["Design"],"estimated_minutes":240},{"title":"Build responsive navigation & keyboard menu","status_key":"in_progress","priority":"urgent","labels":["Engineering"],"estimated_minutes":180},{"title":"Migrate blog content to structured CMS","status_key":"todo","priority":"medium","labels":["Content"],"estimated_minutes":150},{"title":"Cross-browser Safari & mobile QA pass","status_key":"backlog","priority":"medium","labels":["QA"],"estimated_minutes":90}]'::jsonb,
  TRUE, NULL
),
(
  'tpl-software-dev', NULL, 'Software Development', 'Engineering',
  'Sprint-ready engineering workflow with backlog triage, review, and release gates.', '#1E40AF',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Draft API schema & auth token rotation RFC","status_key":"completed","priority":"high","labels":["Backend"],"estimated_minutes":180},{"title":"Implement rate-limiting middleware","status_key":"in_progress","priority":"urgent","labels":["Security"],"estimated_minutes":240},{"title":"Write integration test suite for webhooks","status_key":"todo","priority":"medium","labels":["Testing"],"estimated_minutes":150},{"title":"Optimize database query indexes","status_key":"backlog","priority":"low","labels":["Performance"],"estimated_minutes":120}]'::jsonb,
  TRUE, NULL
),
(
  'tpl-marketing-campaign', NULL, 'Marketing Campaign', 'Marketing',
  'Coordinate creative briefs, ad assets, lifecycle emails, and launch attribution.', '#9333EA',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Finalize Q4 campaign messaging & positioning","status_key":"completed","priority":"high","labels":["Copy"],"estimated_minutes":120},{"title":"Produce social launch video cutdowns","status_key":"in_progress","priority":"high","labels":["Creative"],"estimated_minutes":300},{"title":"Configure UTM tracking & landing conversion goals","status_key":"todo","priority":"medium","labels":["Analytics"],"estimated_minutes":90}]'::jsonb,
  TRUE, NULL
),
(
  'tpl-business-ops', NULL, 'Business Operations', 'Operations',
  'Standard operating procedures, vendor reviews, compliance, and quarterly planning.', '#0F766E',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Annual software vendor renewal audit","status_key":"in_progress","priority":"high","labels":["Finance"],"estimated_minutes":180},{"title":"Update employee onboarding handbook","status_key":"todo","priority":"medium","labels":["People"],"estimated_minutes":120}]'::jsonb,
  TRUE, NULL
),
(
  'tpl-product-launch', NULL, 'Product Launch', 'Product',
  'Cross-functional launch tracker uniting product, engineering, docs, and GTM.', '#B45309',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Publish changelog & customer release notes","status_key":"todo","priority":"high","labels":["Docs"],"estimated_minutes":90},{"title":"Coordinate beta customer feedback interviews","status_key":"in_progress","priority":"high","labels":["Research"],"estimated_minutes":180}]'::jsonb,
  TRUE, NULL
),
(
  'tpl-event-planning', NULL, 'Event Planning', 'Events',
  'Manage venue logistics, speaker outreach, catering, and attendee check-in.', '#BE123C',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Confirm keynote speaker travel & AV requirements","status_key":"in_progress","priority":"urgent","labels":["Logistics"],"estimated_minutes":120},{"title":"Send calendar invites and registration confirmation","status_key":"todo","priority":"medium","labels":["Comms"],"estimated_minutes":60}]'::jsonb,
  TRUE, NULL
),
(
  'tpl-content-calendar', NULL, 'Content Calendar', 'Editorial',
  'Editorial pipeline from pitch and outline to editing, SEO review, and publish.', '#4338CA',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Write Q4 customer case study: Northstar","status_key":"in_progress","priority":"high","labels":["Editorial"],"estimated_minutes":210},{"title":"Design social preview graphics","status_key":"todo","priority":"medium","labels":["Design"],"estimated_minutes":90}]'::jsonb,
  TRUE, NULL
),
(
  'tpl-personal-prod', NULL, 'Personal Productivity', 'Personal',
  'Keep weekly priorities, deep work blocks, and personal goals cleanly organized.', '#15803D',
  '[{"name":"Backlog","status_key":"backlog","color":"#64748B"},{"name":"To Do","status_key":"todo","color":"#3B82F6"},{"name":"In Progress","status_key":"in_progress","color":"#C99A4E"},{"name":"In Review","status_key":"in_review","color":"#8B5CF6"},{"name":"Completed","status_key":"completed","color":"#16A34A"}]'::jsonb,
  '[{"title":"Weekly planning & inbox zero review","status_key":"todo","priority":"medium","labels":["Routine"],"estimated_minutes":45},{"title":"Read architectural design specification","status_key":"in_progress","priority":"low","labels":["Focus"],"estimated_minutes":60}]'::jsonb,
  TRUE, NULL
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. REALTIME REPLICA IDENTITY & PUBLICATION
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'projects',
    'boards',
    'board_columns',
    'tasks',
    'task_assignees',
    'subtasks',
    'checklists',
    'checklist_items',
    'task_dependencies',
    'comments',
    'comment_reactions',
    'attachments',
    'notifications',
    'project_milestones',
    'project_discussions',
    'activity_logs',
    'time_entries',
    'workspace_members',
    'workspace_invitations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 9. SCHEMA, TABLE & RLS HELPER FUNCTION GRANTS
-- -----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(TEXT, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_workspace_role_raw(TEXT, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_workspace_with(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_workspace_id(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.board_workspace_id(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.task_workspace_id(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checklist_workspace_id(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.comment_workspace_id(TEXT) TO authenticated, service_role;

