# YMR Dashboard — Follow-up Adjustments (2026-08-21, round 2)

## Context for Claude Code
This follows on from `Claude_Code_Prompt_2026-08-21.md` in this same repo, which you've already implemented (control row now has AI Insights / Financial Year / Plant / Theme; the Unit/Week/Month/Performance/Composition row exists; Plant-wise Breakdown is gone). This is a **small set of corrections** on top of that work, in `dashboard.html` and `assets/dashboard.js` only. Re-read the current state of both files before editing — don't assume the line numbers below are still exact, they're pointers from the last read.

---

## 1. Delete the "Data generated …" line
The Theme control cell currently shows a timestamp under the dropdown:
```html
<span class="meta" id="dataMeta">Loading data…</span>
```
populated in `assets/dashboard.js` via:
```js
document.getElementById("dataMeta").textContent = "Data generated " + (YMR_DATA.generatedAt || "—");
```
**Task:** Remove the `<span id="dataMeta">` element from `dashboard.html` (inside the Theme `.control-cell`), and remove the line in `assets/dashboard.js` that sets its `textContent` (currently near the end of the init sequence).

**Don't miss this:** there is a **second** reference to `dataMeta` at the very top of `dashboard.js`, in the "no data file" fallback:
```js
if (typeof YMR_DATA === "undefined") {
  document.getElementById("dataMeta").textContent = "assets/data.js not found — run Update_Dashboard.bat first.";
  return;
}
```
If `#dataMeta` no longer exists in the DOM, this line will throw instead of showing a message. Redirect this fallback message somewhere still on the page (e.g. `#scopeLabel`, or a plain `alert()`/`console.error()` plus replacing the whole `.wrap` content with a short text node) so a genuinely missing `data.js` still fails visibly rather than throwing an uncaught error.

---

## 2. Move Theme to the extreme left of the control row, and fix the row's alignment
**Current order** in `.control-row`: AI Insights → Financial Year → Plant → Theme (rightmost).
**Requested order:** **Theme first (extreme left)**, then the rest of that row.

**Task:**
- In `dashboard.html`, move the Theme `.control-cell` (containing `#themeSelect`) to be the **first** child of `.control-row`, before the AI Insights cell. Keep Financial Year and Plant in their current relative order after it, i.e. new order: **Theme → AI Insights → Financial Year → Plant**.
- The Theme cell currently uses the `right` modifier class (`.control-row .control-cell.right{ align-items:flex-end; }` in the `<style>` block), which right-aligns its label/select — that made sense when Theme was the rightmost cell. Now that it's leftmost, drop the `right` class (or swap it for whatever the other left-aligned cells use, e.g. no modifier class, matching the Financial Year cell) so its label and dropdown are left-aligned like the rest of the row.
- The row's uneven bottom-alignment the user is seeing (`align-items:flex-end` on `.control-row`) is very likely caused by the Theme cell being taller than its neighbors because of the `#dataMeta` line sitting under the select — deleting `#dataMeta` (§1) should resolve most of this on its own. After both changes, visually confirm all four cells (Theme, AI Insights, Financial Year, Plant) sit on a clean common baseline at their bottom edge; if the AI Insights button (no label above it, unlike the dropdowns) still looks misaligned against the labeled dropdown cells, adjust `.control-row .control-cell.action` so the button's bottom edge lines up with the dropdowns' bottom edges (e.g. wrapping it in a spacer to match label height, or adjusting `align-self`).

---

## 3. Delete the Week slicer entirely — remove week analysis, not just hide it
**Requested:** "Week slicer need to delete from current row of UNIT, no need of week analysis in dashboard."

This should be a full removal of the Week feature added in the previous round, not just hiding the UI. In `dashboard.html`, remove the `#weekGroup` / `#weekSlicer` `.filter-group` block (between Unit and Month in the filters row).

In `assets/dashboard.js`, remove all of the week-specific machinery that supports it:
- `buildWeekSlicer()` and its call inside `renderAll()`/init.
- The `ALL_WEEKS` constant and `isWeekLabel()` helper.
- The `mode === "week"` branches in `periodMatches()` and `periodLabel()` (the period model goes back to just a month label or `"YTD"`, as it was before the Week slicer existed).
- `trendIsWeekly()` (or equivalent) and the week branch inside `renderTrend()` — the trend chart's data source goes back to being purely month-of-FY based (via `fyMonths(state.fy)`), with no week series.
- The `Week-xx` empty-state copy inside `renderTrend()` ("The source workbook holds a single week snapshot…").
- Leave the **AI Insights panel's own "Current Week" view toggle** (`state.insightView`, the `insightViewSeg` segmented control with Current Week/Current Month/YTD) completely alone — that's a separate, unrelated feature scoped to the Insights panel and was not part of what was added for the Unit/Week/Month row. Don't touch it.
- After removing, grep the whole of `dashboard.js` and `dashboard.html` for `week`/`Week` to confirm nothing dangling references `weekGroup`, `weekSlicer`, `buildWeekSlicer`, `ALL_WEEKS`, or `isWeekLabel`.

---

## 4. Shrink "Performance vs Target" / "Composition" buttons to fit the Unit/Month row on one line
**Requested:** "Performance vs Target and Composition need to be in small font to be fit in same row of YTD Slicer, Sequence is ok."

The sequence (Unit → Month → Performance vs Target button → Composition button, left to right) is confirmed correct as-is — only the sizing needs to change so the row doesn't wrap.

**Task:** In the `<style>` block, `.insight-btn.compact` (used by `#performanceToggle` and `#compositionToggle`) is currently:
```css
.insight-btn.compact{ padding:7px 14px; font-size:13px; border-radius:8px; }
```
Reduce this further — e.g. `padding:5px 10px; font-size:12px;` — and/or tighten the internal `gap` (currently inherited `gap:10px` from `.insight-btn`) so the two buttons plus their chevrons take up less horizontal space. Iterate until, at a typical desktop window width, the whole row (Unit pills + Month pills + both buttons) fits on one line without wrapping under `.filters-grid`'s `flex-wrap: wrap`. If it still doesn't fit at reasonable widths even at a sensibly small font size, drop the chevron (`▼`) glyph from these two compact buttons specifically (keep it on the full-size AI Insights button) rather than shrinking the text past legibility.

---

## 5. Rename the "Month" label to "Filter"
**Requested:** "Month word needs to be eliminate which is written above YTD, instead write 'Filter' word."

The Month pill group's label sits directly above its pill row, which starts with the `YTD` pill:
```html
<div class="filter-group" id="monthGroup">
  <span class="filter-label">Month</span>
  <div class="pill-row" id="monthSlicer"></div>
</div>
```
**Task:** Change that `<span class="filter-label">Month</span>` text to `Filter`. Nothing else about `#monthGroup`/`#monthSlicer` changes — same pills (YTD + each month), same behavior, only the label text above them.

---

## Acceptance checklist
- [ ] No "Data generated …" text anywhere on the page; the missing-`data.js` fallback still shows *some* visible message instead of throwing a console error.
- [ ] Control row reads, left to right: Theme → AI Insights → Financial Year → Plant, all sitting on a clean common baseline (open dev tools, confirm no console errors, resize the window to check it holds up).
- [ ] No Week slicer/pill/group anywhere in the Unit/Month row; `grep -i week` across `dashboard.html`/`dashboard.js` turns up nothing except the untouched AI Insights "Current Week" view toggle.
- [ ] Trend chart still renders correctly (month-of-FY series) with no leftover week branch.
- [ ] Unit pills, Month pills, "Performance vs Target" button, and "Composition" button all sit on one line at a normal desktop window width — no wrap.
- [ ] The label above the Month/YTD pill row now reads "Filter", not "Month".
- [ ] Full click-through of every control (Theme, AI Insights, Financial Year, Plant, Unit, Month, Performance vs Target, Composition, and Composition's `⛶` full-view button) with dev tools open — no console errors.
