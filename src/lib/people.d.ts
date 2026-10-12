// Types for people.js (plain JavaScript, like figures.js).
import type { Figure } from './figures.js';

export const PEOPLE_FIGURES: Record<string, Figure>;
/** Who stands on each number in each element (index 0 is empty): ids of PEOPLE_FIGURES or figures.js's people. */
export const PEOPLE: Record<'fire' | 'water' | 'earth' | 'air', (string | null)[]>;
export function personOf(suit: 'fire' | 'water' | 'earth' | 'air', value: number): Figure;
