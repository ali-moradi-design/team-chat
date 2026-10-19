import type { ApiError, Attachment } from '@team-chat/shared';
import { ApiClientError, refreshSession } from './http';
import { tokenStore } from './token';

function once(file: File, token: string | null, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: unknown;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        body = undefined;
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new ApiClientError(0, 'network', 'Network error'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
}

/** Uploads one file with progress. Retries once after refreshing an expired token. */
export async function uploadFile(file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<Attachment> {
  let res = await once(file, tokenStore.get(), onProgress, signal);
  if (res.status === 401) {
    const session = await refreshSession();
    if (session) res = await once(file, session.accessToken, onProgress, signal);
  }
  if (res.status !== 201) {
    const err = (res.body as { error?: ApiError } | undefined)?.error;
    throw new ApiClientError(res.status, err?.code ?? 'internal', err?.message ?? 'Upload failed');
  }
  return (res.body as { file: Attachment }).file;
}
