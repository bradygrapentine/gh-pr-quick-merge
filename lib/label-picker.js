/* label-picker.js — modal that fetches a repo's labels and lets the user
 * tick which to apply, replacing the v0.4 comma-separated prompt() (QM-172).
 *
 * Two seams:
 *   - fetchLabels(repo, token, fetchImpl)  — pure-ish, testable.
 *   - pickLabels({ repos, token, fetchImpl, mountFn? })  — opens the modal
 *     against `document` (or a caller-supplied mount), returns Promise<string[]>
 *     resolving to the selected label names, or null on cancel.
 *
 * The picker fetches the union of labels across all selected repos. If repos
 * disagree (different label sets), the union is shown with a small
 * "(only in N/M repos)" tag so the user can pick deliberately.
 */

(function attach(scope) {
  const ENDPOINT = (repo) => `https://api.github.com/repos/${repo}/labels?per_page=100`;

  /**
   * @param {string} repo  "owner/name"
   * @param {string} token PAT or OAuth token
   * @param {typeof fetch} [fetchImpl]
   * @returns {Promise<Array<{name: string, color: string, description: string|null}>>}
   */
  async function fetchLabels(repo, token, fetchImpl) {
    const f = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    if (!f) throw new Error("label-picker: no fetch available");
    const res = await f(ENDPOINT(repo), {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((l) => ({
      name: String(l.name || ""),
      color: String(l.color || "ededed"),
      description: l.description == null ? null : String(l.description),
    }));
  }

  /**
   * Aggregate labels across multiple repos, tracking how many repos contain
   * each label name (so the UI can flag rare labels).
   *
   * @param {Map<string, Array<{name:string, color:string, description:string|null}>>} byRepo
   * @returns {Array<{name:string, color:string, description:string|null, repoCount:number}>}
   */
  function aggregateLabels(byRepo) {
    const counts = new Map();
    for (const [, labels] of byRepo) {
      const seenInRepo = new Set();
      for (const l of labels) {
        if (seenInRepo.has(l.name)) continue;
        seenInRepo.add(l.name);
        const prev = counts.get(l.name);
        if (prev) prev.repoCount++;
        else counts.set(l.name, { ...l, repoCount: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Open the picker. Returns array of selected label names, or null if cancelled.
   *
   * @param {object} opts
   * @param {string[]} opts.repos          — repo slugs to fetch labels from
   * @param {string} opts.token
   * @param {typeof fetch} [opts.fetchImpl]
   * @param {Document} [opts.doc]          — defaults to global document
   * @returns {Promise<string[]|null>}
   */
  async function pickLabels({ repos, token, fetchImpl, doc }) {
    const _doc = doc || (typeof document !== "undefined" ? document : null);
    if (!_doc) throw new Error("label-picker: no document available");
    if (!Array.isArray(repos) || repos.length === 0) return null;

    // Fetch in parallel; tolerate per-repo failures so the picker still opens.
    const byRepo = new Map();
    const errors = [];
    const results = await Promise.allSettled(repos.map((r) => fetchLabels(r, token, fetchImpl)));
    results.forEach((r, i) => {
      if (r.status === "fulfilled") byRepo.set(repos[i], r.value);
      else errors.push(`${repos[i]}: ${r.reason && r.reason.message ? r.reason.message : "fetch failed"}`);
    });
    const labels = aggregateLabels(byRepo);

    return new Promise((resolve) => {
      const modal = _doc.createElement("div");
      modal.className = "qm-typed-modal qm-label-picker-modal";
      const card = _doc.createElement("div");
      card.className = "qm-typed-card qm-label-picker-card";

      const heading = _doc.createElement("h2");
      heading.textContent = "Apply labels";
      card.appendChild(heading);

      if (errors.length) {
        const err = _doc.createElement("p");
        err.className = "qm-label-picker-err";
        err.textContent = `Couldn't fetch labels for ${errors.length} repo(s): ${errors.join("; ")}`;
        card.appendChild(err);
      }

      if (labels.length === 0) {
        const empty = _doc.createElement("p");
        empty.textContent = byRepo.size === 0
          ? "No labels could be fetched. Check your token and try again."
          : "These repos have no labels defined.";
        card.appendChild(empty);
      }

      const list = _doc.createElement("ul");
      list.className = "qm-label-picker-list";
      const checks = [];
      for (const l of labels) {
        const li = _doc.createElement("li");
        const lbl = _doc.createElement("label");
        const cb = _doc.createElement("input");
        cb.type = "checkbox";
        cb.value = l.name;
        cb.dataset.qmLabel = l.name;
        checks.push(cb);
        const swatch = _doc.createElement("span");
        swatch.className = "qm-label-picker-swatch";
        swatch.style.background = `#${l.color}`;
        const name = _doc.createElement("span");
        name.className = "qm-label-picker-name";
        name.textContent = l.name;
        lbl.appendChild(cb);
        lbl.appendChild(swatch);
        lbl.appendChild(name);
        if (l.repoCount < byRepo.size) {
          const tag = _doc.createElement("span");
          tag.className = "qm-label-picker-tag";
          tag.textContent = `only in ${l.repoCount}/${byRepo.size} repo${byRepo.size === 1 ? "" : "s"}`;
          lbl.appendChild(tag);
        }
        li.appendChild(lbl);
        list.appendChild(li);
      }
      card.appendChild(list);

      const actions = _doc.createElement("div");
      actions.className = "qm-typed-actions";
      const cancelBtn = _doc.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "qm-btn";
      cancelBtn.textContent = "Cancel";
      const goBtn = _doc.createElement("button");
      goBtn.type = "button";
      goBtn.className = "qm-btn qm-typed-go";
      goBtn.textContent = "Apply";
      goBtn.disabled = true;
      actions.appendChild(cancelBtn);
      actions.appendChild(goBtn);
      card.appendChild(actions);
      modal.appendChild(card);
      _doc.body.appendChild(modal);

      function close(result) {
        modal.remove();
        resolve(result);
      }
      checks.forEach((cb) => cb.addEventListener("change", () => {
        goBtn.disabled = !checks.some((c) => c.checked);
      }));
      cancelBtn.addEventListener("click", () => close(null));
      goBtn.addEventListener("click", () => {
        const picked = checks.filter((c) => c.checked).map((c) => c.value);
        close(picked.length ? picked : null);
      });
      modal.addEventListener("click", (e) => { if (e.target === modal) close(null); });
    });
  }

  const api = { fetchLabels, aggregateLabels, pickLabels };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.QM_LABEL_PICKER = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
