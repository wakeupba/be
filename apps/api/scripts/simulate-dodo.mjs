#!/usr/bin/env node
/*
 * Simulate Dodo Payments webhooks against the local dev API, signed exactly
 * like production deliveries. This is the default way to test billing flows
 * without a Dodo account:
 *
 *   pnpm sim:dodo subscribe            # upgrade to Ride or Die
 *   pnpm sim:dodo renew                # monthly renewal
 *   pnpm sim:dodo cancel               # user cancels, keeps paid term
 *   pnpm sim:dodo cancel-now           # immediate cancellation
 *   pnpm sim:dodo expire               # paid term ends -> downgrade
 *   pnpm sim:dodo hold                 # renewal payment failed
 *   pnpm sim:dodo topup [--packs 2]    # buy prepaid call packs
 *
 * Flags: --user <id> (default: first user in the local D1)
 *        --origin <url> (default: http://localhost:8787)
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function devVars() {
  const vars = {};
  for (const line of readFileSync(path.join(root, '.dev.vars'), 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

function d1(query) {
  const out = execFileSync(
    'pnpm',
    ['exec', 'wrangler', 'd1', 'execute', 'wakeupbabe', '--local', '--json', '--command', query],
    { encoding: 'utf8', cwd: root },
  );
  return JSON.parse(out.slice(out.indexOf('[')))[0]?.results ?? [];
}

const vars = devVars();
const secret = vars.DODO_WEBHOOK_SECRET;
if (!secret) {
  console.error('DODO_WEBHOOK_SECRET missing from .dev.vars');
  process.exit(1);
}

const event = process.argv[2];
const origin = arg('origin', 'http://localhost:8787');
let userId = arg('user');
if (!userId) {
  const [user] = d1('SELECT id, email FROM users ORDER BY created_at LIMIT 1');
  if (!user) {
    console.error('no users in the local D1; sign in once at the dashboard first');
    process.exit(1);
  }
  userId = user.id;
  console.log(`user: ${user.email} (${userId})`);
}

const customer = { customer_id: 'cus_local_sim' };
const metadata = { userId };
const subscription_id = arg('sub', 'sub_local_sim');
const packs = Number(arg('packs', '1'));

// payload shapes mirror real deliveries observed in test mode: subscription
// events carry the status snapshot, and a portal cancel arrives as
// subscription.updated with status still active
const payloads = {
  subscribe: { type: 'subscription.active', data: { customer, metadata, subscription_id, status: 'active' } },
  renew: { type: 'subscription.renewed', data: { customer, metadata, subscription_id, status: 'active' } },
  cancel: {
    type: 'subscription.updated',
    data: { customer, metadata, subscription_id, status: 'active', cancel_at_next_billing_date: true },
  },
  'cancel-now': {
    type: 'subscription.cancelled',
    data: { customer, metadata, subscription_id, status: 'cancelled', cancel_at_next_billing_date: false },
  },
  expire: {
    type: 'subscription.expired',
    data: { customer, metadata, subscription_id, status: 'expired', cancel_at_next_billing_date: true },
  },
  hold: { type: 'subscription.on_hold', data: { customer, metadata, subscription_id, status: 'on_hold' } },
  topup: {
    type: 'payment.succeeded',
    data: {
      customer,
      metadata,
      product_cart: [{ product_id: vars.DODO_PRODUCT_TOPUP || 'prod_local_topup', quantity: packs }],
    },
  },
};

const payload = payloads[event];
if (!payload) {
  console.error(`usage: pnpm sim:dodo <${Object.keys(payloads).join('|')}> [--user id] [--packs n]`);
  process.exit(1);
}

const body = JSON.stringify(payload);
const id = `msg_sim_${crypto.randomUUID()}`;
const timestamp = Math.floor(Date.now() / 1000);
const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
const signature = crypto
  .createHmac('sha256', Buffer.from(rawSecret, 'base64'))
  .update(`${id}.${timestamp}.${body}`)
  .digest('base64');

const response = await fetch(`${origin}/hooks/dodo`, {
  method: 'POST',
  body,
  headers: {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': `v1,${signature}`,
  },
});
console.log(`${payload.type} -> ${response.status} ${await response.text()}`);

const [after] = d1(
  `SELECT plan, calls_used_this_period, extra_call_credits FROM users WHERE id = '${userId.replaceAll("'", "''")}'`,
);
if (after) {
  console.log(
    `state: plan=${after.plan} used=${after.calls_used_this_period} credits=${after.extra_call_credits}`,
  );
}
