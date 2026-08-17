# Arizona Women Specialists

The practice website, a real appointment booking flow, and an admin panel —
Next.js (App Router), React 19, TypeScript, Tailwind CSS v4 and MongoDB.

```bash
cp .env.example .env.local   # then fill it in
npm run seed                 # creates the admin account + pricing plans
npm run dev                  # http://localhost:3000
npm run build
npm start
npm run lint
```

## Environment

`.env.local` (gitignored — `.env.example` is the template):

| Variable | What it does |
| --- | --- |
| `MONGODB_URI` | Connection string. Local `mongodb://127.0.0.1:27017` or an Atlas SRV URI |
| `MONGODB_DB` | Database name (default `arizona`) |
| `SESSION_SECRET` | Signs the admin and patient session cookies. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Admin credentials are **not** in the env — accounts live in the `admins`
collection with scrypt-hashed passwords.

## Seeding

```bash
npm run seed                                         # admin + pricing plans
npm run seed -- --email you@clinic.com --password "your password" --name "Front desk"
npm run seed -- --slots 14                           # also add 14 days of weekday slots
```

Default account: `admin@arizonawomen.com` / `Arizona@2026` — change it by
re-running with `--email/--password`. Re-running is safe: it resets that
admin's password, leaves existing pricing edits alone, and skips duplicate
slots. `scripts/seed.mjs` also creates every index.

## Routes

**Public**

| Route | What's there |
| --- | --- |
| `/` | Home — hero, chips, illustration, quick links, insurance |
| `/services` | Service cards, "Being seen is simple" steps, FAQ |
| `/pricing` | Free test banner, **price cards read from MongoDB**, insurance list |
| `/about` | The three providers |
| `/contact` | Phoenix + Glendale offices, hours |
| `/book` | Profile and the booking flow — reads real slots, writes real bookings |
| `/register` `/login` | Patient accounts — name, email, password |
| `/my-bookings` | The signed-in patient's appointments, with cancel |

**Admin** (`/admin`, session-guarded — signed out visitors are redirected to `/admin/login`)

| Route | What you can do |
| --- | --- |
| `/admin` | Counts for upcoming/total/cancelled bookings, open slots, plans + latest bookings |
| `/admin/bookings` | Every booking, filter and search, cancel / restore / delete |
| `/admin/slots` | Bulk-add slots over a date range by weekday, with time presets and capacity; switch individual times off; delete unbooked ones |
| `/admin/pricing` | Edit, reorder, add and delete the cards on `/pricing` |

**API**

| Method + path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/availability?start=&days=` | public | Open slots per day |
| `POST /api/bookings` | public | Create a booking (attaches the patient account when signed in) |
| `POST /api/auth/register` | public | Create a patient account |
| `GET/POST/DELETE /api/auth/session` | public | Who am I / log in / log out |
| `GET /api/my/bookings` | patient | That patient's bookings |
| `PATCH /api/my/bookings/[id]` | patient | Cancel own booking |
| `GET/POST/DELETE /api/admin/session` | — | Sign in / who am I / sign out |
| `GET /api/admin/bookings` | admin | List (optional `?status=`) |
| `PATCH/DELETE /api/admin/bookings/[id]` | admin | Change status / delete |
| `GET/POST /api/admin/slots` | admin | List a range / bulk create |
| `PATCH/DELETE /api/admin/slots/[id]` | admin | Activate-deactivate / delete |
| `GET/POST /api/admin/plans` | admin | List / create |
| `PATCH/DELETE /api/admin/plans/[id]` | admin | Edit / delete |

## How booking works

1. Admin adds slots in `/admin/slots` — patients can only book times that exist
   there.
2. `/book` fetches `/api/availability`; days with open slots are highlighted and
   every time chip is a real slot id.
3. Choosing a time opens "Tell us a bit about you"; **Continue** posts to
   `/api/bookings`.
4. The seat is claimed with a conditional `$inc` (`booked < capacity`), so two
   people racing for the last opening can't both win — the loser gets a 409 and
   the calendar refreshes.
5. The booking appears in `/admin/bookings`. Cancelling frees the seat; restoring
   takes it back.

Collections: `admins`, `users`, `plans`, `slots` (`date`, `time`, `minutes`, `capacity`,
`booked`, `active`), `bookings` (patient, reason, insurance, status, slot
reference).

## Patient accounts

The header shows **Log in** / **Register** when signed out, and an avatar button
when signed in — its dropdown holds **My bookings** and **Log out**.

Accounts live in `users` (`name`, `email`, `passwordHash`, `createdAt`,
`lastLoginAt`) and use the same scrypt hashing as admins, with a separate
`aws_user` cookie (30 days) so a patient session is never an admin session.

Bookings made while signed in store a `userId`. Bookings made as a guest are
adopted on register or login when the email matches, so nothing is orphaned.
`/my-bookings` splits upcoming from past/cancelled, and cancelling asks for
confirmation, frees the slot, and cannot be undone by the patient — only the
office can restore it from `/admin/bookings`.

## Admin authentication

Accounts are documents in `admins`:

```js
{ email, name, passwordHash, createdAt, lastLoginAt }
```

`passwordHash` is `scrypt$N$r$p$salt$hash` (all base64url) built with Node's
built-in `crypto.scrypt` — a fresh 16-byte salt per password, so the plain text
is never stored or recoverable. Sign-in compares with `timingSafeEqual`, and an
unknown email still runs a hash so it takes the same time as a wrong password.

A successful sign-in sets an HttpOnly cookie holding `{id, email, expires}`,
signed with `SESSION_SECRET` (HMAC-SHA256, 8-hour expiry). The admin layout
re-reads the account from Mongo on every page load, so deleting the document
locks that person out immediately.

## Structure

```
scripts/seed.mjs                   # admin account, plans, optional slots
src/
  app/
    layout.tsx  globals.css        # Tailwind v4 @theme tokens
    (site)/                        # marketing pages — header + footer
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
    auth.ts  password.ts          # session cookie, scrypt hashing
    api-helpers.ts               # admin route wrapper
    site.ts  practice.ts  availability.ts
```

## Design tokens

One brand, two densities. Wine `#7C2C3E` and sage `#4E7B73` on white for the
marketing pages and admin; `/book` uses the same hues in a lighter scheduling
palette (`cream`, `line`, `gold` = the "has openings" accent).
