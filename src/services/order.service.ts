import { Prisma } from '@prisma/client';
import { createOrderTransition } from '../utils/orderTransitions';
import { prisma } from '../utils/prisma';
import { createUserStampFields, updateUserStampFields, userStampInclude } from '../utils/userStamps';
import { isCancelledOrderStatus } from '../utils/orderStatus';
import { writeAuditLog } from './auditLog.service';
import { orderSnapshot } from '../utils/auditSnapshot.util';
import { ACTIVE_ENTITY_FILTER } from '../utils/softDelete.util';
import {
  computeOrderProductLineBilling,
  parseUnitDiscountsMap,
  roundOrderMoney,
} from '../utils/orderSales.util';

function normalizeUnitDiscountsForDb(
  input: unknown,
): Prisma.InputJsonValue | undefined {
  const map = parseUnitDiscountsMap(input);
  return Object.keys(map).length > 0 ? map : undefined;
}

/** Persisted line price/discount; falls back to catalog when omitted (legacy clients). */
function resolveLinePricing(
  input: {
    unitPrice?: number | null;
    discountPercent?: number | null;
  },
  catalog: { price: Prisma.Decimal; discount: Prisma.Decimal }
): {
  unitPrice: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
} {
  const u =
    input.unitPrice !== undefined && input.unitPrice !== null && Number.isFinite(Number(input.unitPrice))
      ? Number(input.unitPrice)
      : numFromDecimal(catalog.price);
  const d =
    input.discountPercent !== undefined &&
    input.discountPercent !== null &&
    Number.isFinite(Number(input.discountPercent))
      ? Number(input.discountPercent)
      : numFromDecimal(catalog.discount);
  return {
    unitPrice: new Prisma.Decimal(u),
    discountPercent: new Prisma.Decimal(d),
  };
}

function numFromDecimal(d: Prisma.Decimal | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
}

type OrderTransitionRow = {
  id: string;
  orderId: string;
  fromState: string | null;
  toState: string;
  transitionedBy: string | null;
  remarks: string | null;
  transitionOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

async function formatTransitionsForApi(transitions: OrderTransitionRow[]) {
  const userIds = [...new Set(transitions.map((t) => t.transitionedBy).filter((x): x is string => !!x))];
  let userMap = new Map<string, { id: string; name: string | null; email: string }>();
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    userMap = new Map(users.map((u) => [u.id, u]));
  }
  return transitions.map((t) => ({
    id: t.id,
    orderId: t.orderId,
    fromState: t.fromState,
    toState: t.toState,
    transitionedBy: t.transitionedBy,
    transitionedByUser: t.transitionedBy ? userMap.get(t.transitionedBy) ?? null : null,
    remarks: t.remarks,
    transitionOrder: t.transitionOrder,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));
}

function serializeOrderProduct(op: any) {
  const linePrice = op.unitPrice != null ? op.unitPrice : op.product?.price;
  const lineDiscount =
    op.discountPercent != null ? op.discountPercent : op.product?.discount;
  const billing = computeOrderProductLineBilling({
    unitNumbers: op.unitNumbers,
    unitPrice: op.unitPrice,
    discountPercent: op.discountPercent,
    unitDiscounts: op.unitDiscounts,
    product: op.product
      ? { price: op.product.price, discount: op.product.discount }
      : null,
  });

  const unitDiscounts =
    op.unitDiscounts != null ? parseUnitDiscountsMap(op.unitDiscounts) : null;

  return {
    ...op,
    // Backward-compatible keys used by some legacy UIs.
    price: linePrice != null ? linePrice.toString() : null,
    discount: lineDiscount != null ? lineDiscount.toString() : null,
    unitPrice: op.unitPrice != null ? op.unitPrice.toString() : null,
    discountPercent: op.discountPercent != null ? op.discountPercent.toString() : null,
    unitDiscounts: unitDiscounts && Object.keys(unitDiscounts).length > 0 ? unitDiscounts : null,
    unitCount: billing.units,
    ratePerUnit: linePrice != null ? linePrice.toString() : null,
    productDiscountAmount: billing.productDiscountAmount.toString(),
    unitDiscountAmount: billing.unitDiscountAmount.toString(),
    discountAmount: billing.totalDiscountAmount.toString(),
    lineTotal: billing.lineTotal.toString(),
    product: op.product
      ? {
          ...op.product,
          price: op.product.price.toString(),
          discount: op.product.discount.toString(),
        }
      : null,
  };
}

function computeOrderTotalBill(orderProducts: Array<{ lineTotal?: string }>): number {
  return roundOrderMoney(
    orderProducts.reduce((sum, op) => sum + Number(op.lineTotal ?? 0), 0),
  );
}

function serializeOrderProductListItem(op: any) {
  const serialized = serializeOrderProduct(op);
  return {
    id: serialized.id,
    productCode: serialized.product?.code ?? null,
    productName: serialized.product?.name ?? null,
    unitNumbers: serialized.unitNumbers ?? null,
    unitCount: serialized.unitCount,
    ratePerUnit: serialized.ratePerUnit,
    discountPercent: serialized.discountPercent,
    unitDiscounts: serialized.unitDiscounts,
    discountAmount: serialized.discountAmount,
    lineTotal: serialized.lineTotal,
  };
}

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
  /** Unit price charged on this line (optional; defaults from Product). */
  unitPrice?: number | null;
  /** Discount % on this line (optional; defaults from Product). */
  discountPercent?: number | null;
  /** Per-tooth discount % keyed by tooth number (e.g. {"24": 10, "32": 5}). */
  unitDiscounts?: Record<string, number> | null;
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
  age?: number;
  gender?: string;
  contactNumber?: string;
}

function normalizePatientData(patient: CreatePatientData) {
  const parsedAge =
    typeof patient.age === 'number'
      ? patient.age
      : parseInt(String(patient.age ?? ''), 10);
  return {
    name: patient.name,
    age: Number.isFinite(parsedAge) ? parsedAge : 0,
    gender: (patient.gender ?? '').trim(),
    contactNumber: patient.contactNumber,
  };
}

export type OrderStatusType =
  | 'NEW'
  | 'MODEL'
  | 'THREE_D_MODEL'
  | 'QC'
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
  /** When provided (e.g. sheet import), used as Order.id instead of auto-generated ODLUX… id */
  id?: string;
  invoiceNumber?: string;
  patient: CreatePatientData; // Changed from patientId to patient object
  doctorId?: string;
  clinicId: string;
  referredDoctorId?: string;
  referenceName?: string;
  partner: string;
  estimateDate: Date;
  scanningMode?: string;
  schedule?: Date;
  enterRemark?: string;
  dateOfApproach?: Date;
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
  private static normalizeRepeatCorrectionsFilter(value: string): string {
    const s = value.trim().toLowerCase();
    if (s === 'repeat') return 'Repeat';
    if (s === 'correction' || s === 'corrections') return 'Corrections';
    if (s === 'new') return 'New';
    return value.trim();
  }

  private async loadOrderAuditSnapshot(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderProducts: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!order) return null;
    return orderSnapshot(order as unknown as Record<string, unknown>);
  }

  async createOrder(data: CreateOrderData, actorUserId?: string) {
    const isCancelled = isCancelledOrderStatus(data.status);
    const products = data.orderProducts ?? [];

    if (!isCancelled) {
      if (!Array.isArray(products) || products.length === 0) {
        throw new Error('Order must have at least one product');
      }

      for (const product of products) {
        if (!product.productId || !product.shadeType ||
            !product.finishingInstructions ||
            product.componentDetails === undefined || product.componentDetails === null ||
            !product.incaseOfAllAbutments || !product.occlusalStaining || !product.ponticDesign ||
            !product.repeatCorrections || !product.enterReason) {
          throw new Error('Each order product must have all required fields: productId, shadeType, finishingInstructions, componentDetails, incaseOfAllAbutments, occlusalStaining, ponticDesign, repeatCorrections, enterReason');
        }
      }
    }
    
    // Use sheet-provided order id when present; otherwise generate ODLUX… id
    let orderId = data.id?.trim();
    if (orderId) {
      const existing = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (existing) {
        throw new Error(`Order ID '${orderId}' already exists`);
      }
    } else {
      orderId = await this.generateOrderId();
    }

    // Lookup doctor name for denormalized storage (if doctorId provided)
    let doctor = null;
    if (data.doctorId) {
      doctor = await prisma.user.findUnique({
        where: { id: data.doctorId },
        select: { name: true },
      });
    }
    
    // Create or find patient
    const patientData = normalizePatientData(data.patient);
    let patient = await prisma.patient.findFirst({
      where: {
        name: patientData.name,
        age: patientData.age,
        gender: patientData.gender,
      },
    });

    // If patient doesn't exist, create a new one
    if (!patient) {
      patient = await prisma.patient.create({
        data: { ...patientData, ...createUserStampFields(actorUserId) },
      });
    }

    const productIds = [...new Set(data.orderProducts.map((p) => p.productId))];
    const catalogRows = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    if (catalogRows.length !== productIds.length) {
      throw new Error('One or more products were not found');
    }
    const catalogById = new Map(catalogRows.map((p) => [p.id, p]));

    const order = await prisma.order.create({
      data: {
        id: orderId,
        invoiceNumber: data.invoiceNumber?.trim() || orderId,
        patientId: patient.id,
        doctorId: data.doctorId || null,
        doctorName: doctor?.name || null,
        referenceName: data.referenceName,
        clinicId: data.clinicId,
        referredDoctorId: data.referredDoctorId,
        partner: data.partner,
        estimateDate: data.estimateDate,
        scanningMode: data.scanningMode ?? null,
        schedule: data.schedule ?? null,
        enterRemark: data.enterRemark ?? null,
        dateOfApproach: data.dateOfApproach ?? null,
        status: data.status || 'NEW',
        ...createUserStampFields(actorUserId),
        orderProducts: products.length
          ? {
          create: products.map((product) => {
            const prod = catalogById.get(product.productId)!;
            const { unitPrice, discountPercent } = resolveLinePricing(
              {
                unitPrice: product.unitPrice,
                discountPercent: product.discountPercent,
              },
              { price: prod.price, discount: prod.discount }
            );
            const unitDiscounts = normalizeUnitDiscountsForDb(product.unitDiscounts);
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
              unitPrice,
              discountPercent,
            };
            if (unitDiscounts !== undefined) {
              productData.unitDiscounts = unitDiscounts;
            }

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
        }
          : undefined,
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
        ...userStampInclude,
      },
    } as any) as any;

    // Create initial transition for order creation
    await createOrderTransition({
      orderId: order.id,
      fromState: undefined,
      toState: order.status || 'NEW',
      transitionedBy: actorUserId,
      remarks: 'Order created',
    });

    await writeAuditLog({
      actorUserId,
      action: 'CREATE',
      entityType: 'Order',
      entityId: order.id,
      entityLabel: order.invoiceNumber,
      after: orderSnapshot(order as unknown as Record<string, unknown>),
    });

    return {
      ...order,
      orderProducts: order.orderProducts.map((op: any) => serializeOrderProduct(op)),
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
        transitions: {
          orderBy: { transitionOrder: 'asc' },
        },
        ...userStampInclude,
      },
    });

    // Convert Decimal fields to strings for JSON serialization
    if (order && order.isActive) {
      const orderData = { ...order } as any;
      delete orderData.doctorName;
      const transitions = await formatTransitionsForApi(order.transitions ?? []);
      const orderProducts = order.orderProducts.map((op: any) => serializeOrderProduct(op));
      const totalBill = computeOrderTotalBill(orderProducts);
      return {
        ...orderData,
        transitions,
        orderProducts,
        totalBill: totalBill.toString(),
      };
    }

    return null;
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
        transitions: {
          orderBy: { transitionOrder: 'asc' },
        },
      },
    });

    // Convert Decimal fields to strings for JSON serialization
    if (order && order.isActive) {
      const orderData = { ...order } as any;
      delete orderData.doctorName;
      const transitions = await formatTransitionsForApi(order.transitions ?? []);
      const orderProducts = order.orderProducts.map((op: any) => serializeOrderProduct(op));
      const totalBill = computeOrderTotalBill(orderProducts);
      return {
        ...orderData,
        transitions,
        orderProducts,
        totalBill: totalBill.toString(),
      };
    }

    return null;
  }

  /**
   * Append a user-visible note on the order timeline without changing status.
   * Persisted as an OrderTransition with fromState === toState === current status.
   */
  async addOrderActivityNote(orderId: string, userId: string | undefined, note: string) {
    const trimmed = (note || '').trim();
    if (!trimmed) {
      throw new Error('Note cannot be empty');
    }
    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!existing) {
      throw new Error('Order not found');
    }
    const status = existing.status || 'NEW';
    await createOrderTransition({
      orderId,
      fromState: status,
      toState: status,
      transitionedBy: userId,
      remarks: trimmed,
    });
    await writeAuditLog({
      actorUserId: userId,
      action: 'UPDATE',
      entityType: 'Order',
      entityId: orderId,
      metadata: { activityNote: trimmed },
    });
    return this.getOrderById(orderId);
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
    repeatCorrections?: string;
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
    const whereClause: any = { ...ACTIVE_ENTITY_FILTER };
    
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
    
    // Product line filters (orders that have at least one matching order product)
    if (filters.productCode || filters.repeatCorrections) {
      const orderProductSome: Record<string, unknown> = {};
      if (filters.productCode) {
        orderProductSome.product = {
          code: {
            contains: filters.productCode,
            mode: 'insensitive',
          },
        };
      }
      if (filters.repeatCorrections) {
        orderProductSome.repeatCorrections = {
          equals: OrderService.normalizeRepeatCorrectionsFilter(filters.repeatCorrections),
          mode: 'insensitive',
        };
      }
      whereClause.orderProducts = { some: orderProductSome };
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
                  discount: true,
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
        orders: (orders as any[]).map((order: any) => {
          const orderProductLines = order.orderProducts.map((op: any) =>
            serializeOrderProductListItem(op),
          );
          const totalBill = computeOrderTotalBill(
            order.orderProducts.map((op: any) => serializeOrderProduct(op)),
          );
          return {
            id: order.id,
            invoiceNumber: order.invoiceNumber,
            status: order.status,
            schedule: order.schedule ? order.schedule.getTime() : null,
            estimateDate: order.estimateDate.getTime(),
            dateOfApproach: order.dateOfApproach ? order.dateOfApproach.getTime() : null,
            createdOn: order.createdAt.getTime(),
            amount: totalBill,
            totalBill,
            assignedGroup: null,
            productDetails: orderProductLines
              .map((op: { productCode?: string | null }) => op.productCode || '')
              .filter((code: string) => code)
              .join(', '),
            orderProducts: orderProductLines,
            patientName: order.patient.name,
            doctorName: (order.clinic as any).doctorName || null,
            clinicName: order.clinic.clinicName,
            referenceName: (order as any).referenceName || null,
          };
        }),
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
      where: ACTIVE_ENTITY_FILTER,
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
    return orders.map((order) => ({
      ...order,
      orderProducts: order.orderProducts.map((op: any) => serializeOrderProduct(op)),
    }));
  }

  async updateOrder(id: string, data: UpdateOrderData, transitionedBy?: string, remarks?: string) {
    const beforeSnapshot = await this.loadOrderAuditSnapshot(id);

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
      const patientData = normalizePatientData(data.patient);
      let patient = await prisma.patient.findFirst({
        where: {
          name: patientData.name,
          age: patientData.age,
          gender: patientData.gender,
        },
      });

      if (!patient) {
        patient = await prisma.patient.create({
          data: { ...patientData, ...createUserStampFields(transitionedBy) },
        });
      } else if (data.patient.contactNumber !== undefined) {
        // Update contact number if provided
        patient = await prisma.patient.update({
          where: { id: patient.id },
          data: { contactNumber: data.patient.contactNumber, ...updateUserStampFields(transitionedBy) },
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
    Object.assign(updateData, updateUserStampFields(transitionedBy));

    // Handle orderProducts update if provided
    if (data.orderProducts !== undefined) {
      const effectiveStatus = data.status ?? currentOrder.status;
      const isCancelled = isCancelledOrderStatus(effectiveStatus);

      if (data.orderProducts.length === 0) {
        if (!isCancelled) {
          throw new Error('Order must have at least one product');
        }
        await prisma.orderProduct.deleteMany({ where: { orderId: id } });
      } else {
      const productIds = [...new Set(data.orderProducts.map((p) => p.productId))];
      const catalogRows = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
      if (catalogRows.length !== productIds.length) {
        throw new Error('One or more products were not found');
      }
      const catalogById = new Map(catalogRows.map((p) => [p.id, p]));

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
      const updateOperations = productsToUpdate.map((product) => {
        const prod = catalogById.get(product.productId)!;
        const { unitPrice, discountPercent } = resolveLinePricing(
          {
            unitPrice: product.unitPrice,
            discountPercent: product.discountPercent,
          },
          { price: prod.price, discount: prod.discount }
        );
        const unitDiscounts = normalizeUnitDiscountsForDb(product.unitDiscounts);
        const updateProductData: Prisma.OrderProductUpdateInput = {
          product: { connect: { id: product.productId } },
          shadeType: product.shadeType,
          finishingInstructions: product.finishingInstructions,
          componentDetails: product.componentDetails,
          incaseOfAllAbutments: product.incaseOfAllAbutments,
          occlusalStaining: product.occlusalStaining,
          ponticDesign: product.ponticDesign,
          repeatCorrections: product.repeatCorrections,
          enterReason: product.enterReason,
          unitPrice,
          discountPercent,
        };
        if (unitDiscounts !== undefined) {
          updateProductData.unitDiscounts = unitDiscounts;
        } else {
          updateProductData.unitDiscounts = Prisma.JsonNull;
        }

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
          create: productsToCreate.map((product) => {
            const prod = catalogById.get(product.productId)!;
            const { unitPrice, discountPercent } = resolveLinePricing(
              {
                unitPrice: product.unitPrice,
                discountPercent: product.discountPercent,
              },
              { price: prod.price, discount: prod.discount }
            );
            const unitDiscounts = normalizeUnitDiscountsForDb(product.unitDiscounts);
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
              unitPrice,
              discountPercent,
            };
            if (unitDiscounts !== undefined) {
              productData.unitDiscounts = unitDiscounts;
            }

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
        ...userStampInclude,
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

    const afterSnapshot = orderSnapshot(updatedOrder as unknown as Record<string, unknown>);
    const dataKeys = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
    const onlyStatusChange = dataKeys.length === 1 && dataKeys[0] === 'status';

    await writeAuditLog({
      actorUserId: transitionedBy,
      action: onlyStatusChange ? 'STATUS_CHANGE' : 'UPDATE',
      entityType: 'Order',
      entityId: id,
      entityLabel: updatedOrder.invoiceNumber,
      before: beforeSnapshot ?? undefined,
      after: afterSnapshot,
      metadata: remarks ? { remarks } : undefined,
    });

    return {
      ...updatedOrder,
      orderProducts: updatedOrder.orderProducts.map((op: any) => serializeOrderProduct(op)),
    };
  }

  async deleteOrder(id: string, actorUserId?: string) {
    const beforeSnapshot = await this.loadOrderAuditSnapshot(id);
    const existing = await prisma.order.findUnique({
      where: { id },
      select: { invoiceNumber: true, isActive: true },
    });
    if (!existing) {
      throw new Error('Order not found');
    }
    const deleted = await prisma.order.update({
      where: { id },
      data: { isActive: false, ...updateUserStampFields(actorUserId) },
    });
    await writeAuditLog({
      actorUserId,
      action: 'DELETE',
      entityType: 'Order',
      entityId: id,
      entityLabel: existing.invoiceNumber ?? id,
      before: beforeSnapshot ?? undefined,
      metadata: { softDelete: true },
    });
    return deleted;
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
