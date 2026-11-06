/**
 * Unit tests for the small helpers the booking, security and scheduling code
 * rely on. No database or server needed:  npm test
 */
import { cleanPhone, phoneCountries, phoneHref } from "@/lib/phone";
import { selfPayLine } from "@/lib/site";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNext } from "@/components/auth/safe-next";
import { bookingIdFromToken, manageLinkExpired, manageToken } from "@/lib/booking-links";
import { crossSiteBlocked } from "@/lib/csrf";
import { cleanSourceUrl } from "@/lib/meta";
import { ALL_VISIT_REASONS, acceptedNetworks, carriers, cleanInsurance, insuranceLabel, plansFor, reasonFor, zocdocReasons } from "@/lib/practice";
import { ctaFor, DEFAULT_PROVIDERS, initialsOf, zocdocAgeDays } from "@/lib/providers";
import {
  cleanSchedule,
  DEFAULT_WEEKLY_SCHEDULE,
  hoursFromSchedule,
  mondayOf,
  normaliseTime,
  summarizeWeek,
} from "@/lib/scheduling";

process.env.SESSION_SECRET ??= "unit-test-secret-that-is-long-enough-1234567890";

describe("safeNext — where to land after signing in", () => {
  it("keeps paths on this site", () => {
    assert.equal(safeNext("/my-bookings/appointments"), "/my-bookings/appointments");
    assert.equal(safeNext("/book?provider=tate#x"), "/book?provider=tate#x");
  });
  for (const evil of ["//evil.example", "https://evil.example", "/\\evil.example", "/\t/evil.example", "javascript:alert(1)"]) {
    it(`refuses ${JSON.stringify(evil)}`, () => assert.equal(safeNext(evil), "/my-bookings"));
  }
  it("never bounces back to an auth page", () => assert.equal(safeNext("/login?next=/x"), "/my-bookings"));
});

describe("appointment links", () => {
  it("round-trips a booking id and rejects tampering", () => {
    const id = "6ac480745999e0ee46274c63";
    const token = manageToken(id);
    assert.equal(bookingIdFromToken(token), id);
    assert.equal(bookingIdFromToken(`6ac480745999e0ee46274c64.${token.split(".")[1]}`), null);
    assert.equal(bookingIdFromToken(`${id}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`), null);
    assert.equal(bookingIdFromToken("garbage"), null);
  });
  it("expires 30 days after the visit", () => {
    assert.equal(manageLinkExpired("2026-09-06", "2026-10-06"), false);
    assert.equal(manageLinkExpired("2026-09-05", "2026-10-06"), true);
    assert.equal(manageLinkExpired("2026-12-01", "2026-10-06"), false);
    assert.equal(manageLinkExpired("nonsense", "2026-10-06"), true);
  });
});

describe("cleanSourceUrl — the page URL Meta may see", () => {
  it("drops query strings and hashes", () => {
    assert.equal(cleanSourceUrl("https://site.com/book?reschedule=abc.def&provider=tate"), "https://site.com/book");
    assert.equal(cleanSourceUrl("https://site.com/about#book-tate"), "https://site.com/about");
  });
  it("hides private pages entirely", () => {
    assert.equal(cleanSourceUrl("https://site.com/appointment/6ac4.sig/check-in"), "https://site.com/");
    assert.equal(cleanSourceUrl("https://site.com/login?next=%2Fappointment%2Ftok"), "https://site.com/");
  });
  it("ignores garbage", () => assert.equal(cleanSourceUrl("not a url"), undefined));
});

describe("crossSiteBlocked — CSRF guard", () => {
  const req = (method: string, headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/x", { method, headers: { host: "localhost:3000", ...headers } });
  it("lets reads through", () => assert.equal(crossSiteBlocked(req("GET", { "sec-fetch-site": "cross-site" })), null));
  it("allows the site's own pages", () => {
    assert.equal(crossSiteBlocked(req("POST", { "sec-fetch-site": "same-origin" })), null);
    assert.equal(crossSiteBlocked(req("POST", { origin: "http://localhost:3000" })), null);
  });
  it("refuses other sites and sibling subdomains", () => {
    assert.equal(crossSiteBlocked(req("POST", { "sec-fetch-site": "cross-site" }))?.status, 403);
    assert.equal(crossSiteBlocked(req("POST", { "sec-fetch-site": "same-site" }))?.status, 403);
    assert.equal(crossSiteBlocked(req("PATCH", { origin: "https://evil.example" }))?.status, 403);
  });
  it("lets non-browser clients through (no cookies to ride on)", () => assert.equal(crossSiteBlocked(req("POST", {})), null));
});

describe("weekly schedule helpers", () => {
  it("normalises times", () => {
    assert.equal(normaliseTime("8:30 AM"), "8:30 am");
    assert.equal(normaliseTime("8:30am"), "8:30 am");
    assert.equal(normaliseTime("13:00 pm"), null);
    assert.equal(normaliseTime("8:61 am"), null);
  });
  it("finds the Monday of any day", () => {
    assert.equal(mondayOf("2026-10-06"), "2026-10-05");
    assert.equal(mondayOf("2026-10-11"), "2026-10-05");
    assert.equal(mondayOf("2026-10-12"), "2026-10-12");
  });
  it("the practice's week has 53 slots, Monday to Friday", () => {
    const rows = cleanSchedule(DEFAULT_WEEKLY_SCHEDULE);
    assert.equal(rows.length, 12);
    assert.equal(rows.reduce((sum, row) => sum + row.times.length, 0), 53);
    assert.ok(rows.every((row) => row.weekday >= 1 && row.weekday <= 5));
  });
  it("derives office hours and groups days", () => {
    const hours = hoursFromSchedule(DEFAULT_WEEKLY_SCHEDULE);
    const friday = hours.maryvale.find((day) => day.weekday === 5);
    assert.deepEqual(friday, { weekday: 5, first: "8:30 am", last: "3:00 pm" });
    const groups = summarizeWeek(hours.maryvale);
    assert.equal(groups.at(-1)?.first, null, "the weekend is closed");
  });
});

describe("visit reasons", () => {
  it("each provider's Zocdoc list uses known reasons", () => {
    for (const list of Object.values(zocdocReasons)) {
      assert.ok(list.every((reason) => ALL_VISIT_REASONS.includes(reason)));
    }
  });
  it("starts on a reason the provider takes", () => {
    assert.equal(reasonFor(zocdocReasons.tate, "Pre-conception Counseling"), "OB-GYN Consultation");
    assert.equal(reasonFor(zocdocReasons.tate, "Breast Pain"), "Breast Pain");
  });
});

describe("providers", () => {
  it("seed list has the three providers", () => {
    assert.deepEqual(DEFAULT_PROVIDERS.map((provider) => provider.id), ["shah", "denton", "tate", "erickson", "cook"]);
  });
  it("makes initials and button text from a name", () => {
    assert.equal(initialsOf("Dr. Maria Lopez, MD"), "ML");
    assert.equal(ctaFor("Dr. Hetalkumar Shah, MD"), "Book with Dr. Shah");
    assert.equal(ctaFor("Kylee Tate, PA-C"), "Book with Kylee");
  });
  it("counts days since the Zocdoc check", () => {
    assert.equal(zocdocAgeDays({ zocdocCheckedAt: "2026-10-01" }, "2026-10-06"), 5);
    assert.equal(zocdocAgeDays({ zocdocCheckedAt: null }, "2026-10-06"), null);
  });
});

describe("insurance picker", () => {
  const popular = carriers.filter((carrier) => carrier.popular).map((carrier) => carrier.name);
  it("offers AHCCCS as a quick pick, and no longer Medicare or Anthem", () => {
    assert.ok(popular.includes("AHCCCS"));
    assert.ok(!popular.includes("Medicare"));
    assert.ok(!popular.includes("Anthem Blue Cross Blue Shield"));
    assert.ok(popular.includes("Blue Cross Blue Shield of Arizona"));
  });
  it("marks a typed-in carrier for a coverage check, whatever the browser says", () => {
    assert.deepEqual(cleanInsurance({ carrier: "  Banner   Plus ", plan: "", memberId: "X1", unlisted: false }), {
      carrier: "Banner Plus",
      plan: "",
      memberId: "X1",
      unlisted: true,
    });
    assert.deepEqual(cleanInsurance({ carrier: "Cigna", plan: "PPO", unlisted: true }), { carrier: "Cigna", plan: "PPO" });
    assert.equal(cleanInsurance({ carrier: "  " }), null);
    assert.equal(cleanInsurance("Cigna"), null);
  });
  it("labels a carrier without a plan by name alone", () => {
    assert.equal(insuranceLabel({ carrier: "Banner Plus", plan: "" }), "Banner Plus");
    assert.equal(insuranceLabel({ carrier: "Cigna", plan: "PPO" }), "Cigna · PPO");
  });
  it("keeps Medicare in the full list", () => assert.ok(carriers.some((carrier) => carrier.name === "Medicare")));
  it("offers every network the practice added, with its own plans", () => {
    for (const name of ["Velocity", "Provider Select", "Prospect", "Prime Health", "MultiPlan Claritev", "IHP", "Gold Kidney Health Plan", "Galaxy Health", "Fusion", "CorVel", "MCCP"]) {
      assert.ok(carriers.some((carrier) => carrier.name === name), name);
      assert.equal(cleanInsurance({ carrier: name, plan: "PPO" })?.unlisted, undefined, name);
    }
    assert.deepEqual(plansFor("Velocity"), ["Auto", "PPO", "Workers Comp"]);
    assert.equal(acceptedNetworks.length, 11);
    assert.equal(new Set(carriers.map((carrier) => carrier.name)).size, carriers.length, "no carrier twice");
  });
});

describe("home page Self Pay card", () => {
  it("quotes the prices from Admin → Pricing", () => {
    const plans = [
      { tag: "New Patient", title: "New Patient Visit", amount: "$125.00" },
      { tag: "Returning", title: "Established Patient Visit", amount: "$100.00" },
      { tag: "Birth Control", title: "IUD Removal", amount: "$200.00" },
    ];
    assert.equal(selfPayLine(plans), "$125 first visit · $100 follow-up");
    assert.equal(selfPayLine([plans[0]]), "$125 first visit");
    assert.equal(selfPayLine([plans[2]]), null);
  });
});

describe("mobile phone on bookings", () => {
  it("tidies any common way of writing a US number", () => {
    for (const raw of ["6235550199", "(623) 555-0199", "623.555.0199", "1-623-555-0199", "+1 623 555 0199"]) {
      assert.equal(cleanPhone(raw), "(623) 555-0199", raw);
    }
  });
  for (const bad of ["", "555-0199", "22345678901", "(023) 555-0199", "623-555-01999", "call me", "623555019x", null, 6235550199]) {
    it(`refuses ${JSON.stringify(bad)}`, () => assert.equal(cleanPhone(bad), null));
  }
  it("takes numbers from other countries, picked from the list or typed with +code", () => {
    assert.equal(cleanPhone("98765 43210", "IN"), "+91 98765 43210");
    assert.equal(cleanPhone("+91 98765 43210", "US"), "+91 98765 43210");
    assert.equal(cleanPhone("55 1234 5678", "MX"), "+52 55 1234 5678");
    assert.equal(cleanPhone("98765 43210", "US"), null, "an Indian number isn't a US one");
    assert.equal(cleanPhone("6235550199", "XX"), "(623) 555-0199", "an unknown country falls back to the US");
  });
  it("makes call links for both kinds", () => {
    assert.equal(phoneHref("(623) 555-0199"), "tel:+16235550199");
    assert.equal(phoneHref("+91 98765 43210"), "tel:+919876543210");
  });
  it("lists the United States first, then Mexico, India and Canada", () => {
    assert.deepEqual(phoneCountries("en").slice(0, 4).map((country) => country.code), ["US", "MX", "IN", "CA"]);
  });
});
