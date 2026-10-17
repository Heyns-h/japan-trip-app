// State, map, loading and saving. Screens are built in views.js; plan logic lives in model.js.
import { FILES } from "./config.js";
import { githubStore, demoStore } from "./github.js";
import { indexPlaces, leg, applyOps, describeOps } from "./model.js";
import { esc, areaList, areaDetail, planView, gate, settings } from "./views.js";

const L = window.L;
const TOKEN_KEY = "jtp-token", WHO_KEY = "jtp-who", UI_KEY = "jtp-ui";
const local = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
};
const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const DEMO = isLocalhost && new URLSearchParams(location.search).has("demo");
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let store = null, places = null, items = {}, areas = {};
let ui = { tab: "places", area: null, screen: "app" };
try { ui = { ...ui, ...JSON.parse(local.get(UI_KEY) || "{}"), screen: "app" }; } catch (e) {}
let plan = [], planSha = null, pending = [], saving = false, confirmClear = false, syncState = "idle", syncMsg = "";

const view = document.getElementById("view");
const sub = document.getElementById("sub");
const syncEl = document.getElementById("sync");

// ---------- map ----------
const JAPAN = [[25.5, 127], [41.5, 142.5]];
const map = L.map("map", { minZoom: 4, maxZoom: 16 }).fitBounds(JAPAN);
const zoomClass = () => map.getContainer().classList.toggle("z-low", map.getZoom() < 7);
map.on("zoomend", zoomClass); zoomClass();

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const dark = matchMedia("(prefers-color-scheme: dark)");
let tiles;
function setTiles() {
  if (tiles) map.removeLayer(tiles);
  const opt = { maxZoom: 16, attribution: "Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors" };
  tiles = dark.matches
    ? L.layerGroup([L.tileLayer(ESRI + "Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", opt), L.tileLayer(ESRI + "Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 })])
    : L.tileLayer(ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", opt);
  tiles.addTo(map);
}
setTiles();
dark.addEventListener("change", setTiles);

const legend = L.control({ position: "bottomright" });
legend.onAdd = () => {
  const el = L.DomUtil.create("div", "legend");
  const ln = (cls, txt) => `<div><svg width="34" height="8" aria-hidden="true"><line x1="2" y1="4" x2="32" y2="4" class="${cls}" /></svg>${txt}</div>`;
  el.innerHTML = ln("route-shinkansen", "Shinkansen") + ln("route-rail", "Train") + ln("route-local", "Metro / local") + ln("route-walk", "Walk") + ln("route-flight", "Flight");
  return el;
};
legend.addTo(map);

const areaLayer = L.layerGroup().addTo(map);
const itemLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const stopLayer = L.layerGroup().addTo(map);
const divIcon = (html, size) => L.divIcon({ className: "", html, iconSize: size, iconAnchor: size.map(n => n / 2) });

function drawMap() {
  [areaLayer, itemLayer, routeLayer, stopLayer].forEach(l => l.clearLayers());
  if (!places) return;
  const planAreas = new Set(plan.map(id => items[id].area.id));
  for (const a of places.areas) {
    const cls = "pin" + (planAreas.has(a.id) ? " has-plan" : "") + (ui.area === a.id ? " active" : "");
    L.marker([a.lat, a.lng], { icon: L.divIcon({ className: "", html: `<div class="${cls}"><i></i><span>${esc(a.name)}</span></div>`, iconSize: [0, 0] }), title: a.name, zIndexOffset: ui.area === a.id ? 500 : 0 })
      .on("click", () => openArea(a.id, true)).addTo(areaLayer);
  }
  if (ui.area && areas[ui.area]) {
    for (const i of areas[ui.area].items) {
      if (plan.includes(i.id)) continue;
      L.marker([i.lat, i.lng], { icon: divIcon(`<div class="dot${i.unsure ? " unsure" : ""}"></div>`, [12, 12]), title: i.name, zIndexOffset: 800 })
        .bindTooltip(i.name, { direction: "top", offset: [0, -6] }).on("click", () => focusCard(i.id)).addTo(itemLayer);
    }
  }
  plan.forEach((id, k) => {
    const i = items[id];
    if (k > 0) {
      const p = items[plan[k - 1]];
      L.polyline([[p.lat, p.lng], [i.lat, i.lng]], { className: "route-" + leg(places, p, i).mode, interactive: false }).addTo(routeLayer);
    }
    L.marker([i.lat, i.lng], { icon: divIcon(`<div class="stopmark">${k + 1}</div>`, [24, 24]), title: `${k + 1}. ${i.name}`, zIndexOffset: 1000 })
      .bindTooltip(`${k + 1}. ${i.name}`, { direction: "top", offset: [0, -10] })
      .on("click", () => { openArea(i.area.id, false); focusCard(id); }).addTo(stopLayer);
  });
}
const fly = (bounds, maxZoom = 14) => map.flyToBounds(L.latLngBounds(bounds).pad(0.2), { maxZoom, duration: reduceMotion() ? 0 : 0.7 });

// ---------- render ----------
function render() {
  const planTab = document.getElementById("tab-plan"), placesTab = document.getElementById("tab-places");
  placesTab.setAttribute("aria-selected", ui.tab === "places" && ui.screen === "app");
  planTab.setAttribute("aria-selected", ui.tab === "plan" && ui.screen === "app");
  const c = document.getElementById("plan-count"); c.textContent = plan.length; c.toggleAttribute("data-zero", !plan.length);
  renderSync();
  if (ui.screen === "gate") view.innerHTML = gate(ui.gateError);
  else if (ui.screen === "settings") view.innerHTML = settings(local.get(WHO_KEY) || "", DEMO);
  else if (!places) view.innerHTML = `<p class="small">Loading the trip…</p>`;
  else if (ui.tab === "plan") view.innerHTML = planView(places, items, plan, confirmClear);
  else if (ui.area && areas[ui.area]) view.innerHTML = areaDetail(areas[ui.area], plan);
  else view.innerHTML = areaList(places, plan);
  drawMap();
  local.set(UI_KEY, JSON.stringify({ tab: ui.tab, area: ui.area }));
}
function rerenderKeepScroll() { const y = view.scrollTop; render(); view.scrollTop = y; }

function renderSync() {
  if (DEMO) { syncEl.dataset.state = "idle"; syncEl.innerHTML = `<span class="demo-banner">Demo data · saved in this browser only</span>`; return; }
  syncEl.dataset.state = syncState;
  const text = { idle: "", saving: "Saving…", saved: "Plan saved to GitHub", error: syncMsg || "Couldn't save" }[syncState];
  syncEl.innerHTML = text ? `<i></i><span>${esc(text)}</span>${syncState === "error" ? ` <button data-retry>Try again</button>` : ""}` : "";
}

// ---------- plan sync ----------
let saveTimer = null;
function edit(op) {
  pending.push(op);
  plan = applyOps(plan, [op], new Set(Object.keys(items)));
  confirmClear = false;
  rerenderKeepScroll();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 900);
}

async function save() {
  if (saving || !pending.length) return;
  saving = true; syncState = "saving"; renderSync();
  const batch = pending.slice();
  const valid = new Set(Object.keys(items));
  try {
    for (let attempt = 0; ; attempt++) {
      const remote = await store.read(FILES.plan);
      const stops = applyOps(remote.data.stops || [], batch, valid);
      try {
        const r = await store.write(FILES.plan, { ...remote.data, version: 1, stops }, remote.sha, describeOps(batch, items, local.get(WHO_KEY)));
        planSha = r.sha;
        pending = pending.slice(batch.length);
        // Keep any edits made while this save was running on top of the saved list.
        plan = applyOps(stops, pending, valid);
        break;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && attempt < 3) continue; // someone else saved first: re-read and replay
        throw e;
      }
    }
    syncState = "saved"; syncMsg = "";
  } catch (e) {
    syncState = "error"; syncMsg = e.message;
    if (e.status === 401) return signOut(e.message);
  } finally {
    saving = false;
  }
  rerenderKeepScroll();
  if (pending.length) save();
}

async function refreshPlan() {
  if (!store || saving || pending.length) return;
  try {
    const r = await store.read(FILES.plan);
    if (r.sha === planSha) return;
    planSha = r.sha;
    plan = applyOps(r.data.stops || [], [], new Set(Object.keys(items)));
    rerenderKeepScroll();
  } catch (e) { /* stay on the copy we have; the next save reports problems */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshPlan(); });
setInterval(refreshPlan, 60000);
window.addEventListener("beforeunload", e => { if (pending.length || saving) { save(); e.preventDefault(); } });

// ---------- load ----------
async function load() {
  render();
  try {
    const [p, pl] = await Promise.all([store.read(FILES.places), store.read(FILES.plan)]);
    places = p.data;
    ({ items, areas } = indexPlaces(places));
    planSha = pl.sha;
    plan = applyOps(pl.data.stops || [], [], new Set(Object.keys(items)));
    if (ui.area && !areas[ui.area]) ui.area = null;
    sub.textContent = `Trip planner · ${places.areas.length} areas · ${Object.keys(items).length} things to do`;
    render();
    if (ui.tab === "places" && ui.area) fly(areas[ui.area].items.map(i => [i.lat, i.lng]));
  } catch (e) {
    if (!DEMO && (e.status === 401 || e.status === 403 || e.status === 404)) return signOut(e.message);
    view.innerHTML = `<div class="gate"><h2>The trip didn't load</h2><p>${esc(e.message)}</p><div class="row"><button class="btn solid" data-reload>Try again</button></div></div>`;
  }
}

function signOut(message) {
  local.set(TOKEN_KEY, null);
  store = null; places = null; items = {}; areas = {}; plan = []; pending = [];
  ui.screen = "gate"; ui.gateError = message || "";
  syncState = "idle";
  render();
}

function start() {
  const token = local.get(TOKEN_KEY);
  if (DEMO) store = demoStore();
  else if (token) store = githubStore(token);
  else { ui.screen = "gate"; render(); return; }
  load();
}

// ---------- navigation ----------
function openArea(id, flyTo) {
  ui.screen = "app"; ui.tab = "places"; ui.area = id; render(); view.scrollTop = 0;
  if (flyTo) fly(areas[id].items.map(i => [i.lat, i.lng]));
}
function focusCard(id) {
  const el = document.getElementById("card-" + id); if (!el) return;
  el.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
  el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400);
}

document.getElementById("tab-places").onclick = () => { if (!store) return; ui.screen = "app"; ui.tab = "places"; render(); };
document.getElementById("tab-plan").onclick = () => {
  if (!store) return;
  ui.screen = "app"; ui.tab = "plan"; render();
  if (plan.length) fly(plan.map(id => [items[id].lat, items[id].lng]));
};
document.getElementById("device").onclick = () => { if (ui.screen === "gate") return; ui.screen = "settings"; render(); };

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  const d = t.dataset;
  if (d.area) openArea(d.area, true);
  else if (d.back !== undefined) { ui.area = null; render(); map.flyToBounds(JAPAN, { duration: reduceMotion() ? 0 : .6 }); }
  else if (d.toggle) edit({ t: plan.includes(d.toggle) ? "remove" : "add", id: d.toggle });
  else if (d.goto) { ui.screen = "app"; ui.tab = d.goto; render(); }
  else if (d.move) edit({ t: "move", id: d.move, dir: +d.dir });
  else if (d.remove) edit({ t: "remove", id: d.remove });
  else if (d.show) { const i = items[d.show]; map.flyTo([i.lat, i.lng], 14, { duration: reduceMotion() ? 0 : .6 }); }
  else if (d.clear) { if (d.clear === "yes") edit({ t: "clear" }); else { confirmClear = d.clear === "ask"; rerenderKeepScroll(); } }
  else if (d.retry !== undefined) save();
  else if (d.reload !== undefined) load();
  else if (d.forget !== undefined) signOut("");
});

document.addEventListener("submit", e => {
  e.preventDefault();
  if (e.target.id === "gate") {
    const token = document.getElementById("token").value.trim();
    const who = document.getElementById("who-gate").value.trim();
    if (!token) { ui.gateError = "Paste the token first."; render(); return; }
    local.set(TOKEN_KEY, token);
    if (who) local.set(WHO_KEY, who);
    ui.screen = "app"; ui.gateError = "";
    start();
  } else if (e.target.id === "settings") {
    local.set(WHO_KEY, document.getElementById("who").value.trim() || null);
    ui.screen = "app"; render();
  }
});

start();
