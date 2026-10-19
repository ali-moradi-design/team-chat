import { z } from 'zod';
import { objectId } from './common';

export const attachmentSchema = z.object({
  fileId: objectId,
  name: z.string(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  kind: z.enum(['image', 'file']),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  url: z.string(),
  thumbUrl: z.string().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;
