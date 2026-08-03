import { Hono } from 'hono';
import type { Container } from '../container';
import type { Env } from '../env';
import { fakeBillingActive } from '../services/billing/dodo';
import { applyDodoEvent, type DodoWebhookPayload } from './hooks';

type DevContext = { Bindings: Env; Variables: { container: Container } };

const FAKE_CUSTOMER = 'cus_fake_local';
const FAKE_SUBSCRIPTION = 'sub_fake_local';

/* deliberately un-designed: this page must never be mistaken for product UI */
function page(title: string, body: string): string {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
  body { font-family: ui-monospace, monospace; max-width: 26rem; margin: 12vh auto; padding: 0 1rem; color: #18181b; }
  .tag { font-size: 11px; letter-spacing: .16em; color: #a1a1aa; }
  h1 { font-size: 17px; margin: .5rem 0 1.5rem; }
  button { font: inherit; padding: .5rem 1rem; margin: 0 .5rem .5rem 0; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff; cursor: pointer; }
  button.primary { background: #18181b; color: #fff; border-color: #18181b; }
  p { font-size: 13px; color: #52525b; line-height: 1.6; }
</style></head>
<body><div class="tag">DODO FAKE CHECKOUT · DEV ONLY</div>${body}</body></html>`;
}

/*
 * Local stand-ins for Dodo's hosted checkout and portal, so the full UI
 * payment loop is testable with zero external accounts. Active only when
 * DODO_FAKE_CHECKOUT=1 and no real API key exists; 404 otherwise.
 */
export const devRoutes = new Hono<DevContext>()
  .use('*', async (c, next) => {
    if (!fakeBillingActive(c.env)) return c.notFound();
    await next();
  })

  .get('/fake-checkout', (c) => {
    const product = c.req.query('product') ?? '';
    const user = c.req.query('user') ?? '';
    const returnUrl = c.req.query('return') ?? '';
    const isTopup = product === c.env.DODO_PRODUCT_TOPUP;
    return c.html(
      page(
        'Fake checkout',
        `<h1>${isTopup ? 'Top-up pack · $2' : 'Ride or Die · $5/mo'}</h1>
         <p>This stands in for Dodo's hosted checkout. Paying fires the same
         event pipeline a real payment would.</p>
         <form method="post" action="/dev/fake-checkout">
           <input type="hidden" name="product" value="${product}">
           <input type="hidden" name="user" value="${user}">
           <input type="hidden" name="return" value="${returnUrl}">
           <button class="primary" name="action" value="pay">Pay</button>
           <button name="action" value="fail">Fail the payment</button>
         </form>`,
      ),
    );
  })

  .post('/fake-checkout', async (c) => {
    const form = await c.req.formData();
    const product = String(form.get('product') ?? '');
    const userId = String(form.get('user') ?? '');
    const returnUrl = String(form.get('return') ?? '');
    const action = String(form.get('action') ?? 'pay');
    if (!userId || !returnUrl) return c.text('missing fields', 400);

    const back = new URL(returnUrl);
    if (action !== 'pay') {
      back.searchParams.set('status', 'failed');
      return c.redirect(back.toString(), 303);
    }

    const isTopup = product === c.env.DODO_PRODUCT_TOPUP;
    const payload: DodoWebhookPayload = isTopup
      ? {
          type: 'payment.succeeded',
          data: {
            customer: { customer_id: FAKE_CUSTOMER },
            metadata: { userId },
            product_cart: [{ product_id: product, quantity: 1 }],
          },
        }
      : {
          type: 'subscription.active',
          data: {
            customer: { customer_id: FAKE_CUSTOMER },
            metadata: { userId },
            subscription_id: FAKE_SUBSCRIPTION,
            status: 'active',
          },
        };
    await applyDodoEvent(c.get('container'), c.env, payload);

    back.searchParams.set('status', 'succeeded');
    return c.redirect(back.toString(), 303);
  })

  .get('/fake-portal', (c) => {
    const customer = c.req.query('customer') ?? '';
    const returnUrl = c.req.query('return') ?? '';
    return c.html(
      page(
        'Fake portal',
        `<h1>Billing portal</h1>
         <p>Cancel at period end keeps the paid term (subscription.cancelled,
         scheduled). Cancel now revokes immediately. Expire simulates the
         paid term actually ending.</p>
         <form method="post" action="/dev/fake-portal">
           <input type="hidden" name="customer" value="${customer}">
           <input type="hidden" name="return" value="${returnUrl}">
           <button name="action" value="cancel">Cancel at period end</button>
           <button name="action" value="cancel-now">Cancel now</button>
           <button name="action" value="expire">Expire term</button>
           <button class="primary" name="action" value="back">Back to the app</button>
         </form>`,
      ),
    );
  })

  .post('/fake-portal', async (c) => {
    const form = await c.req.formData();
    const customer = String(form.get('customer') ?? FAKE_CUSTOMER);
    const returnUrl = String(form.get('return') ?? '');
    const action = String(form.get('action') ?? 'back');
    if (!returnUrl) return c.text('missing fields', 400);

    // shapes mirror real deliveries: a portal cancel is subscription.updated
    // with status still active; terminal events carry the revoked status
    const events: Record<string, DodoWebhookPayload> = {
      cancel: {
        type: 'subscription.updated',
        data: {
          customer: { customer_id: customer },
          subscription_id: FAKE_SUBSCRIPTION,
          status: 'active',
          cancel_at_next_billing_date: true,
        },
      },
      'cancel-now': {
        type: 'subscription.cancelled',
        data: {
          customer: { customer_id: customer },
          subscription_id: FAKE_SUBSCRIPTION,
          status: 'cancelled',
          cancel_at_next_billing_date: false,
        },
      },
      expire: {
        type: 'subscription.expired',
        data: {
          customer: { customer_id: customer },
          subscription_id: FAKE_SUBSCRIPTION,
          status: 'expired',
          cancel_at_next_billing_date: true,
        },
      },
    };
    const payload = events[action];
    if (payload) await applyDodoEvent(c.get('container'), c.env, payload);
    return c.redirect(returnUrl, 303);
  });
