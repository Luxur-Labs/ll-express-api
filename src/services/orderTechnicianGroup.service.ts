import { createOrderTransition } from '../utils/orderTransitions';
import { prisma } from '../utils/prisma';

export interface CreateOrderTechnicianGroupData {
  orderId: string;
  technicianGroupId: string;
  assignedBy?: string;
  notes?: string;
}

export interface UpdateOrderTechnicianGroupData {
  assignedBy?: string;
  notes?: string;
  isActive?: boolean;
}

export class OrderTechnicianGroupService {
  /**
   * Assign an order to a technician group
   */
  async assignOrderToTechnicianGroup(data: CreateOrderTechnicianGroupData) {
    // Check if assignment already exists
    const existingAssignment = await prisma.orderTechnicianGroup.findUnique({
      where: {
        orderId_technicianGroupId: {
          orderId: data.orderId,
          technicianGroupId: data.technicianGroupId,
        },
      },
    });

    if (existingAssignment) {
      // If exists and inactive, reactivate it
      if (!existingAssignment.isActive) {
        const updatedAssignment = await prisma.orderTechnicianGroup.update({
          where: { id: existingAssignment.id },
          data: {
            isActive: true,
            assignedAt: new Date(),
            assignedBy: data.assignedBy,
            notes: data.notes,
          },
          include: {
            order: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
              },
            },
            technicianGroup: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        });

        // Update order status to IN_PROGRESS (application status)
        await prisma.order.update({
          where: { id: data.orderId },
          data: { status: 'IN_PROGRESS' },
        });

        // Create transition record
        await createOrderTransition({
          orderId: data.orderId,
          fromState: 'ORDER_INITIATED',
          toState: 'TASK_ASSIGNMENT',
          transitionedBy: data.assignedBy,
          remarks: `Order assigned to technician group: ${updatedAssignment.technicianGroup.name}`,
        });

        return updatedAssignment;
      } else {
        throw new Error('Order is already assigned to this technician group');
      }
    }

    // Create new assignment
    const newAssignment = await prisma.orderTechnicianGroup.create({
      data: {
        orderId: data.orderId,
        technicianGroupId: data.technicianGroupId,
        assignedBy: data.assignedBy,
        notes: data.notes,
      },
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        },
        technicianGroup: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // Update order status to IN_PROGRESS (application status)
    await prisma.order.update({
      where: { id: data.orderId },
      data: { status: 'IN_PROGRESS' },
    });

    // Create transition record
    await createOrderTransition({
      orderId: data.orderId,
      fromState: 'ORDER_INITIATED',
      toState: 'TASK_ASSIGNMENT',
      transitionedBy: data.assignedBy,
      remarks: `Order assigned to technician group: ${newAssignment.technicianGroup.name}`,
    });

    return newAssignment;
  }

  /**
   * Get all assignments for a specific order
   */
  async getOrderAssignments(orderId: string) {
    return await prisma.orderTechnicianGroup.findMany({
      where: {
        orderId,
        isActive: true,
      },
      include: {
        technicianGroup: {
          select: {
            id: true,
            name: true,
            description: true,
            leader: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            members: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
  }

  /**
   * Get all orders assigned to a specific technician group
   */
  async getTechnicianGroupOrders(technicianGroupId: string, page: number = 0, limit: number = 20) {
    const skip = page * limit;

    const [assignments, total] = await Promise.all([
      prisma.orderTechnicianGroup.findMany({
        where: {
          technicianGroupId,
          isActive: true,
        },
        include: {
          order: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              createdAt: true,
              doctorName: true,
              patient: {
                select: {
                  name: true,
                },
              },
              clinic: {
                select: {
                  clinicName: true,
                  doctorName: true,
                } as any,
              },
            } as any,
          },
        },
        orderBy: {
          assignedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.orderTechnicianGroup.count({
        where: {
          technicianGroupId,
          isActive: true,
        },
      }),
    ]);

    return {
      data: {
        assignments: assignments.map((assignment: any) => ({
          id: assignment.id,
          orderId: assignment.order.id,
          invoiceNumber: assignment.order.invoiceNumber,
          status: assignment.order.status,
          patientName: assignment.order.patient?.name || null,
          doctorName: assignment.order.clinic?.doctorName || null,
          clinicName: assignment.order.clinic?.clinicName || null,
          assignedAt: assignment.assignedAt.getTime(),
          notes: assignment.notes,
        })),
        pagination: {
          page,
          limit,
          total,
        },
      },
    };
  }

  /**
   * Update an assignment
   */
  async updateAssignment(assignmentId: string, data: UpdateOrderTechnicianGroupData) {
    return await prisma.orderTechnicianGroup.update({
      where: { id: assignmentId },
      data,
      include: {
        order: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        },
        technicianGroup: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  /**
   * Remove an assignment (soft delete by setting isActive to false)
   */
  async removeAssignment(assignmentId: string) {
    return await prisma.orderTechnicianGroup.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });
  }

  /**
   * Remove all assignments for an order
   */
  async removeAllOrderAssignments(orderId: string) {
    return await prisma.orderTechnicianGroup.updateMany({
      where: { orderId },
      data: { isActive: false },
    });
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStats() {
    const [totalAssignments, activeAssignments, ordersByGroup] = await Promise.all([
      prisma.orderTechnicianGroup.count(),
      prisma.orderTechnicianGroup.count({
        where: { isActive: true },
      }),
      prisma.orderTechnicianGroup.groupBy({
        by: ['technicianGroupId'],
        where: { isActive: true },
        _count: {
          orderId: true,
        },
      }),
    ]);

    // Get technician group names separately
    const technicianGroupIds = ordersByGroup.map(group => group.technicianGroupId);
    const technicianGroups = await prisma.technicianGroup.findMany({
      where: {
        id: { in: technicianGroupIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const technicianGroupMap = new Map(
      technicianGroups.map(group => [group.id, group.name])
    );

    return {
      totalAssignments,
      activeAssignments,
      ordersByGroup: ordersByGroup.map(group => ({
        technicianGroupId: group.technicianGroupId,
        technicianGroupName: technicianGroupMap.get(group.technicianGroupId) || 'Unknown',
        orderCount: group._count.orderId,
      })),
    };
  }
}

export const orderTechnicianGroupService = new OrderTechnicianGroupService();
