import { prisma } from '../utils/prisma';

export interface CreateFileData {
  fileName: string;
  fileSize?: bigint;
  fileType?: string;
  fileExtension?: string;
  s3Key: string;
  fileCategory?: string;
  fileDescription?: string;
  uploadedBy?: string;
  orderId?: string;
}

export interface UpdateFileData {
  fileName?: string;
  fileSize?: bigint;
  fileType?: string;
  fileExtension?: string;
  s3Key?: string;
  fileCategory?: string;
  fileDescription?: string;
  isActive?: boolean;
}

export class FileService {
  async createFile(data: CreateFileData) {
    return prisma.file.create({
      data: {
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        fileExtension: data.fileExtension,
        s3Key: data.s3Key,
        fileCategory: data.fileCategory,
        fileDescription: data.fileDescription,
        uploadedBy: data.uploadedBy,
        orderId: data.orderId,
      },
    });
  }

  async createMultipleFiles(filesData: CreateFileData[]) {
    return prisma.file.createMany({
      data: filesData.map(file => ({
        fileName: file.fileName,
        fileSize: file.fileSize,
        fileType: file.fileType,
        fileExtension: file.fileExtension,
        s3Key: file.s3Key,
        fileCategory: file.fileCategory,
        fileDescription: file.fileDescription,
        uploadedBy: file.uploadedBy,
        orderId: file.orderId,
      })),
    });
  }

  async getFileById(id: string) {
    return prisma.file.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
    });
  }

  async getFilesByOrderId(orderId: string) {
    return prisma.file.findMany({
      where: { 
        orderId,
        isActive: true,
      },
      orderBy: { uploadDate: 'desc' },
    });
  }

  async getAllFiles() {
    return prisma.file.findMany({
      where: { isActive: true },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
      orderBy: { uploadDate: 'desc' },
    });
  }

  async updateFile(id: string, data: UpdateFileData) {
    return prisma.file.update({
      where: { id },
      data: {
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        fileExtension: data.fileExtension,
        s3Key: data.s3Key,
        fileCategory: data.fileCategory,
        fileDescription: data.fileDescription,
        isActive: data.isActive,
      },
    });
  }

  async deleteFile(id: string) {
    // Soft delete by setting isActive to false
    return prisma.file.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async hardDeleteFile(id: string) {
    return prisma.file.delete({
      where: { id },
    });
  }

  async getFilesByCategory(category: string) {
    return prisma.file.findMany({
      where: { 
        fileCategory: category,
        isActive: true,
      },
      orderBy: { uploadDate: 'desc' },
    });
  }

  async searchFilesByName(fileName: string) {
    return prisma.file.findMany({
      where: {
        fileName: {
          contains: fileName,
          mode: 'insensitive',
        },
        isActive: true,
      },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
      orderBy: { uploadDate: 'desc' },
    });
  }
}
