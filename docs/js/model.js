// Pure functions: indexing places, travel legs between stops, and plan edits. No DOM, no network.

export const MODE_LABEL = { walk: "Walk", local: "Metro / local train or bus", rail: "Train", shinkansen: "Shinkansen", flight: "Flight" };

export const REGIONS = [
  ["Kanto & Gunma", "tokyo"],
  ["Kyoto & around", "kyoto"],
  ["Osaka, Nara & Kii", "osaka"],
  ["Kyushu", "fukuoka"],
  ["Okinawa", "okinawa"],
];

/** Adds item.area back-references and returns lookup tables. */
export function indexPlaces(places) {
  const items = {}, areas = {};
  for (const a of places.areas) {
    areas[a.id] = a;
    for (const i of a.items) { i.area = a; items[i.id] = i; }
  }
  return { items, areas };
}

export function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "2h15" → "~2h 15m", "0h30" → "~30 min" */
export function fmtTime(t) {
  const [h, m] = t.split("h").map(Number);
  return "~" + (h ? `${h}h${m ? ` ${m}m` : ""}` : `${m} min`);
}

const pairKey = (x, y) => [x, y].sort().join("|");

/** How to get from item a to item b: { mode, time, lines[] }. */
export function leg(places, a, b) {
  const d = km(a, b), A = a.area, B = b.area;
  if (A === B) {
    if (d < 1.3) return { mode: "walk", time: `~${Math.max(5, Math.round(d / 4.5 * 60))} min`, lines: [`${d.toFixed(1)} km on foot.`] };
    return { mode: "local", time: "", lines: [`${d.toFixed(1)} km across ${A.name}. Check the Google Maps link for the best line.`] };
  }
  const direct = places.direct[pairKey(A.id, B.id)];
  if (direct) return { mode: direct.mode, time: fmtTime(direct.time), lines: [direct.line] };
  const lines = [];
  if (A.hub !== A.id) lines.push(`Back to ${places.hubs[A.hub].name}: reverse of “${A.access}”`);
  let mode = "rail", time = "";
  if (A.hub !== B.hub) {
    const t = places.trunk[pairKey(A.hub, B.hub)];
    if (t) { lines.push(t.line); mode = t.mode; time = fmtTime(t.time) + " main leg"; }
  }
  if (B.hub !== B.id) lines.push(`${B.name}: ${B.access}`);
  return { mode, time, lines };
}

/**
 * Applies queued edits to a plan's stop list. Edits are replayed on the latest copy from GitHub
 * before every save, so changes made on another device in the meantime are kept.
 */
export function applyOps(stops, ops, validIds) {
  let s = stops.filter(id => validIds.has(id));
  for (const op of ops) {
    const k = s.indexOf(op.id);
    if (op.t === "add" && k < 0 && validIds.has(op.id)) s.push(op.id);
    else if (op.t === "remove" && k >= 0) s.splice(k, 1);
    else if (op.t === "move" && k >= 0) {
      const j = k + op.dir;
      if (j >= 0 && j < s.length) [s[k], s[j]] = [s[j], s[k]];
    }
    else if (op.t === "clear") s = [];
  }
  return s;
}

/** Short commit message for a batch of edits. */
export function describeOps(ops, items, who) {
  const name = id => items[id]?.name || id;
  const parts = ops.map(op => op.t === "add" ? `add ${name(op.id)}` : op.t === "remove" ? `remove ${name(op.id)}` : op.t === "move" ? `move ${name(op.id)} ${op.dir < 0 ? "up" : "down"}` : "clear plan");
  const text = parts.length > 3 ? `${parts.slice(0, 3).join(", ")} and ${parts.length - 3} more` : parts.join(", ");
  return `Plan${who ? ` (${who})` : ""}: ${text}`;
}

export const gSearch = q => "https://www.google.com/search?q=" + encodeURIComponent(q);
const place = i => i.unsure ? `${i.lat},${i.lng}` : `${i.name}, ${i.area.name}, Japan`;
export const gDirections = (a, b) =>
  "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(place(a)) + "&destination=" + encodeURIComponent(place(b)) + "&travelmode=transit";
