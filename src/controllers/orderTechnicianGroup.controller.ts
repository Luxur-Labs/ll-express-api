import { Request, Response } from 'express';
import { orderTechnicianGroupService } from '../services/orderTechnicianGroup.service';

export async function assignOrderToTechnicianGroupController(req: Request, res: Response) {
  try {
    const { orderId, technicianGroupId, notes } = req.body;
    const assignedBy = (req as any).user?.id; // Get from authenticated user

    if (!orderId || !technicianGroupId) {
      return res.status(400).json({
        message: 'orderId and technicianGroupId are required',
      });
    }

    const assignment = await orderTechnicianGroupService.assignOrderToTechnicianGroup({
      orderId,
      technicianGroupId,
      assignedBy,
      notes,
    });

    return res.status(201).json({
      message: 'Order assigned to technician group successfully',
      assignment,
    });
  } catch (error: any) {
    console.error('Error assigning order to technician group:', error);
    if (error.message === 'Order is already assigned to this technician group') {
      return res.status(409).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrderAssignmentsController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const assignments = await orderTechnicianGroupService.getOrderAssignments(orderId);
    return res.json({ assignments });
  } catch (error) {
    console.error('Error fetching order assignments:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getTechnicianGroupOrdersController(req: Request, res: Response) {
  try {
    const { technicianGroupId } = req.params;
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!technicianGroupId) {
      return res.status(400).json({ message: 'Technician Group ID is required' });
    }

    if (page < 0 || limit < 1 || limit > 100) {
      return res.status(400).json({
        message: 'Invalid pagination parameters. Page must be >= 0, limit must be between 1 and 100',
      });
    }

    const result = await orderTechnicianGroupService.getTechnicianGroupOrders(
      technicianGroupId,
      page,
      limit
    );
    return res.json(result);
  } catch (error) {
    console.error('Error fetching technician group orders:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateAssignmentController(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;
    const { notes, isActive } = req.body;
    const assignedBy = (req as any).user?.id;

    if (!assignmentId) {
      return res.status(400).json({ message: 'Assignment ID is required' });
    }

    const assignment = await orderTechnicianGroupService.updateAssignment(assignmentId, {
      notes,
      isActive,
      assignedBy,
    });

    return res.json({
      message: 'Assignment updated successfully',
      assignment,
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeAssignmentController(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;

    if (!assignmentId) {
      return res.status(400).json({ message: 'Assignment ID is required' });
    }

    await orderTechnicianGroupService.removeAssignment(assignmentId);
    return res.status(204).send();
  } catch (error) {
    console.error('Error removing assignment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function removeAllOrderAssignmentsController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    await orderTechnicianGroupService.removeAllOrderAssignments(orderId);
    return res.status(204).send();
  } catch (error) {
    console.error('Error removing all order assignments:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAssignmentStatsController(req: Request, res: Response) {
  try {
    const stats = await orderTechnicianGroupService.getAssignmentStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching assignment stats:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
