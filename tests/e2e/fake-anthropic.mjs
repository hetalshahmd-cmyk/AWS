// A stand-in for the Claude API (POST /v1/messages) so the AI writer can be
// tested without a real key, network or cost. The app reaches it through
// ANTHROPIC_BASE_URL. A focus keyword containing "failcase" gets an error.
import http from "node:http";

const words = (n, about) =>
  Array.from({ length: n }, (_, i) => `Point ${i + 1}: general information about ${about} for patients.`).join(" ");

function answer(keyword) {
  return {
    title: `A guide to ${keyword}`,
    seoTitle: `${keyword[0].toUpperCase()}${keyword.slice(1)}: a plain guide`,
    description: `What to know about ${keyword}, when to see a doctor, and how our OB-GYN team in Phoenix and Glendale can help you.`,
    slug: `guide ${keyword}`,
    intro: `This guide explains ${keyword} in plain words. ${words(5, keyword)}`,
    sections: [
      { heading: `What is ${keyword}?`, body: `${words(8, keyword)} Ask us about [prenatal care](/services#service-4).` },
      { heading: "What happens at the visit", body: `${words(8, keyword)} A [made-up study](https://made-up.example/study) is not a source.` },
      { heading: "How to get ready", body: `- Write down your questions\n- Bring your insurance card\n\nYou can book an appointment online. ${words(4, keyword)}` },
    ],
    whenToCall: "- Bleeding that soaks a pad in an hour — call 911\n- Severe belly pain — call 911\n- Questions — call the office",
    faqs: [
      { question: `Is ${keyword} safe?`, answer: "For most people, yes. Ask your doctor about your own situation." },
      { question: "Do I need an appointment?", answer: "You can book online or call us." },
    ],
    referenceIds: ["medline-pregnancy", "owh-prenatal-tests"],
  };
}

export function startFakeAnthropic(port) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        /* ignore */
      }
      requests.push({ path: req.url, headers: req.headers, body, raw });
      const prompt = body.messages?.[0]?.content ?? "";
      const keyword = String(prompt).match(/Focus keyword: "([^"]+)"/)?.[1] ?? "pregnancy";
      res.setHeader("content-type", "application/json");
      if (req.url !== "/v1/messages" || req.method !== "POST") {
        res.statusCode = 404;
        res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "not found" } }));
        return;
      }
      if (keyword.includes("failcase")) {
        res.statusCode = 400;
        res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "test failure" } }));
        return;
      }
      res.end(
        JSON.stringify({
          id: `msg_test_${requests.length}`,
          type: "message",
          role: "assistant",
          model: body.model,
          content: [{ type: "text", text: JSON.stringify(answer(keyword)) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 6000, output_tokens: 5000 },
        }),
      );
    });
  });
  server.listen(port, "127.0.0.1");
  return { requests, close: () => new Promise((resolve) => server.close(resolve)) };
}
