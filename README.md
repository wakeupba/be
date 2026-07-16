# Wake Up Babe 📞

> **[wakeupba.be](https://wakeupba.be)**, your calendar, but clingy.

Color a Google Calendar event red and Wake Up Babe phone-calls you before it starts. The call rings through Do Not Disturb, briefs you on the meeting, and listens for a keypress:

- press **1** to acknowledge (we stop bothering you)
- press **2** to snooze (we call again in 5 minutes)
- no answer? we call once more, which is exactly what pierces DND on both iOS and Android

Notifications are noise. Nobody ignores a ringing phone.

## Why

Corporate calendars are fully booked, and important meetings drown in the same notification stream as everything else. Every existing "reminder call" product is aimed at businesses calling their customers. This one calls *you*, and only for the meetings *you* mark, with zero new UI to learn: the marker is the event color you already have.

## How it works

```
Google Calendar ──(read-only poll, 5 min)──► sync service
                                                │ red event found
                                                ▼
                                         call scheduler (D1)
                                                │ due (1 min cron)
                                                ▼
                                     telephony adapter (Plivo)
                                                │
                                          ☎️  your phone
```

- **API**: Cloudflare Worker, [Hono](https://hono.dev), D1, two cron triggers
- **Landing + dashboard**: Next.js static exports served as Workers assets
- **Telephony**: Plivo behind a provider interface (swappable)
- **Payments**: Dodo Payments hosted checkout (merchant of record)
- **Scopes**: `calendar.readonly` only. We cannot write to your calendar, ever.

## Monorepo layout

```
apps/
  api/        Cloudflare Worker: OAuth, sync, scheduling, webhooks, dashboard API
  landing/    wakeupba.be (Next.js static export)
  dashboard/  app.wakeupba.be (Next.js static export)
packages/
  shared/     DTOs shared between API and dashboard
```

## Development

```sh
pnpm install
pnpm -C apps/api dev          # worker on :8787
pnpm -C apps/dashboard dev    # dashboard on :3001
pnpm -C apps/landing dev      # landing on :3000
```

Secrets live in `wrangler secret` / `.dev.vars`, never in this repo. See `apps/api/.dev.vars.example`.

## Self-hosting

You can. You will need your own Google Cloud OAuth app, a Plivo account, and a rented phone number. The hosted version at [wakeupba.be](https://wakeupba.be) exists so you do not have to do any of that for $5/month.

## License

[AGPL-3.0](LICENSE). Self-host it, fork it, contribute to it. If you run a modified version as a service, share your changes.
