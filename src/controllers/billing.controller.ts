import { Request, Response } from 'express';
import { BillingPeriodType } from '@prisma/client';
import { BillingService } from '../services/billing.service';

const billingService = new BillingService();

function parseDate(s: unknown, label: string): Date {
  if (typeof s !== 'string' || !s.trim()) {
    throw new Error(`${label} is required (ISO date)`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} is invalid`);
  return d;
}

function parseBillingPeriodType(periodType: unknown): BillingPeriodType {
  if (periodType === BillingPeriodType.QUARTERLY) return BillingPeriodType.QUARTERLY;
  if (periodType === BillingPeriodType.WEEKLY) return BillingPeriodType.WEEKLY;
  if (periodType === BillingPeriodType.CUSTOM) return BillingPeriodType.CUSTOM;
  return BillingPeriodType.MONTHLY;
}

export async function previewBillingInvoiceController(req: Request, res: Response) {
  try {
    const { clinicId, dateFrom, dateTo, periodType } = req.body;
    if (!clinicId) return res.status(400).json({ message: 'clinicId is required' });
    const from = parseDate(dateFrom, 'dateFrom');
    const to = parseDate(dateTo, 'dateTo');
    if (to < from) return res.status(400).json({ message: 'dateTo must be on or after dateFrom' });
    const pt = parseBillingPeriodType(periodType);
    const data = await billingService.previewInvoice(clinicId, from, to, pt);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Preview failed' });
  }
}

export async function finalizeBillingInvoiceController(req: Request, res: Response) {
  try {
    const { clinicId, dateFrom, dateTo, periodType, receivedAmount, creditsAdjusted, roundOff, isPaid } =
      req.body;
    if (!clinicId) return res.status(400).json({ message: 'clinicId is required' });
    const from = parseDate(dateFrom, 'dateFrom');
    const to = parseDate(dateTo, 'dateTo');
    if (to < from) return res.status(400).json({ message: 'dateTo must be on or after dateFrom' });
    const pt = parseBillingPeriodType(periodType);
    const data = await billingService.finalizeInvoice({
      clinicId,
      dateFrom: from,
      dateTo: to,
      periodType: pt,
      receivedAmount: Number(receivedAmount) || 0,
      creditsAdjusted: Number(creditsAdjusted) || 0,
      roundOff: Number(roundOff) || 0,
      isPaid: Boolean(isPaid),
    });
    return res.status(201).json(data);
  } catch (e: any) {
    const message = e?.message || 'Finalize failed';
    if (String(message).toLowerCase().includes('already generated')) {
      return res.status(409).json({ message });
    }
    return res.status(400).json({ message });
  }
}

export async function getBillingLedgerController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const take = Math.min(500, Math.max(1, Number(req.query.take) || 100));
    const data = await billingService.listLedger(clinicId, take);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Ledger load failed' });
  }
}

export async function listBillingInvoicesController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const take = Math.min(200, Math.max(1, Number(req.query.take) || 50));
    const data = await billingService.listInvoices(clinicId, take);
    return res.json({ data });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'List failed' });
  }
}

export async function listPendingInvoicesController(req: Request, res: Response) {
  try {
    const take = Math.min(100, Math.max(1, Number(req.query.take) || 20));
    const data = await billingService.listPendingInvoices(take);
    return res.json({ data });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'List failed' });
  }
}

export async function getBillingClinicSummaryController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const data = await billingService.clinicSummary(clinicId);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Summary load failed' });
  }
}

export async function getBillingOverallSummaryController(_req: Request, res: Response) {
  try {
    const data = await billingService.overallSummary();
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Summary load failed' });
  }
}

export async function getBillingInvoiceController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await billingService.getInvoiceDetail(id);
    return res.json(data);
  } catch (e: any) {
    return res.status(404).json({ message: e?.message || 'Not found' });
  }
}

export async function cancelBillingInvoiceController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await billingService.cancelInvoice(id);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Cancel failed' });
  }
}

export async function patchBillingInvoicePaymentController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { receivedAmount, creditsAdjusted, isPaid } = req.body;
    const data = await billingService.updateInvoicePayment(id, {
      receivedAmount: Number(receivedAmount) || 0,
      creditsAdjusted: Number(creditsAdjusted) || 0,
      isPaid: Boolean(isPaid),
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Update failed' });
  }
}

export async function createRazorpayInvoiceOrderController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await billingService.createRazorpayOrderForInvoice(id);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Failed to create Razorpay order' });
  }
}

export async function verifyRazorpayInvoicePaymentController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        message: 'razorpayOrderId, razorpayPaymentId and razorpaySignature are required',
      });
    }
    const data = await billingService.verifyRazorpayInvoicePayment({
      invoiceId: id,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Razorpay verification failed' });
  }
}
