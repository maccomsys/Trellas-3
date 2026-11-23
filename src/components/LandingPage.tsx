import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
  GanttChart,
  Layers,
  LayoutGrid,
  ListTodo,
  MessageSquare,
  Moon,
  Plus,
  Sun,
  Users,
} from 'lucide-react';
import { useApp } from './AppContext';
import { TrellasLogo } from './TrellasLogo';
import { UserAvatar } from './UserAvatar';

const FAQS = [
  {
    q: 'How does Trellas keep project workflows calm and uncluttered?',
    a: 'Every project lives in one workspace with five synchronized views — Kanban Board, List, Calendar, Timeline, and Overview — so teams do not have to juggle separate tools for tasks, comments, files, and time tracking.',
  },
  {
    q: 'Can I invite external collaborators or assign granular roles?',
    a: 'Yes. Workspaces support five explicit permission roles: Workspace Owner, Administrator, Project Manager, Member, and Guest. All permissions are validated on the server.',
  },
  {
    q: 'Is sample data clearly separated from my own work?',
    a: 'Yes. Demo accounts include pre-populated sample projects so you can test boards, reports, and timelines right away, and every user-created item is cleanly stored and distinguished in your workspace.',
  },
  {
    q: 'Does Trellas support multiple workspaces?',
    a: 'Yes. You can create separate workspaces for different teams, clients, or personal goals and switch between them instantaneously with complete data isolation.',
  },
];

const PLANS = [
  {
    name: 'Free',
    audience: 'For individuals getting organized',
    price: '$0',
    cadence: 'per member / month',
    cta: 'Start free workspace',
    featured: false,
    limits: [
      '1 personal workspace',
      'Up to 3 active projects',
      'Kanban boards & list view',
      '100 MB file attachments',
    ],
  },
  {
    name: 'Pro',
    audience: 'For small focused teams',
    price: '$10',
    cadence: 'per member / month',
    cta: 'Create Pro workspace',
    featured: true,
    limits: [
      'Unlimited projects & templates',
      'Board, List, Calendar & Timeline views',
      'Task dependencies & time tracking',
      '10 GB shared file storage',
    ],
  },
  {
    name: 'Business',
    audience: 'For growing multi-project teams',
    price: '$18',
    cadence: 'per member / month',
    cta: 'Explore Business plan',
    featured: false,
    limits: [
      'Unlimited workspaces',
      'Role-based access controls (5 roles)',
      'Workload & productivity analytics',
      '100 GB storage + CSV exports',
    ],
  },
  {
    name: 'Enterprise',
    audience: 'For organizations at scale',
    price: 'Custom',
    cadence: 'annual agreement',
    cta: 'Start trial account',
    featured: false,
    limits: [
      'Custom workspace limits & retention',
      'Organization-wide governance',
      'Dedicated onboarding specialist',
      'Custom security policies',
    ],
  },
];

export const LandingPage: React.FC = () => {
  const { navigate, theme, setThemeMode } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-[#111312] text-[#1C1F1D] dark:text-[#F1F2EE] transition-colors">
      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-40 bg-[#FAF9F6]/90 dark:bg-[#111312]/90 backdrop-blur-md border-b border-[#E6E4DC] dark:border-[#242926]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a href="#top" className="whitespace-nowrap shrink-0">
            <TrellasLogo />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#545C57] dark:text-[#A3ABA6]">
            <a href="#product" className="hover:text-[#1C1F1D] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Product
            </a>
            <a href="#features" className="hover:text-[#1C1F1D] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#1C1F1D] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              How it works
            </a>
            <a href="#pricing" className="hover:text-[#1C1F1D] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg text-[#545C57] dark:text-[#A3ABA6] hover:bg-[#EFECE4] dark:hover:bg-[#1D211F] transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigate('login')}
              className="px-3 py-2 text-sm font-medium text-[#1C1F1D] dark:text-[#F1F2EE] hover:text-[#1B3B2B] dark:hover:text-[#6EE7B7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate('register')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Get started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="trellas-grid-bg border-b border-[#E6E4DC] dark:border-[#242926]">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          <div className="lg:col-span-5 space-y-6">
            <h1 className="font-display text-[clamp(2.5rem,4.4vw,3.85rem)] leading-[1.05] tracking-tight text-[#1C1F1D] dark:text-[#F1F2EE] text-balance">
              Where work takes{' '}
              <span className="italic font-normal relative inline-block">
                focus
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-1 h-[3px] bg-[#C99A4E] rounded-full"
                />
              </span>
              .
            </h1>

            <p className="text-base sm:text-lg text-[#545C57] dark:text-[#A3ABA6] leading-relaxed max-w-lg">
              Plan Better. Work Smarter. Achieve More. Bring your projects, tasks, Kanban boards, shared calendar, and team collaboration together in one calm workspace.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate('register')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Create your workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('login')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white dark:bg-[#191D1B] border border-[#DEDAD0] dark:border-[#2C312E] hover:border-[#1B3B2B] dark:hover:border-[#6EE7B7] text-sm font-medium text-[#1C1F1D] dark:text-[#F1F2EE] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Sign in</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-5 pt-2 text-xs text-[#646D67] dark:text-[#8E9691]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                Sample data, ready to edit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                Password-protected account
              </span>
            </div>
          </div>

          {/* Right Product Interface Preview */}
          <div id="product" className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#F0EDE5] dark:border-[#242926]">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-[#1C1F1D] dark:text-[#F1F2EE]">
                  <FolderKanban className="w-4 h-4 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                  <span>Website Relaunch</span>
                  <span className="text-[#8E9691] font-normal">·</span>
                  <span className="text-xs font-medium text-[#1B3B2B] dark:text-[#6EE7B7]">Active</span>
                </div>
                <div className="flex items-center -space-x-2">
                  <UserAvatar name="Maya Chen" avatarUrl="/src/assets/images/avatar_maya_chen_1795389987021.jpg" size="sm" />
                  <UserAvatar name="Julian Wright" avatarUrl="/src/assets/images/avatar_julian_wright_1795389986590.jpg" size="sm" />
                  <UserAvatar name="Priya Rao" avatarUrl="/src/assets/images/avatar_priya_rao_1795389986691.jpg" size="sm" />
                  <UserAvatar name="Theo Silva" avatarUrl="/src/assets/images/avatar_theo_silva_1795389986722.jpg" size="sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4">
                {/* Preview Column 1 */}
                <div className="bg-[#FAF9F6] dark:bg-[#121514] rounded-xl p-3 border border-[#ECE9E0] dark:border-[#232825] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#47504A] dark:text-[#B6BEB9]">
                    <span>To Do</span>
                    <span className="font-mono-num text-[#7D8580]">3</span>
                  </div>
                  <div className="bg-white dark:bg-[#1B1F1D] rounded-lg p-3 border border-[#E6E4DC] dark:border-[#2A2F2C] space-y-2">
                    <div className="text-[11px] font-medium text-[#7C3AED] dark:text-[#A78BFA]">Content</div>
                    <div className="text-xs font-semibold leading-snug">Migrate blog content to the new CMS</div>
                    <div className="flex items-center justify-between text-[11px] text-[#7D8580] pt-1">
                      <span>Medium</span>
                      <span className="font-mono-num">Nov 25</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#1B1F1D] rounded-lg p-3 border border-[#E6E4DC] dark:border-[#2A2F2C] space-y-2">
                    <div className="text-[11px] font-medium text-[#B91C1C] dark:text-[#F87171]">Bug</div>
                    <div className="text-xs font-semibold leading-snug">QA pass on Safari and mobile</div>
                    <div className="flex items-center justify-between text-[11px] text-[#7D8580] pt-1">
                      <span>High</span>
                      <span className="font-mono-num">Nov 21</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('login')}
                    className="w-full py-1.5 rounded-lg border border-dashed border-[#D5D1C5] dark:border-[#323835] text-xs text-[#6E7670] hover:text-[#1B3B2B] dark:hover:text-white transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add task
                  </button>
                </div>

                {/* Preview Column 2 */}
                <div className="bg-[#FAF9F6] dark:bg-[#121514] rounded-xl p-3 border border-[#ECE9E0] dark:border-[#232825] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#47504A] dark:text-[#B6BEB9]">
                    <span>In Progress</span>
                    <span className="font-mono-num text-[#7D8580]">2</span>
                  </div>
                  <div className="bg-white dark:bg-[#1B1F1D] rounded-lg p-3 border border-[#E6E4DC] dark:border-[#2A2F2C] space-y-2">
                    <div className="text-[11px] font-medium text-[#2563EB] dark:text-[#60A5FA]">Engineering</div>
                    <div className="text-xs font-semibold leading-snug">Build the responsive navigation</div>
                    <div className="flex items-center justify-between text-[11px] text-[#7D8580] pt-1">
                      <span className="text-[#B91C1C] dark:text-[#F87171] font-medium">Urgent</span>
                      <span className="font-mono-num">Today</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#1B1F1D] rounded-lg p-3 border border-[#E6E4DC] dark:border-[#2A2F2C] space-y-2">
                    <div className="text-[11px] font-medium text-[#2563EB] dark:text-[#60A5FA]">Engineering</div>
                    <div className="text-xs font-semibold leading-snug">Set up the redirect map</div>
                    <div className="flex items-center justify-between text-[11px] text-[#7D8580] pt-1">
                      <span>Low</span>
                      <span className="font-mono-num">Nov 24</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('login')}
                    className="w-full py-1.5 rounded-lg border border-dashed border-[#D5D1C5] dark:border-[#323835] text-xs text-[#6E7670] hover:text-[#1B3B2B] dark:hover:text-white transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add task
                  </button>
                </div>

                {/* Preview Column 3 */}
                <div className="bg-[#FAF9F6] dark:bg-[#121514] rounded-xl p-3 border border-[#ECE9E0] dark:border-[#232825] space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#47504A] dark:text-[#B6BEB9]">
                    <span>In Review</span>
                    <span className="font-mono-num text-[#7D8580]">1</span>
                  </div>
                  <div className="bg-white dark:bg-[#1B1F1D] rounded-lg p-3 border border-[#E6E4DC] dark:border-[#2A2F2C] space-y-2">
                    <div className="text-[11px] font-medium text-[#0F766E] dark:text-[#5EEAD4]">Design</div>
                    <div className="text-xs font-semibold leading-snug">Wireframe homepage and pricing</div>
                    <div className="flex items-center justify-between text-[11px] text-[#7D8580] pt-1">
                      <span>High</span>
                      <span className="font-mono-num">Today</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('login')}
                    className="w-full py-1.5 rounded-lg border border-dashed border-[#D5D1C5] dark:border-[#323835] text-xs text-[#6E7670] hover:text-[#1B3B2B] dark:hover:text-white transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add task
                  </button>
                </div>
              </div>

              {/* Weekly progress */}
              <div className="mt-4 pt-4 border-t border-[#F0EDE5] dark:border-[#242926] flex items-center gap-4">
                <span className="text-xs font-medium text-[#646D67] dark:text-[#9CA39F] whitespace-nowrap">
                  Weekly progress
                </span>
                <div className="flex-1 h-2 bg-[#ECEAE2] dark:bg-[#252A27] rounded-full overflow-hidden">
                  <div className="h-full bg-[#1B3B2B] dark:bg-[#34D399] rounded-full" style={{ width: '68%' }} />
                </div>
                <span className="font-mono-num text-xs font-semibold text-[#1C1F1D] dark:text-[#F1F2EE]">68%</span>
              </div>
            </div>

            {/* 3 KPI Strip Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] py-4 px-5 text-center">
                <div className="font-display text-2xl font-semibold tabular-nums">23</div>
                <div className="text-[11px] font-medium text-[#6E7670] dark:text-[#8E9691] mt-1">Open Tasks</div>
              </div>
              <div className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] py-4 px-5 text-center">
                <div className="font-display text-2xl font-semibold tabular-nums">6</div>
                <div className="text-[11px] font-medium text-[#6E7670] dark:text-[#8E9691] mt-1">Due This Week</div>
              </div>
              <div className="bg-white dark:bg-[#181B1A] rounded-xl border border-[#E5E2D9] dark:border-[#2A2F2C] py-4 px-5 text-center">
                <div className="font-display text-2xl font-semibold tabular-nums text-[#1B3B2B] dark:text-[#6EE7B7]">+18%</div>
                <div className="text-[11px] font-medium text-[#6E7670] dark:text-[#8E9691] mt-1">Team Velocity</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview & Multi-View Capabilities */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl space-y-3 mb-12">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-balance">
            One structured project, viewed the way your team works.
          </h2>
          <p className="text-[#545C57] dark:text-[#A3ABA6] text-base leading-relaxed">
            Switch seamlessly between Kanban boards, sortable tables, calendars, and Gantt timelines without duplicating a single task.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-7 space-y-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">
              <LayoutGrid className="w-4 h-4" />
              <span>Interactive Kanban Boards</span>
            </div>
            <h3 className="font-display text-2xl tracking-tight">Drag-and-drop clarity with customizable columns</h3>
            <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] leading-relaxed max-w-xl">
              Reorder columns, drag cards across workflow stages, filter by assignee or priority, and inspect checklists, dependencies, and attachments without leaving your board.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs text-[#545C57] dark:text-[#A3ABA6]">
              <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]">
                <ListTodo className="w-4 h-4 mb-1.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                <div className="font-semibold text-[#1C1F1D] dark:text-white">List View</div>
                <div>Bulk edit & sorting</div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]">
                <Calendar className="w-4 h-4 mb-1.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                <div className="font-semibold text-[#1C1F1D] dark:text-white">Calendar</div>
                <div>Month, week & day</div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]">
                <GanttChart className="w-4 h-4 mb-1.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                <div className="font-semibold text-[#1C1F1D] dark:text-white">Timeline</div>
                <div>Milestones & Gantt</div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#ECE9E0] dark:border-[#242926]">
                <Clock className="w-4 h-4 mb-1.5 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                <div className="font-semibold text-[#1C1F1D] dark:text-white">Time Tracking</div>
                <div>Live timer & logs</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">
                <Users className="w-4 h-4" />
                <span>Team Collaboration</span>
              </div>
              <h3 className="font-display text-2xl tracking-tight">Built-in comments, @mentions & inbox</h3>
              <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] leading-relaxed">
                Keep feedback anchored directly to tasks and project threads. Manage team roles, balance individual workloads, and track every deadline in one inbox.
              </p>
            </div>
            <div className="pt-4 border-t border-[#ECE9E0] dark:border-[#242926] flex items-center justify-between text-xs text-[#646D67] dark:text-[#8E9691]">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Threaded discussions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> 5 RBAC roles
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-y border-[#E6E4DC] dark:border-[#242926] bg-white dark:bg-[#161918]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-2xl space-y-3 mb-12">
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-balance">
              From workspace setup to shipping on schedule.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="font-mono-num text-xs font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">01. Organize</div>
              <h3 className="font-semibold text-lg">Create workspaces & launch from templates</h3>
              <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] leading-relaxed">
                Separate client work, engineering sprints, or personal goals into isolated workspaces. Start from 8 ready-made templates or customize your own.
              </p>
            </div>
            <div className="space-y-3">
              <div className="font-mono-num text-xs font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">02. Execute</div>
              <h3 className="font-semibold text-lg">Break work into subtasks, checklists & timelines</h3>
              <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] leading-relaxed">
                Assign multiple collaborators, map blocking dependencies, attach files, and track live time against estimated effort.
              </p>
            </div>
            <div className="space-y-3">
              <div className="font-mono-num text-xs font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">03. Measure</div>
              <h3 className="font-semibold text-lg">Monitor team velocity & export reports</h3>
              <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] leading-relaxed">
                Spot overdue tasks early, balance workloads across team members, and export project progress summaries as CSV reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl space-y-3 mb-12">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-balance">
            Transparent plans that grow with your team.
          </h2>
          <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
            Plan structure shown below for workspace sizing. All core features are immediately testable in your workspace account (online payment checkout is not enabled in this preview).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col justify-between border ${
                plan.featured
                  ? 'bg-[#1B3B2B] text-[#FAF9F6] border-[#1B3B2B]'
                  : 'bg-white dark:bg-[#181B1A] border-[#E5E2D9] dark:border-[#2A2F2C]'
              }`}
            >
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className={`text-xs mt-0.5 ${plan.featured ? 'text-[#C8D8CE]' : 'text-[#646D67] dark:text-[#9CA39F]'}`}>
                    {plan.audience}
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-semibold tabular-nums">{plan.price}</span>
                  <span className={`text-xs ${plan.featured ? 'text-[#C8D8CE]' : 'text-[#646D67] dark:text-[#9CA39F]'}`}>
                    {plan.cadence}
                  </span>
                </div>
                <ul className="space-y-2.5 pt-2 border-t border-current/10 text-xs">
                  {plan.limits.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.featured ? 'text-[#6EE7B7]' : 'text-[#1B3B2B] dark:text-[#6EE7B7]'}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => navigate('register')}
                className={`mt-6 w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  plan.featured
                    ? 'bg-[#FAF9F6] text-[#1B3B2B] hover:bg-[#ECEAE2]'
                    : 'bg-[#FAF9F6] dark:bg-[#232825] border border-[#DEDAD0] dark:border-[#323835] hover:border-[#1B3B2B] text-[#1C1F1D] dark:text-[#F1F2EE]'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight mb-8">Frequently asked questions</h2>
        <div className="divide-y divide-[#E6E4DC] dark:divide-[#242926] border-y border-[#E6E4DC] dark:border-[#242926]">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-medium text-sm sm:text-base py-1 cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <p className="mt-2 text-sm text-[#545C57] dark:text-[#A3ABA6] leading-relaxed pr-8">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E6E4DC] dark:border-[#242926] bg-white dark:bg-[#161918]">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <TrellasLogo size="sm" />
            <span className="text-xs text-[#646D67] dark:text-[#8E9691]">
              Calm project management for focused teams.
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#545C57] dark:text-[#A3ABA6]">
            <button type="button" onClick={() => navigate('login')} className="hover:text-[#1C1F1D] dark:hover:text-white cursor-pointer">
              Sign in
            </button>
            <button type="button" onClick={() => navigate('register')} className="hover:text-[#1C1F1D] dark:hover:text-white cursor-pointer">
              Create account
            </button>
            <a href="#pricing" className="hover:text-[#1C1F1D] dark:hover:text-white">
              Pricing
            </a>
            <span>© {new Date().getFullYear()} Trellas</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
