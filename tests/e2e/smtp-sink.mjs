// Minimal SMTP sink for local tests: accepts everything, saves each message
// as a .eml file, never relays anything.
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const port = Number(process.argv[3] ?? 2525);
fs.mkdirSync(dir, { recursive: true });
let count = 0;

net
  .createServer((socket) => {
    let buffer = "";
    let inData = false;
    let data = [];
    const send = (line) => socket.write(line + "\r\n");
    send("220 sink ready");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            count += 1;
            fs.writeFileSync(path.join(dir, `${String(count).padStart(3, "0")}.eml`), data.join("\r\n"));
            data = [];
            send("250 ok");
          } else data.push(line.startsWith("..") ? line.slice(1) : line);
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO") {
          send("250-sink");
          send("250-AUTH PLAIN LOGIN");
          send("250 8BITMIME");
        } else if (cmd === "HELO") send("250 sink");
        else if (cmd === "AUTH") {
          if (/LOGIN/i.test(line) && line.trim().split(/\s+/).length === 2) send("334 VXNlcm5hbWU6");
          else send("235 ok");
        } else if (cmd === "DATA") {
          inData = true;
          send("354 go");
        } else if (cmd === "QUIT") {
          send("221 bye");
          socket.end();
        } else if (/^[A-Za-z0-9+/=]+$/.test(line) && line.length > 0 && !["MAIL", "RCPT", "RSET", "NOOP"].includes(cmd)) {
          // AUTH LOGIN username/password lines
          send(line.length && socket.loginStep ? "235 ok" : "334 UGFzc3dvcmQ6");
          socket.loginStep = true;
        } else send("250 ok");
      }
    });
    socket.on("error", () => {});
  })
  .listen(port, "127.0.0.1", () => console.log(`sink on ${port} -> ${dir}`));
