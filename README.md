# YMR Dashboard

A single-page HTML/CSS/JS dashboard for Yarn Material Reconciliation (YMR), built to
`instruction.md`. It reads its data from `Data/YMR.xlsx` via a generated `assets/data.js`
file, so it opens as a plain local file in Chrome — no server required.

## Folder contents

| File | Purpose |
|---|---|
| `dashboard.html` | The dashboard. Open this in Chrome. |
| `assets/dashboard.js` | All dashboard logic (filters, calculations, charts, insights). |
| `assets/data.js` | **Generated.** A snapshot of `Data/YMR.xlsx` as JS data. Do not edit by hand. |
| `Data/YMR.xlsx` | The source workbook (sheet `YMR Factors`). |
| `assets/pyraloop-logo.svg` | Stand-alone Pyraloop wordmark. The header has its own theme-aware copy inline. |
| `scripts/refresh_data.ps1` | Converts the Excel file into `assets/data.js`. Used by the .bat. |
| `scripts/refresh_data.py` | Optional Python equivalent of the above, for anyone who prefers it. |
| `Update_Dashboard.bat` | One-click: refreshes `assets/data.js` from Excel, then opens/reloads the dashboard in Chrome. |

## Setup

None. `Update_Dashboard.bat` uses Windows PowerShell, which is already on every
Windows machine — **Python is not required, and Excel does not need to be
installed** (the workbook is read directly as a file).

If you'd rather run the refresh yourself instead of double-clicking the .bat:

```bash
powershell -ExecutionPolicy Bypass -File scripts\refresh_data.ps1
```

## Day-to-day use

1. Edit `Data\YMR.xlsx` in Excel (add months, correct values, adjust targets/formulas
   in the M:Q columns) and save it. **Close the file before refreshing** — the refresh
   reads the saved workbook.
2. Double-click **`Update_Dashboard.bat`**.
3. It reads the workbook, regenerates `assets\data.js`, and opens the dashboard in
   Chrome. If the dashboard tab was already open, press `Ctrl+R` on it to pick up the
   refreshed data.

You can also open `dashboard.html` directly at any time — it always renders whatever
is currently in `assets/data.js`.

## How the calculations work

- The **Attribute / Formula / Target / Direction** table in `YMR.xlsx` (columns
  M:Q) is read directly — the dashboard does not hard-code the % formulas. Each
  attribute's formula (e.g. `Shortfall/Consumption`) is compiled and evaluated against
  the summed row data for whatever scope/period is selected, so changing a formula or
  target in Excel changes the dashboard on the next refresh.
- **Overall** and multi-unit targets are the two plants' targets weighted by their
  Consumption in the selected period (the source only defines targets plant-wise).
- Red/Green respects each attribute's **Direction** ("Higher is Better" / "Lower is
  Better") exactly as stated in the source file. Status is shown as the plain words
  **ON TARGET** / **OFF TARGET** — colour carries the signal, with no tick or cross.
- **YMR % is Yield %** — the `Yield %` row of that same table (`Yield/Consumption`,
  target 94%, Higher is Better). It is the first card in *Performance vs Target* and is
  read from the workbook like every other attribute.

## Filters

The page header carries the top-level controls, and the Filters card the rest:

- **Financial Year** (header, left): each FY in the data, running **July → June**, plus
  **All periods**. It narrows the Month slicer and the Yield % trend chart.
- **Plant** (header, centre): Overall (both plants) / Plant-05 / Plant-06.
- **Theme** (header, right): System default / Light / **Dark mode** / **Anti-Gravity**.
  Remembered between sessions.
- **Unit:** its own pills — All Units / Unit-01 / Unit-02. Always available, including
  under Overall, where it means that unit across both plants.
- **Month:** **YTD** first, then one pill per month of the selected financial year. One
  is active at a time.

All six attributes (Yield %, Shortfall, C Grade, Yarn Waste, UC Small Lot, Gain/Loss)
are always shown — there is no attribute slicer and no period mode selector.

## Yield % trend chart

Yield % (the YMR % headline) gets its own line chart with a **Month-wise / Week-wise /
Date-wise** slicer. The dashed **target line is labelled with its value** (`Target
94.00%`) and every point on the achieved line carries **its own number**, with markers
green at or above target and red below. The chart follows the Plant and Unit selection,
and shades the month currently picked in the Month slicer.

The workbook currently has one row per month plus a single `Week-01` and a `YTD`
snapshot, so **month-wise** is the granularity with real history. Week-wise needs
further `Week-02`, `Week-03`… rows, and date-wise needs a `Date` column added to the
`YMR Factors` sheet — the chart says so on screen, and starts plotting them
automatically once they exist.

## Logo

The header shows a built-in Pyraloop wordmark that follows the active theme. To use an
official asset instead, drop it at `assets/pyraloop-logo.png` — the dashboard picks it
up on the next load, with no code change.

## Breakdown

The **Breakdown** button at the top of the page opens the detail table; it's closed by
default. It follows the Plant dropdown — with Plant-05 selected the button reads
*Plant-05 Breakdown* and opens that plant alone, broken down unit-wise; under Overall
it opens both plants. Columns are headed **A/T** (Actual / Target).

## Composition

Pie charts are **plant-wise**, and a pie's slices are the attributes. Selecting Plant-05
or Plant-06 gives one pie for that plant; **Overall gives two pies, one per plant, side
by side** (they stack on a narrow window). Each pie also follows the Unit and Month
slicers, and its subtitle states the unit and period being shown.

**The number against each attribute is its actual value, not its share of the pie.** A
slice reads `Shortfall 7.73%` — the same figure as that attribute's KPI card for the
same scope — and the legend adds the absolute quantity, coloured green or red against
the attribute's target. Slice *size* is still the attribute's share of the total loss
quantity (absolute values, so a negative Gain/Loss still shows its size); hovering a
slice shows actual, quantity and share together.

The section header carries a **square full-view button** (⛶). It expands Composition to
fill the window and enlarges the pies; click again or press `Esc` to return. The active
filters still apply — full view changes layout only.

Yield % is excluded from the pie — it is the headline reconciliation metric, not a loss
bucket, and including it would swamp every other slice.

## AI Insights panel

The **AI Insights** button sits at the top of the page, styled like the other slicers,
with a badge showing how many red-flagged findings there currently are. The panel is
closed by default — click the button to open it, click again to close.

The panel ranks red-flagged Plant/Unit × attribute combinations by how far they sit
from target (in percentage points) for Current Week / Current Month / YTD, and
generates a short actionable per finding. This ranking and the actionable text are
produced **on-device by rule-based logic in `assets/dashboard.js`** — the dashboard is
a static local file with no network access, so it does not call an external AI
service. If you'd like real LLM-generated narrative insights instead, that would need
an API key and a small amount of server/network-calling code — ask and it can be
wired in.
