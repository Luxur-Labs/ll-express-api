import { Request, Response } from 'express';
import { OrderService, CreateOrderData, UpdateOrderData } from '../services/order.service';

const orderService = new OrderService();

export async function createOrderController(req: Request, res: Response) {
  try {
    const {
      invoiceNumber,
      patientId,
      doctorId,
      clinicId,
      referredDoctorId,
      partner,
      scanningMode,
      schedule,
      enterRemark,
      estimateDate,
      dateOfApproach,
      orderProducts
    } = req.body;

    if (!invoiceNumber || !patientId || !doctorId || !clinicId || !partner || 
        !scanningMode || !schedule || !enterRemark || !estimateDate || !dateOfApproach || 
        !orderProducts || !Array.isArray(orderProducts) || orderProducts.length === 0) {
      return res.status(400).json({
        message: 'All required fields must be provided: invoiceNumber, patientId, doctorId, clinicId, partner, scanningMode, schedule, enterRemark, estimateDate, dateOfApproach, and orderProducts (non-empty array)'
      });
    }

    // Validate each order product
    for (const product of orderProducts) {
      if (!product.workSpecification || !product.shadeType || !product.finishingInstructions ||
          !product.componentDetails || !product.incaseOfAllAbutments || !product.occlusalStaining ||
          !product.ponticDesign || !product.repeatCorrections || !product.enterReason) {
        return res.status(400).json({
          message: 'Each order product must have all required fields: workSpecification, shadeType, finishingInstructions, componentDetails, incaseOfAllAbutments, occlusalStaining, ponticDesign, repeatCorrections, enterReason'
        });
      }
    }

    const orderData: CreateOrderData = {
      invoiceNumber,
      patientId,
      doctorId,
      clinicId,
      referredDoctorId,
      partner,
      scanningMode,
      schedule: new Date(schedule),
      enterRemark,
      estimateDate: new Date(estimateDate),
      dateOfApproach: new Date(dateOfApproach),
      orderProducts,
    };

    const order = await orderService.createOrder(orderData);
    return res.status(201).json(order);
  } catch (error) {
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
      doctorId,
      clinicId,
      referredDoctorId,
      partner,
      scanningMode,
      schedule,
      enterRemark,
      estimateDate,
      dateOfApproach
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Check if order exists
    const existingOrder = await orderService.getOrderById(id);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const updateData: UpdateOrderData = {};
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
    if (patientId !== undefined) updateData.patientId = patientId;
    if (doctorId !== undefined) updateData.doctorId = doctorId;
    if (clinicId !== undefined) updateData.clinicId = clinicId;
    if (referredDoctorId !== undefined) updateData.referredDoctorId = referredDoctorId;
    if (partner !== undefined) updateData.partner = partner;
    if (scanningMode !== undefined) updateData.scanningMode = scanningMode;
    if (schedule !== undefined) updateData.schedule = new Date(schedule);
    if (enterRemark !== undefined) updateData.enterRemark = enterRemark;
    if (estimateDate !== undefined) updateData.estimateDate = new Date(estimateDate);
    if (dateOfApproach !== undefined) updateData.dateOfApproach = new Date(dateOfApproach);

    const updatedOrder = await orderService.updateOrder(id, updateData);
    return res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
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

    const orders = await orderService.getOrdersByPatient(patientId);
    return res.json(orders);
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

    const orders = await orderService.getOrdersByDoctor(doctorId);
    return res.json(orders);
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

    const orders = await orderService.getOrdersByClinic(clinicId);
    return res.json(orders);
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

    const orders = await orderService.getOrdersByPartner(partner);
    return res.json(orders);
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

    const orders = await orderService.getOrdersByScanningMode(scanningMode);
    return res.json(orders);
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

    const orders = await orderService.getOrdersByDateRange(start, end);
    return res.json(orders);
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
