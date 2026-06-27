import { Prisma, BillingPeriodType, BillingLedgerEntryType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { razorpayService } from './razorpay.service';
import { countToothUnits } from '../utils/toothNumber.util';

export const COMPANY_HEADER = {
  name: 'Izee Medical Laboratories Pvt Ltd',
  tagLine: '(2024-25)',
  address:
    'G3, H.No. 8-2-248, Maharshi House, Road No. 03, Nagarjuna Circle, Beside Chutney\'s, Hyderabad, 500034',
  phone: '9154159829',
  email: 'accounts@luxurdentallabs.com',
};

function toNumber(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
}

export function countUnits(unitNumbers?: string | null): number {
  return countToothUnits(unitNumbers);
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Distribute one payment across many open invoices: pay from the oldest billing
 * period (dateFrom) first, then the next, until the amount is used. Unpaid balance
 * remains on the later (newer) invoices. Tiebreakers: invoice date, then createdAt, then id.
 */
const FIFO_OPEN_INVOICE_ORDER: Prisma.BillingInvoiceOrderByWithRelationInput[] = [
  { dateFrom: 'asc' },
  { invoiceDate: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

/** Simplified amount in words for invoice footer (Indian English style, rupees). */
export function numberToWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return 'Zero only';

  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function wordsBelowThousand(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ''}`.trim();
    return `${ones[Math.floor(num / 100)]} hundred${num % 100 ? ` and ${wordsBelowThousand(num % 100)}` : ''}`.trim();
  }

  let remaining = n;
  const parts: string[] = [];
  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;

  if (crore) parts.push(`${wordsBelowThousand(crore)} crore`);
  if (lakh) parts.push(`${wordsBelowThousand(lakh)} lakh`);
  if (thousand) parts.push(`${wordsBelowThousand(thousand)} thousand`);
  if (remaining) parts.push(wordsBelowThousand(remaining));

  const paise = Math.round((Math.abs(amount) - n) * 100);
  let s = parts.join(' ').replace(/\s+/g, ' ').trim();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (paise > 0) s += ` and ${paise} paise`;
  return `${s} only`;
}

function buildPeriodLabel(
  dateFrom: Date,
  dateTo: Date,
  periodType: BillingPeriodType
): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (periodType === 'QUARTERLY') {
    const q = Math.floor(dateFrom.getMonth() / 3) + 1;
    return `Q${q} - ${dateFrom.getFullYear()}`;
  }
  if (periodType === 'WEEKLY') {
    return `Week ${ymd(dateFrom)} to ${ymd(dateTo)}`;
  }
  if (periodType === 'CUSTOM') {
    return `Custom ${ymd(dateFrom)} to ${ymd(dateTo)}`;
  }
  if (
    dateFrom.getMonth() === dateTo.getMonth() &&
    dateFrom.getFullYear() === dateTo.getFullYear()
  ) {
    return `${months[dateFrom.getMonth()]} - ${dateFrom.getFullYear()}`;
  }
  return `${months[dateFrom.getMonth()]} ${dateFrom.getFullYear()} - ${months[dateTo.getMonth()]} ${dateTo.getFullYear()}`;
}

/** Uses the same safe allocator as invoice create (rare; prefer create path). */
async function nextInvoiceNumber(invoiceDate: Date): Promise<string> {
  return prisma.$transaction((tx) => nextInvoiceNumberWithTx(tx, invoiceDate));
}

export interface InvoiceLineDraft {
  orderId: string | null;
  orderProductId: string | null;
  voucherNo: string | null;
  deliveryDate: Date | null;
  patientName: string;
  productDescription: string;
  toothNo: string;
  unit: number;
  ratePerUnit: number;
  discountRate: number;
  lineTotal: number;
  sortOrder: number;
}

export class BillingService {
  /**
   * Order product lines already captured on a **non-cancelled** billing invoice for this clinic
   * are excluded from new previews/finalizes. Lines on cancelled invoices are not included here,
   * so those order products become billable again after cancellation.
   */
  private async getActiveBilledOrderProductKeys(
    clinicId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Set<string>> {
    const db = tx ?? prisma;
    const rows = await db.billingInvoiceLine.findMany({
      where: {
        orderId: { not: null },
        orderProductId: { not: null },
        invoice: {
          clinicId,
          cancelledAt: null,
        },
      },
      select: { orderId: true, orderProductId: true },
    });
    return new Set(
      rows.map((r) => `${String(r.orderId)}::${String(r.orderProductId)}`)
    );
  }

  /** Opening balance (clinic pending) is rolled into the total only on the first non-cancelled invoice, and only when it is greater than zero. */
  private resolvePreviousBalanceForInvoice(
    isFirst: boolean,
    clinicPendingBalance: number
  ): number {
    if (!isFirst) return 0;
    const opening = roundMoney(clinicPendingBalance);
    return opening > 0 ? opening : 0;
  }

  private async isFirstNonCancelledInvoiceForClinic(
    clinicId: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const db = tx ?? prisma;
    const n = await db.billingInvoice.count({
      where: { clinicId, cancelledAt: null },
    });
    return n === 0;
  }

  async buildLinesForPeriod(
    clinicId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<InvoiceLineDraft[]> {
    const billedKeys = await this.getActiveBilledOrderProductKeys(clinicId);

    const orders = await prisma.order.findMany({
      where: {
        clinicId,
        isActive: true,
        estimateDate: { gte: dateFrom, lte: dateTo },
      },
      include: {
        patient: true,
        orderProducts: { include: { product: true } },
      },
      orderBy: { estimateDate: 'asc' },
    });

    let sortOrder = 0;
    const lines: InvoiceLineDraft[] = [];
    for (const order of orders) {
      for (const op of order.orderProducts) {
        if (billedKeys.has(`${order.id}::${op.id}`)) {
          continue;
        }
        const opRow = op as any;
        const unit = countUnits(op.unitNumbers);
        const rate =
          opRow.unitPrice != null ? toNumber(opRow.unitPrice) : toNumber(op.product.price);
        const discountPct =
          opRow.discountPercent != null
            ? toNumber(opRow.discountPercent)
            : toNumber(op.product.discount);
        const gross = unit * rate;
        const discountAmt = roundMoney((gross * discountPct) / 100);
        const lineTotal = roundMoney(gross - discountAmt);
        const desc = [op.product.name, op.workType].filter(Boolean).join(' — ') || op.product.name;
        lines.push({
          orderId: order.id,
          orderProductId: op.id,
          voucherNo: order.invoiceNumber,
          deliveryDate: order.estimateDate,
          patientName: order.patient.name,
          productDescription: desc,
          toothNo: op.unitNumbers || '',
          unit,
          ratePerUnit: rate,
          discountRate: discountAmt,
          lineTotal,
          sortOrder: sortOrder++,
        });
      }
    }
    return lines;
  }

  async previewInvoice(
    clinicId: string,
    dateFrom: Date,
    dateTo: Date,
    periodType: BillingPeriodType
  ) {
    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, isActive: true },
    });
    if (!clinic) throw new Error('Clinic not found');

    const lines = await this.buildLinesForPeriod(clinicId, dateFrom, dateTo);
    if (!lines.length) {
      throw new Error('No orders found for the selected period. Preview was not generated.');
    }
    const invoiceSubtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
    const isFirst = await this.isFirstNonCancelledInvoiceForClinic(clinicId);
    const clinicPending = roundMoney(toNumber(clinic.pendingBalance));
    const previousBalance = this.resolvePreviousBalanceForInvoice(isFirst, clinicPending);
    const roundOff = 0;
    const totalPayable = roundMoney(invoiceSubtotal + roundOff + previousBalance);
    const receivedAmount = 0;
    const creditsAdjusted = 0;
    const netPayable = roundMoney(totalPayable - receivedAmount - creditsAdjusted);

    return {
      company: COMPANY_HEADER,
      clinic: {
        id: clinic.id,
        clinicName: clinic.clinicName,
        organizationId: clinic.organizationId,
        clientAddress: clinic.clientAddress,
        accountType: 'Ledger Account',
        pendingBalance: toNumber(clinic.pendingBalance),
      },
      periodType,
      periodLabel: buildPeriodLabel(dateFrom, dateTo, periodType),
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      lines,
      invoiceSubtotal,
      roundOff,
      previousBalance,
      totalPayable,
      receivedAmount,
      creditsAdjusted,
      netPayable,
      totalInWords: numberToWords(netPayable),
      isFirstInvoice: isFirst,
    };
  }

  /**
   * Same line pricing as period invoice preview, but for a single order — used for
   * order-details print so output matches tax invoice generation layout.
   */
  async previewInvoiceForOrderPrint(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        clinic: true,
        patient: true,
        orderProducts: { include: { product: true } },
      },
    });
    if (!order) throw new Error('Order not found');

    const lines: InvoiceLineDraft[] = [];
    let sortOrder = 0;
    for (const op of order.orderProducts) {
      const opRow = op as any;
      const unit = countUnits(op.unitNumbers);
      const rate =
        opRow.unitPrice != null ? toNumber(opRow.unitPrice) : toNumber(op.product.price);
      const discountPct =
        opRow.discountPercent != null
          ? toNumber(opRow.discountPercent)
          : toNumber(op.product.discount);
      const gross = unit * rate;
      const discountAmt = roundMoney((gross * discountPct) / 100);
      const lineTotal = roundMoney(gross - discountAmt);
      const desc = [op.product.name, op.workType].filter(Boolean).join(' — ') || op.product.name;
      lines.push({
        orderId: order.id,
        orderProductId: op.id,
        voucherNo: order.invoiceNumber,
        deliveryDate: order.estimateDate,
        patientName: order.patient.name,
        productDescription: desc,
        toothNo: op.unitNumbers || '',
        unit,
        ratePerUnit: rate,
        discountRate: discountAmt,
        lineTotal,
        sortOrder: sortOrder++,
      });
    }

    if (!lines.length) {
      throw new Error('This order has no products to include on the invoice print.');
    }

    const clinic = order.clinic;
    const invoiceSubtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
    const roundOff = 0;
    const previousBalance = 0;
    const totalPayable = roundMoney(invoiceSubtotal + roundOff + previousBalance);
    const receivedAmount = 0;
    const creditsAdjusted = 0;
    const netPayable = roundMoney(totalPayable - receivedAmount - creditsAdjusted);

    const est = order.estimateDate;
    const periodLabel = `Order ${order.invoiceNumber} — Estimate ${est.toISOString().slice(0, 10)}`;

    return {
      company: COMPANY_HEADER,
      clinic: {
        id: clinic.id,
        clinicName: clinic.clinicName,
        organizationId: clinic.organizationId,
        clientAddress: clinic.clientAddress,
        accountType: 'Ledger Account',
        pendingBalance: toNumber(clinic.pendingBalance),
      },
      periodType: BillingPeriodType.CUSTOM,
      periodLabel,
      dateFrom: est.toISOString(),
      dateTo: est.toISOString(),
      invoiceNumber: order.invoiceNumber,
      invoiceDate: est.toISOString(),
      lines,
      invoiceSubtotal,
      roundOff,
      previousBalance,
      totalPayable,
      receivedAmount,
      creditsAdjusted,
      netPayable,
      totalInWords: numberToWords(netPayable),
    };
  }

  async finalizeInvoice(input: {
    clinicId: string;
    dateFrom: Date;
    dateTo: Date;
    periodType: BillingPeriodType;
    receivedAmount?: number;
    creditsAdjusted?: number;
    roundOff?: number;
    isPaid?: boolean;
  }) {
    const {
      clinicId,
      dateFrom,
      dateTo,
      periodType,
      receivedAmount = 0,
      creditsAdjusted = 0,
      roundOff = 0,
      isPaid = false,
    } = input;

    return prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.findFirst({
        where: { id: clinicId, isActive: true },
      });
      if (!clinic) throw new Error('Clinic not found');

      const periodLabel = buildPeriodLabel(dateFrom, dateTo, periodType);
      // Do not require at most one invoice per period label. Additional invoices are allowed when
      // new order lines appear; order lines already on a non-cancelled invoice are excluded in buildLinesWithTx.

      const lines = await this.buildLinesWithTx(tx, clinicId, dateFrom, dateTo);
      if (!lines.length) {
        throw new Error(
          'No unbilled order lines for the selected date range. There may be no orders in range, or every line may already be on a non-cancelled invoice.'
        );
      }
      const invoiceSubtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
      const isFirst = await this.isFirstNonCancelledInvoiceForClinic(clinicId, tx);
      const currentPending = roundMoney(toNumber(clinic.pendingBalance));
      const previousBalance = this.resolvePreviousBalanceForInvoice(isFirst, currentPending);
      const totalPayable = roundMoney(invoiceSubtotal + roundOff + previousBalance);
      const recv = roundMoney(Math.max(0, receivedAmount));
      const cred = roundMoney(Math.max(0, creditsAdjusted));
      const netPayable = roundMoney(totalPayable - recv - cred);

      const invoiceDate = new Date();
      const invoiceNumber = await nextInvoiceNumberWithTx(tx, invoiceDate);

      const inv = await tx.billingInvoice.create({
        data: {
          clinicId,
          invoiceNumber,
          periodType,
          periodLabel,
          dateFrom,
          dateTo,
          invoiceDate,
          roundOff: new Prisma.Decimal(roundOff),
          invoiceSubtotal: new Prisma.Decimal(invoiceSubtotal),
          previousBalance: new Prisma.Decimal(previousBalance),
          totalPayable: new Prisma.Decimal(totalPayable),
          receivedAmount: new Prisma.Decimal(recv),
          creditsAdjusted: new Prisma.Decimal(cred),
          netPayable: new Prisma.Decimal(netPayable),
          totalInWords: numberToWords(netPayable),
          isPaid,
          paidAt: isPaid ? new Date() : null,
          lines: {
            create: lines.map((l) => ({
              orderId: l.orderId,
              orderProductId: l.orderProductId,
              voucherNo: l.voucherNo,
              deliveryDate: l.deliveryDate,
              patientName: l.patientName,
              productDescription: l.productDescription,
              toothNo: l.toothNo || null,
              unit: l.unit,
              ratePerUnit: new Prisma.Decimal(l.ratePerUnit),
              discountRate: new Prisma.Decimal(l.discountRate),
              lineTotal: new Prisma.Decimal(l.lineTotal),
              sortOrder: l.sortOrder,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.billingLedgerEntry.create({
        data: {
          clinicId,
          invoiceId: inv.id,
          entryType: BillingLedgerEntryType.INVOICE,
          description: `Tax invoice ${invoiceNumber} (${periodLabel})`,
          amount: new Prisma.Decimal(invoiceSubtotal),
        },
      });

      if (recv > 0) {
        await tx.billingLedgerEntry.create({
          data: {
            clinicId,
            invoiceId: inv.id,
            entryType: BillingLedgerEntryType.PAYMENT,
            description: `Payment received against ${invoiceNumber}`,
            amount: new Prisma.Decimal(-recv),
          },
        });
      }

      if (cred > 0) {
        await tx.billingLedgerEntry.create({
          data: {
            clinicId,
            invoiceId: inv.id,
            entryType: BillingLedgerEntryType.CREDIT_ADJUSTMENT,
            description: `Credits adjusted against ${invoiceNumber}`,
            amount: new Prisma.Decimal(-cred),
          },
        });
      }

      // Carry forward: first invoice may include opening balance (> 0 only); later invoices bill new charges only.
      const newPending = roundMoney(currentPending - recv - cred + invoiceSubtotal + roundOff);
      await tx.clinic.update({
        where: { id: clinicId },
        data: { pendingBalance: new Prisma.Decimal(newPending) },
      });

      return this.getInvoiceByIdWithTx(tx, inv.id);
    });
  }

  private async buildLinesWithTx(
    tx: Prisma.TransactionClient,
    clinicId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<InvoiceLineDraft[]> {
    const billedKeys = await this.getActiveBilledOrderProductKeys(clinicId, tx);

    const orders = await tx.order.findMany({
      where: {
        clinicId,
        estimateDate: { gte: dateFrom, lte: dateTo },
      },
      include: {
        patient: true,
        orderProducts: { include: { product: true } },
      },
      orderBy: { estimateDate: 'asc' },
    });

    let sortOrder = 0;
    const lines: InvoiceLineDraft[] = [];
    for (const order of orders) {
      for (const op of order.orderProducts) {
        if (billedKeys.has(`${order.id}::${op.id}`)) {
          continue;
        }
        const opRow = op as any;
        const unit = countUnits(op.unitNumbers);
        const rate =
          opRow.unitPrice != null ? toNumber(opRow.unitPrice) : toNumber(op.product.price);
        const discountPct =
          opRow.discountPercent != null
            ? toNumber(opRow.discountPercent)
            : toNumber(op.product.discount);
        const gross = unit * rate;
        const discountAmt = roundMoney((gross * discountPct) / 100);
        const lineTotal = roundMoney(gross - discountAmt);
        const desc = [op.product.name, op.workType].filter(Boolean).join(' — ') || op.product.name;
        lines.push({
          orderId: order.id,
          orderProductId: op.id,
          voucherNo: order.invoiceNumber,
          deliveryDate: order.estimateDate,
          patientName: order.patient.name,
          productDescription: desc,
          toothNo: op.unitNumbers || '',
          unit,
          ratePerUnit: rate,
          discountRate: discountAmt,
          lineTotal,
          sortOrder: sortOrder++,
        });
      }
    }
    return lines;
  }

  async cancelInvoice(invoiceId: string) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.billingInvoice.findUnique({
        where: { id: invoiceId },
        include: { clinic: true },
      });
      if (!inv) throw new Error('Invoice not found');
      if (inv.cancelledAt) throw new Error('Invoice is already cancelled');

      const recv = roundMoney(toNumber(inv.receivedAmount));
      const cred = roundMoney(toNumber(inv.creditsAdjusted));
      if (inv.isPaid || recv > 0 || cred > 0) {
        throw new Error(
          'Cannot cancel an invoice that has payments or credits recorded against it.'
        );
      }

      const newerOpen = await tx.billingInvoice.findFirst({
        where: {
          clinicId: inv.clinicId,
          cancelledAt: null,
          id: { not: inv.id },
          createdAt: { gt: inv.createdAt },
        },
        select: { invoiceNumber: true },
      });
      if (newerOpen) {
        throw new Error(
          `Cannot cancel this invoice while a newer invoice exists (${newerOpen.invoiceNumber}). Cancel newer invoices first.`
        );
      }

      const net = roundMoney(toNumber(inv.netPayable));
      const prevBal = roundMoney(toNumber(inv.previousBalance));
      const clinic = await tx.clinic.findUnique({ where: { id: inv.clinicId } });
      if (!clinic) throw new Error('Clinic not found');
      const currentPending = roundMoney(toNumber(clinic.pendingBalance));
      const newPending = roundMoney(currentPending - net + prevBal);

      await tx.billingLedgerEntry.create({
        data: {
          clinicId: inv.clinicId,
          invoiceId: inv.id,
          entryType: BillingLedgerEntryType.MANUAL,
          description: `Invoice ${inv.invoiceNumber} cancelled (period ${inv.periodLabel})`,
          amount: new Prisma.Decimal(-roundMoney(toNumber(inv.invoiceSubtotal))),
        },
      });

      await tx.billingInvoice.update({
        where: { id: invoiceId },
        data: { cancelledAt: new Date() },
      });

      await tx.clinic.update({
        where: { id: inv.clinicId },
        data: { pendingBalance: new Prisma.Decimal(newPending) },
      });

      return this.getInvoiceByIdWithTx(tx, invoiceId);
    });
  }

  async updateInvoicePayment(
    invoiceId: string,
    input: { receivedAmount: number; creditsAdjusted: number; isPaid: boolean }
  ) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.billingInvoice.findUnique({
        where: { id: invoiceId },
        include: { clinic: true },
      });
      if (!inv) throw new Error('Invoice not found');
      if (inv.cancelledAt) throw new Error('Cannot update payment on a cancelled invoice');

      const oldNet = roundMoney(toNumber(inv.netPayable));
      const totalPayable = roundMoney(toNumber(inv.totalPayable));
      const recv = roundMoney(Math.max(0, input.receivedAmount));
      const cred = roundMoney(Math.max(0, input.creditsAdjusted));
      const newNet = roundMoney(totalPayable - recv - cred);

      const clinicId = inv.clinicId;
      const clinic = await tx.clinic.findUnique({ where: { id: clinicId } });
      if (!clinic) throw new Error('Clinic not found');

      const currentPending = roundMoney(toNumber(clinic.pendingBalance));
      const pendingDelta = newNet - oldNet;
      const newPending = roundMoney(currentPending + pendingDelta);

      await tx.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          receivedAmount: new Prisma.Decimal(recv),
          creditsAdjusted: new Prisma.Decimal(cred),
          netPayable: new Prisma.Decimal(newNet),
          totalInWords: numberToWords(newNet),
          isPaid: input.isPaid,
          paidAt: input.isPaid ? new Date() : null,
        },
      });

      const recvDelta = recv - roundMoney(toNumber(inv.receivedAmount));
      const credDelta = cred - roundMoney(toNumber(inv.creditsAdjusted));

      if (recvDelta !== 0) {
        await tx.billingLedgerEntry.create({
          data: {
            clinicId,
            invoiceId,
            entryType: BillingLedgerEntryType.PAYMENT,
            description:
              recvDelta > 0
                ? `Additional payment on invoice ${inv.invoiceNumber}`
                : `Payment adjustment on invoice ${inv.invoiceNumber}`,
            amount: new Prisma.Decimal(-recvDelta),
          },
        });
      }

      if (credDelta !== 0) {
        await tx.billingLedgerEntry.create({
          data: {
            clinicId,
            invoiceId,
            entryType: BillingLedgerEntryType.CREDIT_ADJUSTMENT,
            description: `Credit adjustment on invoice ${inv.invoiceNumber}`,
            amount: new Prisma.Decimal(-credDelta),
          },
        });
      }

      await tx.clinic.update({
        where: { id: clinicId },
        data: { pendingBalance: new Prisma.Decimal(newPending) },
      });

      return this.getInvoiceByIdWithTx(tx, invoiceId);
    });
  }

  /**
   * Apply a rupee payment to one invoice (partial or full), ledger + clinic pending.
   */
  private async applyRupeesToInvoiceInTx(
    tx: Prisma.TransactionClient,
    inv: any,
    payRupees: number,
    ledgerDescription: string
  ) {
    const pay = roundMoney(Math.max(0, payRupees));
    if (pay <= 0) return 0;
    const oldNet = roundMoney(toNumber(inv.netPayable));
    const apply = roundMoney(Math.min(pay, oldNet));
    if (apply <= 0) return 0;
    const currentReceived = roundMoney(toNumber(inv.receivedAmount));
    const currentCredits = roundMoney(toNumber(inv.creditsAdjusted));
    const totalPayable = roundMoney(toNumber(inv.totalPayable));
    const newReceived = roundMoney(currentReceived + apply);
    const newNet = roundMoney(totalPayable - newReceived - currentCredits);

    await tx.billingInvoice.update({
      where: { id: inv.id },
      data: {
        receivedAmount: new Prisma.Decimal(newReceived),
        netPayable: new Prisma.Decimal(newNet),
        totalInWords: numberToWords(newNet),
        isPaid: newNet <= 0,
        paidAt: newNet <= 0 ? new Date() : null,
      },
    });

    const clinic = await tx.clinic.findUnique({ where: { id: inv.clinicId } });
    if (!clinic) throw new Error('Clinic not found');
    const currentPending = roundMoney(toNumber(clinic.pendingBalance));
    const newPending = roundMoney(currentPending - apply);
    await tx.billingLedgerEntry.create({
      data: {
        clinicId: inv.clinicId,
        invoiceId: inv.id,
        entryType: BillingLedgerEntryType.PAYMENT,
        description: ledgerDescription,
        amount: new Prisma.Decimal(-apply),
      },
    });
    await tx.clinic.update({
      where: { id: inv.clinicId },
      data: { pendingBalance: new Prisma.Decimal(newPending) },
    });
    return apply;
  }

  async createRazorpayOrderForInvoice(invoiceId: string, amountRupees?: number) {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        clinic: {
          select: { id: true, clinicName: true, organizationId: true },
        },
      },
    });
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.cancelledAt) throw new Error('Cannot collect payment on a cancelled invoice');

    const maxPay = roundMoney(toNumber(invoice.netPayable));
    if (maxPay <= 0) {
      throw new Error('Invoice has no outstanding balance to collect.');
    }
    const requested =
      amountRupees != null && Number.isFinite(Number(amountRupees))
        ? roundMoney(Math.min(Math.max(0, Number(amountRupees)), maxPay))
        : maxPay;
    if (requested <= 0) {
      throw new Error('Payment amount must be positive.');
    }

    const amountInPaise = Math.round(requested * 100);
    const receipt = `invoice_${invoice.id.slice(0, 10)}_${Date.now()}`;
    const order = await razorpayService.createOrder({
      amountInPaise,
      receipt,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: String(invoice.invoiceNumber),
        clinicId: invoice.clinicId,
        kind: 'SINGLE',
      },
    });

    return {
      keyId: razorpayService.keyId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clinicName: invoice.clinic.clinicName,
      amount: requested,
      amountInPaise,
      currency: order.currency,
      orderId: order.id,
      description: `Invoice ${invoice.invoiceNumber} payment`,
    };
  }

  async verifyRazorpayInvoicePayment(input: {
    invoiceId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const isValid = razorpayService.verifyPaymentSignature({
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
    });
    if (!isValid) {
      throw new Error('Invalid Razorpay payment signature.');
    }

    const order = (await razorpayService.fetchOrder(input.razorpayOrderId)) as {
      amount: number;
      notes?: Record<string, string> | null;
    };
    const orderRupees = roundMoney(order.amount / 100);

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.billingInvoice.findUnique({
        where: { id: input.invoiceId },
      });
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.cancelledAt) throw new Error('Cannot verify payment on a cancelled invoice');

      const alreadyRecorded = await tx.billingLedgerEntry.findFirst({
        where: {
          clinicId: invoice.clinicId,
          entryType: BillingLedgerEntryType.PAYMENT,
          description: { contains: input.razorpayPaymentId, mode: 'insensitive' },
        },
      });
      if (alreadyRecorded) {
        return {
          ...(await this.getInvoiceByIdWithTx(tx, invoice.id)),
          paymentStatus: 'ALREADY_PROCESSED',
        };
      }

      const oldNet = roundMoney(toNumber(invoice.netPayable));
      if (oldNet <= 0) {
        return {
          ...(await this.getInvoiceByIdWithTx(tx, invoice.id)),
          paymentStatus: 'ALREADY_SETTLED',
        };
      }

      const toApply = roundMoney(Math.min(orderRupees, oldNet));
      await this.applyRupeesToInvoiceInTx(
        tx,
        invoice,
        toApply,
        `Razorpay payment captured (${input.razorpayPaymentId}) for invoice ${invoice.invoiceNumber}`
      );

      return {
        ...(await this.getInvoiceByIdWithTx(tx, invoice.id)),
        paymentStatus: 'PAID',
      };
    });
  }

  async recordCashPaymentOnInvoice(invoiceId: string, amount: number) {
    const pay = roundMoney(Math.max(0, Number(amount) || 0));
    if (pay <= 0) throw new Error('Amount must be positive');
    return prisma.$transaction(async (tx) => {
      const inv = await tx.billingInvoice.findUnique({ where: { id: invoiceId } });
      if (!inv) throw new Error('Invoice not found');
      if (inv.cancelledAt) throw new Error('Cannot pay a cancelled invoice');
      const before = roundMoney(toNumber(inv.netPayable));
      if (before <= 0) throw new Error('Nothing due on this invoice');
      if (pay > before) {
        throw new Error(`Amount cannot exceed outstanding (₹${before.toFixed(2)})`);
      }
      await this.applyRupeesToInvoiceInTx(
        tx,
        inv,
        pay,
        `Cash payment for invoice ${inv.invoiceNumber}`
      );
      return this.getInvoiceByIdWithTx(tx, invoiceId);
    });
  }

  async suggestAmountFromLineIds(invoiceId: string, lineIds: string[]) {
    if (!lineIds.length) {
      return { amount: 0, cappedAtNet: 0, lineCount: 0 };
    }
    const inv = await prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { where: { id: { in: lineIds } } } },
    });
    if (!inv) throw new Error('Invoice not found');
    if (inv.cancelledAt) throw new Error('Invalid invoice');
    if (inv.lines.length !== lineIds.length) {
      throw new Error('One or more line items do not belong to this invoice');
    }
    const sum = roundMoney(
      inv.lines.reduce((s, l) => s + toNumber((l as any).lineTotal), 0)
    );
    const net = roundMoney(toNumber(inv.netPayable));
    const capped = roundMoney(Math.min(sum, net));
    return { amount: capped, cappedAtNet: net, lineCount: inv.lines.length };
  }

  async listOpenInvoicesForClinic(clinicId: string) {
    const rows = await prisma.billingInvoice.findMany({
      where: {
        clinicId,
        cancelledAt: null,
        netPayable: { gt: 0 },
      },
      orderBy: FIFO_OPEN_INVOICE_ORDER,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dateFrom: true,
        periodLabel: true,
        netPayable: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.invoiceDate.toISOString(),
      dateFrom: r.dateFrom.toISOString(),
      periodLabel: r.periodLabel,
      netPayable: toNumber(r.netPayable),
    }));
  }

  /**
   * Distribute a cash payment (FIFO) across many open invoices for a clinic in one transaction.
   */
  async recordClinicMultiCashPayment(
    clinicId: string,
    input: { mode: 'PENDING_TOTAL' | 'SELECTED' | 'CUSTOM'; amount?: number; invoiceIds?: string[] }
  ) {
    return prisma.$transaction(async (tx) => {
      const { payAmount, rows } = await this.resolveClinicPayRows(tx, clinicId, input);
      if (payAmount <= 0) throw new Error('Nothing to pay');
      let rem = payAmount;
      for (const inv of rows) {
        if (rem <= 0) break;
        const invRow = await tx.billingInvoice.findUnique({ where: { id: inv.id } });
        if (!invRow) continue;
        const net = roundMoney(toNumber(invRow.netPayable));
        if (net <= 0) continue;
        const part = roundMoney(Math.min(net, rem));
        await this.applyRupeesToInvoiceInTx(
          tx,
          invRow,
          part,
          `Clinic multi cash payment (invoice ${invRow.invoiceNumber})`
        );
        rem = roundMoney(rem - part);
      }
      return { paidTotal: roundMoney(payAmount - rem), targetAmount: payAmount };
    });
  }

  private async resolveClinicPayRows(
    tx: Prisma.TransactionClient,
    clinicId: string,
    input: { mode: 'PENDING_TOTAL' | 'SELECTED' | 'CUSTOM'; amount?: number; invoiceIds?: string[] }
  ) {
    const allOpen = await tx.billingInvoice.findMany({
      where: { clinicId, cancelledAt: null, netPayable: { gt: 0 } },
      orderBy: FIFO_OPEN_INVOICE_ORDER,
    });
    if (!allOpen.length) {
      return { payAmount: 0, rows: [] as { id: string }[] };
    }
    if (input.mode === 'PENDING_TOTAL') {
      const totalDue = roundMoney(
        allOpen.reduce((s, i) => s + toNumber(i.netPayable), 0)
      );
      const cap = input.amount != null ? roundMoney(Math.min(Number(input.amount), totalDue)) : totalDue;
      return { payAmount: cap, rows: allOpen.map((i) => ({ id: i.id })) };
    }
    if (input.mode === 'SELECTED' && input.invoiceIds?.length) {
      const set = new Set(input.invoiceIds);
      const rows = allOpen.filter((i) => set.has(i.id));
      if (!rows.length) throw new Error('No valid open invoice was selected');
      const sumSel = roundMoney(rows.reduce((s, i) => s + toNumber(i.netPayable), 0));
      const cap =
        input.amount != null
          ? roundMoney(Math.min(Number(input.amount), sumSel))
          : sumSel;
      return { payAmount: cap, rows: rows.map((i) => ({ id: i.id })) };
    }
    if (input.mode === 'CUSTOM' && input.amount != null) {
      const totalDue = roundMoney(
        allOpen.reduce((s, i) => s + toNumber(i.netPayable), 0)
      );
      const cap = roundMoney(Math.min(Math.max(0, Number(input.amount)), totalDue));
      return { payAmount: cap, rows: allOpen.map((i) => ({ id: i.id })) };
    }
    throw new Error('Invalid payment mode or missing amount/invoice list');
  }

  async createRazorpayOrderForClinic(
    clinicId: string,
    input: { mode: 'PENDING_TOTAL' | 'SELECTED' | 'CUSTOM'; amount?: number; invoiceIds?: string[] }
  ) {
    const { payAmount } = await prisma.$transaction((tx) =>
      this.resolveClinicPayRows(tx, clinicId, input)
    );
    if (payAmount <= 0) throw new Error('Nothing to pay for this selection');
    const amountInPaise = Math.round(payAmount * 100);
    const receipt = `clinic_${clinicId.slice(0, 8)}_${Date.now()}`;
    const includeIds =
      input.mode === 'SELECTED' && input.invoiceIds?.length
        ? input.invoiceIds.join(',')
        : 'ALL';
    const order = await razorpayService.createOrder({
      amountInPaise,
      receipt,
      notes: {
        clinicId,
        kind: 'BULK',
        mode: String(input.mode),
        includeIds: includeIds.length > 200 ? `${includeIds.slice(0, 200)}` : includeIds,
      },
    });
    return {
      keyId: razorpayService.keyId,
      clinicId,
      amount: payAmount,
      amountInPaise,
      currency: order.currency,
      orderId: order.id,
      description: 'Clinic payment (one or more invoices)',
    };
  }

  async verifyRazorpayClinicPayment(input: {
    clinicId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    if (
      !razorpayService.verifyPaymentSignature({
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
      })
    ) {
      throw new Error('Invalid Razorpay payment signature.');
    }
    const order = (await razorpayService.fetchOrder(input.razorpayOrderId)) as {
      amount: number;
      notes?: { includeIds?: string } | null;
    };
    const orderRupees = roundMoney(order.amount / 100);
    if (orderRupees <= 0) throw new Error('Invalid order amount');
    return prisma.$transaction(async (tx) => {
      const dupe = await tx.billingLedgerEntry.findFirst({
        where: {
          clinicId: input.clinicId,
          entryType: BillingLedgerEntryType.PAYMENT,
          description: { contains: input.razorpayPaymentId, mode: 'insensitive' },
        },
      });
      if (dupe) {
        return { ok: true, paymentStatus: 'ALREADY_PROCESSED' as const, paidTotal: 0 };
      }
      const allOpen = await tx.billingInvoice.findMany({
        where: { clinicId: input.clinicId, cancelledAt: null, netPayable: { gt: 0 } },
        orderBy: FIFO_OPEN_INVOICE_ORDER,
      });
      const rawIds = order.notes?.includeIds;
      let open = allOpen;
      if (rawIds && rawIds !== 'ALL' && String(rawIds).trim()) {
        const set = new Set(
          String(rawIds)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        );
        open = allOpen.filter((i) => set.has(i.id));
      }
      let rem = orderRupees;
      for (const inv0 of open) {
        if (rem <= 0) break;
        const inv = await tx.billingInvoice.findUnique({ where: { id: inv0.id } });
        if (!inv) continue;
        const net = roundMoney(toNumber(inv.netPayable));
        if (net <= 0) continue;
        const part = roundMoney(Math.min(net, rem));
        await this.applyRupeesToInvoiceInTx(
          tx,
          inv,
          part,
          `Razorpay payment (${input.razorpayPaymentId}) for invoice ${inv.invoiceNumber} (clinic pool)`
        );
        rem = roundMoney(rem - part);
      }
      return { ok: true, paymentStatus: 'APPLIED' as const, paidTotal: roundMoney(orderRupees - rem) };
    });
  }

  async listLedger(clinicId: string, take = 100) {
    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, isActive: true },
    });
    if (!clinic) throw new Error('Clinic not found');

    const entries = await prisma.billingLedgerEntry.findMany({
      where: {
        clinicId,
        entryType: {
          in: [...BillingService.ledgerEntryTypes()],
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { invoice: { select: { invoiceNumber: true } } },
    });

    return {
      clinicId,
      pendingBalance: roundMoney(toNumber(clinic.pendingBalance)),
      entries: entries.map((e) => BillingService.mapLedgerEntry(e)),
    };
  }

  async clinicSummary(clinicId: string) {
    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, isActive: true },
      select: { id: true },
    });
    if (!clinic) throw new Error('Clinic not found');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const z = new Prisma.Decimal(0);
    const [
      totalOrders,
      todayOrders,
      totalRevenueAgg,
      todayRevenueAgg,
      paidInvoices,
      pendingInvoices,
      cashPaymentsAgg,
      onlinePaymentsAgg,
    ] = await Promise.all([
      prisma.order.count({ where: { clinicId, isActive: true } }),
      prisma.order.count({
        where: {
          clinicId,
          isActive: true,
          createdAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.billingInvoice.aggregate({
        where: { clinicId, cancelledAt: null },
        _sum: { receivedAmount: true },
      }),
      prisma.billingInvoice.aggregate({
        where: {
          clinicId,
          cancelledAt: null,
          invoiceDate: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { receivedAmount: true },
      }),
      prisma.billingInvoice.count({
        where: { clinicId, isPaid: true, cancelledAt: null },
      }),
      prisma.billingInvoice.count({
        where: {
          clinicId,
          cancelledAt: null,
          OR: [{ isPaid: false }, { netPayable: { gt: 0 } }],
        },
      }),
      prisma.billingLedgerEntry.aggregate({
        where: {
          clinicId,
          entryType: BillingLedgerEntryType.PAYMENT,
          amount: { lt: z },
          NOT: {
            description: { contains: 'Razorpay', mode: 'insensitive' },
          },
        },
        _sum: { amount: true },
      }),
      prisma.billingLedgerEntry.aggregate({
        where: {
          clinicId,
          entryType: BillingLedgerEntryType.PAYMENT,
          amount: { lt: z },
          description: { contains: 'Razorpay', mode: 'insensitive' },
        },
        _sum: { amount: true },
      }),
    ]);

    const paidCashFromLedger = roundMoney(Math.abs(toNumber(cashPaymentsAgg._sum.amount)));
    const paidOnlineFromLedger = roundMoney(Math.abs(toNumber(onlinePaymentsAgg._sum.amount)));

    return {
      clinicId,
      totalRevenue: roundMoney(toNumber(totalRevenueAgg._sum.receivedAmount)),
      todayRevenue: roundMoney(toNumber(todayRevenueAgg._sum.receivedAmount)),
      totalOrders,
      todayOrders,
      paidInvoices,
      pendingInvoices,
      /** Sum of PAYMENT ledger rows not attributed to Razorpay (cash, counter, finalize-at-issue, etc.). */
      paidCashFromLedger,
      /** Sum of PAYMENT ledger rows with Razorpay in the description (online). */
      paidOnlineFromLedger,
    };
  }

  /** Aggregated billing stats across all active clinics (for Billing Management “All”). */
  async allClinicsBillingSummary() {
    const z = new Prisma.Decimal(0);
    const [pendingBalanceAgg, totalRevenueAgg, cashPaymentsAgg, onlinePaymentsAgg] = await Promise.all([
      prisma.clinic.aggregate({
        where: { isActive: true },
        _sum: { pendingBalance: true },
      }),
      prisma.billingInvoice.aggregate({
        where: { cancelledAt: null },
        _sum: { receivedAmount: true },
      }),
      prisma.billingLedgerEntry.aggregate({
        where: {
          entryType: BillingLedgerEntryType.PAYMENT,
          amount: { lt: z },
          NOT: {
            description: { contains: 'Razorpay', mode: 'insensitive' },
          },
        },
        _sum: { amount: true },
      }),
      prisma.billingLedgerEntry.aggregate({
        where: {
          entryType: BillingLedgerEntryType.PAYMENT,
          amount: { lt: z },
          description: { contains: 'Razorpay', mode: 'insensitive' },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      pendingBalance: roundMoney(toNumber(pendingBalanceAgg._sum.pendingBalance)),
      totalRevenue: roundMoney(toNumber(totalRevenueAgg._sum.receivedAmount)),
      paidCashFromLedger: roundMoney(Math.abs(toNumber(cashPaymentsAgg._sum.amount))),
      paidOnlineFromLedger: roundMoney(Math.abs(toNumber(onlinePaymentsAgg._sum.amount))),
    };
  }

  async overallSummary() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [
      totalOrders,
      todayOrders,
      totalRevenueAgg,
      todayRevenueAgg,
      paidInvoices,
      pendingInvoices,
    ] = await Promise.all([
      prisma.order.count({ where: { isActive: true } }),
      prisma.order.count({
        where: {
          isActive: true,
          createdAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.billingInvoice.aggregate({
        where: { cancelledAt: null },
        _sum: { receivedAmount: true },
      }),
      prisma.billingInvoice.aggregate({
        where: {
          cancelledAt: null,
          invoiceDate: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { receivedAmount: true },
      }),
      prisma.billingInvoice.count({
        where: { isPaid: true, cancelledAt: null },
      }),
      prisma.billingInvoice.count({
        where: {
          cancelledAt: null,
          OR: [{ isPaid: false }, { netPayable: { gt: 0 } }],
        },
      }),
    ]);

    return {
      totalRevenue: roundMoney(toNumber(totalRevenueAgg._sum.receivedAmount)),
      todayRevenue: roundMoney(toNumber(todayRevenueAgg._sum.receivedAmount)),
      totalOrders,
      todayOrders,
      paidInvoices,
      pendingInvoices,
    };
  }

  /**
   * Invoices with amount still due (not cancelled, netPayable is greater than 0).
   * Oldest invoice date first = longest-outstanding (long overdue). Used for admin dashboard.
   */
  async listPendingInvoices(take = 20) {
    const safeTake = Math.min(100, Math.max(1, take));
    const rows = await prisma.billingInvoice.findMany({
      where: {
        cancelledAt: null,
        netPayable: { gt: 0 },
      },
      orderBy: { invoiceDate: 'asc' },
      take: safeTake,
      include: {
        clinic: { select: { id: true, clinicName: true, organizationId: true } },
      },
    });
    return rows.map((i) => ({
      id: i.id,
      clinicId: i.clinicId,
      clinicName: i.clinic.clinicName,
      organizationId: i.clinic.organizationId,
      invoiceNumber: i.invoiceNumber,
      periodLabel: i.periodLabel,
      periodType: i.periodType,
      invoiceDate: i.invoiceDate.toISOString(),
      netPayable: toNumber(i.netPayable),
      isPaid: i.isPaid,
    }));
  }

  /** @see listInvoices */
  static buildClinicInvoiceListWhere(
    clinicId: string,
    status: 'all' | 'open' | 'partial' | 'paid' | 'cancelled'
  ): Prisma.BillingInvoiceWhereInput {
    return BillingService.buildInvoiceListWhere(status, clinicId);
  }

  static buildInvoiceListWhere(
    status: 'all' | 'open' | 'partial' | 'paid' | 'cancelled',
    clinicId?: string
  ): Prisma.BillingInvoiceWhereInput {
    const z = new Prisma.Decimal(0);
    const base: Prisma.BillingInvoiceWhereInput = clinicId
      ? { clinicId }
      : { clinic: { isActive: true } };
    switch (status) {
      case 'all':
        return base;
      case 'cancelled':
        return { ...base, cancelledAt: { not: null } };
      case 'paid':
        return { ...base, cancelledAt: null, isPaid: true };
      case 'open':
        return {
          ...base,
          cancelledAt: null,
          isPaid: false,
          netPayable: { gt: z },
          receivedAmount: { equals: z },
          creditsAdjusted: { equals: z },
        };
      case 'partial':
        return {
          ...base,
          cancelledAt: null,
          isPaid: false,
          netPayable: { gt: z },
          OR: [{ receivedAmount: { gt: z } }, { creditsAdjusted: { gt: z } }],
        };
      default:
        return base;
    }
  }

  private static ledgerEntryTypes() {
    return [
      BillingLedgerEntryType.PAYMENT,
      BillingLedgerEntryType.CREDIT_ADJUSTMENT,
      BillingLedgerEntryType.MANUAL,
    ] as const;
  }

  private static mapLedgerEntry(e: {
    id: string;
    createdAt: Date;
    entryType: BillingLedgerEntryType;
    description: string;
    amount: Prisma.Decimal | number;
    clinicId: string;
    clinic?: { clinicName: string; organizationId: string };
    invoice?: { invoiceNumber: string | null } | null;
  }) {
    return {
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      entryType: e.entryType,
      description: e.description,
      amount: toNumber(e.amount),
      invoiceNumber: e.invoice?.invoiceNumber ?? null,
      clinicId: e.clinicId,
      clinicName: e.clinic?.clinicName ?? null,
      organizationId: e.clinic?.organizationId ?? null,
    };
  }

  async listAllLedger(take = 100, skip = 0) {
    const safeTake = Math.min(500, Math.max(1, take));
    const safeSkip = Math.max(0, skip);
    const where = {
      clinic: { isActive: true },
      entryType: { in: [...BillingService.ledgerEntryTypes()] },
    };
    const [entries, total] = await Promise.all([
      prisma.billingLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: safeSkip,
        take: safeTake,
        include: {
          invoice: { select: { invoiceNumber: true } },
          clinic: { select: { id: true, clinicName: true, organizationId: true } },
        },
      }),
      prisma.billingLedgerEntry.count({ where }),
    ]);

    return {
      entries: entries.map((e) => BillingService.mapLedgerEntry(e)),
      total,
    };
  }

  async listAllInvoices(
    options: {
      take?: number;
      skip?: number;
      status?: 'all' | 'open' | 'partial' | 'paid' | 'cancelled';
    } = {}
  ) {
    const take = Math.min(100, Math.max(1, options.take ?? 50));
    const skip = Math.max(0, options.skip ?? 0);
    const status = options.status ?? 'all';
    const where = BillingService.buildInvoiceListWhere(status);

    const include = {
      clinic: { select: { id: true, clinicName: true, organizationId: true } },
      lines: {
        select: {
          orderId: true,
        },
      },
    } as const;

    const [list, total] = await Promise.all([
      prisma.billingInvoice.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip,
        take,
        include,
      }),
      prisma.billingInvoice.count({ where }),
    ]);

    const data = list.map((i) => ({
      id: i.id,
      clinicId: i.clinicId,
      clinicName: i.clinic.clinicName,
      organizationId: i.clinic.organizationId,
      invoiceNumber: i.invoiceNumber,
      periodLabel: i.periodLabel,
      periodType: i.periodType,
      invoiceDate: i.invoiceDate.toISOString(),
      invoiceSubtotal: toNumber(i.invoiceSubtotal),
      previousBalance: toNumber(i.previousBalance),
      totalPayable: toNumber(i.totalPayable),
      receivedAmount: toNumber(i.receivedAmount),
      creditsAdjusted: toNumber(i.creditsAdjusted),
      netPayable: toNumber(i.netPayable),
      isPaid: i.isPaid,
      cancelledAt: i.cancelledAt ? i.cancelledAt.toISOString() : null,
      orderCount: new Set(i.lines.map((l) => l.orderId).filter(Boolean)).size,
      lineCount: i.lines.length,
    }));

    return { data, total };
  }

  async allClinicsInvoiceStatusCounts() {
    const [open, partial, paid, cancelled] = await Promise.all([
      prisma.billingInvoice.count({
        where: BillingService.buildInvoiceListWhere('open'),
      }),
      prisma.billingInvoice.count({
        where: BillingService.buildInvoiceListWhere('partial'),
      }),
      prisma.billingInvoice.count({
        where: BillingService.buildInvoiceListWhere('paid'),
      }),
      prisma.billingInvoice.count({
        where: BillingService.buildInvoiceListWhere('cancelled'),
      }),
    ]);

    return { open, partial, paid, cancelled };
  }

  async listInvoices(
    clinicId: string,
    options: {
      take?: number;
      skip?: number;
      status?: 'all' | 'open' | 'partial' | 'paid' | 'cancelled';
    } = {}
  ) {
    const take = Math.min(100, Math.max(1, options.take ?? 50));
    const skip = Math.max(0, options.skip ?? 0);
    const status = options.status ?? 'all';

    const where = BillingService.buildClinicInvoiceListWhere(clinicId, status);

    const include = {
      lines: {
        select: {
          orderId: true,
        },
      },
    } as const;

    const [list, total] = await Promise.all([
      prisma.billingInvoice.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip,
        take,
        include,
      }),
      prisma.billingInvoice.count({ where }),
    ]);

    const data = list.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      periodLabel: i.periodLabel,
      periodType: i.periodType,
      invoiceDate: i.invoiceDate.toISOString(),
      invoiceSubtotal: toNumber(i.invoiceSubtotal),
      previousBalance: toNumber(i.previousBalance),
      totalPayable: toNumber(i.totalPayable),
      receivedAmount: toNumber(i.receivedAmount),
      creditsAdjusted: toNumber(i.creditsAdjusted),
      netPayable: toNumber(i.netPayable),
      isPaid: i.isPaid,
      cancelledAt: i.cancelledAt ? i.cancelledAt.toISOString() : null,
      orderCount: new Set(i.lines.map((l) => l.orderId).filter(Boolean)).size,
      lineCount: i.lines.length,
    }));

    return { data, total };
  }

  /**
   * Four cheap COUNT queries (no line includes) for invoice tab badges.
   * @see buildClinicInvoiceListWhere
   */
  async clinicInvoiceStatusCounts(clinicId: string) {
    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, isActive: true },
      select: { id: true },
    });
    if (!clinic) throw new Error('Clinic not found');

    const [open, partial, paid, cancelled] = await Promise.all([
      prisma.billingInvoice.count({
        where: BillingService.buildClinicInvoiceListWhere(clinicId, 'open'),
      }),
      prisma.billingInvoice.count({
        where: BillingService.buildClinicInvoiceListWhere(clinicId, 'partial'),
      }),
      prisma.billingInvoice.count({
        where: BillingService.buildClinicInvoiceListWhere(clinicId, 'paid'),
      }),
      prisma.billingInvoice.count({
        where: BillingService.buildClinicInvoiceListWhere(clinicId, 'cancelled'),
      }),
    ]);

    return { open, partial, paid, cancelled };
  }

  async getInvoiceDetail(invoiceId: string) {
    const inv = await prisma.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        clinic: true,
      },
    });
    if (!inv) throw new Error('Invoice not found');
    return this.serializeInvoice(inv);
  }

  private async getInvoiceByIdWithTx(tx: Prisma.TransactionClient, invoiceId: string) {
    const inv = await tx.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        clinic: true,
      },
    });
    if (!inv) throw new Error('Invoice not found');
    return this.serializeInvoice(inv);
  }

  private serializeInvoice(inv: any) {
    return {
      company: COMPANY_HEADER,
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      periodType: inv.periodType,
      periodLabel: inv.periodLabel,
      dateFrom: inv.dateFrom.toISOString(),
      dateTo: inv.dateTo.toISOString(),
      invoiceDate: inv.invoiceDate.toISOString(),
      roundOff: toNumber(inv.roundOff),
      invoiceSubtotal: toNumber(inv.invoiceSubtotal),
      previousBalance: toNumber(inv.previousBalance),
      totalPayable: toNumber(inv.totalPayable),
      receivedAmount: toNumber(inv.receivedAmount),
      creditsAdjusted: toNumber(inv.creditsAdjusted),
      netPayable: toNumber(inv.netPayable),
      totalInWords: inv.totalInWords,
      isPaid: inv.isPaid,
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      cancelledAt: inv.cancelledAt ? inv.cancelledAt.toISOString() : null,
      clinic: {
        id: inv.clinic.id,
        clinicName: inv.clinic.clinicName,
        organizationId: inv.clinic.organizationId,
        clientAddress: inv.clinic.clientAddress,
        contactNumber: inv.clinic.contactNumber,
        accountType: 'Ledger Account',
      },
      lines: inv.lines.map((l: any) => ({
        id: l.id,
        voucherNo: l.voucherNo,
        deliveryDate: l.deliveryDate ? l.deliveryDate.toISOString() : null,
        patientName: l.patientName,
        productDescription: l.productDescription,
        toothNo: l.toothNo,
        unit: l.unit,
        ratePerUnit: toNumber(l.ratePerUnit),
        discountRate: toNumber(l.discountRate),
        lineTotal: toNumber(l.lineTotal),
      })),
    };
  }
}

/** Stable 32-bit hash for advisory lock keys (Postgres pg_advisory_xact_lock). */
function hash32ForLock(s: string): [number, number] {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(33, h) + s.charCodeAt(i)) | 0;
  }
  const k1 = h & 0x7fffffff;
  const k2 = (h ^ (h >>> 16) ^ (h << 3)) & 0x7fffffff;
  return [k1, k2];
}

/**
 * Max numeric suffix after `prefix` (e.g. luxur/04/2026/7 -> 7). Handles gaps from
 * deletions; `count + 1` can collide when count is less than the max suffix.
 */
function maxInvoiceSuffixForPrefix(prefix: string, invoiceNumbers: string[]): number {
  let maxN = 0;
  for (const num of invoiceNumbers) {
    if (!num.startsWith(prefix)) continue;
    const tail = num.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }
  return maxN;
}

/**
 * Next invoice number inside a transaction. Uses a transaction-scoped advisory lock
 * so concurrent finalizes cannot both pick the same next number, and max(suffix)+1
 * so numbering stays unique even if older numbers were removed.
 */
async function nextInvoiceNumberWithTx(tx: Prisma.TransactionClient, invoiceDate: Date) {
  const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
  const yyyy = invoiceDate.getFullYear();
  const prefix = `luxur/${mm}/${yyyy}/`;
  const [k1, k2] = hash32ForLock(prefix);
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${k1}::integer, ${k2}::integer)`);
  const rows = await tx.billingInvoice.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true },
  });
  let n = maxInvoiceSuffixForPrefix(
    prefix,
    rows.map((r) => r.invoiceNumber)
  ) + 1;
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const candidate = `${prefix}${n}`;
    const taken = await tx.billingInvoice.findFirst({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    n += 1;
  }
  throw new Error('Could not allocate a unique invoice number for this month');
}
