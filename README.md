# Arizona Women Specialists

The practice website plus the provider booking flow, built with the latest
Next.js (App Router), React 19, TypeScript and Tailwind CSS v4.

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the production build
npm run lint
```

## Routes

| Route | What's there |
| --- | --- |
| `/` | Home — hero, chips, illustration, quick links, insurance section |
| `/services` | Six service cards, "Being seen is simple" steps, FAQ accordion |
| `/pricing` | Free pregnancy test banner, six price cards, AHCCCS/WIC note, full insurance list |
| `/about` | The three providers, credentials |
| `/contact` | Phoenix + Glendale offices, directions, office hours |
| `/book` | Provider profile and the booking flow |

Everything that used to link out to healow.com now points at `/book`.

The five marketing pages live in the `(site)` route group, which supplies the
announcement bar, sticky header and footer. `/book` sits outside that group, so
it renders bare — no site header or footer — as designed.

`index.html` is the original single-file site this was ported from. Nothing
references it any more; keep it as a reference or delete it.

## Booking flow (`/book`)

Left column: profile with **Highlights** and **Location** tabs. Right column: the
booking card — visit reason, insurance, New/Existing patient toggle, two-week
availability grid with prev/next paging.

1. **Insurance modal** — search, **Popular carriers** as logo tiles, **All
   carriers** grouped alphabetically with a `#` group, "I'm paying for myself" at
   the bottom. Picking a carrier drills into its plans. Opens from the booking
   card, the "200+ plans" link, and the booking modal.
2. **Visit reason** — dropdown grouped into *Popular* and *All Visit Reasons*.
3. **Booking modal** — click any gold day (or "View more availability"): provider
   header, scheduling details, **Available appointments** as gold time chips, then
   **More availability** for the rest of the window.
4. **Tell us a bit about you** — clicking a time opens the form: summary card,
   email, legal first/last name, date of birth, sex, optional gender identity and
   pronouns, then the yellow **Continue** button.
5. **Confirmation** — when, reason, patient type, insurance, location.

Scheduling state lives in `booking-context.tsx`, so the card and both modals stay
in sync — changing the visit reason reshuffles availability everywhere.

## Structure

```
src/
  app/
    layout.tsx              # fonts, metadata, page shell
    globals.css             # Tailwind v4 @theme tokens
    (site)/                 # marketing pages — header + footer
      layout.tsx  page.tsx  services/  pricing/  about/  contact/
    book/page.tsx           # booking page — no site chrome
  components/
    site/                   # SiteNav, SiteFooter, InsuranceSection, Faq,
                            # HeroIllustration, Ico, ui (Button/Band/SectionHead)
    booking-context.tsx     # shared scheduling state + modal mounting
    ProfilePanel.tsx  BookingCard.tsx  BookingFlowModal.tsx
    InsuranceModal.tsx  VisitReasonSelect.tsx  icons.tsx
  lib/
    site.ts                 # all marketing copy and data
    practice.ts             # booking copy, visit reasons, carriers and plans
    availability.ts         # date helpers + mock slot generation
```

## Design tokens

Two palettes coexist in `globals.css`:

- **Site** — wine `#7C2C3E`, sage `#4E7B73` on white, serif display face
  (`font-display`), used by everything in `(site)`.
- **Booking** — the cream/ink/gold set used by `/book`.

## Notes on the availability data

`src/lib/availability.ts` generates slots from a deterministic FNV-1a hash of
`date | patientType | visitReason` — no `Math.random()`, so server and client
render identical markup and hydration stays clean. Weekends are closed, past
dates are empty, Fridays are mornings only, and new patients see fewer openings.

Swap `buildWindow()` for a real scheduling API and the UI needs no changes — it
only depends on the `DaySlots[]` shape. `/book` uses `revalidate = 3600` so the
window always starts from the current day rather than build time.

Carrier logos are text tiles standing in for the real marks, and no appointment
is actually booked — the flow is a local mock.
