// Admin → Modify site: the home page hero and the office cards.
import { jar, pageUntil } from "./lib.mjs";
import { png } from "./doctors.mjs";

export async function run({ call, check, base, admin, doctor }) {
  console.log("\n# Modify site");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);
  const D = jar();
  await call(D, "POST", "/api/admin/session", doctor);

  check("signed out: can't read or save", (await call(jar(), "GET", "/api/admin/site")).status === 401 && (await call(jar(), "PUT", "/api/admin/site", {})).status === 401);
  check("a doctor can't change the site", (await call(D, "GET", "/api/admin/site")).status === 403);

  const original = (await call(A, "GET", "/api/admin/site")).data?.content;
  check("starts with the hero (3 pictures) and both offices", original?.hero?.slides?.length === 3 && original?.offices?.map((o) => o.id).join() === "maryvale,arrowhead");
  check("the admin page opens", (await call(A, "GET", "/admin/site")).text.includes("Modify site"));

  // Words
  const edited = structuredClone(original);
  edited.hero.title = "Caring for women in the West Valley";
  edited.hero.emphasis = "every single day.";
  edited.offices[1].name = "Arrowhead Office";
  edited.offices[1].address = ["6370 W Union Hills Dr, Suite 100", "Glendale, AZ 85308"];
  edited.offices[1].phone = "(623) 555-0142";
  const saved = await call(A, "PUT", "/api/admin/site", edited);
  check("save new words", saved.status === 200 && saved.data.content.offices[1].phone === "(623) 555-0142");
  check("…the home page shows the new headline", (await pageUntil(call, "/", (t) => t.includes("Caring for women in the West Valley"))).includes("every single day."));
  const contact = await pageUntil(call, "/contact", (t) => t.includes("Arrowhead Office"));
  check("…the office card shows the new name, address and phone", contact.includes("Suite 100") && contact.includes("tel:+16235550142"));
  check("…the privacy notice uses the new address", (await pageUntil(call, "/privacy", (t) => t.includes("Suite 100"))).includes("Suite 100"));

  // Pictures
  const form = new FormData();
  form.set("image", new File([png()], "office.png", { type: "image/png" }));
  const up = await call(A, "POST", "/api/admin/site/images", form);
  check("upload a picture", up.status === 201 && /^\/api\/site-images\/[a-f\d]{24}$/.test(up.data?.url ?? ""));
  check("…it is served as an image", (await fetch(base + up.data.url)).headers.get("content-type") === "image/png");
  const fake = new FormData();
  fake.set("image", new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.png", { type: "image/png" }));
  check("a non-image named .png is refused", (await call(A, "POST", "/api/admin/site/images", fake)).status === 400);
  check("a doctor can't upload", (await call(D, "POST", "/api/admin/site/images", form)).status === 403);

  const withUpload = structuredClone(edited);
  withUpload.offices[0].image = { photo: null, url: up.data.url, alt: "The front of the Phoenix office", position: "40% 60%" };
  withUpload.hero.slides.push({ image: { photo: "stethoscope", url: null, alt: "", position: "50% 50%" }, mobilePosition: "30% 50%", title: "Fourth picture", body: "" });
  const pic = await call(A, "PUT", "/api/admin/site", withUpload);
  check("use the upload on an office card and add a 4th hero picture", pic.status === 200 && pic.data.content.hero.slides.length === 4);
  check("…the card shows the upload", (await pageUntil(call, "/contact", (t) => t.includes(up.data.url))).includes("The front of the Phoenix office"));
  check("…the hero has 4 pictures", (await pageUntil(call, "/", (t) => t.includes("Fourth picture"))).includes("Fourth picture"));

  // Refused input
  const bad = (mutate) => {
    const copy = structuredClone(withUpload);
    mutate(copy);
    return call(A, "PUT", "/api/admin/site", copy);
  };
  const refused = await Promise.all([
    bad((c) => (c.offices[0].maps = "javascript:alert(1)")),
    bad((c) => (c.hero.slides = [])),
    bad((c) => (c.hero.title = "")),
    bad((c) => (c.offices[0].image = { photo: null, url: "/api/site-images/0123456789abcdef01234567", alt: "x", position: "50% 50%" })),
    bad((c) => (c.offices[0].image.url = "https://evil.example/x.png")),
    bad((c) => (c.hero.slides[0].image = { photo: "notAPhoto", url: null, alt: "", position: "50% 50%" })),
    bad((c) => (c.hero.slides[0].image.position = "50%; background:url(x)")),
    bad((c) => (c.offices = c.offices.slice(0, 1))),
    bad((c) => (c.offices[0].phone = "call me")),
  ]);
  check("bad links, pictures, focus points, phones and missing fields refused", refused.every((r) => r.status === 400), refused.map((r) => r.status).join(","));
  check("an upload needs a description", (await bad((c) => (c.offices[0].image.alt = ""))).status === 400);

  // Putting the original back removes the upload nobody uses any more.
  check("put the original back", (await call(A, "PUT", "/api/admin/site", original)).status === 200);
  check("…the unused upload is deleted", (await fetch(base + up.data.url)).status === 404);
  check("…the home page has the original headline", (await pageUntil(call, "/", (t) => t.includes(original.hero.emphasis.replace(/'/g, "&#x27;")))).includes(original.hero.emphasis.replace(/'/g, "&#x27;")));
}
