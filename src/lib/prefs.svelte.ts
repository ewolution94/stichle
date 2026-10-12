// This device's own card preferences (Settings → Stichle): the figure cards, or the classic deck the
// game began with (the user, 2026-10-12: keep it as an option). Kept in localStorage; blocked storage
// just means the default.

import type { Art } from './deck';

const ART = 'stichle:art';

function stored(): Art {
  try {
    return localStorage.getItem(ART) === 'classic' ? 'classic' : 'figures';
  } catch {
    return 'figures';
  }
}

export const prefs = $state({ art: stored() });

export function setArt(art: Art) {
  prefs.art = art;
  try {
    localStorage.setItem(ART, art);
  } catch {
    // not kept
  }
}
