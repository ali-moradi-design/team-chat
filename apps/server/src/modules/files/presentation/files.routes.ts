import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { objectId, type Attachment } from '@team-chat/shared';
import { AppError, badRequest } from '../../../lib/errors';
import { currentUser, param, parse } from '../../../lib/http';
import type { FilesService } from '../application/files.service';
import { attachmentUrl } from '../../messages';

export function filesRoutes(
  service: FilesService,
  opts: {
    requireAuth: RequestHandler;
    requireMediaAuth: RequestHandler;
    maxBytes: number;
    isTest: boolean;
  },
): { uploadRouter: Router; downloadRouter: Router } {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: opts.maxBytes, files: 1, fields: 2, parts: 4 },
  });

  const uploadRouter = Router();
  uploadRouter.post(
    '/',
    opts.requireAuth,
    rateLimit({
      windowMs: 60_000,
      limit: opts.isTest ? 1000 : 30,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
    (req, res, next) => {
      upload.single('file')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          next(
            err.code === 'LIMIT_FILE_SIZE'
              ? new AppError('payload_too_large', 'File is too large')
              : badRequest(err.message),
          );
        } else next(err);
      });
    },
    async (req, res) => {
      const file = req.file;
      if (!file) throw badRequest('Missing file field');
      // multer decodes names as latin1; browsers send UTF-8.
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const record = await service.upload(currentUser(req), {
        buffer: file.buffer,
        originalName,
        mime: file.mimetype,
      });
      const out: Attachment = {
        fileId: record.id,
        name: record.name,
        mime: record.mime,
        size: record.size,
        kind: record.kind,
        ...(record.width ? { width: record.width } : {}),
        ...(record.height ? { height: record.height } : {}),
        url: attachmentUrl(record.id),
        ...(record.kind === 'image' ? { thumbUrl: `${attachmentUrl(record.id)}/thumb` } : {}),
      };
      res.status(201).json({ file: out });
    },
  );

  const downloadRouter = Router();
  const send =
    (variant: 'original' | 'thumb'): RequestHandler =>
    async (req, res) => {
      const { file, path } = await service.getForDownload(
        currentUser(req),
        parse(objectId, param(req, 'id')),
        variant,
      );
      const asImage = file.kind === 'image';
      res.set({
        'Content-Type':
          variant === 'thumb' ? 'image/webp' : asImage ? file.mime : 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-site',
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Disposition':
          variant === 'original' && !asImage
            ? `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`
            : 'inline',
      });
      res.sendFile(path, { dotfiles: 'deny', headers: {} }, (err) => {
        if (err && !res.headersSent)
          res.status(404).json({ error: { code: 'not_found', message: 'File missing' } });
      });
    };
  downloadRouter.get('/:id/thumb', opts.requireMediaAuth, send('thumb'));
  downloadRouter.get('/:id', opts.requireMediaAuth, send('original'));

  return { uploadRouter, downloadRouter };
}
