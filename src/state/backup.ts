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
