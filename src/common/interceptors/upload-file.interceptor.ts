import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const uploadStorage = (entity: string) =>
  diskStorage({
    destination: path.join('uploads', entity),
    filename: (req, file, callback) => {
      const fileName = randomUUID() + path.extname(file.originalname);

      callback(null, fileName);
    },
  });

export const uploadFileInterceptor = (entity: string) => FileInterceptor('file', { storage: uploadStorage(entity) });

export const uploadFileFieldsInterceptor = (entity: string, fields: string[]) =>
  FileFieldsInterceptor(
    fields.map((name) => ({ name, maxCount: 1 })),
    { storage: uploadStorage(entity) },
  );
