import { prisma } from './prisma';

export interface CreateTransitionData {
  orderId: string;
  fromState?: string;
  toState: string;
  transitionedBy?: string;
  remarks?: string;
}

/**
 * Create an order transition record
 * This utility function is used by other services to automatically track status changes
 */
export async function createOrderTransition(data: CreateTransitionData) {
  // Get the next transition order number for this order
  const lastTransition = await prisma.orderTransition.findFirst({
    where: { orderId: data.orderId },
    orderBy: { transitionOrder: 'desc' },
    select: { transitionOrder: true },
  });

  const nextTransitionOrder = (lastTransition?.transitionOrder || 0) + 1;

  // Create the transition record
  return await prisma.orderTransition.create({
    data: {
      orderId: data.orderId,
      fromState: data.fromState,
      toState: data.toState,
      transitionedBy: data.transitionedBy,
      remarks: data.remarks,
      transitionOrder: nextTransitionOrder,
    },
  });
}

/**
 * Get all transitions for a specific order
 */
export async function getOrderTransitions(orderId: string) {
  return await prisma.orderTransition.findMany({
    where: { orderId },
    orderBy: { transitionOrder: 'asc' },
  });
}

/**
 * Get order transition timeline with order creation as first event
 */
export async function getOrderTimeline(orderId: string) {
  const [transitions, order] = await Promise.all([
    prisma.orderTransition.findMany({
      where: { orderId },
      orderBy: { transitionOrder: 'asc' },
    }),
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  if (!order) {
    throw new Error('Order not found');
  }

  // Create timeline with order creation as first event
  const timeline = [
    {
      id: 'order-created',
      type: 'order_created',
      fromState: null,
      toState: 'ORDER_INITIATED',
      remarks: 'Order created',
      transitionOrder: 0,
      createdAt: order.createdAt.getTime(),
    },
    ...transitions.map(transition => ({
      id: transition.id,
      type: 'status_transition',
      fromState: transition.fromState,
      toState: transition.toState,
      remarks: transition.remarks,
      transitionOrder: transition.transitionOrder,
      createdAt: transition.createdAt.getTime(),
    })),
  ];

  return {
    orderId,
    invoiceNumber: order.invoiceNumber,
    currentStatus: order.status,
    timeline,
  };
}
