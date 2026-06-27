import { Request, Response } from 'express';
import { BillingPeriodType } from '@prisma/client';
import { BillingService } from '../services/billing.service';
import { notifyClinicInvoiceWhatsApp } from '../services/whatsappInvoiceNotify.service';

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

/** Single-order tax invoice payload (same shape as POST /invoices/preview) for printing from order details. */
export async function previewOrderInvoicePrintController(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ message: 'orderId is required' });
    const data = await billingService.previewInvoiceForOrderPrint(orderId);
    return res.json(data);
  } catch (e: any) {
    const msg = e?.message || 'Preview failed';
    if (String(msg).toLowerCase().includes('not found')) {
      return res.status(404).json({ message: msg });
    }
    return res.status(400).json({ message: msg });
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
    if (data?.clinic?.contactNumber && data?.id) {
      void notifyClinicInvoiceWhatsApp({
        id: data.id,
        invoiceNumber: data.invoiceNumber,
        periodLabel: data.periodLabel,
        netPayable: data.netPayable,
        clinic: {
          clinicName: data.clinic.clinicName,
          contactNumber: data.clinic.contactNumber,
        },
      }).catch((e) => console.error('[whatsapp-invoice]', e));
    }
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

export async function getBillingClinicInvoiceCountsController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const counts = await billingService.clinicInvoiceStatusCounts(clinicId);
    return res.json(counts);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Count failed' });
  }
}

export async function listBillingInvoicesController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const take = Math.min(100, Math.max(1, Number(req.query.take) || 50));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const statusRaw = String(req.query.status ?? 'all').toLowerCase();
    const allowed: Array<'all' | 'open' | 'partial' | 'paid' | 'cancelled'> = [
      'all',
      'open',
      'partial',
      'paid',
      'cancelled',
    ];
    const status = (allowed.includes(statusRaw as any) ? statusRaw : 'all') as
      | 'all'
      | 'open'
      | 'partial'
      | 'paid'
      | 'cancelled';
    const { data, total } = await billingService.listInvoices(clinicId, { take, skip, status });
    return res.json({ data, total });
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

export async function getBillingAllClinicsSummaryController(_req: Request, res: Response) {
  try {
    const data = await billingService.allClinicsBillingSummary();
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Summary load failed' });
  }
}

export async function getBillingAllClinicsLedgerController(req: Request, res: Response) {
  try {
    const take = Math.min(500, Math.max(1, Number(req.query.take) || 100));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const data = await billingService.listAllLedger(take, skip);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Ledger load failed' });
  }
}

export async function getBillingAllClinicsInvoiceCountsController(_req: Request, res: Response) {
  try {
    const counts = await billingService.allClinicsInvoiceStatusCounts();
    return res.json(counts);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Count failed' });
  }
}

export async function listBillingAllClinicsInvoicesController(req: Request, res: Response) {
  try {
    const take = Math.min(100, Math.max(1, Number(req.query.take) || 50));
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const statusRaw = String(req.query.status ?? 'all').toLowerCase();
    const allowed: Array<'all' | 'open' | 'partial' | 'paid' | 'cancelled'> = [
      'all',
      'open',
      'partial',
      'paid',
      'cancelled',
    ];
    const status = (allowed.includes(statusRaw as any) ? statusRaw : 'all') as
      | 'all'
      | 'open'
      | 'partial'
      | 'paid'
      | 'cancelled';
    const { data, total } = await billingService.listAllInvoices({ take, skip, status });
    return res.json({ data, total });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'List failed' });
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
    const amount = req.body?.amount;
    const data = await billingService.createRazorpayOrderForInvoice(
      id,
      amount != null ? Number(amount) : undefined
    );
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Failed to create Razorpay order' });
  }
}

export async function recordCashPaymentOnInvoiceController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { amount } = req.body || {};
    if (amount == null || Number(amount) <= 0) {
      return res.status(400).json({ message: 'amount is required' });
    }
    const data = await billingService.recordCashPaymentOnInvoice(id, Number(amount));
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Payment failed' });
  }
}

export async function suggestLinePaymentAmountController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { lineIds } = req.body || {};
    if (!Array.isArray(lineIds)) {
      return res.status(400).json({ message: 'lineIds array is required' });
    }
    const data = await billingService.suggestAmountFromLineIds(id, lineIds);
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Failed' });
  }
}

export async function listOpenInvoicesForClinicController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const data = await billingService.listOpenInvoicesForClinic(clinicId);
    return res.json({ data });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Failed' });
  }
}

export async function recordClinicMultiCashController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const { mode, amount, invoiceIds, method } = req.body || {};
    if (method && method !== 'CASH') {
      return res.status(400).json({ message: 'This endpoint is for cash; use /razorpay/order for online' });
    }
    if (mode !== 'PENDING_TOTAL' && mode !== 'SELECTED' && mode !== 'CUSTOM') {
      return res.status(400).json({ message: 'mode must be PENDING_TOTAL, SELECTED, or CUSTOM' });
    }
    const data = await billingService.recordClinicMultiCashPayment(clinicId, {
      mode,
      amount: amount != null ? Number(amount) : undefined,
      invoiceIds: Array.isArray(invoiceIds) ? invoiceIds : undefined,
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Payment failed' });
  }
}

export async function createRazorpayClinicOrderController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const { mode, amount, invoiceIds } = req.body || {};
    if (mode !== 'PENDING_TOTAL' && mode !== 'SELECTED' && mode !== 'CUSTOM') {
      return res.status(400).json({ message: 'mode is required' });
    }
    const data = await billingService.createRazorpayOrderForClinic(clinicId, {
      mode,
      amount: amount != null ? Number(amount) : undefined,
      invoiceIds: Array.isArray(invoiceIds) ? invoiceIds : undefined,
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Failed to create order' });
  }
}

export async function verifyRazorpayClinicPaymentController(req: Request, res: Response) {
  try {
    const { clinicId } = req.params;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'razorpay fields required' });
    }
    const data = await billingService.verifyRazorpayClinicPayment({
      clinicId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return res.json(data);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Verification failed' });
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
