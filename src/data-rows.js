import {TRAIN_TEXT} from './model.js';

// Keep source line numbers visible after cleaning so a removed copy can be
// compared with the retained sentence. This list is for display, not training.
export function trainingRows() {
  const first = new Map();
  return TRAIN_TEXT.flatMap((text, index) => {
    if (!text.trim()) return [];
    const line = index + 1;
    const duplicateOf = first.get(text) ?? null;
    if (duplicateOf === null) first.set(text, line);
    return [{text, line, duplicateOf}];
  });
}
