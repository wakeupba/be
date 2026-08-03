<a href="https://wakeupba.be">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.png">
    <img src=".github/assets/banner-light.png" alt="wake up babe. your calendar, but clingy. color a meeting red, your phone rings before it.">
  </picture>
</a>

<p align="center">
  <a href="https://wakeupba.be"><kbd>Website</kbd></a>
  <a href="#how-it-works"><kbd>How it works</kbd></a>
  <a href="#development"><kbd>Development</kbd></a>
  <a href="#self-hosting"><kbd>Self-hosting</kbd></a>
  <a href="#contributing"><kbd>Contributing</kbd></a>
</p>

<p align="center">
  <a href="https://github.com/wakeupba/be/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/wakeupba/be/ci.yml?branch=main&label=ci" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/wakeupba/be?color=d92d20" alt="License: AGPL-3.0"></a>
  <a href="https://wakeupba.be"><img src="https://img.shields.io/website?url=https%3A%2F%2Fwakeupba.be&label=wakeupba.be" alt="Website status"></a>
  <a href="https://github.com/sponsors/zingzy"><img src="https://img.shields.io/badge/sponsor-%E2%9D%A4-d92d20?logo=githubsponsors&logoColor=white" alt="Sponsor"></a>
</p>

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
                                     telephony adapter (Twilio)
                                                │
                                          ☎️  your phone
```

- **API**: Cloudflare Worker, [Hono](https://hono.dev), D1 + Drizzle, two cron triggers
- **Landing + dashboard**: Next.js static exports served as Workers assets
- **Telephony**: Twilio behind a provider interface (swappable)
- **Payments**: Dodo Payments hosted checkout + webhooks (merchant of record; we never touch card data)
- **Observability**: Workers Logs with structured events, optional Sentry (set `SENTRY_DSN`)
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

Local dev runs the real Workers runtime (workerd via miniflare) against a local SQLite-backed D1, so dev and prod behave identically.

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then fill in secrets
pnpm -C apps/api db:migrate:local                  # create/refresh local D1
pnpm -C apps/api dev                               # worker on :8787, crons included
pnpm -C apps/dashboard dev                         # dashboard on :3004
pnpm -C apps/landing dev                           # landing on :3003
```

Useful to know:

- `pnpm -C apps/api dev` runs wrangler *and* pulses the cron triggers
  (dispatcher every minute, calendar sync every five) — wrangler alone never
  fires them locally. `pnpm -C apps/api dev:bare` is the escape hatch if you
  want wrangler without the pulse.
- Tests run in the real Workers runtime against a real D1:
  `pnpm -C apps/api test`.
- Billing can be developed three ways, in increasing order of realism:
  vitest suite (no keys), `DODO_FAKE_CHECKOUT=1` (local stand-ins for Dodo's
  hosted pages, plus `pnpm -C apps/api sim:dodo <event>` to fire signed
  webhooks), or a real Dodo test-mode account (set the `DODO_*` vars, which
  automatically retires the fakes).
- Real phone calls locally need Twilio to reach your machine — it rejects
  localhost callback URLs outright. Run
  `cloudflared tunnel --url http://localhost:8787` and point
  `TELEPHONY_PUBLIC_ORIGIN` in `.dev.vars` at the tunnel URL. Everything
  except live calls works without it.
- Local D1 lives under `apps/api/.wrangler/state/`. Delete it to reset your data.
- Google OAuth locally: add `http://localhost:8787/auth/callback` as a redirect URI in your Google Cloud console.

Secrets live in `wrangler secret` / `.dev.vars`, never in this repo. See `apps/api/.dev.vars.example`.

## Self-hosting

You can. You will need your own Google Cloud OAuth app, a Twilio account, and a rented phone number. The hosted version at [wakeupba.be](https://wakeupba.be) exists so you do not have to do any of that for $5/month.

## Contributing

Bug reports, fixes, and well-argued feature proposals are welcome, see [CONTRIBUTING.md](.github/CONTRIBUTING.md). Security issues go through [private vulnerability reporting](.github/SECURITY.md), never public issues.

## License

[AGPL-3.0](LICENSE). Self-host it, fork it, contribute to it. If you run a modified version as a service, share your changes.
