# YMR (Yarn Material Reconciliation) Dashboard — Spec

## Purpose
A single, dynamic HTML dashboard for Yarn Material Reconciliation analysis, covering both plants individually and combined, updating automatically based on the underlying data file.

## Scope & Views
- Single file/dashboard containing:
  - **Overall view** — both plants combined
  - **Plant-wise view** — selectable per plant
  - **Unit-wise view** — within each selected plant, break down by unit

## Attributes to Analyze (as Checkboxes)
User can toggle visibility of each attribute via checkboxes:
- [ ] C Grade
- [ ] Shortfall
- [ ] Yarn Waste
- [ ] UC Small Lot
- [ ] Gain/Loss

## Calculation Logic
- All attribute values must be calculated using the **formulas defined in the Attribute column** of the source data file (not re-derived independently).
- Each attribute must have a defined **Target** value (plant-wise).

## Visualizations
- **Pie chart** per attribute, showing the composition/contribution linked to that attribute.
- **Red/Green indicators**:
  - Each attribute shows actual vs. target, plant-wise.
  - Marked **Green** if performance is favorable relative to target and direction.
  - Marked **Red** if unfavorable relative to target and direction.
  - Direction logic (higher-is-better vs. lower-is-better) must be respected per attribute (e.g., Gain is favorable-high, Shortfall/Waste are favorable-low).

## Filters / Slicers
- **Time-based:**
  - Month-wise
  - Week-wise
  - Date-wise
  - YTD (Year-to-Date)
- **Location-based:**
  - Plant-wise (individual plant selection)
  - Unit-wise (within selected plant)
  - Overall (both plants combined)

## AI Insights Panel
A dedicated slicer/panel showing AI-generated insights on red-flagged (unfavorable) areas:
- Views: **Current Week**, **Current Month**, **YTD**
- Breakdown: **Plant-wise** and **Unit-wise**
- Content: Top red-flagged areas ranked by severity/impact, based on actual data
- Each insight should show a clear **actionable** — a one-view summary of what needs attention, not just the red flag itself

## Data Source
- Existing YMR Excel file (structure to be confirmed via inspection before build)

## Output
- Single dynamic HTML dashboard, opens in Chrome
- Updates automatically when the source Excel data changes

## Definition of Done
- Overall + plant-wise + unit-wise views all functional in one file
- All 5 attribute checkboxes toggle visibility correctly
- Attribute values match formulas from the source file's Attribute column
- Red/Green marking correctly reflects target and direction per attribute
- Pie charts correctly linked to their respective attributes
- All slicers (month, week, date, YTD, plant, unit, overall) function correctly
- AI Insights panel correctly surfaces top red areas with actionables, filterable by current week/month/YTD and plant/unit
