import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const uploadFileInterceptor = (entity: string) =>
  FileInterceptor('file', {
    storage: diskStorage({
      destination: path.join('uploads', entity),
      filename: (req, file, callback) => {
        const fileName = randomUUID() + path.extname(file.originalname);

        callback(null, fileName);
      },
    }),
  });
