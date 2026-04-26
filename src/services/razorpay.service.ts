import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';

export class RazorpayService {
  private client: Razorpay | null = null;

  get keyId(): string {
    if (!env.RAZORPAY_KEY_ID) {
      throw new Error('Razorpay is not configured. Missing RAZORPAY_KEY_ID.');
    }
    return env.RAZORPAY_KEY_ID;
  }

  private get keySecret(): string {
    if (!env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay is not configured. Missing RAZORPAY_KEY_SECRET.');
    }
    return env.RAZORPAY_KEY_SECRET;
  }

  private getClient(): Razorpay {
    if (!this.client) {
      this.client = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
    }
    return this.client;
  }

  async createOrder(input: {
    amountInPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }) {
    const client = this.getClient();
    return client.orders.create({
      amount: input.amountInPaise,
      currency: input.currency || 'INR',
      receipt: input.receipt,
      notes: input.notes,
    });
  }

  /** Fetch order to read amount in paise (for partial / bulk payment verification). */
  async fetchOrder(orderId: string) {
    const client = this.getClient();
    return client.orders.fetch(orderId);
  }

  verifyPaymentSignature(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const generated = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');
    return generated === input.razorpaySignature;
  }
}

export const razorpayService = new RazorpayService();
