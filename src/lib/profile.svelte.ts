// Your record on this device (development/plans/stichle.md → Release 2): games, rounds, bids met,
// streaks, achievements, and the look you chose from what they unlocked. Kept in localStorage; blocked
// storage means a record that lasts until the page closes. A code (copy it, paste it on another device)
// moves the record; it carries no names and nothing about anyone else.

import {
  ACHIEVEMENTS,
  cleanRecord,
  emptyRecord,
  unlocked,
  type AchievementId,
  type Look,
  type PlayerRecord,
  type Reward,
} from './achievements';

const KEY = 'stichle:profile';

function load(): PlayerRecord {
  try {
    return cleanRecord(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return emptyRecord();
  }
}

export const profile: PlayerRecord = $state(load());

/** Achievements earned since the page last showed them (the toast takes them one by one). */
export const fresh: { list: AchievementId[] } = $state({ list: [] });

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify($state.snapshot(profile)));
  } catch {
    // not kept
  }
}

/** After counting something: keep it, and queue what it earned for the toast. */
export function counted(ids: AchievementId[]) {
  save();
  if (ids.length) fresh.list = [...fresh.list, ...ids];
}

/** The look on the page: the cloth's colour and the cards' edges (the back is drawn by deck.ts). */
export function applyLook() {
  const root = document.documentElement;
  root.dataset.cloth = profile.look.cloth;
  root.dataset.edge = profile.look.edge;
}

export function choose(kind: Reward['kind'], id: string) {
  if (!unlocked(profile, kind, id)) return;
  (profile.look as unknown as Record<string, string>)[kind] = id;
  save();
  applyLook();
}

/** The record as a code to carry to another device: base64url of its JSON, plain and short. */
export function exportCode() {
  const json = JSON.stringify({ ...$state.snapshot(profile), counted: [] });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Takes a pasted code; false if it isn't one. The pasted record replaces this device's. */
export function importCode(code: string) {
  try {
    const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!raw || raw.v !== 1) return false;
    Object.assign(profile, cleanRecord(raw));
    save();
    applyLook();
    return true;
  } catch {
    return false;
  }
}

export const earnedCount = () => ACHIEVEMENTS.filter((a) => profile.earned[a.id]).length;
export type { Look };
