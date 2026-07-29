import { Request, Response } from 'express';

import { BillingService } from '../services/billing.service';
import { OrderService } from '../services/order.service';
import { prisma } from '../utils/prisma';
import type { AuthUser } from '../types/auth';
import { env } from '../config/env';

const billingService = new BillingService();
const orderService = new OrderService();

function requireClinicId(res: Response): string | null {
  const user = res.locals.user as AuthUser | undefined;
  if (!user || user.role !== 'CLINIC' || !user.clinicId) {
    res.status(403).json({ message: 'Clinic access only' });
    return null;
  }
  return user.clinicId;
}

export async function clinicPortalMeController(_req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  const user = res.locals.user as AuthUser;
  const [clinic, dbUser] = await Promise.all([
    prisma.clinic.findFirst({
      where: { id: clinicId, isActive: true },
      select: {
        id: true,
        clinicName: true,
        organizationId: true,
        clientAddress: true,
        contactNumber: true,
        doctorName: true,
        pendingBalance: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { mustChangePassword: true },
    }),
  ]);

  if (!clinic) {
    return res.status(404).json({ message: 'Clinic not found' });
  }

  return res.json({
    user: {
      id: user.id,
      role: user.role,
      clinicId,
      name: clinic.clinicName,
      mustChangePassword: dbUser?.mustChangePassword === true,
    },
    clinic: {
      ...clinic,
      pendingBalance: Number(clinic.pendingBalance),
    },
  });
}

export async function clinicPortalInvoicesController(req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  const take = Math.min(100, Math.max(1, Number(req.query.take) || 50));
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const status = String(req.query.status ?? 'all');

  if (status === 'pending') {
    const [open, partial] = await Promise.all([
      billingService.listInvoices(clinicId, { take, skip, status: 'open' }),
      billingService.listInvoices(clinicId, { take, skip, status: 'partial' }),
    ]);
    const merged = [...open.data, ...partial.data].sort(
      (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime(),
    );
    return res.json({
      data: merged.slice(0, take),
      total: open.total + partial.total,
    });
  }

  const invoiceStatus = ['open', 'partial', 'paid', 'cancelled', 'all'].includes(status)
    ? (status as 'open' | 'partial' | 'paid' | 'cancelled' | 'all')
    : 'all';

  const data = await billingService.listInvoices(clinicId, { take, skip, status: invoiceStatus });
  return res.json(data);
}

export async function clinicPortalInvoiceCountsController(_req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  const counts = await billingService.clinicInvoiceStatusCounts(clinicId);
  return res.json({
    pending: counts.open + counts.partial,
    paid: counts.paid,
    open: counts.open,
    partial: counts.partial,
    cancelled: counts.cancelled,
  });
}

export async function clinicPortalOrdersController(req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const page = Math.max(0, Number(req.query.page) || 0);
  const data = await orderService.getOrdersList({ clinicId, limit, page });
  return res.json(data);
}

export async function clinicPortalPaymentOptionsController(_req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  const onlineAvailable = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  return res.json({
    onlineAvailable,
    provider: 'razorpay',
  });
}

export async function clinicPortalOpenInvoicesController(_req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  try {
    const data = await billingService.listOpenInvoicesForClinic(clinicId);
    return res.json({ data });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Failed to load open invoices' });
  }
}

export async function clinicPortalCreateRazorpayOrderController(req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  try {
    const { mode, amount, invoiceIds } = req.body || {};
    if (mode !== 'PENDING_TOTAL' && mode !== 'SELECTED' && mode !== 'CUSTOM') {
      return res.status(400).json({ message: 'mode must be PENDING_TOTAL, SELECTED, or CUSTOM' });
    }
    const data = await billingService.createRazorpayOrderForClinic(clinicId, {
      mode,
      amount: amount != null ? Number(amount) : undefined,
      invoiceIds: Array.isArray(invoiceIds) ? invoiceIds : undefined,
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Failed to create payment order' });
  }
}

export async function clinicPortalVerifyRazorpayController(req: Request, res: Response) {
  const clinicId = requireClinicId(res);
  if (!clinicId) return;

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'razorpayOrderId, razorpayPaymentId and razorpaySignature are required' });
    }
    const data = await billingService.verifyRazorpayClinicPayment({
      clinicId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Payment verification failed' });
  }
}
