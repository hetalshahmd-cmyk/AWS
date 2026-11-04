// Patient ↔ provider chat: who can chat, messages and pictures, read receipts,
// typing, delete for everyone, privacy between chats, admins read only, and
// emails that never carry the message.
import fs from "node:fs";
import path from "node:path";
import { jar, pageUntil } from "./lib.mjs";
import { png } from "./doctors.mjs";

const SECRET = "my bleeding started again this morning";

async function signInPatient(call, db, skip = []) {
  for (const user of await db.collection("users").find({ demo: true }, { projection: { email: 1 }, sort: { _id: 1 } }).toArray()) {
    if (skip.includes(user.email)) continue;
    const P = jar();
    if ((await call(P, "POST", "/api/auth/session", { email: user.email, password: "Demo@2026" })).status === 200) return { P, email: user.email };
  }
  return null;
}

/** Mail the fake SMTP server received for `to` since `after` (ms). */
function mailFor(mailDir, to, after) {
  if (!fs.existsSync(mailDir)) return [];
  return fs
    .readdirSync(mailDir)
    .map((file) => path.join(mailDir, file))
    .filter((file) => fs.statSync(file).mtimeMs > after)
    .map((file) => fs.readFileSync(file, "utf8"))
    .filter((body) => body.includes(to));
}

export async function run({ call, check, db, admin, doctor, mailDir }) {
  console.log("\n# Chat");
  const A = jar();
  await call(A, "POST", "/api/admin/session", admin);
  const D = jar(); // Julie Denton
  await call(D, "POST", "/api/admin/session", doctor);
  const T = jar(); // Kylee Tate
  await call(T, "POST", "/api/admin/session", { email: "tate@arizonawomen.com", password: doctor.password });

  // Chat buttons on the Providers page: providers with a sign-in only.
  const about = await pageUntil(call, "/about", (t) => t.includes("/my-bookings/messages"));
  check("the Providers page has Chat for providers who can sign in", about.includes(encodeURIComponent("/my-bookings/messages?provider=denton")));
  check("…and none for providers without a sign-in (Dr. Erickson)", !about.includes("provider%3Derickson") && !about.includes("provider=erickson"));

  const first = await signInPatient(call, db);
  check("a patient signs in", Boolean(first));
  if (!first) return;
  const { P, email } = first;

  check("signed out, chats are closed", (await call(jar(), "GET", "/api/my/chats")).status === 401);
  check("no chat with a provider who can't answer", (await call(P, "POST", "/api/my/chats", { providerId: "erickson" })).status === 400);
  const opened = await call(P, "POST", "/api/my/chats", { providerId: "denton" });
  const id = opened.data?.conversation?.id;
  check("a patient opens a chat with Julie", opened.status === 200 && Boolean(id));
  check("…the same chat again on the next click", (await call(P, "POST", "/api/my/chats", { providerId: "denton" })).data?.conversation?.id === id);

  const send = (j, family, fields) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return call(j, "POST", `/api/${family}/chats/${id}/messages`, form);
  };

  const before = Date.now();
  const sent = await send(P, "my", { text: `Hello Julie — ${SECRET}` });
  check("the patient sends a message", sent.status === 201 && sent.data.message.text.includes(SECRET));
  const picture = await send(P, "my", { text: "", image: new File([png()], "rash.png", { type: "image/png" }) });
  check("…and a picture", picture.status === 201 && picture.data.message.image?.id);
  const refused = await Promise.all([
    send(P, "my", { text: "   " }),
    send(P, "my", { text: "", image: new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.png", { type: "image/png" }) }),
  ]);
  check("empty messages and fake pictures are refused", refused.every((r) => r.status === 400), refused.map((r) => r.status).join(","));
  const long = await send(P, "my", { text: "x".repeat(2500) });
  check("…a very long message is cut to 2,000 characters", long.status === 201 && long.data.message.text.length === 2000);

  // The provider
  const list = await call(D, "GET", "/api/doctor/chats");
  const forJulie = list.data?.conversations?.find((item) => item.id === id);
  check("Julie sees the chat with 3 unread", forJulie?.unread === 3 && forJulie.patientEmail === email, JSON.stringify(forJulie?.unread));
  check("…another provider can't open it", (await call(T, "GET", `/api/doctor/chats/${id}`)).status === 404);
  const thread = await call(D, "GET", `/api/doctor/chats/${id}`);
  check("Julie reads the messages, oldest first", thread.status === 200 && thread.data.messages.length === 3 && thread.data.messages[0].text.includes(SECRET));
  const image = await call(D, "GET", `/api/chat-files/${picture.data.message.image.id}?as=staff`);
  check("…and opens the picture", image.status === 200 && image.headers.get("content-type") === "image/png");

  // Ticks: delivered once Julie's app checked in, read once she opened it.
  let patientView = await call(P, "GET", `/api/my/chats/${id}`);
  check("✓✓ delivered: the patient sees Julie's app has checked in", Boolean(patientView.data.conversation.seenAt.provider));
  await call(D, "POST", `/api/doctor/chats/${id}/read`);
  patientView = await call(P, "GET", `/api/my/chats/${id}`);
  check("✓✓ read: Julie's read time is after the messages", patientView.data.conversation.readAt.provider >= picture.data.message.createdAt);

  await call(D, "POST", `/api/doctor/chats/${id}/typing`);
  const after = patientView.data.now;
  const typingView = await call(P, "GET", `/api/my/chats/${id}?after=${encodeURIComponent(after)}`);
  check("the patient sees Julie typing", Date.now() - Date.parse(typingView.data.conversation.typingAt.provider) < 6000);
  const reply = await send(D, "doctor", { text: "Please call the office today so we can see you." });
  check("Julie replies", reply.status === 201);
  const news = await call(P, "GET", `/api/my/chats/${id}?after=${encodeURIComponent(typingView.data.now)}`);
  check(
    "…and the patient's next check brings the new message (plus at most a 2-second overlap)",
    news.data.messages.some((m) => m.id === reply.data.message.id) &&
      news.data.messages.every((m) => m.id === reply.data.message.id || Date.parse(m.createdAt) >= Date.parse(typingView.data.now) - 2500) &&
      news.data.conversation.unread === 1,
    `${news.data.messages.length} messages, unread ${news.data.conversation.unread}`,
  );

  // Pictures and chats stay private.
  const other = await signInPatient(call, db, [email]);
  check("another patient can't open this chat or its picture", (await call(other.P, "GET", `/api/my/chats/${id}`)).status === 404 && (await call(other.P, "GET", `/api/chat-files/${picture.data.message.image.id}?as=patient`)).status === 404);
  check("signed out, pictures are closed", (await call(jar(), "GET", `/api/chat-files/${picture.data.message.image.id}?as=patient`)).status === 401);
  check("the patient's own picture opens for them", (await call(P, "GET", `/api/chat-files/${picture.data.message.image.id}?as=patient`)).status === 200);

  // Delete for everyone — kept for the practice.
  const mine = sent.data.message.id;
  check("a patient can't delete the provider's message", (await call(P, "DELETE", `/api/my/chats/${id}/messages/${reply.data.message.id}`)).status === 400);
  const deleted = await call(P, "DELETE", `/api/my/chats/${id}/messages/${mine}`);
  check("the patient deletes their own message for everyone", deleted.status === 200 && deleted.data.message.deletedAt && deleted.data.message.text === "");
  const julieAfter = await call(D, "GET", `/api/doctor/chats/${id}`);
  check("…Julie sees \"deleted\", not the text", julieAfter.data.messages.find((m) => m.id === mine)?.text === "" && !JSON.stringify(julieAfter.data).includes(SECRET));
  const adminView = await call(A, "GET", `/api/doctor/chats/${id}`);
  check("…the admin still sees the original, marked deleted", adminView.data.messages.find((m) => m.id === mine)?.text.includes(SECRET) && adminView.data.messages.find((m) => m.id === mine)?.deletedAt);
  check("…and it is still in the database", (await db.collection("chat_messages").countDocuments({ text: { $regex: SECRET } })) === 1);

  // Admins: every chat, read only.
  check("the admin lists every chat", (await call(A, "GET", "/api/doctor/chats")).data.conversations.some((item) => item.id === id));
  check("…but can't write in one", (await send(A, "doctor", { text: "hi" })).status === 403 && (await call(A, "POST", `/api/doctor/chats/${id}/read`)).status === 403);
  check("…and reading doesn't mark anything read", (await db.collection("chat_conversations").findOne({ patientEmail: email, providerId: "denton" })).unread.patient === 1);

  // Emails say "new message" — never the message.
  const mail = mailFor(mailDir, "denton@arizonawomen.com", before - 1000);
  check("Julie was emailed about the new message", mail.some((body) => body.includes("New message from a patient")));
  check("…without the message itself", mail.every((body) => !body.includes(SECRET) && !body.includes("bleeding")));

  // The pages
  check("the patient's Messages page opens", (await call(P, "GET", `/my-bookings/messages?chat=${id}`)).status === 200);
  check("Julie's Messages page opens", (await call(D, "GET", "/admin/doctor/messages")).text.includes("Messages"));
  check("the admin's Patient chats page opens", (await call(A, "GET", "/admin/messages")).text.includes("Patient chats"));
  const viaButton = await call(P, "GET", "/my-bookings/messages?provider=tate");
  check("the Chat button link opens a chat with that provider", viaButton.status === 200 && (await db.collection("chat_conversations").countDocuments({ patientEmail: email, providerId: "tate" })) === 1);
}
