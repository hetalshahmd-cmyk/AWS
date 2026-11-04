/** Unit tests for the chat rules shared by browser and server:  npm test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanMessageText, dayLabel, isOnline, isTyping, MAX_MESSAGE, tickState } from "@/lib/chat";

describe("chat messages", () => {
  it("trims, keeps new lines, drops control characters and caps the length", () => {
    assert.equal(cleanMessageText("  hi\r\nthere\u0007  "), "hi\nthere");
    assert.equal(cleanMessageText("a\n\n\n\n\n\nb"), "a\n\n\nb");
    assert.equal(cleanMessageText("x".repeat(MAX_MESSAGE + 50)).length, MAX_MESSAGE);
    assert.equal(cleanMessageText(42), "");
  });
});

describe("ticks", () => {
  const message = { from: "patient" as const, createdAt: "2026-11-04T17:00:00.000Z" };
  const none = { patient: null, provider: null };
  it("✓ sent until the provider's app checks in", () => {
    assert.equal(tickState(message, { readAt: none, seenAt: none }), "sent");
  });
  it("✓✓ delivered once it has", () => {
    assert.equal(tickState(message, { readAt: none, seenAt: { patient: null, provider: "2026-11-04T17:00:05.000Z" } }), "delivered");
  });
  it("blue ✓✓ once read", () => {
    assert.equal(tickState(message, { readAt: { patient: null, provider: "2026-11-04T17:01:00.000Z" }, seenAt: none }), "read");
  });
  it("an older read doesn't count", () => {
    assert.equal(tickState(message, { readAt: { patient: null, provider: "2026-11-04T16:00:00.000Z" }, seenAt: none }), "sent");
  });
});

describe("online and typing", () => {
  const now = Date.parse("2026-11-04T17:00:00.000Z");
  it("online for 45 seconds after the app checked in", () => {
    assert.equal(isOnline("2026-11-04T16:59:30.000Z", now), true);
    assert.equal(isOnline("2026-11-04T16:58:00.000Z", now), false);
    assert.equal(isOnline(null, now), false);
  });
  it("typing for a few seconds", () => {
    assert.equal(isTyping("2026-11-04T16:59:57.000Z", now), true);
    assert.equal(isTyping("2026-11-04T16:59:40.000Z", now), false);
  });
  it("labels days the way WhatsApp does", () => {
    const today = new Date("2026-11-04T20:00:00.000Z");
    assert.equal(dayLabel("2026-11-04T16:00:00.000Z", "en", today), "Today");
    assert.equal(dayLabel("2026-11-03T16:00:00.000Z", "en", today), "Yesterday");
    assert.equal(dayLabel("2026-11-03T16:00:00.000Z", "es", today), "Ayer");
    assert.equal(dayLabel("2026-10-01T16:00:00.000Z", "en", today), "Oct 1, 2026");
  });
});
