# YMR Dashboard — Layout & Control Restructure (2026-08-21)

## Context for Claude Code
This is the `YMR-Dashboard` repo (single-page dashboard: `dashboard.html` + `assets/dashboard.js` + `assets/data.js`, no build step, no framework). It already follows a spec in `instruction.md` — read that file first for the existing architecture conventions (the `state` object, `renderAll()` pipeline, the pill-slicer pattern, the full-screen `.icon-btn` pattern, the theme system). Do **not** touch `assets/data.js`, `scripts/refresh_data.py`, `scripts/refresh_data.ps1`, or `Update_Dashboard.bat` — this is a pure layout/UI restructure of `dashboard.html` and `assets/dashboard.js` (plus its `<style>` block).

Everything below was requested verbatim by the dashboard owner. Where the request is ambiguous I've written the most literal reading and flagged it — confirm with the user before a change that would alter what data the trend chart or breakdown reacts to, since that's a behavior change, not just a layout change.

---

## 1. Logo
A new logo file, `Pyraloop Logo.png`, is sitting at the repo root (next to `dashboard.html`). The dashboard already supports a drop-in logo: `dashboard.html` has `<img id="brandLogoImg" src="assets/pyraloop-logo.png" ... hidden>` and `assets/dashboard.js`'s `initLogo()` un-hides it automatically on successful load, hiding the built-in `<svg id="brandLogoWord">` wordmark instead.

**Task:** Copy/rename `Pyraloop Logo.png` (repo root) to `assets/pyraloop-logo.png`, replacing/adding that file. No HTML/JS change should be needed since the swap is already wired up — just verify the image renders cleanly at the header's `height:34px` (see `.brand-logo img` in the `<style>` block) without distortion; adjust `.brand-logo img` sizing only if the new logo's aspect ratio makes it look wrong at that height.

---

## 2. Top row: Financial Year / Plant / Theme / AI Insights
**Current state:** `.control-row` (Financial Year → Plant → Theme) and `.top-slicer` (AI Insights button, Plant-wise Breakdown button) are two separate rows, `.top-slicer` sitting below `.control-row`.

**Requested:** One single row containing, left to right:
1. **AI Insights** button — **extreme left**
2. **Financial Year** dropdown
3. **Plant** dropdown
4. **Theme** selector — stays rightmost, as today

**Task:**
- Merge the AI Insights button (`#insightsToggle`) into `.control-row`, as a new first `.control-cell`.
- Remove `#breakdownToggle` from this row entirely (see §4 — the whole Plant-wise Breakdown feature is being deleted, not just relocated).
- The `#insightsPanel` section (which the button opens) stays where it is in the document — only the *button* moves.
- Keep the existing `insightsToggle` click handler / `aria-expanded` / open-state logic in `assets/dashboard.js` (`~line 603-625`) working from its new location; it doesn't need new JS, just the DOM move.

---

## 3. Delete "Plant-wise Breakdown" completely
**Requested:** "Plant wise break down eliminate from dashboard and also eliminate complete row."

**Task — remove entirely, not just hide:**
- `dashboard.html`: delete `<button id="breakdownToggle">…</button>` (inside `.top-slicer`) and the whole `<section class="card" id="breakdownPanel" hidden>…</section>` block.
- Once the breakdown button is gone and AI Insights has moved into `.control-row` (§2), the now-empty `.top-slicer` wrapper `<div class="top-slicer">…</div>` (with its `<span class="hint">…</span>`) should be removed too — don't leave a stray empty/near-empty row.
- `assets/dashboard.js`: remove `renderBreakdown()`, `applyBreakdownOpen()`, the `breakdownToggle` click-handler block (`~line 627-645`), the `state.breakdownOpen` field, and the `renderBreakdown()` call inside `renderAll()`.
- `<style>` block: remove now-unused breakdown-only CSS (`table.breakdown`, `.cell-status`, `.dot`, `.table-scroll`, `.insight-btn` stays — it's shared with AI Insights) — double check `.insight-btn`/`.icon-btn` classes aren't reused elsewhere before deleting any of them.
- Leave `renderKpis()` / the "Performance vs Target" section untouched — that's a different feature (see §6), don't confuse the two.

---

## 4. Remove "Filters" heading
**Task:** In `dashboard.html`, the `<section class="card">` that wraps the Unit/Month pill slicers currently starts with `<h2>Filters</h2>` (just above `.filters-grid`). Delete that `<h2>` line. Leave the rest of the card (the `.filters-grid` with `#unitSlicer` / `#monthSlicer`) as the target for §5 below.

---

## 5. Unit / Week / Month — one row, in that order
**Requested:** "slicer of unit and month should be in same Row parallel line, while extreme left should be all units and then week and then Months."

**Current state:** `#unitGroup` and the Month `.filter-group` are both inside `.filters-grid` (`display:flex; flex-wrap:wrap`), but the Month group has inline style `flex:1; min-width:100%` which forces it onto its own line below Unit. There is currently **no "Week" slicer** in this row — "week" only exists today as: (a) the `Week-01` row in the source data, (b) the separate "Trend by" control's `Week-wise` option (being removed, §7), and (c) the AI Insights panel's own "Current Week" view toggle (leave that one alone — it's scoped to the Insights panel, not this row).

**Task:**
- Fix the CSS so Unit and Month stay on one row wherever there's width for it: remove the `flex:1; min-width:100%` inline style from the Month `.filter-group` and let both groups share `.filters-grid`'s normal flex-wrap behavior (matching how Unit already behaves).
- Add a **Week** pill-group between Unit and Month, so left-to-right order is: **Unit pills → Week pill(s) → Month pills**. Recommended implementation, matching the existing pill pattern (`buildUnitSlicer()` / `buildMonthSlicer()` in `assets/dashboard.js`):
  - Add a new `#weekGroup` / `#weekSlicer` `.filter-group` between `#unitGroup` and the Month group in `dashboard.html`.
  - Add a `buildWeekSlicer()` in `assets/dashboard.js` that renders a single toggle-able pill (e.g. "Current Week") bound to the `Week-01` row in the data, following the same on/off pattern as the existing pills.
  - This is a **behavior decision, not just layout** — confirm with the user how "Week" should interact with `state.period`: does selecting Week deselect the active Month pill (mutually exclusive, like Month vs YTD today), or can Week and Month both be highlighted with Week taking precedence? The cleanest fit with the existing `state.period` model (one active period at a time — a month label, `"YTD"`, or now also `"Week-01"`) is **mutually exclusive with Month/YTD**, i.e. add `"Week-01"` as another value `state.period` can hold, same list as the Month pills, just displayed in its own group before them. Flag this choice to the user in your summary of changes rather than silently picking it.

---

## 6. New popup button: "Performance vs Target"
**Requested:** "pop up button need to be create for Performance vs Target complete and place this button parallel to month slicer at extreme right in parallel row."

**Task:**
- Add a new button in the same row as Unit/Week/Month (§5), positioned at the **extreme right** of that row.
- Follow the existing "slicer button opens a panel" pattern already used for AI Insights / (the now-deleted) Breakdown: `.insight-btn` style, `aria-expanded`/`aria-controls`, toggles a `hidden` attribute on the target panel, tracked via a `state.performancePopupOpen`-style boolean, mirroring `applyBreakdownOpen()`'s structure (which you're deleting in §3 — reuse that same open/close pattern for this new button instead of writing something new).
- The panel it opens/closes is the **existing** `<section class="card">…<h2>Performance vs Target</h2>…<div class="kpi-grid" id="kpiGrid"></div></section>`. Give that section an `id` (e.g. `performancePanel`) if it doesn't have one, add `hidden` to it by default, and wire the new button to toggle it — same mechanics as the deleted `breakdownToggle`/`breakdownPanel` pair, just relabeled.
- Don't touch `renderKpis()` itself — the button only controls visibility, not what's rendered inside.

---

## 7. Simplify the Yield % (YMR %) Trend section
**Requested (read together as one instruction):**
> "delete slicer Yield % (YMR %) Trend / Overall (both plants) / all units · FY 2025-26 · target and achieved shown with values / Trend by / it only shows trend chart based on above slicers of Unit/week and month row."

**Reading:** the Trend section should stop having its own independent controls and scope label, and should purely follow the Unit / Week / Month row from §5.

**Task:**
- In `dashboard.html`, in the Trend `<section class="card">`:
  - Remove the `<h2>Yield % (YMR %) Trend</h2>` heading (or keep a plain, non-interactive label if the user wants the section still identifiable — confirm; the literal request says "delete slicer" which reads as removing the heading/label row, not necessarily the whole section).
  - Remove `<span class="hint" id="trendScopeLabel"></span>` (the "Overall (both plants) / all units · FY 2025-26 · target and achieved shown with values" text).
  - Remove the `<div class="filter-group"><span class="filter-label">Trend by</span><div class="pill-row" id="trendModeSlicer"></div></div>` block (the Month-wise/Week-wise/Date-wise pill selector).
  - Keep `.trend-legend` (Achieved/Target key) and `#trendWrap` (the actual chart).
- In `assets/dashboard.js`:
  - Remove `buildTrendModeSlicer()` (the function populating `#trendModeSlicer`) and the `state.trendMode` field.
  - Rewrite the trend data source (currently branching on `state.trendMode === 'date'|'week'|'month'` around `~line 676-707` in `renderTrend()`) so it always derives its series from the current `state.unit` + `state.period` selection from §5 (i.e. whatever Unit/Week/Month pills are active), rather than from the separate `trendMode`. Concretely: when the new Week pill (§5) is active, plot the week view; otherwise plot the month-wise series scoped to `state.fy`, filtered by `state.unit`, same as `scopeRows()`/`currentPeriod()` are used elsewhere on the page.
  - Remove references to `#trendScopeLabel` inside `renderTrend()` (currently sets `scopeText` there) since that label is deleted.
- This is the most behavior-heavy change in this list — after implementing, manually check: switching Unit pills changes the trend chart; switching Month pills changes it; the new Week pill (§5) shows the week view; nothing throws a console error when `#trendModeSlicer`/`#trendScopeLabel` no longer exist (grep the whole of `dashboard.js` for both IDs to make sure nothing else still references them).

---

## 8. New popup button: "Composition — Attribute Breakup"
**Requested:** "Composition — Attribute Breakup, for this, also create a pop up button and place with Row of Unit/month and this pop button can be place with parallel to unit and month."

**Task:**
- Add a second new popup-toggle button, same row as §5/§6 (Unit / Week / Month / Performance-popup), for the existing `<section class="card" id="compositionCard">…<h2>Composition — Attribute Breakup</h2>…</section>` block.
- Same mechanics as §6: default `hidden` on `#compositionCard`, a new toggle button using the `.insight-btn` pattern, `aria-expanded`/`aria-controls`.
- Note `#compositionCard` already has its own **separate** full-screen button (`#compFullBtn`, the `⛶` `.icon-btn`) for expanding the pies once the panel is open — keep that behavior; the new popup button only controls whether the whole Composition card is shown/hidden, it doesn't replace `compFullBtn`.
- With two new popup buttons (Performance vs Target, Composition) plus the Unit/Week/Month pill groups all sharing one row, check the row's `flex-wrap` at narrower widths (this dashboard has no other responsive breakpoints — verify by resizing the browser, don't assume it fits).

---

## Target end-state layout (top to bottom)

```
Brand row:        [PYRALOOP title + sub-line]                    [logo]
Control row:      [AI Insights ▾]   [Financial Year ▾]   [Plant ▾]        [Theme ▾]
AI Insights panel: (opens below control row when toggled — unchanged)
Filters card:      (no "Filters" heading)
  Row:  [Unit pills]   [Week pill]   [Month pills]   ...   [Performance vs Target ▾] [Composition ▾]
Performance vs Target panel:  (hidden by default, opened by its new popup button)
Trend card:        [Achieved/Target legend]
                    [trend chart — reacts only to Unit/Week/Month pills above]
Composition panel: (hidden by default, opened by its new popup button)
```
(Plant-wise Breakdown panel and its button no longer exist anywhere on the page.)

---

## Acceptance checklist
- [ ] `assets/pyraloop-logo.png` exists and the header shows the new logo, not the built-in wordmark, at correct proportions.
- [ ] One row: AI Insights (leftmost) → Financial Year → Plant → Theme (rightmost).
- [ ] No "Plant-wise Breakdown" button, panel, or row anywhere in the DOM; `grep -i breakdown` across `dashboard.html`/`dashboard.js` returns nothing left behind (aside from anything genuinely unrelated).
- [ ] "Filters" `<h2>` is gone; the card has no heading above the pill row.
- [ ] One row: Unit pills (leftmost) → Week pill → Month pills → Performance vs Target popup button → Composition popup button (extreme right).
- [ ] Trend section has no heading, no scope label, no "Trend by" control; it re-renders correctly whenever Unit, Week, or Month selection changes.
- [ ] Performance vs Target section is hidden until its new button is clicked; toggles open/closed correctly; `aria-expanded` updates.
- [ ] Composition section is hidden until its new button is clicked; toggles correctly; its existing full-screen `⛶` button still works once opened.
- [ ] No console errors on load or on any slicer/button interaction (open dev tools and click through everything).
- [ ] Theme switching (System/Light/Dark/Anti-Gravity) still works correctly with all the new/moved elements.
- [ ] `Update_Dashboard.bat` / `scripts/refresh_data.py` were not touched and still work (this was a pure front-end layout change).

## Please flag back to the user (don't silently decide)
1. §5 — whether the new Week pill is mutually exclusive with Month/YTD (recommended) or can co-exist.
2. §7 — whether to remove the Trend section's heading entirely or keep a plain non-interactive label.
