/** Хранилище проектов в localStorage (MVP без бэкенда). */
import type { Wardrobe } from '../types/wardrobe';
import { isWardrobe, normalizeWardrobe, uid } from './geometry';

const KEY = 'wardrobe.projects.v1';

function safeRead(): Record<string, Wardrobe> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return {};
    const out: Record<string, Wardrobe> = {};
    for (const [id, w] of Object.entries(data as Record<string, unknown>)) if (isWardrobe(w)) out[id] = w;
    return out;
  } catch {
    return {};
  }
}

function safeWrite(all: Record<string, Wardrobe>): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function listProjects(): Wardrobe[] {
  return Object.values(safeRead()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string): Wardrobe | null {
  return safeRead()[id] ?? null;
}

export function saveProject(w: Wardrobe): boolean {
  const all = safeRead();
  all[w.id] = w;
  return safeWrite(all);
}

export function deleteProject(id: string): void {
  const all = safeRead();
  delete all[id];
  safeWrite(all);
}

export function duplicateProject(w: Wardrobe, name: string): Wardrobe {
  const now = Date.now();
  const copy: Wardrobe = { ...structuredClone(w), id: uid('wr'), name, createdAt: now, updatedAt: now };
  saveProject(copy);
  return copy;
}

/** Импорт JSON: новый id, чтобы не перезаписать существующий проект. */
export function importProject(json: string): Wardrobe | null {
  try {
    const data = JSON.parse(json) as unknown;
    if (!isWardrobe(data)) return null;
    const now = Date.now();
    const w = normalizeWardrobe({ ...data, id: uid('wr'), hardware: data.hardware ?? [], createdAt: now, updatedAt: now });
    saveProject(w);
    return w;
  } catch {
    return null;
  }
}

export function exportProjectJson(w: Wardrobe): string {
  return JSON.stringify(w, null, 2);
}
