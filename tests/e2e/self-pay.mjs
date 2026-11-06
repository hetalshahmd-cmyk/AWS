// Top menu: "Insurance" and "Self Pay" tabs; the old Pricing address redirects;
// plan names awaiting billing's confirmation are not on the site.
const PENDING_PLANS = ["Molina", "Imperial", "UPMC", "HealthSmart", "Multiplan", "Prime Health", "Provider Network of America", "See all accepted plans"];
const clean = (html) => html.replace(/<!-- -->/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

export async function run({ call, check, db }) {
  console.log("\n# Self Pay and Insurance tabs");

  const old = await call(null, "GET", "/pricing");
  check("the old /pricing address sends people to /self-pay", old.status === 308 && (old.headers.get("location") ?? "").endsWith("/self-pay"), `${old.status} ${old.headers.get("location")}`);

  const selfPay = await call(null, "GET", "/self-pay");
  const page = clean(selfPay.text);
  check("the Self Pay page opens with its new headline and subtitle", selfPay.status === 200 && page.includes("Self-Pay Pricing") && page.includes("No insurance? Simple, upfront self-pay prices, with no surprises."));
  check("…says AHCCCS accepted, never WIC accepted", page.includes("AHCCCS accepted") && !page.includes("WIC accepted"));
  check("…keeps the prices", page.includes("$100") && page.includes("$75"));
  check("…no longer lists plans awaiting billing's confirmation", PENDING_PLANS.every((plan) => !page.includes(plan)), PENDING_PLANS.filter((plan) => page.includes(plan)).join(", "));
  check("…and points insured patients to the Insurance tab", page.includes("Have insurance?") && page.includes("See the plans we accept") && page.includes('href="/insurance"'));

  const home = clean((await call(null, "GET", "/")).text);
  check("the menu has Insurance and Self Pay, and no Pricing", home.includes(">Insurance<") && home.includes(">Self Pay<") && !home.includes('href="/pricing"'));
  check("the Home page no longer lists those plans either", PENDING_PLANS.every((plan) => !home.includes(plan)) && home.includes("See the plans we accept"));
  const plans = await db.collection("plans").find().toArray();
  const firstVisit = plans.find((plan) => /new patient/i.test(`${plan.title} ${plan.tag}`));
  check(
    "the Home page's Self Pay card quotes the price from Admin → Pricing",
    Boolean(firstVisit) && home.includes(`${firstVisit.amount.replace(/\.00$/, "")} first visit`),
    firstVisit?.amount,
  );
  check("\"Cash Pay\" appears nowhere", !/cash pay/i.test(home) && !/cash pay/i.test(page));

  const insurance = await call(null, "GET", "/insurance");
  const insurancePage = clean(insurance.text);
  check(
    "the Insurance tab opens with the practice's own wording, and no unconfirmed plans",
    insurance.status === 200 &&
      insurancePage.includes("We accept most major insurance plans and AHCCCS, and help you use your benefits. If you are pregnant, we can refer you to WIC.") &&
      // Multiplan and Prime Health were confirmed by the practice in Nov 2026; the rest still wait.
      PENDING_PLANS.filter((plan) => !["Multiplan", "Prime Health"].includes(plan)).every((plan) => !insurancePage.includes(plan)),
  );
  check(
    "…and lists every network the practice confirmed, with its plans",
    ["Velocity", "Provider Select", "Prospect", "Prime Health", "MultiPlan Claritev", "IHP", "Gold Kidney Health Plan", "Galaxy Health", "Fusion", "CorVel", "MCCP"].every((name) => insurancePage.includes(`>${name}</h3>`)) &&
      insurancePage.includes("Medicare Advantage Plans") &&
      insurancePage.includes("Search your insurance"),
  );

  const sitemap = (await call(null, "GET", "/sitemap.xml")).text;
  check("the sitemap lists /insurance and /self-pay, not /pricing", sitemap.includes("/insurance") && sitemap.includes("/self-pay") && !sitemap.includes("/pricing"));
}
