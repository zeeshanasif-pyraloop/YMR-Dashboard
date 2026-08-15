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
| `scripts/refresh_data.py` | Converts the Excel file into `assets/data.js`. |
| `Update_Dashboard.bat` | One-click: refreshes `assets/data.js` from Excel, then opens/reloads the dashboard in Chrome. |

## One-time setup (Windows)

1. Install [Python 3](https://www.python.org/downloads/) if it isn't already installed —
   tick **"Add python.exe to PATH"** during setup.
2. That's it. `Update_Dashboard.bat` installs the one required package
   (`openpyxl`) automatically the first time it runs.

## Day-to-day use

1. Edit `Data\YMR.xlsx` in Excel (add months, correct values, adjust targets/formulas
   in the M:Q columns) and save/close it.
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
  Better") exactly as stated in the source file.

## Filters

- **Location:** Overall / Plant-05 / Plant-06, with a Unit selector when a plant is
  chosen.
- **Period:** Month (pick any month present in the data), Week (the `Week-01` snapshot
  row in the source file), or YTD.
- **Attributes:** the 5 checkboxes from the spec (C Grade, Shortfall, Yarn Waste, UC
  Small Lot, Gain/Loss) — toggling one hides its KPI card, breakdown column, and pie
  chart everywhere on the page.

Note: the source workbook has one row per **Month** (plus one `Week-01` and one `YTD`
snapshot row) — there's no daily date column in `Data/YMR.xlsx`. "Date-wise" filtering
is therefore implemented at month granularity (the Month selector). To get true
day-by-day filtering, add a `Date` column to the source sheet and the calculation
engine can be pointed at it.

## AI Insights panel

The panel ranks red-flagged Plant/Unit × attribute combinations by how far they sit
from target (in percentage points) for Current Week / Current Month / YTD, and
generates a short actionable per finding. This ranking and the actionable text are
produced **on-device by rule-based logic in `assets/dashboard.js`** — the dashboard is
a static local file with no network access, so it does not call an external AI
service. If you'd like real LLM-generated narrative insights instead, that would need
an API key and a small amount of server/network-calling code — ask and it can be
wired in.
