# Pyraloop Dashboard — Spec

## Purpose
A single, dynamic HTML dashboard for plant KPI reporting, updating automatically from the underlying Excel data file.

**YMR (Yarn Material Reconciliation) is the first KPI module.** The dashboard is built as a shell that can carry further KPI modules — **Efficiency, OTD, EHS** and others — so it grows into a complete plant dashboard rather than a one-report page. See *Multi-KPI Architecture* below.

## Scope & Views
- Single file/dashboard containing:
  - **Overall view** — both plants combined
  - **Plant-wise view** — selectable per plant
  - **Unit-wise view** — within each selected plant, break down by unit

---

## Multi-KPI Architecture (build for this from the start)
The dashboard must be structured so a new KPI is a **configuration + data sheet**, not a rewrite.

- **KPI modules.** Each KPI (YMR, Efficiency, OTD, EHS, …) is a self-contained module that declares:
  - its display name and short code (e.g. `YMR`, `EFF`, `OTD`, `EHS`)
  - its source sheet in the workbook (e.g. `YMR Factors`, `Efficiency Factors`)
  - its **headline factor** (for YMR: `Yield %`)
  - its **factor list** with formula, plant-wise target and direction, all read from that sheet's Attribute table
  - which factors belong in the composition pie, and which headline factor is excluded from it
- **KPI switcher.** A selector at the top of the page switches the active KPI module. Everything below it — KPI cards, trend, breakdown, composition, AI insights — re-renders from the active module's config. YMR is the default.
- **Shared shell.** The header, control row, filter bar, full-screen behaviour, status colouring and chart components are **generic** and must not hard-code YMR factor names.
- **Data pipeline.** The refresh script reads one sheet per KPI module and emits them side by side (e.g. `KPI_DATA.ymr`, `KPI_DATA.efficiency`). A module whose sheet is absent is skipped cleanly — the dashboard still loads with the modules that do exist.
- **Terminology.** "Attributes" are called **factors** in the UI, so the same wording works across every KPI.

---

## Page Layout (top to bottom)
1. **Brand header row** — **"PYRALOOP DASHBOARD"** on the left, **Pyraloop logo** on the right
2. **Control row** — `+` button at the extreme left, then **Financial Year**, **Plant** and **Theme**, tightly grouped and aligned on one line
3. **Filter bar** — **AI Insights** button first, then Unit and Month, compactly laid out
4. **AI Insights panel** — opens/closes from its button
5. **Performance vs Target** — KPI cards for every factor, headline factor first, with a **full-screen button**
6. **Yield % (YMR %) Trend** — line chart driven by the filters above it
7. **Breakdown panel** — **pie charts** (not a table), opened by its slicer button
8. **Composition** — one pie per plant, with a **full-screen button**

## Brand Header
- Left: the title **PYRALOOP DASHBOARD** (replacing "KPI YMR Dashboard"), with a sub-line naming the KPI currently in view (e.g. "Yarn Material Reconciliation — Overall, Plant-wise & Unit-wise").
- Right: the **Pyraloop logo**. The dashboard ships a built-in wordmark that follows the active theme; dropping an official file at `assets/pyraloop-logo.png` (or `.svg`, by changing the `src`) replaces it automatically, no code change needed.

## Control Row
All controls sit on **one line**, close together and aligned to the same baseline — no stray gaps, no stretched columns.

| Position | Control |
|---|---|
| Extreme left | **`+` button** |
| then | **Financial Year** dropdown |
| then | **Plant** dropdown |
| right | **Theme** selector |

- **`+` button** — a compact square button at the extreme left, reserved for **adding more factors or elements in future** (extra factors, another KPI module, a saved view). It must be present and visibly clickable now, opening a short "what can be added" popover, so the slot exists in the layout from day one.
- **Financial Year** — each FY present in the data, running **July → June** (e.g. `FY 2025-26`), plus **All periods**. Narrows the Month slicer and the trend chart; if the selected month falls outside the new FY, it snaps to that FY's last month.
- **Plant** — **Overall (both plants)**, Plant-05, Plant-06. The only plant control on the page.
- **Theme** — a selection box: **System default**, **Light**, **Dark mode**, **Anti-Gravity**. Remembered between sessions.

> Note: the request also suggested the Plant dropdown could move into the filter area. It is kept here so Financial Year, Plant and Theme stay on one line as required, and so plant selection lives in exactly one place. Moving it down is a small change if preferred.

## Filter Bar (compact — no vacant space)
The filter area must be **dense and tidy**, not a mostly-empty card. Requirements:
- **AI Insights button comes first**, at the start of the bar.
- Then the **Unit** slicer and the **Month** slicer, on the same band where width allows, wrapping only when the window is genuinely too narrow.
- Controls are grouped left-to-right with consistent spacing, and the card's vertical padding is trimmed, so the bar reads as one compact strip rather than a large empty panel.
- The Breakdown button sits in this bar too, so every "open a panel" control is in one place.

## Full-Screen Mode
- **Performance vs Target** carries a **square full-screen button** in its header. Clicking it expands that section to fill the window, showing the **complete Performance vs Target row** — every factor card at once, without scrolling or clipping.
- **Composition** carries the same square full-screen button, so the pies can be read large.
- The button toggles: click to expand, click again (or `Esc`) to return to the normal layout.
- The purpose is layout quality — nothing about the data changes in full screen, and the active filters still apply.

---

## Headline Factor — YMR % (Yield %)
- **YMR % is Yield %**, and its formula is already defined in the **Attribute** table of the source file — it must be read from there, not hard-coded.
  - Source row: `Yield %` — Formula `Yield/Consumption` — Target `94%` (Plant-05 and Plant-06) — Direction `Higher is Better`
- It is the module's **headline factor**: first card in *Performance vs Target*, and the series of the trend chart.
- It respects every active filter — Financial Year, Plant, Unit and Month / YTD.
- It carries its **Target** and **Direction** from the source file and shows the same **ON TARGET / OFF TARGET** status marking as the other factors.
- Because the direction is *Higher is Better*, YMR % is green when **at or above** target — the opposite sense to the loss factors.
- It is **excluded from the composition pie**: Yield is the reconciliation headline, not a loss bucket, and including it would swamp every other slice.

## Factors to Analyze
All factors are shown at all times — **there is no factor slicer** (no checkboxes, no pills, no tick marks anywhere):
- Yield % (YMR %)
- Shortfall
- C Grade
- Yarn Waste
- UC Small Lot
- Gain/Loss

Every factor appears as a KPI card in *Performance vs Target*, in the breakdown pies, and in AI Insights. All except Yield % also appear as a slice in the composition pie.

## Yield % (YMR %) Trend — Line Chart
- **The trend follows the filters already selected above it — it has no slicer of its own.** The Month-wise / Week-wise / Date-wise selector is **removed**; the chart reads Financial Year, Plant and Unit from the controls above.
- **X-axis granularity is derived, not chosen:**
  - Financial Year selected → the months of that FY; **All periods** → every month in the data.
  - The month picked in the Month slicer is **highlighted** on the axis, so the single-month KPI cards and the trend read together.
  - `YTD` selected → the same month series for the year, with no single month highlighted.
  - If the source ever carries finer rows (`Week-02`, `Week-03`… or a `Date` column), the chart uses the **finest granularity available** for the selected period automatically — still with no extra slicer.
- **Target line:** a dashed line across the chart, labelled with its **value in numbers** (e.g. `Target 94.00%`).
- **Achieved line:** a solid line with a marker on every point and **each point's value printed on the chart**; the latest point is labelled `Achieved xx.xx%` at the right edge.
- Markers are **green at or above target, red below**, following the factor's direction.

## Breakdown — Pie Charts, Not a Table
The breakdown panel is rendered as **pie charts**, replacing the A/T table rows.
- **Three pies, driven by the current selection:**
  - **Unit-01**, **Unit-02**, and **Overall** for the selected scope (the plant when one is chosen, both plants under Overall).
  - If the Unit slicer narrows to a single unit, that unit's pie and the Overall pie are shown.
- Each pie shows the **factor breakup** for that unit, in the same style as the Composition pies.
- The **A/T comparison must not be lost**: each pie's legend lists the factor with its **actual value, its target, and ON/OFF target colouring**.
- The panel keeps its slicer button and stays closed by default.

## Composition — Pie Charts
- **Pie charts are plant-wise.** Each pie shows the **breakup across factors** (Shortfall, C Grade, Yarn Waste, UC Small Lot, Gain/Loss) for one plant.
  - Do **not** render a separate pie chart per factor — a pie's slices are the factors.
  - **Plant-05** or **Plant-06** selected → **one pie**, for that plant.
  - **Overall** selected → **two pies, one per plant, side by side** (they stack on narrow screens). The plants are not merged into a single combined pie.
  - Each pie also follows the **Unit** and **Month** filters, and its subtitle states the unit and period it is showing.
- **Slices must show actual numbers, not just shares.** Each slice/legend entry shows the factor's **achieved value for that scope** — e.g. `Shortfall 7.73%` — alongside its share of the total and its absolute quantity. A reader must be able to see the achieved percentage without opening another panel.
- The **factor name sits inside the pie**, on its own slice. Slices too small to hold a readable label fall back to the legend only.
- Shares use **absolute values**, so a negative Gain/Loss still contributes its magnitude.
- Each factor keeps a fixed colour, so a slice does not change colour as the scope changes.
- The section carries a **square full-screen button** (see *Full-Screen Mode*).

## Red/Green Indicators
- Each factor (and the headline YMR %) shows actual vs. target, plant-wise.
- **Green** if performance is favorable relative to target and direction; **Red** if unfavorable.
- Direction logic (higher-is-better vs. lower-is-better) must be respected per factor, exactly as stated in the source file.

## Status Labels
- Show only the words **`ON TARGET`** or **`OFF TARGET`**.
- **No tick, check mark, cross, or any other symbol** before or after the label.
- Colour alone carries the good/bad signal: green for `ON TARGET`, red for `OFF TARGET`.

## Filters / Slicers
- **Financial Year**, **Plant**, **Theme** — control row (top).
- **Unit slicer** — pills: `All Units`, `Unit-01`, `Unit-02`. Available in every mode, including Overall, where a unit means that unit across both plants.
- **Month slicer** — **YTD first**, then one pill per month of the selected financial year. Exactly one active at a time.
- There is **no period-mode slicer** and **no factor slicer**.
- Every visual — KPI cards, trend, breakdown pies, composition pies and AI Insights — reacts to all active filters.

## AI Insights
- Entry point is the **first control in the filter bar**, a slicer-style button with a **count badge** of current red-flagged findings.
- The panel is **closed by default**; clicking opens it, clicking again closes it.
- Views: **Current Week**, **Current Month**, **YTD**. Breakdown: **Plant-wise** and **Unit-wise**.
- Content: top red-flagged (unfavorable) areas ranked by severity/impact, each with a clear **actionable** — what needs attention, not just the red flag.
- Findings include the headline factor whenever it falls below target.
- Ranking and actionable text are generated **on-device** by rule-based logic in `assets/dashboard.js` — the dashboard is a static local file and makes no network call to any AI service.

## Calculation Logic
- All factor values must be calculated using the **formulas defined in the Attribute column** of the source data file (not re-derived independently).
- Each factor must have a defined **Target** value (plant-wise).
- The headline factor follows the same rule — formula, target and direction read from the source file.
- The source Attribute table also defines rows the dashboard does not currently surface: `Waste %`, `Shortfall + C-Grade`, and `Shortfall + C-Grade + Yarn Waste`. They stay out of scope unless requested — but the reader/parser must not break on them.

## Data Source
- Existing YMR Excel file — `Data/YMR.xlsx`, sheet `YMR Factors`
  - Data table in columns **A:K** (Month, Plant, Unit, Consumption, Yield, Total Waste, Shortfall, C-Grade, Yarn Waste, UC Small Lots, Gain/Loss)
  - Attribute/target table in columns **M:Q** (Attribute, Formula, Plant-05 Target, Plant-06 Target, Direction)
- Future KPI modules follow the same two-table shape on their own sheet (e.g. `Efficiency Factors`).

## Refresh Pipeline
- `Update_Dashboard.bat` regenerates `assets/data.js` from the Excel file, then opens the dashboard.
- The refresh runs on **`scripts/refresh_data.ps1` (Windows PowerShell)**, which reads the `.xlsx` directly through the .NET zip/XML libraries built into Windows.
  - **No Python and no Excel installation are required.**
  - `scripts/refresh_data.py` is kept as an optional equivalent for anyone who already has Python + openpyxl.
- The batch file must fail with a clear message when `Data/YMR.xlsx` is missing or locked open in Excel — never silently produce stale data.
- Chrome is located via its standard install paths and the `App Paths` registry key, falling back to the default browser.

## Output
- Single dynamic HTML dashboard, opens in Chrome
- Updates when the source Excel data changes and the refresh is run

---

## Definition of Done
- Title reads **PYRALOOP DASHBOARD**, with the Pyraloop logo on the right of the header row
- Control row holds, on **one aligned line**: a **`+` button at the extreme left**, then **Financial Year**, **Plant** and **Theme**, grouped close together
- The **`+` button** exists and is clickable, reserved for adding factors/elements later
- Filter bar is **compact with no vacant space**, with **AI Insights first**, then Unit and Month
- **Performance vs Target** has a **square full-screen button** that opens the complete factor row full screen
- **Composition** has the same square full-screen button
- **Yield % trend follows the filters above it** — the Month/Week/Date trend slicer is gone, the FY drives the axis, and the selected month is highlighted
- Trend shows a **dashed target line labelled with its number** and the **achieved value printed on every point**
- **Breakdown is pie charts, not table rows** — Unit-01, Unit-02 and Overall pies for the current selection, with actual vs target in each legend
- **Composition pies show actual numbers** (e.g. `Shortfall 7.73%`), not only percentage shares
- Composition is **plant-wise**: one pie for a selected plant, **two side-by-side pies under Overall**
- All 6 factors always shown — **no factor slicer**, no checkboxes, no tick marks
- Status labels read exactly `ON TARGET` / `OFF TARGET` with **no tick or symbol**
- **Unit is its own pill slicer**, available in every mode including Overall; the Month slicer starts with **YTD**
- Factor values and the headline factor match formulas from the source file's Attribute column
- Red/Green marking correctly reflects target and direction per factor
- AI Insights surfaces top red areas with actionables, filterable by current week/month/YTD and plant/unit
- The dashboard is structured as **KPI modules with a KPI switcher**, so **Efficiency, OTD and EHS** can be added later as configuration plus a data sheet, without rebuilding the shell
