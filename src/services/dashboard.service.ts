import { prisma } from '../utils/prisma';
import {
  endOfToday,
  formatYmd,
  startOfToday,
  sumOrdersSales,
} from '../utils/orderSales.util';
import { ACTIVE_ENTITY_FILTER } from '../utils/softDelete.util';

const orderSalesInclude = {
  orderProducts: {
    include: { product: true },
  },
} as const;

export interface DashboardMetrics {
  users: {
    total: number;
    byRole: {
      SUPER_ADMIN: number;
      DOCTOR: number;
      EMPLOYEE: number;
    };
    byEmployeeType: Array<{
      type: string;
      count: number;
    }>;
    byTechnicianGroup: Array<{
      group: string;
      count: number;
    }>;
    recentRegistrations: number; // Last 30 days
  };
  orders: {
    total: number;
    totalRevenue: number;
    averageOrderValue: number;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byPartner: Array<{
      partner: string;
      count: number;
      revenue: number;
    }>;
    byScanningMode: Array<{
      mode: string;
      count: number;
    }>;
    recentOrders: number; // Last 30 days
    recentRevenue: number; // Last 30 days
    repeatCount: number;
    correctionsCount: number;
  };
  sales: {
    totalSales: number;
    todaySales: number;
    totalOrders: number;
    todayOrders: number;
  };
  clinics: {
    total: number;
    recentClinics: number; // Last 30 days
  };
  patients: {
    total: number;
    recentPatients: number; // Last 30 days
  };
}

export class DashboardService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const todayStart = startOfToday();
    const todayEnd = endOfToday();

    // User metrics
    const [
      totalUsers,
      usersByRole,
      usersByEmployeeType,
      usersByTechnicianGroup,
      recentUsers,
      totalOrders,
      ordersWithRevenue,
      todayOrdersWithProducts,
      todayOrderCount,
      ordersByStatus,
      ordersByPartner,
      ordersByScanningMode,
      recentOrders,
      repeatOrdersCount,
      correctionsOrdersCount,
      totalClinics,
      recentClinics,
      totalPatients,
      recentPatients
    ] = await Promise.all([
      // User counts
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }).catch(() => []), // Handle empty results
      prisma.user.groupBy({
        by: ['employeeTypeId'],
        _count: { employeeTypeId: true },
        where: { employeeTypeId: { not: null } }
      }).catch(() => []), // Handle empty results
      prisma.user.groupBy({
        by: ['technicianGroupId'],
        _count: { technicianGroupId: true },
        where: { technicianGroupId: { not: null } }
      }).catch(() => []), // Handle empty results
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),

      // Order counts
      prisma.order.count({ where: ACTIVE_ENTITY_FILTER }),
      prisma.order.findMany({
        where: ACTIVE_ENTITY_FILTER,
        include: orderSalesInclude,
      }).catch(() => []),
      prisma.order.findMany({
        where: {
          ...ACTIVE_ENTITY_FILTER,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        include: orderSalesInclude,
      }).catch(() => []),
      prisma.order.count({
        where: {
          ...ACTIVE_ENTITY_FILTER,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: ACTIVE_ENTITY_FILTER,
        _count: { status: true }
      }).catch(() => []), // Handle empty results
      prisma.order.groupBy({
        by: ['partner'],
        where: ACTIVE_ENTITY_FILTER,
        _count: { partner: true }
      }).catch(() => []), // Handle empty results
      prisma.order.groupBy({
        by: ['scanningMode'],
        where: ACTIVE_ENTITY_FILTER,
        _count: { scanningMode: true }
      }).catch(() => []), // Handle empty results
      prisma.order.count({
        where: { ...ACTIVE_ENTITY_FILTER, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.order.count({
        where: {
          ...ACTIVE_ENTITY_FILTER,
          orderProducts: { some: { repeatCorrections: 'Repeat' } },
        },
      }),
      prisma.order.count({
        where: {
          ...ACTIVE_ENTITY_FILTER,
          orderProducts: { some: { repeatCorrections: 'Corrections' } },
        },
      }),

      // Clinic counts
      prisma.clinic.count(),
      prisma.clinic.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),

      // Patient counts
      prisma.patient.count(),
      prisma.patient.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    // Calculate revenue metrics (legacy — product price only, no units/discount)
    const totalRevenue = Array.isArray(ordersWithRevenue) ? ordersWithRevenue.reduce((sum, order) => {
      return sum + (order.orderProducts || []).reduce((orderSum, op) => {
        return orderSum + Number(op.product?.price || 0);
      }, 0);
    }, 0) : 0;

    const totalSales = sumOrdersSales(Array.isArray(ordersWithRevenue) ? ordersWithRevenue : []);
    const todaySales = sumOrdersSales(
      Array.isArray(todayOrdersWithProducts) ? todayOrdersWithProducts : [],
    );

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate recent revenue
    const recentOrdersWithRevenue = Array.isArray(ordersWithRevenue) ? ordersWithRevenue.filter(order => 
      order.createdAt >= thirtyDaysAgo
    ) : [];
    const recentRevenue = recentOrdersWithRevenue.reduce((sum, order) => {
      return sum + (order.orderProducts || []).reduce((orderSum, op) => {
        return orderSum + Number(op.product?.price || 0);
      }, 0);
    }, 0);

    // Get employee type names
    const employeeTypeIds = Array.isArray(usersByEmployeeType) ? usersByEmployeeType.map(u => u.employeeTypeId).filter(Boolean) : [];
    const employeeTypes = employeeTypeIds.length > 0 ? await prisma.employeeType.findMany({
      where: { id: { in: employeeTypeIds as string[] } }
    }) : [];

    // Get technician group names
    const technicianGroupIds = Array.isArray(usersByTechnicianGroup) ? usersByTechnicianGroup.map(u => u.technicianGroupId).filter(Boolean) : [];
    const technicianGroups = technicianGroupIds.length > 0 ? await prisma.technicianGroup.findMany({
      where: { id: { in: technicianGroupIds as string[] } }
    }) : [];

    // Calculate revenue by partner
    const revenueByPartner = Array.isArray(ordersByPartner) ? ordersByPartner.map(partner => {
      const partnerOrders = Array.isArray(ordersWithRevenue) ? ordersWithRevenue.filter(order => order.partner === partner.partner) : [];
      const partnerRevenue = partnerOrders.reduce((sum, order) => {
        return sum + (order.orderProducts || []).reduce((orderSum, op) => {
          return orderSum + Number(op.product?.price || 0);
        }, 0);
      }, 0);
      
      return {
        partner: partner.partner,
        count: partner._count.partner,
        revenue: partnerRevenue
      };
    }) : [];

    // Use actual order status from database
    const ordersByStatusData = Array.isArray(ordersByStatus) ? ordersByStatus.map(o => ({
      status: o.status,
      count: o._count.status
    })) : [];

    return {
      users: {
        total: totalUsers,
        byRole: {
          SUPER_ADMIN: Array.isArray(usersByRole) ? (usersByRole.find(u => u.role === 'SUPER_ADMIN')?._count.role || 0) : 0,
          DOCTOR: Array.isArray(usersByRole) ? (usersByRole.find(u => u.role === 'DOCTOR')?._count.role || 0) : 0,
          EMPLOYEE: Array.isArray(usersByRole) ? (usersByRole.find(u => u.role === 'EMPLOYEE')?._count.role || 0) : 0,
        },
        byEmployeeType: Array.isArray(usersByEmployeeType) ? usersByEmployeeType.map(u => ({
          type: employeeTypes.find(et => et.id === u.employeeTypeId)?.name || 'Unknown',
          count: u._count.employeeTypeId
        })) : [],
        byTechnicianGroup: Array.isArray(usersByTechnicianGroup) ? usersByTechnicianGroup.map(u => ({
          group: technicianGroups.find(tg => tg.id === u.technicianGroupId)?.name || 'Unknown',
          count: u._count.technicianGroupId
        })) : [],
        recentRegistrations: recentUsers
      },
      orders: {
        total: totalOrders,
        totalRevenue,
        averageOrderValue,
        byStatus: ordersByStatusData,
        byPartner: revenueByPartner,
        byScanningMode: Array.isArray(ordersByScanningMode) ? ordersByScanningMode.map(o => ({
          mode: o.scanningMode ?? 'Unknown',
          count: o._count.scanningMode
        })) : [],
        recentOrders,
        recentRevenue,
        repeatCount: repeatOrdersCount,
        correctionsCount: correctionsOrdersCount,
      },
      sales: {
        totalSales,
        todaySales,
        totalOrders,
        todayOrders: todayOrderCount,
      },
      clinics: {
        total: totalClinics,
        recentClinics
      },
      patients: {
        total: totalPatients,
        recentPatients
      }
    };
  }

  /**
   * Sales + order count for a createdAt date range (inclusive calendar days, local server time).
   * Omit both dates → all-time totals.
   */
  async getSalesSummary(input: { from?: string; to?: string } = {}): Promise<{
    sales: number;
    orderCount: number;
    from: string | null;
    to: string | null;
  }> {
    const where: Record<string, unknown> = {
      ...ACTIVE_ENTITY_FILTER,
    };

    let from: string | null = null;
    let to: string | null = null;

    if (input.from || input.to) {
      const fromDate = parseYmdStart(input.from || input.to!);
      const toDate = parseYmdEnd(input.to || input.from!);
      if (fromDate > toDate) {
        throw new Error('from date must be on or before to date');
      }
      where.createdAt = { gte: fromDate, lte: toDate };
      from = formatYmd(fromDate);
      to = formatYmd(toDate);
    }

    const [orderCount, orders] = await Promise.all([
      prisma.order.count({ where: where as any }),
      prisma.order.findMany({
        where: where as any,
        include: orderSalesInclude,
      }),
    ]);

    return {
      sales: sumOrdersSales(orders),
      orderCount,
      from,
      to,
    };
  }
}

function parseYmdStart(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) throw new Error('Invalid from/to date. Use YYYY-MM-DD.');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid from/to date. Use YYYY-MM-DD.');
  return d;
}

function parseYmdEnd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) throw new Error('Invalid from/to date. Use YYYY-MM-DD.');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid from/to date. Use YYYY-MM-DD.');
  return d;
}
