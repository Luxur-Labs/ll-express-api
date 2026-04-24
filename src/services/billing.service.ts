import { Prisma, BillingPeriodType, BillingLedgerEntryType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { razorpayService } from './razorpay.service';

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
  if (!unitNumbers?.trim()) return 1;
  const nums = unitNumbers.match(/\d+/g);
  if (nums && nums.length > 0) return nums.length;
  return 1;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

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

async function nextInvoiceNumber(invoiceDate: Date): Promise<string> {
  const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
  const yyyy = invoiceDate.getFullYear();
  const prefix = `luxur/${mm}/${yyyy}/`;
  const count = await prisma.billingInvoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${count + 1}`;
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
  async buildLinesForPeriod(
    clinicId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<InvoiceLineDraft[]> {
    const orders = await prisma.order.findMany({
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
    const previousBalance = roundMoney(toNumber(clinic.pendingBalance));
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
        pendingBalance: previousBalance,
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
      const existingForPeriod = await tx.billingInvoice.findFirst({
        where: {
          clinicId,
          periodType,
          periodLabel,
          cancelledAt: null,
        },
        select: { id: true, invoiceNumber: true },
      });
      if (existingForPeriod) {
        throw new Error(
          `Invoice already generated for this clinic and period (${periodLabel}). Existing invoice: ${existingForPeriod.invoiceNumber}`
        );
      }

      const lines = await this.buildLinesWithTx(tx, clinicId, dateFrom, dateTo);
      if (!lines.length) {
        throw new Error('No orders found for the selected period. Invoice was not generated.');
      }
      const invoiceSubtotal = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
      const previousBalance = roundMoney(toNumber(clinic.pendingBalance));
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

      await tx.clinic.update({
        where: { id: clinicId },
        data: { pendingBalance: new Prisma.Decimal(netPayable) },
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

  async createRazorpayOrderForInvoice(invoiceId: string) {
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

    const outstanding = roundMoney(toNumber(invoice.netPayable));
    if (outstanding <= 0) {
      throw new Error('Invoice has no outstanding balance to collect.');
    }

    const amountInPaise = Math.round(outstanding * 100);
    const receipt = `invoice_${invoice.id.slice(0, 10)}_${Date.now()}`;
    const order = await razorpayService.createOrder({
      amountInPaise,
      receipt,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clinicId: invoice.clinicId,
      },
    });

    return {
      keyId: razorpayService.keyId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clinicName: invoice.clinic.clinicName,
      amount: outstanding,
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

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.billingInvoice.findUnique({
        where: { id: input.invoiceId },
      });
      if (!invoice) throw new Error('Invoice not found');
      if (invoice.cancelledAt) throw new Error('Cannot verify payment on a cancelled invoice');

      const alreadyRecorded = await tx.billingLedgerEntry.findFirst({
        where: {
          clinicId: invoice.clinicId,
          invoiceId: invoice.id,
          entryType: BillingLedgerEntryType.PAYMENT,
          description: {
            contains: input.razorpayPaymentId,
            mode: 'insensitive',
          },
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

      const receivedNow = oldNet;
      const currentReceived = roundMoney(toNumber(invoice.receivedAmount));
      const currentCredits = roundMoney(toNumber(invoice.creditsAdjusted));
      const totalPayable = roundMoney(toNumber(invoice.totalPayable));
      const newReceived = roundMoney(currentReceived + receivedNow);
      const newNet = roundMoney(totalPayable - newReceived - currentCredits);

      await tx.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          receivedAmount: new Prisma.Decimal(newReceived),
          netPayable: new Prisma.Decimal(newNet),
          totalInWords: numberToWords(newNet),
          isPaid: newNet <= 0,
          paidAt: newNet <= 0 ? new Date() : null,
        },
      });

      const clinic = await tx.clinic.findUnique({ where: { id: invoice.clinicId } });
      if (!clinic) throw new Error('Clinic not found');
      const currentPending = roundMoney(toNumber(clinic.pendingBalance));
      const newPending = roundMoney(currentPending - receivedNow);

      await tx.billingLedgerEntry.create({
        data: {
          clinicId: invoice.clinicId,
          invoiceId: invoice.id,
          entryType: BillingLedgerEntryType.PAYMENT,
          description: `Razorpay payment captured (${input.razorpayPaymentId}) for invoice ${invoice.invoiceNumber}`,
          amount: new Prisma.Decimal(-receivedNow),
        },
      });

      await tx.clinic.update({
        where: { id: invoice.clinicId },
        data: { pendingBalance: new Prisma.Decimal(newPending) },
      });

      return {
        ...(await this.getInvoiceByIdWithTx(tx, invoice.id)),
        paymentStatus: 'PAID',
      };
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
          in: [
            BillingLedgerEntryType.PAYMENT,
            BillingLedgerEntryType.CREDIT_ADJUSTMENT,
            BillingLedgerEntryType.MANUAL,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { invoice: { select: { invoiceNumber: true } } },
    });

    return {
      clinicId,
      pendingBalance: roundMoney(toNumber(clinic.pendingBalance)),
      entries: entries.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        entryType: e.entryType,
        description: e.description,
        amount: toNumber(e.amount),
        invoiceNumber: e.invoice?.invoiceNumber ?? null,
      })),
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

    const [
      totalOrders,
      todayOrders,
      totalRevenueAgg,
      todayRevenueAgg,
      paidInvoices,
      pendingInvoices,
    ] = await Promise.all([
      prisma.order.count({ where: { clinicId } }),
      prisma.order.count({
        where: {
          clinicId,
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
    ]);

    return {
      clinicId,
      totalRevenue: roundMoney(toNumber(totalRevenueAgg._sum.receivedAmount)),
      todayRevenue: roundMoney(toNumber(todayRevenueAgg._sum.receivedAmount)),
      totalOrders,
      todayOrders,
      paidInvoices,
      pendingInvoices,
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
      prisma.order.count({}),
      prisma.order.count({
        where: {
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

  async listInvoices(clinicId: string, take = 50) {
    const list = await prisma.billingInvoice.findMany({
      where: { clinicId },
      orderBy: { invoiceDate: 'desc' },
      take,
      include: {
        lines: {
          select: {
            orderId: true,
          },
        },
      },
    });
    return list.map((i) => ({
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

async function nextInvoiceNumberWithTx(tx: Prisma.TransactionClient, invoiceDate: Date) {
  const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
  const yyyy = invoiceDate.getFullYear();
  const prefix = `luxur/${mm}/${yyyy}/`;
  const count = await tx.billingInvoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${count + 1}`;
}
