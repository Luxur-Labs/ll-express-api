import { prisma } from '../utils/prisma';
import { createOrderTransition } from '../utils/orderTransitions';

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

export interface CreatePatientData {
  name: string;
  age: number;
  gender: string;
  contactNumber?: string;
}

export interface CreateOrderData {
  invoiceNumber: string;
  patient: CreatePatientData; // Changed from patientId to patient object
  doctorId: string;
  clinicId: string;
  referredDoctorId?: string;
  partner: string;
  estimateDate: Date;
  orderProducts: CreateOrderProductData[];
  files?: CreateFileData[];
  status?: 'NEW' | 'IN_PROGRESS' | 'UNCLAIMED' | 'DELAYED' | 'COMPLETED' | 'READY_FOR_DISPATCH' | 'DISPATCH_INITIATED' | 'DISPATCH_PARTNER_BOOKED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED';
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
  status?: 'NEW' | 'IN_PROGRESS' | 'UNCLAIMED' | 'DELAYED' | 'COMPLETED' | 'READY_FOR_DISPATCH' | 'DISPATCH_INITIATED' | 'DISPATCH_PARTNER_BOOKED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED';
}

export class OrderService {
  async createOrder(data: CreateOrderData) {
    // Generate user-friendly order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Create or find patient
    // First, try to find existing patient by name, age, and gender
    let patient = await prisma.patient.findFirst({
      where: {
        name: data.patient.name,
        age: data.patient.age,
        gender: data.patient.gender,
      },
    });

    // If patient doesn't exist, create a new one
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: data.patient.name,
          age: data.patient.age,
          gender: data.patient.gender,
          contactNumber: data.patient.contactNumber,
        },
      });
    }
    
    const order = await prisma.order.create({
      data: {
        id: orderId,
        invoiceNumber: data.invoiceNumber,
        patientId: patient.id,
        doctorId: data.doctorId,
        clinicId: data.clinicId,
        referredDoctorId: data.referredDoctorId,
        partner: data.partner,
        estimateDate: data.estimateDate,
        status: data.status || 'NEW',
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
            fileSize: file.fileSize,
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

    // Create initial transition for order creation
    await createOrderTransition({
      orderId: order.id,
      fromState: undefined,
      toState: order.status || 'NEW',
      transitionedBy: undefined, // System-generated
      remarks: 'Order created',
    });

    return order;
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
        files: true,
      },
    });
  }

  async getOrdersList(filters: {
    page?: number;
    limit?: number;
    search?: string;
    invoiceNumber?: string;
    status?: string;
    patientId?: string;
    doctorId?: string;
    clinicId?: string;
    referredDoctorId?: string;
    patientName?: string;
    doctorName?: string;
    clinicName?: string;
    partner?: string;
    scanningMode?: string;
    scheduleFrom?: string;
    scheduleTo?: string;
    estimateDateFrom?: string;
    estimateDateTo?: string;
    dateOfApproachFrom?: string;
    dateOfApproachTo?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = filters.page || 0;
    const limit = filters.limit || 20;
    const skip = page * limit;
    
    // Build where clause
    const whereClause: any = {};
    
    // Invoice number filter (contains, case-insensitive)
    if (filters.invoiceNumber) {
      whereClause.invoiceNumber = {
        contains: filters.invoiceNumber,
        mode: 'insensitive',
      };
    }
    
    // Status filter (supports comma-separated multiple statuses)
    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim()).filter(s => s);
      if (statuses.length === 1) {
        whereClause.status = statuses[0];
      } else if (statuses.length > 1) {
        whereClause.status = { in: statuses };
      }
    }
    
    // ID filters
    if (filters.patientId) whereClause.patientId = filters.patientId;
    if (filters.doctorId) whereClause.doctorId = filters.doctorId;
    if (filters.clinicId) whereClause.clinicId = filters.clinicId;
    if (filters.referredDoctorId) whereClause.referredDoctorId = filters.referredDoctorId;
    
    // Name filters (case-insensitive partial match)
    if (filters.patientName) {
      whereClause.patient = {
        name: {
          contains: filters.patientName,
          mode: 'insensitive',
        },
      };
    }
    if (filters.doctorName) {
      whereClause.doctor = {
        name: {
          contains: filters.doctorName,
          mode: 'insensitive',
        },
      };
    }
    if (filters.clinicName) {
      whereClause.clinic = {
        clinicName: {
          contains: filters.clinicName,
          mode: 'insensitive',
        },
      };
    }
    
    // Other filters
    if (filters.partner) {
      whereClause.partner = {
        contains: filters.partner,
        mode: 'insensitive',
      };
    }
    if (filters.scanningMode) {
      whereClause.scanningMode = {
        contains: filters.scanningMode,
        mode: 'insensitive',
      };
    }
    
    // Date range filters
    if (filters.scheduleFrom || filters.scheduleTo) {
      whereClause.schedule = {};
      if (filters.scheduleFrom) whereClause.schedule.gte = new Date(filters.scheduleFrom);
      if (filters.scheduleTo) whereClause.schedule.lte = new Date(filters.scheduleTo);
    }
    
    if (filters.estimateDateFrom || filters.estimateDateTo) {
      whereClause.estimateDate = {};
      if (filters.estimateDateFrom) whereClause.estimateDate.gte = new Date(filters.estimateDateFrom);
      if (filters.estimateDateTo) whereClause.estimateDate.lte = new Date(filters.estimateDateTo);
    }
    
    if (filters.dateOfApproachFrom || filters.dateOfApproachTo) {
      whereClause.dateOfApproach = {};
      if (filters.dateOfApproachFrom) whereClause.dateOfApproach.gte = new Date(filters.dateOfApproachFrom);
      if (filters.dateOfApproachTo) whereClause.dateOfApproach.lte = new Date(filters.dateOfApproachTo);
    }
    
    if (filters.createdAtFrom || filters.createdAtTo) {
      whereClause.createdAt = {};
      if (filters.createdAtFrom) whereClause.createdAt.gte = new Date(filters.createdAtFrom);
      if (filters.createdAtTo) whereClause.createdAt.lte = new Date(filters.createdAtTo);
    }
    
    // Search filter (searches across invoiceNumber, patient name, doctor name, clinic name)
    if (filters.search) {
      const searchTerm = filters.search.trim();
      whereClause.OR = [
        { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
        { patient: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { doctor: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { clinic: { clinicName: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }
    
    // Build orderBy clause
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          patient: {
            select: { name: true },
          },
          doctor: {
            select: { name: true },
          },
          clinic: {
            select: { clinicName: true },
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
        orderBy,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return {
      data: {
        orders: orders.map(order => ({
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          status: order.status,
          schedule: order.schedule ? order.schedule.getTime() : null,
          estimateDate: order.estimateDate.getTime(),
          dateOfApproach: order.dateOfApproach ? order.dateOfApproach.getTime() : null,
          createdOn: order.createdAt.getTime(),
          amount: order.orderProducts.reduce((sum: number, op: any) => sum + Number(op.product.price), 0),
          assignedGroup: null,
          orderProducts: order.orderProducts.map((op: any) => `${op.product.product} (${op.workSpecification})`).join(', '),
          patientName: order.patient.name,
          doctorName: order.doctor.name,
          clinicName: order.clinic.clinicName,
        })),
        pagination: {
          page,
          limit,
          total,
        }
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
    });
  }

  async updateOrder(id: string, data: UpdateOrderData, transitionedBy?: string, remarks?: string) {
    // Get current order status before update
    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!currentOrder) {
      throw new Error('Order not found');
    }

    // Update the order
    const updatedOrder = await prisma.order.update({
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

    // Create transition if status changed
    if (data.status && data.status !== currentOrder.status) {
      await createOrderTransition({
        orderId: id,
        fromState: currentOrder.status,
        toState: data.status,
        transitionedBy,
        remarks: remarks || `Order status updated to ${data.status}`,
      });
    }

    return updatedOrder;
  }

  async deleteOrder(id: string) {
    return await prisma.order.delete({
      where: { id },
    });
  }
}

export const orderService = new OrderService();
