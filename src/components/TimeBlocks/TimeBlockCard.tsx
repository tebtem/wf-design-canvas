import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCanvas } from '../../state/CanvasContext';
import {
  BLOCK_STEP,
  blockHeight,
  blockTone,
  clampMinutes,
  DRAFT_NAMES,
  hhmm,
  MAX_BLOCK,
  MIN_BLOCK,
  PX_PER_MINUTE,
  type DraftId,
  type TimeBlock,
} from '../../state/types';
import { CupIcon, DownIcon, GripIcon, UpIcon, XIcon } from '../Icons';
import { type DragData } from './dnd';
import { useOpenBlockMove } from './TimeBlocksSection';

const BULLET = '• ';

/** Enter on a bulleted line starts the next bullet; Enter on an empty bullet ends the list. */
function continueBullets(e: KeyboardEvent<HTMLTextAreaElement>, setValue: (v: string, caret: number) => void) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
  const { value, selectionStart, selectionEnd } = e.currentTarget;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const line = value.slice(lineStart, selectionStart);
  if (!line.startsWith(BULLET)) return;
  e.preventDefault();
  const empty = line === BULLET;
  const next = empty
    ? value.slice(0, lineStart) + value.slice(selectionEnd)
    : value.slice(0, selectionStart) + '\n' + BULLET + value.slice(selectionEnd);
  const caret = empty ? lineStart : selectionStart + 1 + BULLET.length;
  setValue(next, caret);
}

interface Props {
  block: TimeBlock;
  draftId: DraftId;
  index: number;
  count: number;
  start: number;
  announce: (msg: string) => void;
}

export function TimeBlockCard({ block, draftId, index, count, start, announce }: Props) {
  const { dispatch, readOnly } = useCanvas();
  const isBreak = block.isBreak === true;
  const data: DragData = { type: 'block', draftId, minutes: block.minutes, label: block.label, isBreak };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data,
    disabled: readOnly,
  });

  const openMove = useOpenBlockMove();
  const name = `${block.minutes} minute ${isBreak ? 'break' : 'block'}${block.label ? ` "${block.label}"` : ''}`;
  const where = `position ${index + 1} of ${count} in ${DRAFT_NAMES[draftId]}`;
  const inputId = `label-${block.id}`;
  const notesId = `notes-${block.id}`;
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const setNotes = (notes: string, caret?: number) => {
    pendingCaret.current = caret ?? null;
    dispatch({ type: 'editBlock', id: block.id, notes });
  };
  // Place the caret after React writes the new value, before the next keystroke lands.
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    notesRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [block.notes]);

  // ---------- Length: typed in the side field, or dragged from the bottom edge ----------
  const minutesId = `minutes-${block.id}`;
  const [typed, setTyped] = useState<string | null>(null);
  const setMinutes = (m: number) => {
    const next = clampMinutes(m);
    dispatch({ type: 'setBlockMinutes', id: block.id, minutes: next });
    return next;
  };
  const commitTyped = () => {
    if (typed === null) return;
    const n = Number.parseInt(typed, 10);
    setTyped(null);
    if (!Number.isFinite(n)) return;
    const next = setMinutes(n);
    if (next !== n)
      announce(`Lengths go in ${BLOCK_STEP}-minute steps from ${MIN_BLOCK} to ${MAX_BLOCK}. Set to ${next} minutes.`);
  };
  const onMinutesKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTyped();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setTyped(null);
      setMinutes(block.minutes + (e.key === 'ArrowUp' ? BLOCK_STEP : -BLOCK_STEP));
    } else if (e.key === 'Escape') {
      setTyped(null);
    }
  };
  const resize = useRef<{ y: number; minutes: number } | null>(null);
  const onResizeDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = { y: e.clientY, minutes: block.minutes };
  };
  const onResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resize.current) return;
    const delta = (e.clientY - resize.current.y) / PX_PER_MINUTE;
    const next = clampMinutes(resize.current.minutes + delta);
    if (next !== block.minutes) dispatch({ type: 'setBlockMinutes', id: block.id, minutes: next });
  };
  const onResizeUp = () => {
    if (!resize.current) return;
    if (resize.current.minutes !== block.minutes) announce(`${name} is now ${block.minutes} minutes.`);
    resize.current = null;
  };

  const move = (toIndex: number) => {
    if (toIndex < 0 || toIndex >= count) return;
    dispatch({ type: 'moveBlock', id: block.id, toDraft: draftId, toIndex });
    announce(`${name} moved to position ${toIndex + 1} of ${count} in ${DRAFT_NAMES[draftId]}.`);
  };


  const remove = () => {
    dispatch({ type: 'removeBlock', id: block.id });
    announce(`${name} removed from ${DRAFT_NAMES[draftId]}.`);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#draft-${draftId}-heading`)?.focus());
  };

  return (
    <li
      ref={setNodeRef}
      data-block-id={block.id}
      className={`tblock ${isBreak ? 'tblock--break' : `tblock--m${blockTone(block.minutes)}`}${isDragging ? ' is-dragging' : ''}`}
      style={
        {
          transform: CSS.Translate.toString(transform),
          transition,
          '--h': `${blockHeight(block.minutes)}px`,
        } as CSSProperties
      }
    >
      <div className="tblock__side">
        {readOnly ? (
          <span className="tblock__minutes">
            {block.minutes}
            <span className="sr-only"> minutes, {where}</span>
          </span>
        ) : (
          <>
            <label htmlFor={minutesId} className="sr-only">
              Length in minutes of {name}, {where}
            </label>
            <input
              id={minutesId}
              className="tblock__minutes-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={typed ?? String(block.minutes)}
              title={`Length in minutes (${MIN_BLOCK} to ${MAX_BLOCK}, in ${BLOCK_STEP}-minute steps). Arrow keys change it by ${BLOCK_STEP}.`}
              onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))}
              onBlur={commitTyped}
              onKeyDown={onMinutesKey}
            />
            <span className="tblock__unit" aria-hidden="true">
              min
            </span>
            <button
              type="button"
              ref={setActivatorNodeRef}
              className="tblock__handle"
              {...attributes}
              {...listeners}
              aria-roledescription="draggable time block"
              aria-label={`Move ${name}, ${where}`}
              aria-haspopup="dialog"
              title="Drag to move, or click to choose where it goes"
              onClick={() => openMove(block.id)}
            >
              <GripIcon />
            </button>
          </>
        )}
        <span className="print-text" aria-hidden="true">
          {block.minutes}
        </span>
      </div>
      <div className="tblock__body">
        <label htmlFor={inputId} className="sr-only">
          Activity for {name}, {where}
        </label>
        <input
          id={inputId}
          className="tblock__label"
          value={block.label}
          readOnly={readOnly}
          placeholder={isBreak ? 'Break' : readOnly ? 'Untitled' : 'Name this block'}
          onChange={(e) => dispatch({ type: 'editBlock', id: block.id, label: e.target.value })}
        />
        <span className="print-text" aria-hidden="true">
          {block.label}
        </span>
        {isBreak && (
          <span className="tblock__break-tag" aria-hidden="true">
            <CupIcon /> Break
          </span>
        )}
        <span className="tblock__time">
          <span className="sr-only">Runs from </span>
          {hhmm(start)}
          <span aria-hidden="true"> – </span>
          <span className="sr-only"> to </span>
          {hhmm(start + block.minutes)}
        </span>
      </div>
      <div className="tblock__notes">
        <label htmlFor={notesId} className="sr-only">
          Notes for {name}, {where}
        </label>
        <textarea
          ref={notesRef}
          id={notesId}
          className="tblock__notes-text"
          value={block.notes}
          placeholder={readOnly ? '' : '• Add details'}
          readOnly={readOnly}
          rows={1}
          onFocus={(e) => {
            if (!readOnly && !e.currentTarget.value) setNotes(BULLET, BULLET.length);
          }}
          onBlur={(e) => {
            if (e.currentTarget.value.trim() === BULLET.trim()) setNotes('');
          }}
          onKeyDown={(e) => continueBullets(e, setNotes)}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="print-text" aria-hidden="true">
          {block.notes}
        </div>
      </div>
      {!readOnly && (
        <div className="tblock__actions no-print">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Move ${name} up`}
            aria-disabled={index === 0}
            title="Move up"
            onClick={() => move(index - 1)}
          >
            <UpIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Move ${name} down`}
            aria-disabled={index === count - 1}
            title="Move down"
            onClick={() => move(index + 1)}
          >
            <DownIcon />
          </button>
          <button
            type="button"
            className="icon-btn js-break-toggle"
            aria-pressed={isBreak}
            aria-label={`Break: ${name}`}
            title={isBreak ? 'Marked as a break. Click to make it an activity.' : 'Mark as a break'}
            onClick={() => {
              dispatch({ type: 'setBreak', id: block.id, isBreak: !isBreak });
              announce(isBreak ? `${name} is now an activity.` : `${name} is now a break.`);
            }}
          >
            <CupIcon />
          </button>
          <button type="button" className="icon-btn" aria-label={`Remove ${name}`} title="Remove" onClick={remove}>
            <XIcon />
          </button>
        </div>
      )}
      {!readOnly && (
        <div
          className="tblock__resize no-print"
          aria-hidden="true"
          title="Drag to change the length"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
        />
      )}
    </li>
  );
}

export function BlockPreview({ minutes, label }: { minutes: number; label?: string }) {
  return (
    <div
      className={`tblock tblock--m${blockTone(minutes)} tblock--overlay`}
      style={{ '--h': `${blockHeight(minutes)}px` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="tblock__side">
        <span className="tblock__minutes">{minutes}</span>
      </span>
      <div className="tblock__body">
        <span className="tblock__preview-label">{label || `${minutes} min block`}</span>
      </div>
    </div>
  );
}
