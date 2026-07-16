import { z } from 'zod';

// Stage indexes are 1-based, see docs/adr/0003.
export const stageIndex = z.number().int().min(1).max(5);

// Scores are decimal strings with exactly two digits after the point,
// for example "87.50". The legacy HR portal parses them with a fixed
// two-decimal parser. See docs/adr/0003.
export const scoreString = z.string().regex(/^\d{1,3}\.\d{2}$/);
