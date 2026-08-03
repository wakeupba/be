import DodoPayments from 'dodopayments';
import type { Env } from '../../env';

export interface CheckoutInput {
  productId: string;
  userId: string;
  email: string;
  name: string | null;
  /** reuse the Dodo customer once one exists, so purchases share a profile */
  customerId: string | null;
  returnUrl: string;
}

/**
 * Merchant-of-record abstraction over Dodo's hosted surfaces. We build zero
 * payment UI: checkout and the billing portal are Dodo pages we link to.
 */
export interface BillingProvider {
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }>;
}

/** dev-only stand-in for Dodo's hosted pages; never active alongside a
 * real API key */
export function fakeBillingActive(env: Env): boolean {
  return env.DODO_FAKE_CHECKOUT === '1' && !env.DODO_API_KEY;
}

/** billing is live only when the API key and both products are configured,
 * or the dev fake is standing in for the hosted pages */
export function billingConfigured(env: Env): boolean {
  const real = Boolean(env.DODO_API_KEY && env.DODO_PRODUCT_RIDE_OR_DIE && env.DODO_PRODUCT_TOPUP);
  return real || fakeBillingActive(env);
}

/** hands out URLs to the local /dev/fake-checkout pages instead of calling
 * Dodo; the pages then apply events through the same logic as the webhook */
export class FakeBillingProvider implements BillingProvider {
  constructor(private readonly apiOrigin: string) {}

  async createCheckout(input: CheckoutInput): Promise<{ url: string }> {
    const url = new URL('/dev/fake-checkout', this.apiOrigin);
    url.searchParams.set('product', input.productId);
    url.searchParams.set('user', input.userId);
    url.searchParams.set('return', input.returnUrl);
    return { url: url.toString() };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const url = new URL('/dev/fake-portal', this.apiOrigin);
    url.searchParams.set('customer', customerId);
    url.searchParams.set('return', returnUrl);
    return { url: url.toString() };
  }
}

export class DodoBillingProvider implements BillingProvider {
  private readonly client: DodoPayments;

  constructor(apiKey: string, environment: 'test_mode' | 'live_mode') {
    this.client = new DodoPayments({ bearerToken: apiKey, environment });
  }

  async createCheckout(input: CheckoutInput): Promise<{ url: string }> {
    const base = {
      product_cart: [{ product_id: input.productId, quantity: 1 }],
      metadata: { userId: input.userId },
      return_url: input.returnUrl,
    };

    if (input.customerId) {
      try {
        return this.sessionUrl(
          await this.client.checkoutSessions.create({
            ...base,
            customer: { customer_id: input.customerId },
          }),
        );
      } catch (error) {
        // a stored customer id Dodo no longer knows (fake-mode leftovers,
        // test/live mode switch, wiped account) must not brick checkout:
        // fall back to a fresh customer and let the webhook re-link ids
        const notFound =
          error instanceof DodoPayments.APIError &&
          (error.status === 404 || (error.error as { code?: string } | undefined)?.code === 'NOT_FOUND');
        if (!notFound) throw error;
        console.warn(
          `stored dodo customer ${input.customerId} unknown to dodo, creating checkout without it`,
        );
      }
    }

    return this.sessionUrl(
      await this.client.checkoutSessions.create({
        ...base,
        customer: { email: input.email, name: input.name ?? input.email },
      }),
    );
  }

  private sessionUrl(session: { checkout_url?: string | null }): { url: string } {
    if (!session.checkout_url) throw new Error('dodo returned a session without a checkout url');
    return { url: session.checkout_url };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const portal = await this.client.customers.customerPortal.create(customerId, {
      return_url: returnUrl,
    });
    return { url: portal.link };
  }
}
