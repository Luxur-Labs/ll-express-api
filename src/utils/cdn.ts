import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UploadInput {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * Simulated CDN upload: writes file to local `uploads/` and returns a public URL path under `/static`.
 * In production, replace this with real CDN integration (S3, Cloudinary, etc.).
 */
export async function uploadToCdn(input: UploadInput): Promise<string> {
  const uploadsDir = path.resolve('uploads');
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(input.originalname) || mimeToExt(input.mimetype) || '';
  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  await fs.promises.writeFile(filePath, input.buffer);
  // Served by Express static at /static
  return `/static/${fileName}`;
}

function mimeToExt(mime: string): string | null {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'application/pdf') return '.pdf';
  return null;
}


