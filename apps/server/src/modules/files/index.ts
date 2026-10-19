import type { RequestHandler, Router } from 'express';
import type { Config } from '../../config/env';
import { FilesService } from './application/files.service';
import type { MembershipChecker } from './application/ports';
import { MongoFileRepository } from './infrastructure/file.repository';
import { LocalFileStorage } from './infrastructure/localStorage';
import { SharpImageProcessor } from './infrastructure/sharpProcessor';
import { filesRoutes } from './presentation/files.routes';

export { FilesService } from './application/files.service';
export { FileModel } from './infrastructure/file.model';

export function createFilesModule(deps: {
  config: Config;
  membership: () => MembershipChecker;
  requireAuth: RequestHandler;
  requireMediaAuth: RequestHandler;
}): { service: FilesService; uploadRouter: Router; downloadRouter: Router } {
  const service = new FilesService(
    new MongoFileRepository(),
    new LocalFileStorage(deps.config.uploadDir),
    new SharpImageProcessor(),
    deps.membership,
    deps.config.maxFileBytes,
  );
  const { uploadRouter, downloadRouter } = filesRoutes(service, {
    requireAuth: deps.requireAuth,
    requireMediaAuth: deps.requireMediaAuth,
    maxBytes: deps.config.maxFileBytes,
    isTest: deps.config.isTest,
  });
  return { service, uploadRouter, downloadRouter };
}
