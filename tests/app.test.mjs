// Run with: npm test  (Node 18 or later, no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { indexPlaces, leg, applyOps, describeOps, fmtTime } from "../docs/js/model.js";
import { areaList, planView, esc } from "../docs/js/views.js";

// A made-up miniature trip, so the tests don't depend on the private data.
const fixture = () => ({
  hubs: { tokyo: { name: "Tokyo" }, kyoto: { name: "Kyoto" } },
  trunk: { "kyoto|tokyo": { mode: "shinkansen", line: "Shinkansen Tokyo ⇄ Kyoto", time: "2h15" } },
  direct: {},
  areas: [
    { id: "tokyo", name: "Tokyo", jp: "東京", hub: "tokyo", access: "Hub.", lat: 35.68, lng: 139.76, december: "", station: "", trains: [],
      items: [{ id: "tokyo:a", name: "A", lat: 35.6595, lng: 139.7005, tag: "yours", note: "" }, { id: "tokyo:b", name: "B", lat: 35.6600, lng: 139.7010, tag: "yours", note: "" }, { id: "tokyo:c", name: "C <x>", lat: 35.7148, lng: 139.7967, tag: "suggested", note: "" }] },
    { id: "uji", name: "Uji", jp: "宇治", hub: "kyoto", access: "JR Nara Line from Kyoto.", lat: 34.89, lng: 135.80, december: "", station: "", trains: [],
      items: [{ id: "uji:d", name: "D", lat: 34.8893, lng: 135.8077, tag: "suggested", note: "" }] },
  ],
});

test("fmtTime", () => {
  assert.equal(fmtTime("2h15"), "~2h 15m");
  assert.equal(fmtTime("0h30"), "~30 min");
  assert.equal(fmtTime("3h00"), "~3h");
});

test("legs pick walk, local, and hub routes", () => {
  const p = fixture(); const { items } = indexPlaces(p);
  assert.equal(leg(p, items["tokyo:a"], items["tokyo:b"]).mode, "walk");
  assert.equal(leg(p, items["tokyo:a"], items["tokyo:c"]).mode, "local");
  const l = leg(p, items["tokyo:a"], items["uji:d"]);
  assert.equal(l.mode, "shinkansen");
  assert.deepEqual(l.lines, ["Shinkansen Tokyo ⇄ Kyoto", "Uji: JR Nara Line from Kyoto."]);
});

test("edits replay onto a plan changed elsewhere", () => {
  const valid = new Set(["a", "b", "c", "d"]);
  // Another device added "c" while this one added "d" and moved "a" down.
  const remote = ["a", "b", "c"];
  assert.deepEqual(applyOps(remote, [{ t: "add", id: "d" }, { t: "move", id: "a", dir: 1 }], valid), ["b", "a", "c", "d"]);
  assert.deepEqual(applyOps(remote, [{ t: "add", id: "a" }], valid), ["a", "b", "c"], "no duplicates");
  assert.deepEqual(applyOps(remote, [{ t: "remove", id: "zzz" }, { t: "move", id: "c", dir: 1 }], valid), remote, "no-ops are safe");
  assert.deepEqual(applyOps(["a", "gone"], [], valid), ["a"], "unknown ids dropped");
  assert.deepEqual(applyOps(remote, [{ t: "clear" }, { t: "add", id: "b" }], valid), ["b"]);
});

test("commit messages are short and name the stops", () => {
  const { items } = indexPlaces(fixture());
  assert.equal(describeOps([{ t: "add", id: "tokyo:a" }], items, "Heyns"), "Plan (Heyns): add A");
  const many = ["tokyo:a", "tokyo:b", "tokyo:c", "uji:d", "tokyo:a"].map(id => ({ t: "add", id }));
  assert.match(describeOps(many, items, ""), /^Plan: add A, add B, add C <x> and 2 more$/);
});

test("views escape names and render the plan", () => {
  const p = fixture(); const { items } = indexPlaces(p);
  assert.equal(esc(`<a href="x">`), "&lt;a href=&quot;x&quot;&gt;");
  const html = planView(p, items, ["tokyo:c", "uji:d"], false);
  assert.ok(html.includes("C &lt;x&gt;") && !html.includes("C <x>"));
  assert.ok(html.includes("travelmode=transit"));
  assert.ok(areaList(p, ["uji:d"]).includes("1 in plan"));
});

// Checks the real data when the private repo is checked out next to this one.
const dataFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../japan-trip-data/places.json");
test("real places.json is consistent", { skip: !fs.existsSync(dataFile) && "japan-trip-data not checked out alongside" }, () => {
  const p = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const ids = new Set(), imgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs/images");
  for (const a of p.areas) {
    assert.ok(p.hubs[a.hub], `${a.id}: unknown hub ${a.hub}`);
    for (const i of a.items) {
      assert.ok(!ids.has(i.id), `duplicate id ${i.id}`); ids.add(i.id);
      assert.ok(i.lat > 24 && i.lat < 46 && i.lng > 122 && i.lng < 146, `${i.id}: coordinates outside Japan`);
      if (i.image) assert.ok(fs.existsSync(path.join(imgDir, i.image)), `${i.id}: missing image ${i.image}`);
    }
  }
  const hubs = Object.keys(p.hubs);
  for (const x of hubs) for (const y of hubs) if (x < y) assert.ok(p.trunk[`${x}|${y}`], `no trunk route ${x}|${y}`);
});
