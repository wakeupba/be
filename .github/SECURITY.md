# Security Policy

Wake Up Babe touches sensitive things: read-only Google Calendar data, phone numbers, and billing via Dodo Payments. We take security reports seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via GitHub's private vulnerability reporting:

**[github.com/wakeupba/be/security/advisories/new](https://github.com/wakeupba/be/security/advisories/new)**

Include what you can: affected surface (API, dashboard, landing, call flow), reproduction steps, and impact. You will get an acknowledgement within 72 hours and a status update at least weekly until the report is resolved.

## Scope

In scope:

- This repository (`apps/api`, `apps/dashboard`, `apps/landing`, `packages/shared`)
- The hosted service: `wakeupba.be`, `app.wakeupba.be`, `api.wakeupba.be`

Especially interesting: OAuth/session handling, webhook verification (Twilio, Dodo), tenant isolation in the scheduler, and anything that could place calls to numbers that did not opt in.

Out of scope:

- Denial of service / volumetric attacks
- Testing against accounts or data you do not own
- Social engineering, phishing, or physical attacks
- Third-party services themselves (Google, Plivo, Dodo Payments, Cloudflare)

## Supported versions

Wake Up Babe is rolling-release: the hosted service always runs the latest deploy from `main`, and only `main` receives security fixes. Self-hosters should track `main`.
