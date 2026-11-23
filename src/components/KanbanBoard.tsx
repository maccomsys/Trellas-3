import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { formatShortDate, isOverdue } from '../lib/format';
import type { BoardColumn, PriorityLevel, Task, TaskStatus } from '../types/trellas';
import { useApp } from './AppContext';
import { PriorityIndicator } from './StatusBadges';
import { UserAvatar } from './UserAvatar';

interface KanbanBoardProps {
  projectId: string;
  boardId: string;
  columns: BoardColumn[];
  tasks: Task[];
  onTasksChange?: (nextTasks: Task[]) => void;
  onPendingChange?: (pendingCount: number) => void;
  onReload: () => Promise<void>;
}

function sortTasksInColumn(list: Task[]): Task[] {
  return [...list].sort((a, b) => a.position - b.position || b.created_at.localeCompare(a.created_at));
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectId,
  boardId,
  columns,
  tasks,
  onTasksChange,
  onPendingChange,
  onReload,
}) => {
  const { activeWorkspace, members, setSelectedTaskId, refreshWorkspaceData, showToast } = useApp();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    task: Task;
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    colId: string;
    targetTaskId: string | null;
    position: 'before' | 'after' | 'end';
  } | null>(null);

  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragSessionRef = useRef<{
    task: Task;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    active: boolean;
    pointerId: number | null;
    cardEl: HTMLDivElement;
  } | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const justDraggedRef = useRef(false);
  const latestTasksRef = useRef<Task[]>(tasks);
  const latestFilteredRef = useRef<Task[]>(tasks);
  const latestColumnsRef = useRef<BoardColumn[]>(columns);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMutationsRef = useRef(0);
  const mutationEpochRef = useRef(0);
  const mountedRef = useRef(true);

  const stopAutoScroll = () => {
    if (autoScrollRafRef.current !== null) {
      window.cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopAutoScroll();
      document.body.style.userSelect = '';
    };
  }, []);

  useEffect(() => {
    latestTasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    latestColumnsRef.current = columns;
  }, [columns]);

  const [addingInCol, setAddingInCol] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('medium');

  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColStatus, setNewColStatus] = useState<TaskStatus>('todo');
  const [newColColor, setNewColColor] = useState('#3B82F6');

  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.labels.some((l) => l.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterAssignee !== 'all' && !t.assignees.some((a) => a.user_id === filterAssignee)) return false;
      return true;
    });
  }, [tasks, search, filterPriority, filterAssignee]);

  useEffect(() => {
    latestFilteredRef.current = filteredTasks;
  }, [filteredTasks]);

  const handleDropTaskOnColumn = (
    targetCol: BoardColumn,
    activeTaskId: string | null,
    target?: { targetTaskId: string; position: 'before' | 'after' },
  ) => {
    if (!activeTaskId) return;
    const currentTasks = latestTasksRef.current;
    const draggedTask = currentTasks.find((t) => t.id === activeTaskId);
    if (!draggedTask) return;

    const sourceColId = draggedTask.column_id;
    const isSameCol = sourceColId === targetCol.id;

    if (isSameCol && target && target.targetTaskId === draggedTask.id) {
      return;
    }

    const originalTargetOrder = sortTasksInColumn(currentTasks.filter((t) => t.column_id === targetCol.id));
    const targetWithoutDragged = originalTargetOrder.filter((t) => t.id !== draggedTask.id);

    let insertIdx = targetWithoutDragged.length;
    if (target && target.targetTaskId !== draggedTask.id) {
      const refIdx = targetWithoutDragged.findIndex((t) => t.id === target.targetTaskId);
      if (refIdx !== -1) {
        insertIdx = target.position === 'before' ? refIdx : refIdx + 1;
      }
    }

    const updatedMovedTask: Task = {
      ...draggedTask,
      column_id: targetCol.id,
      status: targetCol.status_key,
    };

    const nextTargetOrder = [...targetWithoutDragged];
    nextTargetOrder.splice(insertIdx, 0, updatedMovedTask);

    if (
      isSameCol &&
      draggedTask.status === targetCol.status_key &&
      originalTargetOrder.length === nextTargetOrder.length &&
      originalTargetOrder.every((t, idx) => t.id === nextTargetOrder[idx].id && t.position === idx)
    ) {
      return;
    }

    const nextSourceOrder = isSameCol
      ? []
      : sortTasksInColumn(currentTasks.filter((t) => t.column_id === sourceColId && t.id !== draggedTask.id));

    const updatesById = new Map<string, Partial<Task>>();
    const apiUpdates: Array<{ id: string; body: Record<string, unknown> }> = [];

    nextTargetOrder.forEach((t, idx) => {
      if (t.id === draggedTask.id) {
        updatesById.set(t.id, { column_id: targetCol.id, status: targetCol.status_key, position: idx });
        apiUpdates.push({
          id: t.id,
          body: {
            column_id: targetCol.id,
            status: targetCol.status_key,
            position: idx,
          },
        });
      } else if (t.position !== idx) {
        updatesById.set(t.id, { position: idx });
        apiUpdates.push({
          id: t.id,
          body: { position: idx },
        });
      }
    });

    nextSourceOrder.forEach((t, idx) => {
      if (t.position !== idx) {
        updatesById.set(t.id, { position: idx });
        apiUpdates.push({
          id: t.id,
          body: { position: idx },
        });
      }
    });

    if (apiUpdates.length === 0) return;

    const nextAllTasks = currentTasks.map((t) => {
      const patch = updatesById.get(t.id);
      return patch ? { ...t, ...patch } : t;
    });

    latestTasksRef.current = nextAllTasks;
    onTasksChange?.(nextAllTasks);

    const myEpoch = ++mutationEpochRef.current;
    pendingMutationsRef.current += 1;
    onPendingChange?.(pendingMutationsRef.current);

    mutationQueueRef.current = mutationQueueRef.current
      .catch(() => {})
      .then(async () => {
        let hadError = false;
        try {
          await Promise.all(
            apiUpdates.map((u) =>
              apiFetch(`/api/tasks/${u.id}`, {
                method: 'PATCH',
                body: JSON.stringify(u.body),
              }),
            ),
          );
        } catch (err) {
          hadError = true;
          if (mountedRef.current) {
            showToast(err instanceof ApiError ? err.message : 'Failed to move task', 'error');
          }
        } finally {
          pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
          onPendingChange?.(pendingMutationsRef.current);
        }

        if (hadError || (pendingMutationsRef.current === 0 && myEpoch === mutationEpochRef.current)) {
          await Promise.all([onReload(), refreshWorkspaceData()]);
        }
      });
  };

  const resolveDropTarget = (clientX: number, clientY: number, activeTaskId: string) => {
    const boardEl = boardScrollRef.current;
    const boardRect = boardEl?.getBoundingClientRect();
    if (boardRect) {
      if (
        clientX < boardRect.left - 64 ||
        clientX > boardRect.right + 64 ||
        clientY < boardRect.top - 72 ||
        clientY > boardRect.bottom + 72
      ) {
        return null;
      }
    }

    const visibleCols = latestColumnsRef.current
      .map((col) => {
        const el = colRefs.current.get(col.id);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (boardRect && (rect.right <= boardRect.left + 4 || rect.left >= boardRect.right - 4)) {
          return null;
        }
        return { col, rect };
      })
      .filter((entry): entry is { col: BoardColumn; rect: DOMRect } => entry !== null);

    let matchedCol: BoardColumn | null = null;
    for (const { col, rect } of visibleCols) {
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        matchedCol = col;
        break;
      }
    }

    // Match by X lane for gaps between columns or space below shorter/empty columns
    if (!matchedCol && visibleCols.length > 0) {
      let bestDist = Infinity;
      for (const { col, rect } of visibleCols) {
        const clampedLeft = boardRect ? Math.max(rect.left, boardRect.left) : rect.left;
        const clampedRight = boardRect ? Math.min(rect.right, boardRect.right) : rect.right;
        const dist =
          clientX < clampedLeft ? clampedLeft - clientX : clientX > clampedRight ? clientX - clampedRight : 0;
        if (dist < bestDist && dist <= 72) {
          bestDist = dist;
          matchedCol = col;
        }
      }
    }

    if (!matchedCol) return null;

    const otherColTasks = sortTasksInColumn(
      latestFilteredRef.current.filter((t) => t.column_id === matchedCol!.id && t.id !== activeTaskId),
    );

    for (const candidate of otherColTasks) {
      const cardEl = cardRefs.current.get(candidate.id);
      if (!cardEl) continue;
      const rect = cardEl.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return {
          col: matchedCol,
          target: { targetTaskId: candidate.id, position: 'before' as const },
          indicator: { colId: matchedCol.id, targetTaskId: candidate.id, position: 'before' as const },
        };
      }
    }

    const lastCard = otherColTasks[otherColTasks.length - 1];
    return {
      col: matchedCol,
      target: undefined,
      indicator: {
        colId: matchedCol.id,
        targetTaskId: lastCard ? lastCard.id : null,
        position: (lastCard ? 'after' : 'end') as 'after' | 'end',
      },
    };
  };

  const startDragTracking = (
    task: Task,
    startX: number,
    startY: number,
    cardEl: HTMLDivElement,
    pointerId: number | null,
  ) => {
    const cardRect = cardEl.getBoundingClientRect();
    dragSessionRef.current = {
      task,
      startX,
      startY,
      offsetX: startX - cardRect.left,
      offsetY: startY - cardRect.top,
      width: cardRect.width,
      active: false,
      pointerId,
      cardEl,
    };
    lastPointerRef.current = { x: startX, y: startY };

    const updateDragVisuals = (clientX: number, clientY: number) => {
      const session = dragSessionRef.current;
      if (!session) return;
      lastPointerRef.current = { x: clientX, y: clientY };

      if (!session.active) {
        const dist = Math.hypot(clientX - session.startX, clientY - session.startY);
        if (dist < 5) return;
        session.active = true;
        justDraggedRef.current = true;
        document.body.style.userSelect = 'none';
        setDraggedTaskId(session.task.id);
        if (session.pointerId !== null) {
          try {
            session.cardEl.setPointerCapture?.(session.pointerId);
          } catch {
            // ignore synthetic/unsupported pointer capture
          }
        }
        startAutoScroll();
      }

      setDragPreview({
        task: session.task,
        x: clientX - session.offsetX,
        y: clientY - session.offsetY,
        width: session.width,
      });

      const resolved = resolveDropTarget(clientX, clientY, session.task.id);
      setDragOverColId(resolved ? resolved.col.id : null);
      setDropIndicator(resolved ? resolved.indicator : null);
    };

    const startAutoScroll = () => {
      stopAutoScroll();
      const tick = () => {
        const session = dragSessionRef.current;
        const ptr = lastPointerRef.current;
        const scrollEl = boardScrollRef.current;
        if (!session?.active || !ptr || !scrollEl) {
          autoScrollRafRef.current = null;
          return;
        }
        const sRect = scrollEl.getBoundingClientRect();
        const edge = 76;
        let delta = 0;
        if (ptr.x < sRect.left + edge) {
          const ratio = Math.min(1, (sRect.left + edge - ptr.x) / edge);
          delta = -Math.max(4, Math.round(ratio * 18));
        } else if (ptr.x > sRect.right - edge) {
          const ratio = Math.min(1, (ptr.x - (sRect.right - edge)) / edge);
          delta = Math.max(4, Math.round(ratio * 18));
        }
        if (delta !== 0) {
          const prevLeft = scrollEl.scrollLeft;
          scrollEl.scrollLeft += delta;
          if (scrollEl.scrollLeft !== prevLeft) {
            const resolved = resolveDropTarget(ptr.x, ptr.y, session.task.id);
            setDragOverColId(resolved ? resolved.col.id : null);
            setDropIndicator(resolved ? resolved.indicator : null);
          }
        }
        autoScrollRafRef.current = window.requestAnimationFrame(tick);
      };
      autoScrollRafRef.current = window.requestAnimationFrame(tick);
    };

    const cleanup = () => {
      stopAutoScroll();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.userSelect = '';
      const session = dragSessionRef.current;
      if (session?.pointerId !== null && session?.pointerId !== undefined) {
        try {
          if (session.cardEl.hasPointerCapture?.(session.pointerId)) {
            session.cardEl.releasePointerCapture(session.pointerId);
          }
        } catch {
          // ignore
        }
      }
    };

    const finishDrag = (clientX: number, clientY: number, cancelled: boolean) => {
      const session = dragSessionRef.current;
      cleanup();
      dragSessionRef.current = null;
      lastPointerRef.current = null;

      if (!session?.active) return;

      const resolved = cancelled ? null : resolveDropTarget(clientX, clientY, session.task.id);
      setDraggedTaskId(null);
      setDragPreview(null);
      setDragOverColId(null);
      setDropIndicator(null);

      window.setTimeout(() => {
        justDraggedRef.current = false;
      }, 150);

      if (resolved) {
        handleDropTaskOnColumn(resolved.col, session.task.id, resolved.target);
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (dragSessionRef.current?.pointerId !== null && ev.pointerId !== dragSessionRef.current?.pointerId) return;
      updateDragVisuals(ev.clientX, ev.clientY);
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (dragSessionRef.current?.pointerId !== null) return;
      updateDragVisuals(ev.clientX, ev.clientY);
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (dragSessionRef.current?.pointerId !== null && ev.pointerId !== dragSessionRef.current?.pointerId) return;
      finishDrag(ev.clientX, ev.clientY, false);
    };

    const onMouseUp = (ev: MouseEvent) => {
      if (dragSessionRef.current?.pointerId !== null) return;
      finishDrag(ev.clientX, ev.clientY, false);
    };

    const onPointerCancel = (ev: PointerEvent) => {
      if (dragSessionRef.current?.pointerId !== null && ev.pointerId !== dragSessionRef.current?.pointerId) return;
      finishDrag(ev.clientX, ev.clientY, true);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        const ptr = lastPointerRef.current;
        finishDrag(ptr?.x ?? 0, ptr?.y ?? 0, true);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
  };

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, task: Task) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const targetEl = e.target as Element | null;
    if (targetEl?.closest?.('button, a, input, select, textarea')) return;
    e.preventDefault();
    startDragTracking(task, e.clientX, e.clientY, e.currentTarget, e.pointerId);
  };

  const handleCardMouseDown = (e: React.MouseEvent<HTMLDivElement>, task: Task) => {
    if (e.button !== 0 || dragSessionRef.current) return;
    const targetEl = e.target as Element | null;
    if (targetEl?.closest?.('button, a, input, select, textarea')) return;
    e.preventDefault();
    startDragTracking(task, e.clientX, e.clientY, e.currentTarget, null);
  };

  const handleQuickAddTask = async (col: BoardColumn, e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !newTaskTitle.trim()) return;
    try {
      await apiFetch(`/api/workspaces/${activeWorkspace.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          column_id: col.id,
          status: col.status_key,
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
        }),
      });
      setNewTaskTitle('');
      setAddingInCol(null);
      await Promise.all([onReload(), refreshWorkspaceData()]);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to create task', 'error');
    }
  };

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    try {
      await apiFetch(`/api/boards/${boardId}/columns`, {
        method: 'POST',
        body: JSON.stringify({ name: newColName.trim(), status_key: newColStatus, color: newColColor }),
      });
      setNewColName('');
      setAddingCol(false);
      await onReload();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to add column', 'error');
    }
  };

  const handleMoveColumn = async (colId: string, dir: -1 | 1) => {
    const idx = columns.findIndex((c) => c.id === colId);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= columns.length) return;
    const reordered = [...columns];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(target, 0, removed);
    await apiFetch(`/api/boards/${boardId}/columns/reorder`, {
      method: 'POST',
      body: JSON.stringify({ column_ids: reordered.map((c) => c.id) }),
    });
    setColMenuOpen(null);
    await onReload();
  };

  const handleDeleteColumn = async (colId: string) => {
    try {
      await apiFetch(`/api/columns/${colId}`, { method: 'DELETE' });
      setColMenuOpen(null);
      await onReload();
      await refreshWorkspaceData();
      showToast('Column removed; tasks moved safely', 'info');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Cannot delete last column', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Board Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#646D67] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter board tasks..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] w-48 sm:w-56"
            />
          </div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C]"
          >
            <option value="all">All assignees</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setAddingCol(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] hover:border-[#1B3B2B] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" /> Add column
        </button>
      </div>

      {/* Kanban Columns Scroll Container */}
      <div ref={boardScrollRef} className="flex items-start gap-4 overflow-x-auto pb-4 min-h-[520px]">
        {columns.map((col, colIdx) => {
          const colTasks = sortTasksInColumn(filteredTasks.filter((t) => t.column_id === col.id));
          const isOver = dragOverColId === col.id;

          return (
            <div
              key={col.id}
              data-kanban-col-id={col.id}
              ref={(el) => {
                if (el) colRefs.current.set(col.id, el);
                else colRefs.current.delete(col.id);
              }}
              className={`w-[300px] shrink-0 rounded-2xl p-3 border transition-colors flex flex-col gap-3 ${
                isOver
                  ? 'bg-[#EEF3EF] dark:bg-[#1B2A22] border-[#1B3B2B] dark:border-[#6EE7B7]'
                  : 'bg-[#F3F1EA] dark:bg-[#151817] border-[#E6E4DC] dark:border-[#242926]'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between gap-2 px-1 relative">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  {renamingColId === col.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (renameDraft.trim()) {
                          await apiFetch(`/api/columns/${col.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ name: renameDraft.trim() }),
                          });
                          await onReload();
                        }
                        setRenamingColId(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => setRenamingColId(null)}
                        className="w-36 px-2 py-0.5 text-xs font-semibold rounded bg-white dark:bg-[#1D211F] border border-[#1B3B2B]"
                      />
                    </form>
                  ) : (
                    <span className="text-xs font-semibold truncate">{col.name}</span>
                  )}
                  <span className="font-mono-num text-[11px] text-[#6E7670]">{colTasks.length}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAddingInCol(col.id)}
                    title="Add task in column"
                    className="p-1 rounded text-[#646D67] hover:text-[#1B3B2B] dark:hover:text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setColMenuOpen((prev) => (prev === col.id ? null : col.id))}
                    className="p-1 rounded text-[#646D67] hover:text-[#1C1F1D] dark:hover:text-white cursor-pointer"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>

                {colMenuOpen === col.id && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#1C201E] rounded-xl border border-[#E5E2D9] dark:border-[#2C312E] shadow-lg p-1.5 z-20 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingColId(col.id);
                        setRenameDraft(col.name);
                        setColMenuOpen(null);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] cursor-pointer"
                    >
                      Rename column
                    </button>
                    {colIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(col.id, -1)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] flex items-center gap-2 cursor-pointer"
                      >
                        <ArrowLeft className="w-3 h-3" /> Move left
                      </button>
                    )}
                    {colIdx < columns.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveColumn(col.id, 1)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F5F4EE] dark:hover:bg-[#252A27] flex items-center gap-2 cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3" /> Move right
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteColumn(col.id)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] dark:hover:bg-[#2C1616] flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Delete column
                    </button>
                  </div>
                )}
              </div>

              {/* Tasks Stack */}
              <div className="space-y-2.5">
                {colTasks.map((t) => {
                  const totalChecks = t.subtask_total + t.checklist_total;
                  const doneChecks = t.subtask_completed + t.checklist_completed;
                  const overdue = isOverdue(t.due_date, t.status);
                  const isBeforeIndicator =
                    dropIndicator?.colId === col.id &&
                    dropIndicator.targetTaskId === t.id &&
                    dropIndicator.position === 'before';
                  const isAfterIndicator =
                    dropIndicator?.colId === col.id &&
                    dropIndicator.targetTaskId === t.id &&
                    dropIndicator.position === 'after';

                  return (
                    <div
                      key={t.id}
                      data-kanban-task-id={t.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(t.id, el);
                        else cardRefs.current.delete(t.id);
                      }}
                      onPointerDown={(e) => handleCardPointerDown(e, t)}
                      onMouseDown={(e) => handleCardMouseDown(e, t)}
                      onDragStart={(e) => e.preventDefault()}
                      onClick={() => {
                        if (justDraggedRef.current || dragSessionRef.current?.active) return;
                        setSelectedTaskId(t.id);
                      }}
                      className={`bg-white dark:bg-[#1B1F1D] rounded-xl p-3.5 border border-[#E5E2D9] dark:border-[#2A2F2C] hover:border-[#1B3B2B] dark:hover:border-[#6EE7B7] transition-colors cursor-grab active:cursor-grabbing select-none touch-none space-y-2.5 shadow-2xs ${
                        draggedTaskId === t.id ? 'opacity-40' : ''
                      } ${isBeforeIndicator ? 'shadow-[0_-3px_0_0_#1B3B2B] dark:shadow-[0_-3px_0_0_#6EE7B7]' : ''} ${
                        isAfterIndicator ? 'shadow-[0_3px_0_0_#1B3B2B] dark:shadow-[0_3px_0_0_#6EE7B7]' : ''
                      }`}
                    >
                      {/* Labels as clean unboxed text */}
                      {t.labels.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">
                          {t.labels.map((lbl, i) => (
                            <React.Fragment key={lbl}>
                              {i > 0 && <span className="text-[#B5B9B6]">·</span>}
                              <span>{lbl}</span>
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      <div className="text-sm font-semibold leading-snug">{t.title}</div>

                      {t.description && (
                        <p className="text-xs text-[#646D67] dark:text-[#9CA39F] line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      )}

                      {/* Bottom Metadata */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#F2EFE8] dark:border-[#242926]">
                        <div className="flex items-center gap-2.5 text-[11px] text-[#6E7670] dark:text-[#8E9691]">
                          <PriorityIndicator priority={t.priority} compact />
                          {t.due_date && (
                            <span
                              className={`font-mono-num ${
                                overdue ? 'text-[#B91C1C] dark:text-[#F87171] font-semibold' : ''
                              }`}
                            >
                              {formatShortDate(t.due_date)}
                            </span>
                          )}
                          {totalChecks > 0 && (
                            <span className="inline-flex items-center gap-1 font-mono-num">
                              <CheckSquare className="w-3 h-3" />
                              {doneChecks}/{totalChecks}
                            </span>
                          )}
                          {t.comment_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 font-mono-num">
                              <MessageSquare className="w-3 h-3" />
                              {t.comment_count}
                            </span>
                          )}
                          {t.attachment_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 font-mono-num">
                              <Paperclip className="w-3 h-3" />
                              {t.attachment_count}
                            </span>
                          )}
                        </div>

                        <div className="flex -space-x-1.5 shrink-0 pointer-events-none">
                          {t.assignees.slice(0, 3).map((a) => (
                            <UserAvatar key={a.user_id} name={a.full_name} avatarUrl={a.avatar_url} size="xs" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inline Add Task */}
              {addingInCol === col.id ? (
                <form
                  onSubmit={(e) => handleQuickAddTask(col, e)}
                  className="bg-white dark:bg-[#1B1F1D] rounded-xl p-3 border border-[#1B3B2B] space-y-2.5"
                >
                  <input
                    autoFocus
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task title..."
                    className="w-full text-xs bg-transparent focus:outline-none font-medium"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as PriorityLevel)}
                      className="text-[11px] px-2 py-1 rounded bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddingInCol(null)}
                        className="px-2 py-1 text-[11px] text-[#646D67] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded bg-[#1B3B2B] text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingInCol(col.id)}
                  className="w-full py-2 rounded-xl border border-dashed border-[#D5D1C5] dark:border-[#2E3431] text-xs font-medium text-[#646D67] hover:text-[#1B3B2B] dark:hover:text-white hover:border-[#1B3B2B] transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add task
                </button>
              )}
            </div>
          );
        })}

        {/* Add Column Card */}
        {addingCol && (
          <form
            onSubmit={handleCreateColumn}
            className="w-[280px] shrink-0 rounded-2xl p-4 bg-white dark:bg-[#181B1A] border border-[#E5E2D9] dark:border-[#2A2F2C] space-y-3"
          >
            <div className="text-xs font-semibold">New board column</div>
            <input
              autoFocus
              required
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="e.g. Ready for QA"
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newColStatus}
                onChange={(e) => setNewColStatus(e.target.value as TaskStatus)}
                className="px-2 py-1.5 text-xs rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
              <input
                type="color"
                value={newColColor}
                onChange={(e) => setNewColColor(e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAddingCol(false)} className="px-3 py-1.5 text-xs cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[#1B3B2B] text-white text-xs font-semibold cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Floating Drag Preview */}
      {dragPreview && (
        <div
          style={{
            position: 'fixed',
            left: dragPreview.x,
            top: dragPreview.y,
            width: dragPreview.width,
            zIndex: 100,
            pointerEvents: 'none',
          }}
          className="bg-white dark:bg-[#1B1F1D] rounded-xl p-3.5 border border-[#1B3B2B] dark:border-[#6EE7B7] shadow-xl space-y-2.5 opacity-95"
        >
          {dragPreview.task.labels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#1B3B2B] dark:text-[#6EE7B7]">
              {dragPreview.task.labels.map((lbl, i) => (
                <React.Fragment key={lbl}>
                  {i > 0 && <span className="text-[#B5B9B6]">·</span>}
                  <span>{lbl}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="text-sm font-semibold leading-snug">{dragPreview.task.title}</div>
          {dragPreview.task.description && (
            <p className="text-xs text-[#646D67] dark:text-[#9CA39F] line-clamp-2 leading-relaxed">
              {dragPreview.task.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
