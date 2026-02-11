import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const fileInterceptor = (entityName: string) => {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: path.join('uploads', entityName),
      filename: (req, file, callback) => {
        const fileName = randomUUID() + path.extname(file.originalname);

        callback(null, fileName);
      },
    }),
  });
};
