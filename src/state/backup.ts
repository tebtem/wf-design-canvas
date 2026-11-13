import { parseState } from './persist';
import type { CanvasState } from './types';

const APP = 'wf-design-canvas';

/** A backup file: the canvas plus when it was saved. */
export function backupJson(state: CanvasState): string {
  return JSON.stringify({ app: APP, savedAt: new Date().toISOString(), canvas: state }, null, 2);
}

export function backupFileName(state: CanvasState, now = new Date()): string {
  const slug = state.details.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const date = now.toISOString().slice(0, 10);
  return `${slug || 'facilitation-canvas'}-backup-${date}.json`;
}

/** Reads a backup file's text. Accepts our backup format or a bare canvas. */
export function readBackup(text: string): { state: CanvasState; savedAt: string | null } | null {
  try {
    const obj = JSON.parse(text) as { app?: string; savedAt?: string; canvas?: unknown };
    const canvas = obj && typeof obj === 'object' && 'canvas' in obj ? obj.canvas : obj;
    const state = parseState(JSON.stringify(canvas));
    return state ? { state, savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : null } : null;
  } catch {
    return null;
  }
}

export function downloadBackup(state: CanvasState) {
  const blob = new Blob([backupJson(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName(state);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Backup reminder (solo canvas): remembered on this device only ----------
const LAST_KEY = 'wf-design-canvas:last-backup';
const SNOOZE_KEY = 'wf-design-canvas:backup-snooze';
const DAY = 24 * 60 * 60 * 1000;
/** Remind after this much work... */
export const REMIND_AFTER_ITEMS = 8;
/** ...and again when the last backup is older than this. */
const REMIND_EVERY_DAYS = 7;
const SNOOZE_DAYS = 3;

const readNum = (key: string) => {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const writeNum = (key: string, n: number) => {
  try {
    window.localStorage.setItem(key, String(n));
  } catch {
    // Storage blocked: the reminder simply shows again next time.
  }
};

export const markBackedUp = () => writeNum(LAST_KEY, Date.now());
export const snoozeBackupReminder = () => writeNum(SNOOZE_KEY, Date.now() + SNOOZE_DAYS * DAY);

/** How much someone has put into the canvas: sticky notes, time blocks and filled-in details. */
export function workAmount(state: CanvasState): number {
  const stickies = Object.values(state.cells).reduce((n, c) => n + c.stickies.length, 0);
  const blocks = Object.values(state.drafts).reduce((n, list) => n + list.filter((b) => b.kind !== 'day').length, 0);
  const details = Object.values(state.details).filter((v) => v.trim()).length;
  return stickies + blocks + details;
}

export function shouldRemindBackup(state: CanvasState, now = Date.now()): boolean {
  if (workAmount(state) < REMIND_AFTER_ITEMS) return false;
  if (readNum(SNOOZE_KEY) > now) return false;
  return now - readNum(LAST_KEY) > REMIND_EVERY_DAYS * DAY;
}
