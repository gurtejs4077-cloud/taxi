/**
 * Copies site root assets into www/ for Capacitor (avoids bundling node_modules).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const www = path.join(root, "www");

const exts = new Set([".html", ".js", ".json", ".css", ".ico", ".png", ".svg", ".webp"]);

fs.mkdirSync(www, { recursive: true });
for (const name of fs.readdirSync(root)) {
  if (name === "www" || name === "node_modules" || name === "android" || name === "ios" || name === "scripts") continue;
  const p = path.join(root, name);
  if (!fs.statSync(p).isFile()) continue;
  const ext = path.extname(name).toLowerCase();
  if (!exts.has(ext)) continue;
  fs.copyFileSync(p, path.join(www, name));
}
console.log("[sync-www] Copied web assets into www/");
