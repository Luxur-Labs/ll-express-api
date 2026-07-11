import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';
import { env } from '../config/env';

export interface UploadInput {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

// Initialize S3 client
const s3Client = new S3Client({
  region: env.AWS_REGION || 'us-east-1',
  credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

/**
 * Upload file to AWS S3 and return public URL
 */
export async function uploadToCdn(input: UploadInput): Promise<string> {
  // Fallback to local storage if S3 not configured
  if (!env.S3_BUCKET_NAME) {
    return uploadToLocal(input);
  }

  const ext = path.extname(input.originalname) || mimeToExt(input.mimetype) || '';
  const fileName = `uploads/${crypto.randomUUID()}${ext}`;
  
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: fileName,
    Body: input.buffer,
    ContentType: input.mimetype,
    ...(env.S3_OBJECT_ACL === 'public-read' ? { ACL: 'public-read' as const } : {}),
  });

  await s3Client.send(command);

  // Return public URL
  if (env.S3_PUBLIC_URL) {
    return `${env.S3_PUBLIC_URL}/${fileName}`;
  }
  
  // Fallback to standard S3 URL format
  return `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;
}

/**
 * Fallback to local storage when S3 is not configured
 */
async function uploadToLocal(input: UploadInput): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  
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


