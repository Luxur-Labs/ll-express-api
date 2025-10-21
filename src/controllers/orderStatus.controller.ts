import { Request, Response } from 'express';
import { updateOrderStatus, createOrderTransition, getOrderWithStatus, getOrdersByStatus } from '../services/orderStatus.service';
import { OrderStatus, OrderTransitionStatus } from '../types/orderStatus';

/**
 * Update order status (application level)
 */
export async function updateOrderStatusController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const { status, remarks } = req.body;
    const userId = (req as any).user?.id; // From auth middleware

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    if (!status || !Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ 
        message: 'Valid status is required',
        validStatuses: Object.values(OrderStatus)
      });
    }

    const result = await updateOrderStatus({
      orderId,
      status,
      updatedBy: userId,
      remarks
    });

    return res.json({
      message: 'Order status updated successfully',
      data: {
        orderId: result.order.id,
        applicationStatus: result.applicationStatus,
        databaseStatus: result.databaseStatus,
        // Note: No transition created since status and transitions are independent
      }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Create order transition (database level)
 */
export async function createOrderTransitionController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const { fromTransition, toTransition, remarks } = req.body;
    const userId = (req as any).user?.id; // From auth middleware

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    if (!toTransition || !Object.values(OrderTransitionStatus).includes(toTransition)) {
      return res.status(400).json({ 
        message: 'Valid transition status is required',
        validTransitions: Object.values(OrderTransitionStatus)
      });
    }

    const result = await createOrderTransition({
      orderId,
      fromTransition,
      toTransition,
      transitionedBy: userId,
      remarks
    });

    return res.json({
      message: 'Order transition created successfully',
      data: {
        orderId: result.order.id,
        databaseStatus: result.databaseStatus,
        transition: {
          id: result.transition.id,
          fromState: result.transition.fromState,
          toState: result.transition.toState,
          remarks: result.transition.remarks,
          createdAt: result.transition.createdAt.getTime()
        }
        // Note: No applicationStatus here since transitions don't affect it
      }
    });
  } catch (error) {
    console.error('Error creating order transition:', error);
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get order with both application status and transition history
 */
export async function getOrderWithStatusController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await getOrderWithStatus(orderId);

    return res.json({
      message: 'Order retrieved successfully',
      data: {
        order: {
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          applicationStatus: order.applicationStatus,
          databaseStatus: order.databaseStatus,
          patient: order.patient,
          doctor: order.doctor,
          clinic: order.clinic,
          referredDoctor: order.referredDoctor,
          orderProducts: order.orderProducts,
          transitions: order.transitions.map(t => ({
            id: t.id,
            fromState: t.fromState,
            toState: t.toState,
            remarks: t.remarks,
            transitionOrder: t.transitionOrder,
            createdAt: t.createdAt.getTime()
          })),
          createdAt: order.createdAt.getTime(),
          updatedAt: order.updatedAt.getTime()
        }
      }
    });
  } catch (error) {
    console.error('Error fetching order with status:', error);
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get orders filtered by application status
 */
export async function getOrdersByStatusController(req: Request, res: Response) {
  try {
    const { status } = req.query;

    if (!status || !Object.values(OrderStatus).includes(status as OrderStatus)) {
      return res.status(400).json({ 
        message: 'Valid status is required',
        validStatuses: Object.values(OrderStatus)
      });
    }

    const orders = await getOrdersByStatus(status as OrderStatus);

    return res.json({
      message: 'Orders retrieved successfully',
      data: {
        orders: orders.map(order => ({
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          applicationStatus: order.applicationStatus,
          databaseStatus: order.databaseStatus,
          patient: order.patient,
          doctor: order.doctor,
          clinic: order.clinic,
          createdAt: order.createdAt.getTime(),
          updatedAt: order.updatedAt.getTime()
        })),
        count: orders.length
      }
    });
  } catch (error) {
    console.error('Error fetching orders by status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get available statuses and transitions
 */
export async function getStatusInfoController(req: Request, res: Response) {
  try {
    return res.json({
      message: 'Status information retrieved successfully',
      data: {
        applicationStatuses: Object.values(OrderStatus),
        transitionStatuses: Object.values(OrderTransitionStatus),
        note: "Status and transitions are completely independent - no mapping between them"
      }
    });
  } catch (error) {
    console.error('Error fetching status info:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
