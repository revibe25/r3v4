/**
 * server/types/multer-s3.d.ts
 *
 * Local type declaration for multer-s3 v3.
 * multer-s3 v3 ships no bundled types and @types/multer-s3 targets v2.
 * These declarations cover exactly what storage-s3.ts uses.
 */

import type { S3Client } from '@aws-sdk/client-s3';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';

declare namespace multerS3 {
  interface Options {
    s3: S3Client;
    bucket: string | ((req: Request, file: Express.Multer.File, cb: (err: Error | null, bucket: string) => void) => void);
    key: (req: Request, file: Express.Multer.File, cb: (err: Error | null, key: string) => void) => void;
    contentType?: (req: Request, file: Express.Multer.File, cb: (err: Error | null, mime: string, stream: NodeJS.ReadableStream) => void) => void;
    metadata?: (req: Request, file: Express.Multer.File, cb: (err: Error | null, metadata: Record<string, string>) => void) => void;
    acl?: string;
  }

  function AUTO_CONTENT_TYPE(
    req: Request,
    file: Express.Multer.File,
    cb: (err: Error | null, mime: string, stream: NodeJS.ReadableStream) => void
  ): void;
}

declare function multerS3(options: multerS3.Options): StorageEngine;

export = multerS3;
