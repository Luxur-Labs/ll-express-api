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
  status?: 'NEW' | 'IN_PROGRESS' | 'READY_FOR_DISPATCH' | 'DISPATCH_INITIATED' | 'DISPATCH_PARTNER_BOOKED' | 'ORDER_INITIATED' | 'TASK_ASSIGNMENT' | 'TASK_COMPLETION' | 'TASK_APPROVED' | 'TASK_REJECTED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED';
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
  status?: 'NEW' | 'IN_PROGRESS' | 'READY_FOR_DISPATCH' | 'DISPATCH_INITIATED' | 'DISPATCH_PARTNER_BOOKED' | 'ORDER_INITIATED' | 'TASK_ASSIGNMENT' | 'TASK_COMPLETION' | 'TASK_APPROVED' | 'TASK_REJECTED' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED';
}

export class OrderService {
  async createOrder(data: CreateOrderData) {
    // Generate user-friendly order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const order = await prisma.order.create({
      data: {
        id: orderId,
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
      toState: 'ORDER_INITIATED',
      transitionedBy: undefined, // System-generated
      remarks: 'Order initiated',
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

  async getOrdersList(page: number = 0, limit: number = 20) {
    const skip = page * limit;
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        include: {
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
      prisma.order.count(),
    ]);

    return {
      data: {
        orders: orders.map(order => ({
          id: order.id,
          status: order.status,
          createdOn: order.createdAt.getTime(),
          amount: order.orderProducts.reduce((sum: number, op: any) => sum + Number(op.product.price), 0),
          assignedGroup: null,
          orderProducts: order.orderProducts.map((op: any) => `${op.product.product} (${op.workSpecification})`).join(', ')
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

  async updateOrder(id: string, data: UpdateOrderData, transitionedBy?: string) {
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
        remarks: `Order status manually updated`,
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
