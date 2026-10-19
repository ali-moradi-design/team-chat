import { lazy } from 'react';

/** Loaded on first open only: keeps the emoji data out of the main bundle. */
export const LazyEmojiPicker = lazy(() => import('./ui/EmojiPicker'));
