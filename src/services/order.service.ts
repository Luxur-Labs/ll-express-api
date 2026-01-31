import { createOrderTransition } from '../utils/orderTransitions';
import { prisma } from '../utils/prisma';

export interface CreateOrderProductData {
  productId: string;
  workType?: string;
  workSpecification?: string;
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

export interface UpdateOrderProductData extends CreateOrderProductData {
  id?: string; // ID of existing orderProduct to update
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

export interface UpdateFileData extends CreateFileData {
  id?: string; // ID of existing file to update
}

export interface CreatePatientData {
  name: string;
  age: number;
  gender: string;
  contactNumber?: string;
}

export type OrderStatusType =
  | 'NEW'
  | 'MODEL'
  | 'CAD'
  | 'CAM'
  | 'DMLS'
  | 'METAL'
  | 'CERAMIC'
  | 'ACRYLIC'
  | 'ADMIN_REVIEW'
  | 'DISPATCHED'
  | 'CANCELLED';

export interface CreateOrderData {
  invoiceNumber: string;
  patient: CreatePatientData; // Changed from patientId to patient object
  doctorId?: string;
  clinicId: string;
  referredDoctorId?: string;
  referenceName?: string;
  partner: string;
  estimateDate: Date;
  orderProducts: CreateOrderProductData[];
  files?: CreateFileData[];
  status?: OrderStatusType;
}

export interface UpdateOrderData {
  invoiceNumber?: string;
  patientId?: string;
  patient?: CreatePatientData; // Support updating patient info directly
  doctorId?: string;
  clinicId?: string;
  referredDoctorId?: string;
  referenceName?: string;
  partner?: string;
  scanningMode?: string;
  schedule?: Date;
  enterRemark?: string;
  estimateDate?: Date;
  dateOfApproach?: Date;
  status?: OrderStatusType;
  orderProducts?: UpdateOrderProductData[]; // Support updating order products with IDs
  files?: UpdateFileData[]; // Support updating files with IDs
}

export class OrderService {
  async createOrder(data: CreateOrderData) {
    // Validate that orderProducts is not empty
    if (!data.orderProducts || !Array.isArray(data.orderProducts) || data.orderProducts.length === 0) {
      throw new Error('Order must have at least one product');
    }
    
    // Validate each product has all required fields
    for (const product of data.orderProducts) {
      if (!product.productId || !product.shadeType || 
          !product.finishingInstructions || 
          product.componentDetails === undefined || product.componentDetails === null ||
          !product.incaseOfAllAbutments || !product.occlusalStaining || !product.ponticDesign || 
          !product.repeatCorrections || !product.enterReason) {
        throw new Error('Each order product must have all required fields: productId, shadeType, finishingInstructions, componentDetails, incaseOfAllAbutments, occlusalStaining, ponticDesign, repeatCorrections, enterReason');
      }
    }
    
    // Generate formatted order ID (e.g., ODLUXDDMMYY01)
    const orderId = await this.generateOrderId();

    // Lookup doctor name for denormalized storage (if doctorId provided)
    let doctor = null;
    if (data.doctorId) {
      doctor = await prisma.user.findUnique({
        where: { id: data.doctorId },
        select: { name: true },
      });
    }
    
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
        doctorId: data.doctorId || null,
        doctorName: doctor?.name || null,
        referenceName: data.referenceName,
        clinicId: data.clinicId,
        referredDoctorId: data.referredDoctorId,
        partner: data.partner,
        estimateDate: data.estimateDate,
        status: data.status || 'NEW',
        orderProducts: {
          create: data.orderProducts.map(product => {
            const productData: any = {
              productId: product.productId,
              shadeType: product.shadeType,
              finishingInstructions: product.finishingInstructions,
              componentDetails: product.componentDetails,
              incaseOfAllAbutments: product.incaseOfAllAbutments,
              occlusalStaining: product.occlusalStaining,
              ponticDesign: product.ponticDesign,
              repeatCorrections: product.repeatCorrections,
              enterReason: product.enterReason,
            };
            
            // Only include optional fields if they're provided
            if (product.workType !== undefined) {
              productData.workType = product.workType;
            }
            if (product.workSpecification !== undefined) {
              productData.workSpecification = product.workSpecification;
            }
            if (product.unitNumbers !== undefined) {
              productData.unitNumbers = product.unitNumbers;
            }
            
            return productData;
          })
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
      } as any,
      include: {
        patient: true,
        doctor: true,
        clinic: {
          select: {
            id: true,
            clinicName: true,
            doctorName: true,
            organizationId: true,
            clientAddress: true,
            contactNumber: true,
            createdAt: true,
            updatedAt: true,
          } as any,
        },
        referredDoctor: true,
        orderProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                warranty: true,
                price: true,
                discount: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        files: true,
      },
    } as any) as any;

    // Create initial transition for order creation
    await createOrderTransition({
      orderId: order.id,
      fromState: undefined,
      toState: order.status || 'NEW',
      transitionedBy: undefined, // System-generated
      remarks: 'Order created',
    });

    // Convert Decimal fields to strings for JSON serialization
    return {
      ...order,
      orderProducts: order.orderProducts.map((op: any) => ({
        ...op,
        product: op.product ? {
          ...op.product,
          price: op.product.price.toString(),
          discount: op.product.discount.toString(),
        } : null,
      })),
    };
  }

  async getOrderById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: true,
        clinic: {
          select: {
            id: true,
            clinicName: true,
            doctorName: true,
            organizationId: true,
            clientAddress: true,
            contactNumber: true,
            createdAt: true,
            updatedAt: true,
          } as any,
        },
        referredDoctor: true,
        orderProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                warranty: true,
                price: true,
                discount: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        files: true,
      },
    });

    // Convert Decimal fields to strings for JSON serialization
    if (order) {
      const orderData = { ...order } as any;
      delete orderData.doctorName;
      return {
        ...orderData,
        orderProducts: order.orderProducts.map(op => ({
          ...op,
          product: op.product ? {
            ...op.product,
            price: op.product.price.toString(),
            discount: op.product.discount.toString(),
          } : null,
        })),
      };
    }

    return order;
  }

  async getOrderByInvoiceNumber(invoiceNumber: string) {
    const order = await prisma.order.findUnique({
      where: { invoiceNumber },
      include: {
        patient: true,
        doctor: true,
        clinic: {
          select: {
            id: true,
            clinicName: true,
            doctorName: true,
            organizationId: true,
            clientAddress: true,
            contactNumber: true,
            createdAt: true,
            updatedAt: true,
          } as any,
        },
        referredDoctor: true,
        orderProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                warranty: true,
                price: true,
                discount: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        files: true,
      },
    });

    // Convert Decimal fields to strings for JSON serialization
    if (order) {
      const orderData = { ...order } as any;
      delete orderData.doctorName;
      return {
        ...orderData,
        orderProducts: order.orderProducts.map(op => ({
          ...op,
          product: op.product ? {
            ...op.product,
            price: op.product.price.toString(),
            discount: op.product.discount.toString(),
          } : null,
        })),
      };
    }

    return order;
  }

  async getOrdersList(filters: {
    page?: number;
    limit?: number;
    search?: string;
    invoiceNumber?: string;
    orderId?: string;
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
    productCode?: string;
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
    
    // Order ID filter (contains, case-insensitive)
    if (filters.orderId) {
      whereClause.id = {
        contains: filters.orderId,
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
    // Clinic filters (merge doctorName and clinicName if both are provided)
    const trimmedDoctorName = filters.doctorName?.trim();
    const trimmedClinicName = filters.clinicName?.trim();
    
    if (trimmedDoctorName || trimmedClinicName) {
      whereClause.clinic = {
        ...whereClause.clinic,
        ...(trimmedDoctorName && {
          doctorName: {
            contains: trimmedDoctorName,
            mode: 'insensitive',
          },
        }),
        ...(trimmedClinicName && {
          clinicName: {
            contains: trimmedClinicName,
            mode: 'insensitive',
          },
        }),
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
    
    // Product code filter (filters orders that have products with matching code)
    if (filters.productCode) {
      whereClause.orderProducts = {
        some: {
          product: {
            code: {
              contains: filters.productCode,
              mode: 'insensitive',
            },
          },
        },
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
    
    // Search filter (searches across invoiceNumber, patient name, clinic doctor name, clinic name)
    if (filters.search) {
      const searchTerm = filters.search.trim();
      whereClause.OR = [
        { invoiceNumber: { contains: searchTerm, mode: 'insensitive' } },
        { patient: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { 
          clinic: { 
            OR: [
              { doctorName: { contains: searchTerm, mode: 'insensitive' } },
              { clinicName: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        },
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
            select: { clinicName: true, doctorName: true } as any,
          },
          orderProducts: {
            include: {
              product: {
                select: {
                  name: true,
                  code: true,
                  price: true,
                }
              }
            }
          },
        },
        orderBy,
      }) as any,
      prisma.order.count({ where: whereClause }),
    ]) as any;

    return {
      data: {
        orders: (orders as any[]).map((order: any) => ({
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          status: order.status,
          schedule: order.schedule ? order.schedule.getTime() : null,
          estimateDate: order.estimateDate.getTime(),
          dateOfApproach: order.dateOfApproach ? order.dateOfApproach.getTime() : null,
          createdOn: order.createdAt.getTime(),
          amount: order.orderProducts.reduce((sum: number, op: any) => sum + Number(op.product.price), 0),
          assignedGroup: null,
          orderProducts: order.orderProducts.map((op: any) => op.product.code || '').filter((code: string) => code).join(', '),
          patientName: order.patient.name,
          doctorName: (order.clinic as any).doctorName || null,
          clinicName: order.clinic.clinicName,
          referenceName: (order as any).referenceName || null,
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
    const orders = await prisma.order.findMany({
      include: {
        patient: true,
        doctor: true,
        clinic: {
          select: {
            id: true,
            clinicName: true,
            doctorName: true,
            organizationId: true,
            clientAddress: true,
            contactNumber: true,
            createdAt: true,
            updatedAt: true,
          } as any,
        },
        referredDoctor: true,
        orderProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                warranty: true,
                price: true,
                discount: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        files: true,
      },
    });

    // Convert Decimal fields to strings for JSON serialization
    return orders.map(order => ({
      ...order,
      orderProducts: order.orderProducts.map(op => ({
        ...op,
        product: op.product ? {
          ...op.product,
          price: op.product.price.toString(),
          discount: op.product.discount.toString(),
        } : null,
      })),
    }));
  }

  async updateOrder(id: string, data: UpdateOrderData, transitionedBy?: string, remarks?: string) {
    // Get current order status before update
    const currentOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true, patientId: true },
    });

    if (!currentOrder) {
      throw new Error('Order not found');
    }

    // Handle patient update if provided
    let patientId = data.patientId;
    if (data.patient) {
      // Find or create patient (same logic as createOrder)
      let patient = await prisma.patient.findFirst({
        where: {
          name: data.patient.name,
          age: data.patient.age,
          gender: data.patient.gender,
        },
      });

      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            name: data.patient.name,
            age: data.patient.age,
            gender: data.patient.gender,
            contactNumber: data.patient.contactNumber,
          },
        });
      } else if (data.patient.contactNumber !== undefined) {
        // Update contact number if provided
        patient = await prisma.patient.update({
          where: { id: patient.id },
          data: { contactNumber: data.patient.contactNumber },
        });
      }
      patientId = patient.id;
    }

    // Build update data excluding nested fields
    const updateData: any = {};
    if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
    if (patientId !== undefined) updateData.patientId = patientId;
    if (data.doctorId !== undefined) {
      updateData.doctorId = data.doctorId || null;
      if (data.doctorId) {
        const doctor = await prisma.user.findUnique({
          where: { id: data.doctorId },
          select: { name: true },
        });
        updateData.doctorName = doctor?.name || null;
      } else {
        updateData.doctorName = null;
      }
    }
    if (data.referenceName !== undefined) updateData.referenceName = data.referenceName;
    if (data.clinicId !== undefined) updateData.clinicId = data.clinicId;
    if (data.referredDoctorId !== undefined) updateData.referredDoctorId = data.referredDoctorId;
    if (data.partner !== undefined) updateData.partner = data.partner;
    if (data.scanningMode !== undefined) updateData.scanningMode = data.scanningMode;
    if (data.schedule !== undefined) updateData.schedule = data.schedule || null;
    if (data.enterRemark !== undefined) updateData.enterRemark = data.enterRemark;
    if (data.estimateDate !== undefined) updateData.estimateDate = data.estimateDate;
    if (data.dateOfApproach !== undefined) updateData.dateOfApproach = data.dateOfApproach || null;
    if (data.status !== undefined) updateData.status = data.status;

    // Handle orderProducts update if provided
    if (data.orderProducts !== undefined) {
      // Separate products to update vs create
      const productsToUpdate = data.orderProducts.filter(p => p.id);
      const productsToCreate = data.orderProducts.filter(p => !p.id);
      const productIdsToKeep = productsToUpdate.map(p => p.id!);

      // Get existing product IDs for this order
      const existingProducts = await prisma.orderProduct.findMany({
        where: { orderId: id },
        select: { id: true },
      });
      const existingProductIds = existingProducts.map(p => p.id);

      // Delete products that are not in the update list
      const productIdsToDelete = existingProductIds.filter(id => !productIdsToKeep.includes(id));
      if (productIdsToDelete.length > 0) {
        await prisma.orderProduct.deleteMany({
          where: { id: { in: productIdsToDelete } },
        });
      }

      // Update existing products
      const updateOperations = productsToUpdate.map(product => {
        const updateProductData: any = {
          productId: product.productId,
          shadeType: product.shadeType,
          finishingInstructions: product.finishingInstructions,
          componentDetails: product.componentDetails,
          incaseOfAllAbutments: product.incaseOfAllAbutments,
          occlusalStaining: product.occlusalStaining,
          ponticDesign: product.ponticDesign,
          repeatCorrections: product.repeatCorrections,
          enterReason: product.enterReason,
        };
        
        // Only include optional fields if they're provided
        if (product.workType !== undefined) {
          updateProductData.workType = product.workType;
        }
        if (product.workSpecification !== undefined) {
          updateProductData.workSpecification = product.workSpecification;
        }
        if (product.unitNumbers !== undefined) {
          updateProductData.unitNumbers = product.unitNumbers;
        }
        
        return prisma.orderProduct.update({
          where: { id: product.id! },
          data: updateProductData,
        });
      });
      await Promise.all(updateOperations);

      // Create new products
      if (productsToCreate.length > 0) {
        updateData.orderProducts = {
          create: productsToCreate.map(product => {
            const productData: any = {
              productId: product.productId,
              shadeType: product.shadeType,
              finishingInstructions: product.finishingInstructions,
              componentDetails: product.componentDetails,
              incaseOfAllAbutments: product.incaseOfAllAbutments,
              occlusalStaining: product.occlusalStaining,
              ponticDesign: product.ponticDesign,
              repeatCorrections: product.repeatCorrections,
              enterReason: product.enterReason,
            };
            
            // Only include optional fields if they're provided
            if (product.workType !== undefined) {
              productData.workType = product.workType;
            }
            if (product.workSpecification !== undefined) {
              productData.workSpecification = product.workSpecification;
            }
            if (product.unitNumbers !== undefined) {
              productData.unitNumbers = product.unitNumbers;
            }
            
            return productData;
          }),
        };
      }
    }

    // Handle files update if provided
    if (data.files !== undefined) {
      // Separate files to update vs create
      const filesToUpdate = data.files.filter(f => f.id);
      const filesToCreate = data.files.filter(f => !f.id);
      const fileIdsToKeep = filesToUpdate.map(f => f.id!);

      // Get existing file IDs for this order
      const existingFiles = await prisma.file.findMany({
        where: { orderId: id },
        select: { id: true },
      });
      const existingFileIds = existingFiles.map(f => f.id);

      // Delete files that are not in the update list
      const fileIdsToDelete = existingFileIds.filter(id => !fileIdsToKeep.includes(id));
      if (fileIdsToDelete.length > 0) {
        await prisma.file.deleteMany({
          where: { id: { in: fileIdsToDelete } },
        });
      }

      // Update existing files
      const updateOperations = filesToUpdate.map(file =>
        prisma.file.update({
          where: { id: file.id! },
          data: {
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            fileExtension: file.fileExtension,
            s3Key: file.s3Key,
            fileCategory: file.fileCategory,
            fileDescription: file.fileDescription,
            uploadedBy: file.uploadedBy,
          },
        })
      );
      await Promise.all(updateOperations);

      // Create new files
      if (filesToCreate.length > 0) {
        updateData.files = {
          create: filesToCreate.map(file => ({
            fileName: file.fileName,
            fileSize: file.fileSize,
            fileType: file.fileType,
            fileExtension: file.fileExtension,
            s3Key: file.s3Key,
            fileCategory: file.fileCategory,
            fileDescription: file.fileDescription,
            uploadedBy: file.uploadedBy,
          })),
        };
      }
    }

    // Update the order
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        patient: true,
        doctor: true,
        clinic: {
          select: {
            id: true,
            clinicName: true,
            doctorName: true,
            organizationId: true,
            clientAddress: true,
            contactNumber: true,
            createdAt: true,
            updatedAt: true,
          } as any,
        },
        referredDoctor: true,
        orderProducts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                warranty: true,
                price: true,
                discount: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        files: true,
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

    // Convert Decimal fields to strings for JSON serialization
    return {
      ...updatedOrder,
      orderProducts: updatedOrder.orderProducts.map(op => ({
        ...op,
        product: op.product ? {
          ...op.product,
          price: op.product.price.toString(),
          discount: op.product.discount.toString(),
        } : null,
      })),
    };
  }

  async deleteOrder(id: string) {
    return await prisma.order.delete({
      where: { id },
    });
  }

  private async generateOrderId() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const prefix = `ODLUX${day}${month}${year}`;

    const lastOrder = await prisma.order.findFirst({
      where: { id: { startsWith: prefix } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    const lastSequence = lastOrder?.id ? parseInt(lastOrder.id.slice(prefix.length), 10) : 0;
    const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;

    return `${prefix}${nextSequence.toString().padStart(2, '0')}`;
  }
}

export const orderService = new OrderService();
