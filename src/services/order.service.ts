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

  async getOrdersList(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              name: true,
              age: true,
              gender: true,
            }
          },
          doctor: {
            select: {
              name: true,
            }
          },
          referredDoctor: {
            select: {
              name: true,
            }
          },
          clinic: {
            select: {
              clinicName: true,
              clientAddress: true,
              organizationId: true,
            }
          },
          orderProducts: {
            include: {
              product: {
                select: {
                  product: true,
                  price: true,
                }
              }
            }
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count()
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      orders: orders.map(order => ({
        id: order.id,
        patientName: order.patient.name,
        product: order.orderProducts[0]?.product.product || 'N/A',
        specification: order.orderProducts[0]?.workSpecification || 'N/A',
        quantity: order.orderProducts.length,
        amount: order.orderProducts.reduce((sum: number, op: any) => sum + Number(op.product.price), 0),
        partner: order.partner,
        clinicAddress: order.clinic.clientAddress,
        createdOn: order.createdAt.getTime(),
        status: 'NEW', // Default status
        processInstanceId: null, // Not implemented yet
        assignedGroup: null, // Not implemented yet
        patientAge: order.patient.age.toString(),
        gender: order.patient.gender,
        organisationId: order.clinic.organizationId,
        invoiceNumber: order.invoiceNumber,
        doctorName: order.doctor.name || 'N/A',
        doctorContact: 'N/A', // contactNumber not available in User model
        doctorReferredBy: order.referredDoctor?.name || null,
        clinicName: order.clinic.clinicName,
        schedule: order.schedule.toISOString().split('T')[0],
        estimatedDate: order.estimateDate.toISOString().split('T')[0],
        dateOfApproach: order.dateOfApproach.toISOString().split('T')[0],
        remarks: order.enterRemark,
        orderProducts: order.orderProducts.map(op => ({
          id: op.id,
          productId: op.productId,
          productName: op.product.product,
          productPrice: Number(op.product.price),
          workType: op.workType,
          workSpecification: op.workSpecification,
          shadeType: op.shadeType,
          finishingInstructions: op.finishingInstructions,
          componentDetails: op.componentDetails,
          incaseOfAllAbutments: op.incaseOfAllAbutments,
          occlusalStaining: op.occlusalStaining,
          ponticDesign: op.ponticDesign,
          repeatCorrections: op.repeatCorrections,
          enterReason: op.enterReason,
          unitNumbers: op.unitNumbers,
          createdAt: op.createdAt.getTime(),
          updatedAt: op.updatedAt.getTime(),
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    };
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
