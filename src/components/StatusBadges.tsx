import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import type { PriorityLevel, ProjectStatus, TaskStatus } from '../types/trellas';
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS, TASK_STATUS_LABELS } from '../lib/format';

export const PriorityIndicator: React.FC<{ priority: PriorityLevel; compact?: boolean }> = ({
  priority,
  compact = false,
}) => {
  const config: Record<PriorityLevel, { icon: React.ReactNode; cls: string }> = {
    low: {
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      cls: 'text-[#5A625E] dark:text-[#9CA39F]',
    },
    medium: {
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      cls: 'text-[#B7791F] dark:text-[#E2B05E]',
    },
    high: {
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      cls: 'text-[#C2410C] dark:text-[#FB923C]',
    },
    urgent: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      cls: 'text-[#B91C1C] dark:text-[#F87171]',
    },
  };

  const c = config[priority] || config.medium;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${c.cls}`}>
      {c.icon}
      {!compact && <span>{PRIORITY_LABELS[priority]}</span>}
    </span>
  );
};

export const TaskStatusIndicator: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const config: Record<TaskStatus, { icon: React.ReactNode; cls: string }> = {
    backlog: {
      icon: <Circle className="w-3.5 h-3.5" />,
      cls: 'text-[#64748B] dark:text-[#94A3B8]',
    },
    todo: {
      icon: <Circle className="w-3.5 h-3.5" />,
      cls: 'text-[#2563EB] dark:text-[#60A5FA]',
    },
    in_progress: {
      icon: <Clock className="w-3.5 h-3.5" />,
      cls: 'text-[#B7791F] dark:text-[#E2B05E]',
    },
    in_review: {
      icon: <Eye className="w-3.5 h-3.5" />,
      cls: 'text-[#7C3AED] dark:text-[#A78BFA]',
    },
    completed: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: 'text-[#16A34A] dark:text-[#4ADE80]',
    },
  };

  const c = config[status] || config.todo;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${c.cls}`}>
      {c.icon}
      <span>{TASK_STATUS_LABELS[status]}</span>
    </span>
  );
};

export const ProjectStatusIndicator: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  const config: Record<ProjectStatus, { icon: React.ReactNode; cls: string }> = {
    not_started: {
      icon: <Circle className="w-3.5 h-3.5" />,
      cls: 'text-[#64748B] dark:text-[#94A3B8]',
    },
    planning: {
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      cls: 'text-[#2563EB] dark:text-[#60A5FA]',
    },
    in_progress: {
      icon: <Clock className="w-3.5 h-3.5" />,
      cls: 'text-[#1B3B2B] dark:text-[#6EE7B7]',
    },
    on_hold: {
      icon: <PauseCircle className="w-3.5 h-3.5" />,
      cls: 'text-[#B7791F] dark:text-[#E2B05E]',
    },
    completed: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: 'text-[#16A34A] dark:text-[#4ADE80]',
    },
    cancelled: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      cls: 'text-[#B91C1C] dark:text-[#F87171]',
    },
  };
  const c = config[status] || config.in_progress;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${c.cls}`}>
      {c.icon}
      <span>{PROJECT_STATUS_LABELS[status]}</span>
    </span>
  );
};
