# Arizona Women Specialists

The practice website, a real appointment booking flow, and an admin panel —
Next.js (App Router), React 19, TypeScript, Tailwind CSS v4 and MongoDB.

```bash
cp .env.example .env.local                # then fill it in
npm run seed -- --password "a long one"   # admin account + pricing plans (no default password)
npm run dev                               # http://localhost:3000
npm run build && npm start
npm run lint && npm run typecheck
npm test                                  # unit tests
npm run test:e2e                          # end-to-end, on a throwaway local database
npm run backup                            # copy the database to backups/
npm run screenshots                       # refresh screenshots/full-system (throwaway local database)
```

## Environment

`.env.local` (gitignored — `.env.example` is the template):

| Variable | What it does |
| --- | --- |
| `MONGODB_URI` | Connection string. Local `mongodb://127.0.0.1:27017` or an Atlas SRV URI |
| `MONGODB_DB` | Database name (default `arizona`) |
| `SESSION_SECRET` | Signs the session cookies and the OTP hashes. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` | Mail server. 465 = SSL (`SMTP_SECURE=true`), 587 = STARTTLS (`false`). Leave `SMTP_HOST` blank to auto-probe |
| `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | Mailbox login and the From header |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL — also used to build the appointment links in patient emails |
| `CRON_SECRET` | Guards `/api/cron/reminders`; Vercel Cron sends it as a Bearer token. Without it reminders never run |
| `HEALTH_KEY` | Turns on `/api/admin/health` (16+ characters, sent as the `x-health-key` header). Never reuse `SESSION_SECRET` |
| `NEXT_PUBLIC_META_PIXEL_ID` `META_CAPI_ACCESS_TOKEN` | Meta pixel + Conversions API. Both stay off until a visitor chooses "Allow" |
| `TRUST_PROXY_HEADERS` | `1` only when self-hosting behind your own proxy, so rate limits see real IPs. Not needed on Vercel |
| `ALLOW_DEV_OTP` | `1` on a developer machine without SMTP: the email code comes back in the API response. Ignored in production builds |

Check the mail settings before relying on them:

```bash
npm run mail:check                           # find a host that logs in
npm run mail:check -- --to you@example.com   # and send a test message
```

The practice mailbox is GoDaddy **Microsoft 365**, so it uses
`smtp.office365.com:587` with STARTTLS — *not* `smtpout.secureserver.net`, which
is GoDaddy's legacy Workspace host and answers `535 authentication rejected` for
these credentials. With `SMTP_HOST` unset, the app probes both plus
`mail.<domain>` / `smtp.<domain>` on first send and caches whichever logs in.

**Careful with `$` in `.env.local`.** Next expands `$` in env values, so
`SMTP_PASS=pass$123` silently arrives as `pass` — quoting doesn't help. Write it
escaped: `SMTP_PASS=pass\$123`. The scripts load env through Next's own loader
(`scripts/load-env.mjs`) instead of `node --env-file`, so a script and the app
never disagree about a value.

Admin credentials are **not** in the env — accounts live in the `admins`
collection with scrypt-hashed passwords.

## Deploying

Set these in the host's environment (not a `.env` file):
`MONGODB_URI`, `MONGODB_DB`, `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

Two things bite in production:

- **Passwords with `$`.** `.env.local` needs `pass\$123` because Next expands
  `$`; a hosting dashboard stores values **literally**, so paste the raw
  `pass$123` there — the escaped copy is a different password and the mail
  server answers `535 Authentication unsuccessful`. If in doubt use
  `SMTP_PASS_B64` (base64 of the raw password), which has no escaping at all.
  The app retries the un-escaped form and logs a warning, but fix the value.
- **Atlas Network Access.** Serverless hosts have changing outbound IPs, so
  `Server selection timed out … ReplicaSetNoPrimary` means the allowlist is
  blocking them. Add `0.0.0.0/0` under Atlas → Network Access. Percent-encode
  any special characters in the URI password (`@` = `%40`, `:` = `%3A`).

Check a deployment's settings from your machine — real env vars win over
`.env.local`:

```bash
npm run doctor
MONGODB_URI="…" SMTP_USER="…" SMTP_PASS="…" npm run doctor
```

To check a *running* deployment, call its health endpoint. It needs its own
`HEALTH_KEY` (16+ characters, never `SESSION_SECRET`), sent as a header so it
stays out of logs; without `HEALTH_KEY` the endpoint is off:

```
curl -H "x-health-key: $HEALTH_KEY" https://<site>/api/admin/health          # MongoDB + config
curl -H "x-health-key: $HEALTH_KEY" "https://<site>/api/admin/health?smtp=1"  # + a real SMTP login
```

It never returns the password — only a fingerprint keyed with `HEALTH_KEY` and
flags for stray quotes, edge whitespace and backslash escapes. Compare the fingerprint
with a machine where mail works: **same fingerprint + failing login means the
mail server is refusing that host, not a wrong password.**

## Seeding

```bash
npm run seed -- --password "a long, unique password"            # admin + pricing plans
npm run seed -- --email you@clinic.com --password "…" --name "Front desk"
npm run seed -- --password "…" --doctors --doctor-password "…"   # + one login per provider
```

There are no default passwords: `--password` (and `--doctor-password` with
`--doctors`) is required, at least 12 characters, and never printed. The admin
email defaults to `admin@arizonawomen.com`. Re-running is safe: it resets that
admin's password and leaves existing pricing edits alone. `scripts/seed.mjs`
also creates every index. Appointment slots are not seeded — open them from
**Admin → Appointment slots** (see below).

For a full-looking local database (demo patients, past visits, this week's
bookings, check-ins), run `npm run seed:demo`; `npm run seed:demo -- --reset`
removes only that demo data. It refuses to run against a non-local database.
Demo patients sign in with their email and the demo password printed by
`seed-demo` (local databases only).

## Routes

**Public**

| Route | What's there |
| --- | --- |
| `/` | Home — hero, chips, illustration, quick links, insurance |
| `/services` | Service cards, "Being seen is simple" steps, FAQ |
| `/pricing` | Free test banner, **price cards read from MongoDB**, insurance list |
| `/about` | Provider cards (from Admin → Doctors); **View profile** opens the full profile, **Book** opens that provider's booking form right on the page. `#provider-<id>` opens a profile, `#book-<id>[-<office>]` the booking form |
| `/contact` | Phoenix + Glendale offices, hours |
| `/book` | Providers with their open times. Picking a time asks the visit details (that provider's visit reasons, insurance, new or existing), then who the patient is. Guests confirm their email with a 6-digit code; `?reschedule=<link token>` moves an existing appointment |
| `/register` | Name + email → emailed 6-digit code → password |
| `/login` | Email + password |
| `/my-bookings` | The signed-in patient's panel: overview, appointments (upcoming / past / cancelled), profile and password |
| `/appointment/[token]` | One appointment from the link in the patient's emails — no sign-in. Calendar, directions, reschedule, cancel |
| `/appointment/[token]/check-in` | Pre-visit check-in: contact, emergency contact, insurance IDs and card photos, photo ID, health history |

**Admin** (`/admin`, session-guarded — signed out visitors are redirected to `/admin/login`)

| Route | What you can do |
| --- | --- |
| `/admin` | Registered patients, new this week, upcoming/total/cancelled bookings, open slots, plans + latest bookings |
| `/admin/bookings` | Every booking, filter and search, check-in and email status, cancel / restore / delete |
| `/admin/bookings/[id]` | One booking with the patient's check-in answers and photos |
| `/admin/users` | Registered patients — search, sort, booking counts, delete |
| `/admin/users/[id]` | One patient: profile, totals, next visit, their bookings, and delete |
| `/admin/slots` | One page per week: the week plan (which provider works at which office, when — save to open those times), that week's times marked open / booked (with the patient) / off, an Add slots popup for one-off extra times, and which visit reasons each provider takes. `/admin/schedule` redirects here |
| `/admin/pricing` | Edit, reorder, add and delete the cards on `/pricing` |
| `/admin/doctors` | Every provider: on the website or hidden, sign-in, weekly-schedule and Zocdoc warnings. **+ Add doctor** |
| `/admin/doctors/[id]` | One provider: photo, profile, about/education/certifications, Zocdoc + eCW, show on website, visit reasons, their days in the weekly schedule, and their sign-in (email + password) |
| `/admin/site` | **Modify site** — the home page hero (headline, text, up to 6 pictures with captions and focus points) and the two office cards (name, short name, address, phone, directions link, picture) |
| `/admin/settings` | Your own name, sign-in email and password; add, reset or remove other admins |
| `/admin/doctor` | A provider's own panel (provider sign-ins land here): their appointments only |

**API**

| Method + path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/availability?start=&days=&office=&provider=&reason=` | public | Open slots per day, optionally for one office, provider and/or visit reason |
| `POST /api/bookings` | patient or verified email | Create a booking and send the confirmation email — 401 `needsVerification` otherwise. With `reschedule: <link token>` it also cancels the visit being moved, in the same request |
| `POST /api/auth/otp` | public | Email a 6-digit code (`purpose: "booking"` for guest booking) |
| `PUT /api/auth/otp` | public | Check the code |
| `POST /api/auth/register` | public | Create a patient account (needs a verified email) |
| `GET/POST/DELETE /api/auth/session` | public | Who am I / log in / log out |
| `GET /api/my/bookings` | patient | That patient's bookings |
| `PATCH /api/my/bookings/[id]` | patient | Cancel own booking |
| `PATCH /api/appointments/[token]` | link token | Cancel the appointment behind an emailed link. Answers with the status only |
| `POST /api/appointments/[token]/intake` | link token | Save the check-in (multipart, photos up to 6 MB) |
| `GET /api/cron/reminders` | `CRON_SECRET` | Daily: 3-day and 1-day reminder emails, each sent at most once |
| `GET/POST/DELETE /api/admin/session` | — | Sign in / who am I / sign out |
| `GET /api/admin/bookings` | admin | List (optional `?status=`) |
| `PATCH/DELETE /api/admin/bookings/[id]` | admin | Change status / delete |
| `GET/PUT /api/admin/schedule` | admin | `?week=` read a week. PUT `{week, rows}` this week only · `{week, reset: true}` back to the fixed schedule · `{master: true, rows}` the fixed weekly schedule |
| `GET/POST /api/admin/slots` | admin | List a range (`?office=&provider=`) / bulk create for one provider at one office |
| `PATCH/DELETE /api/admin/slots/[id]` | admin | Activate-deactivate / delete |
| `GET/PUT /api/admin/provider-reasons` | admin | Which visit reasons each provider takes |
| `GET /api/admin/intake-files/[id]` | admin | One check-in photo, never cached |
| `GET /api/admin/users` | admin | Patients with booking counts |
| `GET /api/admin/users/[id]` | admin | One patient and their bookings |
| `DELETE /api/admin/users/[id]` | admin | Delete the account + its bookings, freeing held slots |
| `GET/POST /api/admin/plans` | admin | List / create |
| `PATCH/DELETE /api/admin/plans/[id]` | admin | Edit / delete |
| `GET/POST /api/admin/doctors` | admin | Providers (hidden too) with their sign-in emails / add one |
| `PATCH /api/admin/doctors/[id]` | admin | Save a profile (`zocdocCheckedNow: true` records today's Zocdoc check) |
| `POST /api/admin/doctors/[id]/photo` | admin | Upload a headshot (JPEG/PNG/WebP, 4 MB) |
| `PUT /api/admin/doctors/[id]/reasons` | admin | That provider's visit reasons |
| `PUT/DELETE /api/admin/doctors/[id]/login` | admin | Create or change a provider's sign-in / remove it |
| `PATCH /api/admin/account` | admin | Your own name, email, password (current password required) |
| `GET/POST /api/admin/admins` · `PATCH/DELETE /api/admin/admins/[id]` | admin | Other admins: list, add, set a password, remove |
| `GET /api/provider-photos/[id]` | public | An uploaded provider headshot |
| `GET/PUT /api/admin/site` | admin | The hero and office cards (`settings` → `siteContent`) |
| `POST /api/admin/site/images` | admin | Upload a picture for them (JPEG/PNG/WebP, 8 MB); unused uploads are deleted on the next save |
| `GET /api/site-images/[id]` | public | An uploaded site picture |

## How booking works

0. Anyone can look at times. To book, a signed-in patient just confirms; a
   guest gets a 6-digit code by email and types it in (the API refuses an
   unverified email, so this can't be skipped). Afterwards the guest can add a
   password to turn it into an account.
1. The practice has one **fixed weekly schedule** (who works at which office,
   at what times — Monday to Friday). Every week follows it: a week with no
   plan of its own is filled from it, slots and all, as it comes into view
   (four weeks ahead). On `/admin/slots` the front desk can change one week
   (**Save for this week only**), send it back (**Use the fixed schedule
   again**), or change the fixed schedule itself (**Save as fixed schedule**),
   which updates every upcoming week that still follows it. Booked times are
   never removed — they are listed so the office can call the patient — and
   days already past are not changed. One-off extra times use **Add slots**.
2. Every **Book** button leads to the provider cards on `/about`; a provider's
   Book opens their booking form there: office radio buttons and a
   Monday–Friday week of open times per office (`/api/availability`). Times
   already past today, in Arizona time, are hidden.
3. Picking a time asks the visit details — the reason (from that provider's
   own list, Zocdoc's wording), insurance, new or existing — then "Tell us a
   bit about you"; **Continue** posts to `/api/bookings`.
4. The seat is claimed with a conditional `$inc` (`booked < capacity`), so two
   people racing for the last opening can't both win — the loser gets a 409 and
   the calendar refreshes.
5. The booking appears in `/admin/bookings`. Cancelling frees the seat; restoring
   takes it back.

Collections: `admins`, `users`, `plans`, `slots` (`providerId`, `officeId`, `date`,
`time`, `minutes`, `capacity`, `booked`, `active` — unique per provider, date and
time), `bookings` (patient, reason, insurance, status, slot reference, plus the
slot's `providerId` and `officeId`), `week_schedules` (one plan per week, keyed
by its Monday; `custom: false` when it follows the fixed schedule), `providers`
(profiles, from Admin → Doctors), `settings` (the fixed weekly schedule,
visit reasons per provider), `rate_limits` (TTL-swept counters).

Office ids (`maryvale`, `arrowhead`) live in `src/lib/site.ts`; provider ids are
made from the name when a provider is added (`shah`, `denton`, `tate`, …). Both
are stored on every slot and booking — they never change. Slots and bookings from before this change have no
provider or office; they still work and show as "—" in the admin.

## Emails, reminders, check-in and Spanish

- **Confirmation** is emailed as soon as a booking is made, with the
  appointment link (`/appointment/<token>`) and a check-in button. The token is
  the booking id signed with `SESSION_SECRET`, so it can't be guessed or
  altered.
- **Reminders** go out 3 days and 1 day before. Vercel Cron calls
  `/api/cron/reminders` daily at 16:00 UTC (9 am Arizona, see `vercel.json`).
  Each reminder is claimed in the database before it is sent, so a repeated run
  never sends twice. Cancelling sends a cancellation email.
- No email ever names the visit reason — inboxes are shared and previewed.
- **Check-in** answers live on the booking (`intake`); card and ID photos are
  shrunk in the browser and stored in GridFS (bucket `intake`), served only to
  admins, and deleted with the booking.
- **Spanish:** the toggle on `/book`, the appointment page, check-in and My
  bookings sets the `awsp_lang` cookie. The booking remembers its language, so
  emails and the emailed link open in it. Visit reasons and insurance are
  stored in English for the front desk; only labels are translated
  (`src/lib/i18n.ts` — have a native speaker on staff review it).
- **SMS** reminders aren't built: they need a texting provider that signs a
  BAA (for example Twilio with a HIPAA-eligible account).
- The Meta pixel is **opt-in**: nothing loads, and no server event is sent,
  until the visitor chooses **Allow** on the notice. Even then it never loads
  or fires on `/appointment`, `/my-bookings`, `/admin`, `/book?reschedule=…` or
  a sign-in page heading back to an appointment (`isPrivateLocation` in
  `src/components/analytics/track.ts`), and server events carry only the page's
  origin and path (`cleanSourceUrl` in `src/lib/meta.ts`).

## Patient accounts

The header shows **Log in** / **Register** when signed out, and an avatar button
when signed in — its dropdown holds **My bookings** and **Log out**.

Accounts live in `users` (`name`, `email`, `passwordHash`, `createdAt`,
`lastLoginAt`) and use the same scrypt hashing as admins, with a separate
`aws_user` cookie (30 days) so a patient session is never an admin session.

**Registering takes three steps:** name + email → a 6-digit code emailed to that
address → password. `/api/auth/register` refuses anything whose email hasn't
passed the code, so the step can't be skipped by posting straight to the API.

Codes live in `email_otps` as an HMAC (never the digits themselves), expire after
10 minutes, allow 6 wrong tries and 6 sends, enforce a 45-second gap between
sends, and are deleted once the account is created. Mongo TTL-sweeps stale rows.
Passing the code proves the inbox *for that browser* (a signed `aws_verified`
cookie), so someone else who knows the address can't register or book on the
patient's verification. On a developer machine with `ALLOW_DEV_OTP=1` and no
working mail server, the code comes back in the API response instead.

Bookings made while signed in store a `userId`. Bookings made as a guest are
adopted on register or login when the email matches, so nothing is orphaned.
`/my-bookings` splits upcoming from past/cancelled, and cancelling asks for
confirmation, frees the slot, and cannot be undone by the patient — only the
office can restore it from `/admin/bookings`.

## Admin authentication

Accounts are documents in `admins`:

```js
{ email, name, passwordHash, role: "admin" | "provider", providerId, sessionVersion, createdAt, lastLoginAt }
```

Admins manage them from **Settings** (their own and other admins) and
**Doctors** (each provider's sign-in). Staff passwords are at least 12
characters; a new password bumps `sessionVersion`, which signs that account
out of every other browser.

`passwordHash` is `scrypt$N$r$p$salt$hash` (all base64url) built with Node's
built-in `crypto.scrypt` — a fresh 16-byte salt per password, so the plain text
is never stored or recoverable. Sign-in compares with `timingSafeEqual`, and an
unknown email still runs a hash so it takes the same time as a wrong password.

A successful sign-in sets an HttpOnly cookie holding `{typ, id, email, v, expires}`,
signed with `SESSION_SECRET` (HMAC-SHA256, 8-hour expiry). Every admin page
and API re-reads the account (and its session version) from Mongo, so deleting
it or changing its password locks that session out immediately.

## Security

- **Sign-in:** scrypt (N=2^17; older hashes upgrade on the next sign-in).
  Only wrong passwords count toward the limits: 10 per patient email and 30
  per IP per 15 minutes; 5 per staff email and 20 per IP. Counters live in
  MongoDB (`rate_limits`), so they hold across servers and restarts.
- **Email codes:** atomic attempt counting (6), single use, bound to the
  browser; sending is limited per address and per IP. Registering an email
  that already has an account answers the same way and emails the owner.
- **Bookings:** at most 4 upcoming visits per email; a signed-in patient
  always books under their own address; hidden providers can't be booked.
- **Appointment links** expire 30 days after the visit and never reach Meta.
- **CSRF:** every state-changing API refuses requests from other sites
  (`Sec-Fetch-Site` / `Origin`, `src/lib/csrf.ts`).
- **Headers:** a per-request nonce Content-Security-Policy (`src/proxy.ts`),
  `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, no `X-Powered-By`; private paths are `noindex` and
  disallowed in `robots.txt`.
- Every admin page checks the session itself (`requireAdminPage`), not just the layout.

## Doctors

Providers live in the `providers` collection and are edited from
**Admin → Doctors** — photo, profile, Zocdoc and eCW links, whether they show
on the website, their visit reasons and their sign-in. The first start fills
the collection from `seedProviders` in `src/lib/site.ts`. Changes reach every
page within a minute (each server re-reads the list every 30 seconds).

After adding a provider: open **Appointment slots**, add them to their days and
**Save as fixed schedule** — until then they have no bookable times (the
Doctors page flags this). Zocdoc can't be read automatically (it blocks bots),
so rating and review counts are typed in; the Doctors page asks for a fresh
check after 30 days.

## Modify site

**Admin → Modify site** edits the top of the home page and the office cards.
Pictures come from the built-in library (`src/lib/photos.ts`) or an upload;
click a preview to choose which part stays in view (separately for phones on
hero pictures). Office names and addresses edited here are used everywhere —
booking form, emails, calendar invites, footer, privacy notice and admin. The
office *ids* (`maryvale`, `arrowhead`) never change. The starting content is
`DEFAULT_SITE_CONTENT` in `src/lib/site-content.ts`; it is written to the
database on first start.

## Testing

- `npm test` — unit tests (`tests/unit`, Node's test runner via `tsx`).
- `npm run test:e2e` — builds, seeds a throwaway `arizona_e2e` database on a
  **local** MongoDB, starts the app with a fake mail server, and runs every
  suite in `tests/e2e`: fixed schedule, security, a headless-Chrome pass over
  booking (skipped if Chrome isn't found; set `CHROME_PATH`), and Doctors &
  Settings. It refuses a non-local `MONGODB_URI` and drops the test database
  afterwards (`--keep` to inspect it, `--no-build` to reuse the last build).
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check, unit and
  end-to-end tests on every push, with MongoDB as a service.

## Backups

- **Production:** switch on the database host's automatic backups — on MongoDB
  Atlas, *Project → Backup* (Cloud Backup with point-in-time restore on M10+;
  the free M0 tier has no automatic backups). Check that a snapshot exists and
  try a restore into a scratch cluster once.
- **Manual copy:** `npm run backup` writes every collection (check-in photos
  included) as Extended JSON to `backups/<db>-<time>/`; `npm run restore --
  <folder> --db <name>` loads it into an empty database (or `--replace`, after
  typing the name). The files contain patient health information: keep them
  encrypted; `backups/` is git-ignored.

## Structure

```
scripts/seed.mjs                   # admin account, plans, optional slots
scripts/mail-check.mjs             # SMTP host prober + test send
scripts/doctor.mjs                 # checks MongoDB + SMTP for any environment
scripts/load-env.mjs               # shared env loading (matches Next)
src/
  app/
    layout.tsx  globals.css        # Tailwind v4 @theme tokens
    (site)/                        # marketing pages — header + footer
    (account)/                     # login, register, my-bookings — header only
    book/page.tsx                  # booking page — no site chrome
    admin/login/                   # sign-in
    admin/(dash)/                  # guarded shell + dashboard/bookings/slots/pricing
    api/                           # availability, bookings, admin CRUD
  components/
    site/                          # SiteNav, UserMenu, SiteFooter, Ico, ui, hero, FAQ
    auth/                          # session context, login/register form, MyBookings
    admin/                         # AdminNav, tables, editors, shared inputs
    BookingCard  BookingFlowModal  InsuranceModal  ProfilePanel  booking-context
  lib/
    db.ts  models.ts  repo.ts      # Mongo client, types, all data access
    format.ts                      # date/initials helpers shared by server + client
    mail.ts  otp.ts                # nodemailer transport, emailed codes
    auth.ts  password.ts          # session cookie, scrypt hashing
    api-helpers.ts               # admin route wrapper
    site.ts  practice.ts  availability.ts
```

## Design tokens

One brand, two densities. Wine `#7C2C3E` and sage `#4E7B73` on white for the
marketing pages and admin; `/book` uses the same hues in a lighter scheduling
palette (`cream`, `line`, `gold` = the "has openings" accent).
