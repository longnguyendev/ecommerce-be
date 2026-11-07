import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import { UserRole } from '@/generated/prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Ảnh sản phẩm nằm ở ./uploads/products, phục vụ tĩnh tại /uploads/products/<file> (xem main.ts).
const UPLOAD_SUBDIR = 'products';
const UPLOAD_DIR = join(process.cwd(), 'uploads', UPLOAD_SUBDIR);
const ALLOWED = /^image\/(png|jpe?g|webp|gif|avif)$/i;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface UploadedFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

@Controller('uploads')
export class UploadController {
  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(UPLOAD_DIR)) {
            mkdirSync(UPLOAD_DIR, { recursive: true });
          }
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${Date.now()}-${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED.test(file.mimetype)) cb(null, true);
        else
          cb(
            new BadRequestException(
              'Chỉ chấp nhận file ảnh (png/jpg/webp/gif/avif)',
            ),
            false,
          );
      },
    }),
  )
  uploadImage(@UploadedFile() file: UploadedFile) {
    return {
      url: `/uploads/${UPLOAD_SUBDIR}/${file.filename}`,
      filename: file.filename,
    };
  }
}
