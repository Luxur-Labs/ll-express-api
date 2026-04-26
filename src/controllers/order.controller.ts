import { Request, Response } from 'express';

import { OrderService, CreateOrderData, UpdateOrderData } from '../services/order.service';
import type { AuthUser } from '../types/auth';

const orderService = new OrderService();

export async function createOrderController(req: Request, res: Response) {
  try {
    const {
      invoiceNumber,
      patient, // Changed from patientId to patient object
      doctorId,
      clinicId,
      referredDoctorId,
      referenceName,
      partner,
      estimateDate,
      orderProducts,
      files,
      status
    } = req.body;

    if (!invoiceNumber || !patient || !clinicId || !partner || 
        !estimateDate || 
        !orderProducts || !Array.isArray(orderProducts) || orderProducts.length === 0) {
      return res.status(400).json({
        message: 'All required fields must be provided: invoiceNumber, patient (with name, age, gender), clinicId, partner, estimateDate, and orderProducts (non-empty array)'
      });
    }

    // Validate patient data
    if (!patient.name || patient.age === undefined || !patient.gender) {
      return res.status(400).json({
        message: 'Patient data must include: name, age, and gender'
      });
    }

    // Validate each order product
    for (const product of orderProducts) {
      if (!product.productId || !product.shadeType || !product.finishingInstructions ||
          product.componentDetails === undefined || product.componentDetails === null || !product.incaseOfAllAbutments || !product.occlusalStaining ||
          !product.ponticDesign || !product.repeatCorrections || !product.enterReason) {
        return res.status(400).json({
          message: 'Each order product must have all required fields: productId, shadeType, finishingInstructions, componentDetails, incaseOfAllAbutments, occlusalStaining, ponticDesign, repeatCorrections, enterReason'
        });
      }
    }

    // Validate files if provided
    if (files && Array.isArray(files)) {
      for (const file of files) {
        if (!file.fileName || !file.s3Key) {
          return res.status(400).json({
            message: 'Each file must have fileName and s3Key'
          });
        }
      }
    }

    const orderData: CreateOrderData = {
      invoiceNumber,
      patient: {
        name: patient.name,
        age: typeof patient.age === 'string' ? parseInt(patient.age, 10) : patient.age,
        gender: patient.gender,
        contactNumber: patient.contactNumber,
      },
      doctorId,
      clinicId,
      referredDoctorId,
      referenceName,
      partner,
      estimateDate: new Date(estimateDate),
      orderProducts,
      files,
      status,
    };

    await orderService.createOrder(orderData);
    return res.status(201).json({ message: 'Created order successfully' });
  } catch (error: any) {
    if (
      error?.code === 'P2002' &&
      Array.isArray(error?.meta?.target) &&
      error.meta.target.includes('invoiceNumber')
    ) {
      return res.status(409).json({
        message: `Invoice number '${req.body?.invoiceNumber || ''}' already exists. Please use a different invoice number.`,
      });
    }
    console.error('Error creating order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrderByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrderByInvoiceNumberController(req: Request, res: Response) {
  try {
    const { invoiceNumber } = req.params;

    if (!invoiceNumber) {
      return res.status(400).json({ message: 'Invoice number is required' });
    }

    const order = await orderService.getOrderByInvoiceNumber(invoiceNumber);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json(order);
  } catch (error) {
    console.error('Error fetching order by invoice number:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrdersListController(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    const {
      search,
      invoiceNumber,
      orderId,
      status,
      patientId,
      doctorId,
      clinicId,
      referredDoctorId,
      patientName,
      doctorName,
      clinicName,
      partner,
      scanningMode,
      productCode,
      scheduleFrom,
      scheduleTo,
      estimateDateFrom,
      estimateDateTo,
      dateOfApproachFrom,
      dateOfApproachTo,
      createdAtFrom,
      createdAtTo,
      sortBy,
      sortOrder,
    } = req.query;

    if (page < 0 || limit < 1 || limit > 100) {
      return res.status(400).json({ 
        message: 'Invalid pagination parameters. Page must be >= 0, limit must be between 1 and 100' 
      });
    }

    const result = await orderService.getOrdersList({
      page,
      limit,
      search: search as string | undefined,
      invoiceNumber: invoiceNumber as string | undefined,
      orderId: orderId as string | undefined,
      status: status as string | undefined,
      patientId: patientId as string | undefined,
      doctorId: doctorId as string | undefined,
      clinicId: clinicId as string | undefined,
      referredDoctorId: referredDoctorId as string | undefined,
      patientName: patientName as string | undefined,
      doctorName: doctorName ? (doctorName as string).trim() : undefined,
      clinicName: clinicName as string | undefined,
      partner: partner as string | undefined,
      scanningMode: scanningMode as string | undefined,
      productCode: productCode as string | undefined,
      scheduleFrom: scheduleFrom as string | undefined,
      scheduleTo: scheduleTo as string | undefined,
      estimateDateFrom: estimateDateFrom as string | undefined,
      estimateDateTo: estimateDateTo as string | undefined,
      dateOfApproachFrom: dateOfApproachFrom as string | undefined,
      dateOfApproachTo: dateOfApproachTo as string | undefined,
      createdAtFrom: createdAtFrom as string | undefined,
      createdAtTo: createdAtTo as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });
    return res.json(result);
  } catch (error) {
    console.error('Error fetching orders list:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAllOrdersController(req: Request, res: Response) {
  try {
    const orders = await orderService.getAllOrders();
    return res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateOrderController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      invoiceNumber,
      patientId,
      patient, // Support updating patient info directly
      doctorId,
      clinicId,
      referredDoctorId,
      referenceName,
      partner,
      scanningMode,
      schedule,
      enterRemark,
      estimateDate,
      dateOfApproach,
      status,
      orderProducts, // Support updating order products
      files, // Support updating files
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Validate patient data if provided
    if (patient !== undefined) {
      if (!patient.name || patient.age === undefined || !patient.gender) {
        return res.status(400).json({
          message: 'Patient data must include: name, age, and gender'
        });
      }
    }

    // Validate order products if provided
    if (orderProducts !== undefined) {
      if (!Array.isArray(orderProducts)) {
        return res.status(400).json({
          message: 'orderProducts must be an array'
        });
      }
      for (const product of orderProducts) {
        if (!product.productId || !product.shadeType || !product.finishingInstructions ||
            product.componentDetails === undefined || product.componentDetails === null || !product.incaseOfAllAbutments || !product.occlusalStaining ||
            !product.ponticDesign || !product.repeatCorrections || !product.enterReason) {
          return res.status(400).json({
            message: 'Each order product must have all required fields: productId, shadeType, finishingInstructions, componentDetails, incaseOfAllAbutments, occlusalStaining, ponticDesign, repeatCorrections, enterReason'
          });
        }
      }
    }

    // Validate files if provided
    if (files !== undefined) {
      if (!Array.isArray(files)) {
        return res.status(400).json({
          message: 'files must be an array'
        });
      }
      for (const file of files) {
        if (!file.fileName || !file.s3Key) {
          return res.status(400).json({
            message: 'Each file must have fileName and s3Key'
          });
        }
      }
    }

    const updateData: UpdateOrderData = {};
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
    if (patientId !== undefined) updateData.patientId = patientId;
    if (patient !== undefined) {
      updateData.patient = {
        name: patient.name,
        age: typeof patient.age === 'string' ? parseInt(patient.age, 10) : patient.age,
        gender: patient.gender,
        contactNumber: patient.contactNumber,
      };
    }
    if (doctorId !== undefined) updateData.doctorId = doctorId;
    if (clinicId !== undefined) updateData.clinicId = clinicId;
    if (referredDoctorId !== undefined) updateData.referredDoctorId = referredDoctorId;
    if (referenceName !== undefined) updateData.referenceName = referenceName;
    if (partner !== undefined) updateData.partner = partner;
    if (scanningMode !== undefined) updateData.scanningMode = scanningMode;
    if (schedule !== undefined && schedule !== null && schedule !== '') updateData.schedule = new Date(schedule);
    if (enterRemark !== undefined) updateData.enterRemark = enterRemark;
    if (estimateDate !== undefined) updateData.estimateDate = new Date(estimateDate);
    if (dateOfApproach !== undefined && dateOfApproach !== null && dateOfApproach !== '') updateData.dateOfApproach = new Date(dateOfApproach);
    if (status !== undefined) updateData.status = status;
    if (orderProducts !== undefined) updateData.orderProducts = orderProducts;
    if (files !== undefined) updateData.files = files;

    const updatedOrder = await orderService.updateOrder(id, updateData, (req as any).user?.id);
    return res.json(updatedOrder);
  } catch (error: any) {
    if (
      error?.code === 'P2002' &&
      Array.isArray(error?.meta?.target) &&
      error.meta.target.includes('invoiceNumber')
    ) {
      return res.status(409).json({
        message: `Invoice number '${req.body?.invoiceNumber || ''}' already exists. Please use a different invoice number.`,
      });
    }
    console.error('Error updating order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addOrderActivityNoteController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { note } = req.body as { note?: string };
    const user = res.locals.user as AuthUser | undefined;

    if (!id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await orderService.addOrderActivityNote(id, user?.id, note ?? '');
    return res.status(201).json(order);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (message === 'Note cannot be empty') {
      return res.status(400).json({ message: 'Note cannot be empty' });
    }
    console.error('Error adding order activity note:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateOrderStatusController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update only the status
    const updateData: UpdateOrderData = {
      status,
    };

    const updatedOrder = await orderService.updateOrder(
      id,
      updateData,
      (req as any).user?.id,
      remarks || `Order status updated to ${status}`
    );

    return res.json({
      message: 'Order status updated successfully',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteOrderController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await orderService.deleteOrder(id);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrdersByPatientController(req: Request, res: Response) {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    // This method needs to be implemented in the service
    return res.status(501).json({ message: 'Method not implemented yet' });
  } catch (error) {
    console.error('Error fetching orders by patient:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrdersByDoctorController(req: Request, res: Response) {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' });
    }

    // This method needs to be implemented in the service
    return res.status(501).json({ message: 'Method not implemented yet' });
  } catch (error) {
    console.error('Error fetching orders by doctor:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrdersByClinicController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    // This method needs to be implemented in the service
    return res.status(501).json({ message: 'Method not implemented yet' });
  } catch (error) {
    console.error('Error fetching orders by clinic:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrdersByPartnerController(req: Request, res: Response) {
  try {
    const { partner } = req.params;

    if (!partner) {
      return res.status(400).json({ message: 'Partner is required' });
    }

    // This method needs to be implemented in the service
    return res.status(501).json({ message: 'Method not implemented yet' });
  } catch (error) {
    console.error('Error fetching orders by partner:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrdersByScanningModeController(req: Request, res: Response) {
  try {
    const { scanningMode } = req.params;

    if (!scanningMode) {
      return res.status(400).json({ message: 'Scanning mode is required' });
    }

    // This method needs to be implemented in the service
    return res.status(501).json({ message: 'Method not implemented yet' });
  } catch (error) {
    console.error('Error fetching orders by scanning mode:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getOrdersByDateRangeController(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format for startDate or endDate'
      });
    }

    if (start > end) {
      return res.status(400).json({
        message: 'startDate must be before or equal to endDate'
      });
    }

    // This method needs to be implemented in the service
    return res.status(501).json({ message: 'Method not implemented yet' });
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
