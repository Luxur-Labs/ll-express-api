import { prisma } from '../utils/prisma';

export interface CreateOrderProductData {
  productId: string;
  workType: string;
  workSpecification: string;
  shadeType: string;
  finishingInstructions: string;
  componentDetails: string;
  incaseOfAllAbutments: string;
  occlusalStaining: string;
  ponticDesign: string;
  repeatCorrections: string;
  enterReason: string;
  unitNumbers?: string;
}

export interface CreateFileData {
  fileName: string;
  fileSize?: number;
  fileType?: string;
  fileExtension?: string;
  s3Key: string;
  fileCategory?: string;
  fileDescription?: string;
  uploadedBy?: string;
}

export interface CreateOrderData {
  invoiceNumber: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  referredDoctorId?: string;
  partner: string;
  scanningMode: string;
  schedule: Date;
  enterRemark: string;
  estimateDate: Date;
  dateOfApproach: Date;
  orderProducts: CreateOrderProductData[];
  files?: CreateFileData[];
}

export interface UpdateOrderData {
  invoiceNumber?: string;
  patientId?: string;
  doctorId?: string;
  clinicId?: string;
  referredDoctorId?: string;
  partner?: string;
  scanningMode?: string;
  schedule?: Date;
  enterRemark?: string;
  estimateDate?: Date;
  dateOfApproach?: Date;
}

export class OrderService {
  async createOrder(data: CreateOrderData) {
    return await prisma.order.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        patientId: data.patientId,
        doctorId: data.doctorId,
        clinicId: data.clinicId,
        referredDoctorId: data.referredDoctorId,
        partner: data.partner,
        scanningMode: data.scanningMode,
        schedule: data.schedule,
        enterRemark: data.enterRemark,
        estimateDate: data.estimateDate,
        dateOfApproach: data.dateOfApproach,
        orderProducts: {
          create: data.orderProducts.map(product => ({
            productId: product.productId,
            workType: product.workType,
            workSpecification: product.workSpecification,
            shadeType: product.shadeType,
            finishingInstructions: product.finishingInstructions,
            componentDetails: product.componentDetails,
            incaseOfAllAbutments: product.incaseOfAllAbutments,
            occlusalStaining: product.occlusalStaining,
            ponticDesign: product.ponticDesign,
            repeatCorrections: product.repeatCorrections,
            enterReason: product.enterReason,
            unitNumbers: product.unitNumbers,
          }))
        },
        files: data.files ? {
          create: data.files.map(file => ({
            fileName: file.fileName,
            fileSize: file.fileSize ? BigInt(file.fileSize) : null,
            fileType: file.fileType,
            fileExtension: file.fileExtension,
            s3Key: file.s3Key,
            fileCategory: file.fileCategory,
            fileDescription: file.fileDescription,
            uploadedBy: file.uploadedBy,
          }))
        } : undefined,
      },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
        files: true,
      },
    });
  }

  async getOrderById(id: string) {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
        files: true,
      },
    });
  }

  async getOrderByInvoiceNumber(invoiceNumber: string) {
    return await prisma.order.findUnique({
      where: { invoiceNumber },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
    });
  }

  async getAllOrders() {
    return await prisma.order.findMany({
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
        files: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrder(id: string, data: UpdateOrderData) {
    return await prisma.order.update({
      where: { id },
      data,
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
    });
  }

  async deleteOrder(id: string) {
    return await prisma.order.delete({
      where: { id },
    });
  }

  async getOrdersByPatient(patientId: string) {
    return await prisma.order.findMany({
      where: { patientId },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrdersByDoctor(doctorId: string) {
    return await prisma.order.findMany({
      where: { doctorId },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrdersByClinic(clinicId: string) {
    return await prisma.order.findMany({
      where: { clinicId },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrdersByPartner(partner: string) {
    return await prisma.order.findMany({
      where: { partner },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrdersByScanningMode(scanningMode: string) {
    return await prisma.order.findMany({
      where: { scanningMode },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date) {
    return await prisma.order.findMany({
      where: {
        schedule: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        patient: true,
        doctor: true,
        clinic: true,
        referredDoctor: true,
        orderProducts: {
          include: {
            product: true,
          }
        },
      },
      orderBy: { schedule: 'asc' },
    });
  }
}
