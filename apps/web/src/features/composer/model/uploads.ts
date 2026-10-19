import { useCallback, useRef, useState } from 'react';
import { ALLOWED_FILE_MIME, LIMITS, type Attachment } from '@team-chat/shared';
import { uploadFile } from '@/shared/api/upload';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  isImage: boolean;
  previewUrl?: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: 'tooBig' | 'type' | 'failed';
  attachment?: Attachment;
}

export function validateFile(file: File): UploadItem['error'] | null {
  if (file.size > LIMITS.maxFileSizeBytes) return 'tooBig';
  if (!(ALLOWED_FILE_MIME as readonly string[]).includes(file.type)) return 'type';
  return null;
}

export function useUploads() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const aborts = useRef(new Map<string, AbortController>());

  const patch = useCallback(
    (id: string, p: Partial<UploadItem>) =>
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i))),
    [],
  );

  const add = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const id = crypto.randomUUID();
        const error = validateFile(file);
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage && !error ? URL.createObjectURL(file) : undefined;
        setItems((cur) => [
          ...cur,
          {
            id,
            name: file.name,
            size: file.size,
            isImage,
            ...(previewUrl ? { previewUrl } : {}),
            progress: 0,
            status: error ? 'error' : 'uploading',
            ...(error ? { error } : {}),
          },
        ]);
        if (error) continue;
        const ctl = new AbortController();
        aborts.current.set(id, ctl);
        uploadFile(file, (progress) => patch(id, { progress }), ctl.signal)
          .then((attachment) => patch(id, { status: 'done', progress: 100, attachment }))
          .catch((e: unknown) => {
            if ((e as Error).name !== 'AbortError') patch(id, { status: 'error', error: 'failed' });
          })
          .finally(() => aborts.current.delete(id));
      }
    },
    [patch],
  );

  const remove = useCallback((id: string) => {
    aborts.current.get(id)?.abort();
    setItems((cur) => {
      const gone = cur.find((i) => i.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return cur.filter((i) => i.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    setItems((cur) => {
      cur.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
      return [];
    });
  }, []);

  return { items, add, remove, reset };
}
