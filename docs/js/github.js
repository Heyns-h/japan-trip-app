// Read and write JSON files in the private data repository through the GitHub Contents API.
import { DATA_REPO } from "./config.js";

export class GitHubError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), c => c.charCodeAt(0)));
const b64encode = text => { let s = ""; new TextEncoder().encode(text).forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };

export function githubStore(token) {
  const base = `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}/contents/`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

  async function call(path, init = {}) {
    let res;
    try { res = await fetch(base + path + (init.method ? "" : `?ref=${DATA_REPO.branch}`), { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" }); }
    catch (e) { throw new GitHubError(0, "Can't reach GitHub. Check your connection."); }
    if (res.ok) return res.json();
    const msg = {
      401: "GitHub didn't accept this token. It may have expired or been deleted.",
      403: "This token can't access the trip data. Check it has Contents access to japan-trip-data.",
      404: "The trip data wasn't found. Check the token has access to japan-trip-data.",
    }[res.status] || `GitHub returned an error (${res.status}).`;
    throw new GitHubError(res.status, msg);
  }

  return {
    async read(path) {
      const j = await call(path);
      return { data: JSON.parse(b64decode(j.content)), sha: j.sha };
    },
    async write(path, data, sha, message) {
      const j = await call(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, content: b64encode(JSON.stringify(data, null, 2) + "\n"), sha, branch: DATA_REPO.branch }),
      });
      return { sha: j.content.sha };
    },
  };
}

// Demo mode (localhost only): reads docs/demo/ and keeps the plan in this browser.
export function demoStore() {
  const KEY = "jtp-demo-plan";
  return {
    async read(path) {
      if (path === "plan.json") {
        try { const s = localStorage.getItem(KEY); if (s) return { data: JSON.parse(s), sha: "demo" }; } catch (e) {}
      }
      const res = await fetch("demo/" + path, { cache: "no-store" });
      if (!res.ok) throw new GitHubError(res.status, "Demo data missing. Run: node tools/make_demo.mjs");
      return { data: await res.json(), sha: "demo" };
    },
    async write(path, data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
      return { sha: "demo" };
    },
  };
}
