export const LIMITS = {
  messageMaxLength: 4000,
  nameMaxLength: 48,
  topicMaxLength: 160,
  descriptionMaxLength: 500,
  passwordMinLength: 8,
  passwordMaxLength: 128,
  handleMinLength: 3,
  handleMaxLength: 20,
  historyPageSize: 40,
  historyMaxPageSize: 100,
  maxAttachmentsPerMessage: 5,
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxReactionsPerMessage: 20,
  maxEmojiLength: 16,
  maxDmMembers: 8,
  searchPageSize: 20,
  typingTtlMs: 5000,
} as const;

export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export const ALLOWED_FILE_MIME = [
  ...ALLOWED_IMAGE_MIME,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/json',
] as const;

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🚀'] as const;
