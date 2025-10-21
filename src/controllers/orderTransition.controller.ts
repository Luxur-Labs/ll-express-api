import { Request, Response } from 'express';
import { getOrderTransitions, getOrderTimeline } from '../utils/orderTransitions';

/**
 * Get all transitions for a specific order
 */
export async function getOrderTransitionsController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const transitions = await getOrderTransitions(orderId);
    return res.json({
      message: 'Order transitions retrieved successfully',
      data: {
        orderId,
        transitions: transitions.map(transition => ({
          id: transition.id,
          fromState: transition.fromState,
          toState: transition.toState,
          transitionedBy: transition.transitionedBy,
          remarks: transition.remarks,
          transitionOrder: transition.transitionOrder,
          createdAt: transition.createdAt.getTime(),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching order transitions:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get order timeline (transitions + order creation)
 */
export async function getOrderTimelineController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const timeline = await getOrderTimeline(orderId);
    return res.json({
      message: 'Order timeline retrieved successfully',
      data: timeline,
    });
  } catch (error) {
    console.error('Error fetching order timeline:', error);
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
