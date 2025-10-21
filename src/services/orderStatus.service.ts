import { prisma } from '../utils/prisma';
import { OrderStatus, OrderTransitionStatus } from '../types/orderStatus';

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  updatedBy?: string;
  remarks?: string;
}

export interface OrderTransitionUpdate {
  orderId: string;
  fromTransition?: OrderTransitionStatus;
  toTransition: OrderTransitionStatus;
  transitionedBy?: string;
  remarks?: string;
}

/**
 * Update order status (application level) - completely independent from transitions
 */
export async function updateOrderStatus(data: OrderStatusUpdate) {
  const { orderId, status, updatedBy, remarks } = data;

  // Update the application status field in the database
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { 
      applicationStatus: status // Update the application status field
    },
    include: {
      transitions: {
        orderBy: { transitionOrder: 'asc' }
      },
      patient: true,
      doctor: true,
      clinic: true,
      referredDoctor: true,
      orderProducts: {
        include: {
          product: true
        }
      }
    }
  });

  return {
    order: updatedOrder,
    applicationStatus: status,
    databaseStatus: updatedOrder.status // Keep existing database status unchanged
  };
}

/**
 * Create a transition without changing the application status
 */
export async function createOrderTransition(data: OrderTransitionUpdate) {
  const { orderId, fromTransition, toTransition, transitionedBy, remarks } = data;

  // Get current order to find the latest transition
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      transitions: {
        orderBy: { transitionOrder: 'desc' },
        take: 1
      }
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  const latestTransition = order.transitions[0];
  const actualFromTransition = fromTransition || latestTransition?.toState;

  // Create the transition record
  const nextTransitionOrder = (latestTransition?.transitionOrder || 0) + 1;

  const transition = await prisma.orderTransition.create({
    data: {
      orderId,
      fromState: actualFromTransition,
      toState: toTransition,
      transitionedBy,
      remarks: remarks || `Transitioned to ${toTransition}`,
      transitionOrder: nextTransitionOrder,
    },
  });

  // Update the order's database status to match the transition
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: toTransition },
    include: {
      transitions: {
        orderBy: { transitionOrder: 'asc' }
      },
      patient: true,
      doctor: true,
      clinic: true,
      referredDoctor: true,
      orderProducts: {
        include: {
          product: true
        }
      }
    }
  });

  return {
    order: updatedOrder,
    transition,
    databaseStatus: toTransition
    // Note: No applicationStatus here since transitions don't affect it
  };
}

/**
 * Get order with both application status and transition history
 */
export async function getOrderWithStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      transitions: {
        orderBy: { transitionOrder: 'asc' }
      },
      patient: true,
      doctor: true,
      clinic: true,
      referredDoctor: true,
      orderProducts: {
        include: {
          product: true
        }
      }
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  return {
    ...order,
    applicationStatus: order.applicationStatus, // Now comes from database field
    databaseStatus: order.status
  };
}

/**
 * Get orders filtered by application status
 */
export async function getOrdersByStatus(status: OrderStatus) {
  const orders = await prisma.order.findMany({
    where: {
      applicationStatus: status // Filter by application status field
    },
    include: {
      transitions: {
        orderBy: { transitionOrder: 'asc' }
      },
      patient: true,
      doctor: true,
      clinic: true,
      referredDoctor: true,
      orderProducts: {
        include: {
          product: true
        }
      }
    }
  });

  return orders.map(order => ({
    ...order,
    applicationStatus: order.applicationStatus,
    databaseStatus: order.status
  }));
}
