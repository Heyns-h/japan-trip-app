// Copies the data files from the sibling japan-trip-data checkout into docs/demo/ (git-ignored),
// so the app can run on localhost with ?demo and no token.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.resolve(root, "..", "japan-trip-data");
const dest = path.join(root, "docs", "demo");
fs.mkdirSync(dest, { recursive: true });
for (const f of ["places.json", "plan.json"]) fs.copyFileSync(path.join(src, f), path.join(dest, f));
console.log("Demo data copied to", dest);
