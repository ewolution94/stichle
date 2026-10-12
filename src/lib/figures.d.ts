// Types for figures.js (plain JavaScript, so a workspace review page can load it as it is).

export type FigureId =
  | 'beggar' | 'maid' | 'farmhand' | 'shepherdess' | 'farmer' | 'miller' | 'smith'
  | 'merchant' | 'monk' | 'knight' | 'duchess' | 'queen' | 'king' | 'wizard' | 'jester';

export interface Figure {
  names: { de: string; en: string };
  parts: [role: string, d: string][];
}

export const FIGURES: Record<FigureId, Figure>;
/** Who stands on each number, 1 to 13 (index 0 is empty). */
export const LADDER: (FigureId | null)[];
export function silhouette(id: FigureId, colours: { gold: string; glow: string; paper: string; emblem: () => string }): string;
