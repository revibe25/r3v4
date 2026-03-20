/**
 * server/types/multer-s3.d.ts
 *
 * Minimal type shim for multer-s3@3.x.
 * multer-s3 ships no TypeScript declarations and @types/multer-s3 does not
 * exist for the v3 API. This covers the exact surface used in storage-s3.ts.
 *
 * If multer-s3 publishes official types in a future release, delete this file
 * and add the package to devDependencies instead.
 */

declare module 'multer-s3' {
  import type { S3Client } from '@aws-sdk/client-s3';
  import type { StorageEngine, FileFilterCallback } from 'multer';
  import type { Request } from 'express';

  type ContentTypeCallback = (err: Error | null, mimeType: string) => void;
  type KeyCallback         = (err: Error | null, key: string) => void;
  type MetadataCallback    = (err: Error | null, metadata: Record<string, string>) => void;

  interface Options {
    s3:           S3Client;
    bucket:       string | ((req: Request, file: Express.Multer.File, cb: (err: Error | null, bucket: string) => void) => void);
    contentType?: (req: Request, file: Express.Multer.File, cb: ContentTypeCallback) => void;
    key?:         (req: Request, file: Express.Multer.File, cb: KeyCallback) => void;
    metadata?:    (req: Request, file: Express.Multer.File, cb: MetadataCallback) => void;
    acl?:         string | ((req: Request, file: Express.Multer.File, cb: (err: Error | null, acl: string) => void) => void);
    cacheControl?:string | ((req: Request, file: Express.Multer.File, cb: (err: Error | null, cc: string) => void) => void);
    serverSideEncryption?: string;
  }

  /**
   * AUTO_CONTENT_TYPE — sniffs the content-type from the upload stream.
   * Pass as the `contentType` option to let multer-s3 detect the MIME type.
   */
  const AUTO_CONTENT_TYPE: (req: Request, file: Express.Multer.File, cb: ContentTypeCallback) => void;

  /**
   * multerS3(options) — returns a multer StorageEngine backed by S3/R2.
   * Use as: multer({ storage: multerS3({ ... }) })
   */
  function multerS3(options: Options): StorageEngine;

  namespace multerS3 {
    export { AUTO_CONTENT_TYPE };
  }

  export = multerS3;
}
