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
type Pt = [number, number] | [number, number, number];
export function smooth(pts: Pt[], closed?: boolean, k?: number): string;
export function poly(pts: [number, number][]): string;
export function ellipse(cx: number, cy: number, rx: number, ry: number): string;
export function circle(cx: number, cy: number, r: number): string;
export function limb(pts: [number, number][], w: number): string;
export function star(x: number, y: number, r: number): string;
export function head(cx?: number, cy?: number, rx?: number, ry?: number): [string, string][];
export function face(cx?: number, cy?: number): [string, string][];
export function legs(y0?: number): [string, string][];
export function feet(): [string, string][];
export function gown(hem?: number, left?: number, right?: number): string;
export function silhouette(id: FigureId | Figure, colours: { gold: string; glow: string; paper: string; emblem: () => string }): string;
