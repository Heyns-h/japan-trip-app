// HTML for each screen. Pure functions of their arguments, so they can be tested without a browser.
import { REGIONS, MODE_LABEL, leg, gSearch, gDirections } from "./model.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function areaList(places, plan) {
  const inPlan = new Set(plan);
  return REGIONS.map(([title, hub]) => {
    const rows = places.areas.filter(a => a.hub === hub).map(a => {
      const n = a.items.filter(i => inPlan.has(i.id)).length;
      return `<button class="area-row" data-area="${esc(a.id)}"><span><b>${esc(a.name)}</b><span class="jp">${esc(a.jp)}</span></span>
        <span class="meta">${a.items.length} places${n ? ` · <em>${n} in plan</em>` : ""}</span></button>`;
    }).join("");
    return rows ? `<h2 class="region">${esc(title)}</h2><div class="region-group">${rows}</div>` : "";
  }).join("") + `<p class="disclaimer">Travel times are approximate. December hours, holiday closures (Dec 29–Jan 3) and sightseeing-train calendars change every year, so check before you book.</p>`;
}

function card(i, inPlan) {
  const chip = i.unsure ? `<span class="chip unsure">Check location</span>` : i.tag === "yours" ? `<span class="chip yours">Your pick</span>` : `<span class="chip">Suggested</span>`;
  const img = i.image
    ? `<img src="images/${esc(i.image)}" alt="${esc(i.name)}" loading="lazy"><a class="credit" href="${esc(i.credit)}" target="_blank" rel="noopener">Wikipedia</a>`
    : `<div class="ph" aria-hidden="true">${esc(i.area.jp.slice(0, 2))}</div>`;
  return `<article class="card${inPlan ? " in-plan" : ""}" id="card-${esc(i.id)}">
    <div class="thumb">${img}${chip}</div>
    <div class="card-body">
      <h3>${esc(i.name)}</h3>
      <p>${esc(i.note)}</p>
      <div class="links">
        <a href="${gSearch(`${i.name} ${i.area.name} Japan`)}" target="_blank" rel="noopener">Google search ↗</a>
        <a href="${gSearch(`${i.name} ${i.area.name} December`)}" target="_blank" rel="noopener">In December ↗</a>
      </div>
      <button class="add" data-toggle="${esc(i.id)}" aria-pressed="${inPlan}">${inPlan ? "✓ In plan" : "+ Add to plan"}</button>
    </div>
  </article>`;
}

export function areaDetail(a, plan) {
  const inPlan = new Set(plan);
  return `<button class="back" data-back>← All places</button>
    <div class="area-title"><h2>${esc(a.name)}</h2><span class="jp">${esc(a.jp)}</span>
      <a href="${gSearch(a.name + " Japan things to do December")}" target="_blank" rel="noopener">Search ${esc(a.name)} ↗</a></div>
    <div class="note-dec"><span class="label">In December</span><p>${esc(a.december)}</p></div>
    <div class="access"><span class="label">Getting there</span><span class="station">${esc(a.station)}</span><p>${esc(a.access)}</p></div>
    <div class="cards">${a.items.map(i => card(i, inPlan.has(i.id))).join("")}</div>
    <section class="trains"><span class="label">Sightseeing trains</span>
      ${a.trains.length ? a.trains.map(t => `<div class="train"><a href="${gSearch(t.name + " train December schedule")}" target="_blank" rel="noopener">${esc(t.name)} ↗</a>
        <span class="route">${esc(t.route)}</span>${t.note ? `<span class="tn">${esc(t.note)}</span>` : ""}</div>`).join("")
        : `<p class="small">No sightseeing train serves ${esc(a.name)} directly. See “Getting there” above.</p>`}
      <p class="small">Many sightseeing trains run on a reduced winter calendar. Check the December dates before planning around one.</p>
    </section>`;
}

export function planView(places, items, plan, confirmClear) {
  if (!plan.length) {
    return `<div class="empty"><h3>Your route starts here</h3>
      <p>Open a place, then tap <b>+ Add to plan</b> on the things you've confirmed. They appear here in order, with the train or metro between each stop and a line on the map.</p>
      <p>The plan is shared: anyone with access sees the same list.</p>
      <div class="row"><button class="btn solid" data-goto="places">Browse places</button></div></div>`;
  }
  let html = `<ol class="stops">`;
  plan.forEach((id, k) => {
    const i = items[id];
    if (k > 0) {
      const p = items[plan[k - 1]], l = leg(places, p, i);
      html += `<li class="leg" data-mode="${l.mode}"><span class="mode">${MODE_LABEL[l.mode]}${l.time ? `<span class="t">${esc(l.time)}</span>` : ""}</span>
        ${l.lines.map(t => `<p>${esc(t)}</p>`).join("")}
        <a href="${gDirections(p, i)}" target="_blank" rel="noopener">Exact route in Google Maps ↗</a></li>`;
    }
    html += `<li class="stop"><span class="num">${k + 1}</span>
      <span class="name"><button data-show="${esc(id)}"><b>${esc(i.name)}</b><span>${esc(i.area.name)}</span></button></span>
      <span class="ctrl"><button data-move="${esc(id)}" data-dir="-1" aria-label="Move up" ${k === 0 ? "disabled" : ""}>↑</button><button data-move="${esc(id)}" data-dir="1" aria-label="Move down" ${k === plan.length - 1 ? "disabled" : ""}>↓</button><button data-remove="${esc(id)}" aria-label="Remove">✕</button></span></li>`;
  });
  html += `</ol><section class="plan-tools"><div class="row">
    ${confirmClear ? `<button class="btn danger" data-clear="yes">Yes, clear all ${plan.length} stops</button><button class="btn" data-clear="no">Keep them</button>` : `<button class="btn danger" data-clear="ask">Clear plan</button>`}
    </div></section>`;
  return html;
}

export function gate(error) {
  return `<form class="gate" id="gate">
    <h2>Connect this device</h2>
    <p>The places and your plan are stored in a private GitHub repository. Paste this device's access token to open them. It's saved only in this browser.</p>
    <ol>
      <li>On GitHub: Settings → Developer settings → Fine-grained tokens → Generate new token.</li>
      <li>Repository access: only <b>japan-trip-data</b>. Permission: <b>Contents: Read and write</b>. Set an expiry date.</li>
      <li>Copy the token and paste it below.</li>
    </ol>
    <div class="field"><label for="token">Access token</label><input id="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></div>
    <div class="field"><label for="who-gate">Your name (shown in the plan history)</label><input id="who-gate" type="text" autocomplete="nickname" placeholder="e.g. Heyns"></div>
    <p class="err" role="alert">${esc(error || "")}</p>
    <div class="row"><button class="btn solid" type="submit">Connect</button></div>
  </form>`;
}

export function settings(who, demo) {
  return `<form class="gate" id="settings">
    <h2>This device</h2>
    <div class="field"><label for="who">Your name (shown in the plan history)</label><input id="who" type="text" value="${esc(who)}" autocomplete="nickname"></div>
    <div class="row"><button class="btn solid" type="submit">Save name</button><button class="btn" type="button" data-goto="places">Back</button></div>
    ${demo ? `<p class="small">Demo mode: nothing is sent to GitHub.</p>` : `<p class="small">Forgetting the token signs this device out. To cut off a lost device completely, delete its token on GitHub.</p>
    <div class="row"><button class="btn danger" type="button" data-forget>Forget token</button></div>`}
  </form>`;
}
