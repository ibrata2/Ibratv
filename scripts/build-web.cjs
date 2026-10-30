// Copies the shared web app into www/ for the Android (Capacitor) builds.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const out = path.join(root, "www");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const items = ["index.html", "styles.css", "app.js", "android-bridge.js", "cinema.js", "adblock-hosts.txt", "logo.png", "logo-small.png", "vendor", "fonts"];
for (const it of items) fs.cpSync(path.join(root, it), path.join(out, it), { recursive: true });
console.log("web assets ->", out);
