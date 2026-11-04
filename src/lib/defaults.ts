// The order a family setting is decided in (Dashboard, plans/dashboard.md in the workspace): this
// device's own choice, then Dashboard's value (#ewo-config), then the built-in one, which is today's.
// Stichle's manifest (public/ewo.config.json) names German as its own default, so the family's
// language doesn't reach it and one set for Stichle does; sounds take the family's (off, like
// Stichle's own) or Stichle's. public/boot.js does the same for the language before first paint.
// No Svelte and no DOM here, so the tests load it as it is.

export type Lang = 'de' | 'en';
/** `system` is the first choice, Standard: nothing picked on this device. */
export type LangChoice = Lang | 'system';

/** Stichle speaks German first, like CDNMS: its players are the German-speaking afternoon meeting. */
export const BUILT_IN_LANG: Lang = 'de';
/** Sounds are off until a device switches them on (the user, 2026-10-12). */
export const BUILT_IN_SOUNDS = false;

const isLang = (value: unknown): value is Lang => value === 'de' || value === 'en';

/**
 * The language pill's choice from what this device saved under `ewo:lang`: Deutsch or English, or
 * Standard when it saved nothing. An older pick of System (saved as 'system' before Standard took
 * its place) stays this device's own: the browser's language, as before.
 */
export const choiceFor = (saved: unknown, browser: () => Lang): LangChoice =>
  isLang(saved) ? saved : saved === 'system' ? browser() : 'system';

/** The language to show: this device's own, else Dashboard's, else German. Dashboard's `system` sets none. */
export function languageFor(saved: unknown, dashboard: unknown, browser: () => Lang): Lang {
  const choice = choiceFor(saved, browser);
  if (choice !== 'system') return choice;
  return isLang(dashboard) ? dashboard : BUILT_IN_LANG;
}

/** Sounds: this device's pick (`stichle:sound`, 'on' or 'off'), else Dashboard's, else off. */
export const soundsFor = (saved: unknown, dashboard: unknown): boolean =>
  saved === 'on' ? true : saved === 'off' ? false : typeof dashboard === 'boolean' ? dashboard : BUILT_IN_SOUNDS;
