(function(){
  "use strict";

  // Without the generated data file there is nothing to render, so the page is replaced
  // with the reason. (This script is loaded at the end of <body>, so .wrap already exists.)
  if (typeof YMR_DATA === "undefined") {
    var missingMsg = "assets/data.js not found — run Update_Dashboard.bat first.";
    console.error(missingMsg);
    var wrap = document.querySelector(".wrap");
    if (wrap) {
      wrap.innerHTML = "";
      var note = document.createElement("p");
      note.className = "empty-note";
      note.textContent = missingMsg;
      wrap.appendChild(note);
    }
    return;
  }

  /* ================= formula engine ================= */
  var FIELD_KEY = {
    "UC Small Lots": "ucSmallLots",
    "Total Waste": "totalWaste",
    "Yarn Waste": "yarnWaste",
    "Gain/Loss": "gainLoss",
    "Consumption": "consumption",
    "C-Grade": "cGrade",
    "Shortfall": "shortfall",
    "Yield": "yield"
  };
  function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"); }
  var FIELD_RE = new RegExp(Object.keys(FIELD_KEY).sort(function(a,b){return b.length-a.length;}).map(escapeRegExp).join("|"), "g");
  function compileFormula(formula){
    var expr = formula.replace(FIELD_RE, function(m){ return "r." + FIELD_KEY[m]; });
    return new Function("r", "return (" + expr + ");");
  }
  YMR_DATA.attributes.forEach(function(a){ a.compute = compileFormula(a.formula); });

  var ATTR_BY_KEY = {};
  YMR_DATA.attributes.forEach(function(a){ ATTR_BY_KEY[a.key] = a; });

  var SERIES_COLORS = ["var(--series-1)","var(--series-2)","var(--series-3)","var(--series-4)","var(--series-5)"];

  // Yield is the headline YMR % metric, not a loss bucket — it is excluded
  // from the composition pie (it would swamp every other slice).
  var YIELD_KEY = "yield";
  function isYield(attr){ return attr.key === YIELD_KEY; }

  // Colour per attribute key, so a slice keeps its colour no matter which
  // attributes are currently selected in the slicer. Only the pie attributes
  // consume the palette, so no two slices can share a colour.
  var ATTR_COLOR = {};
  YMR_DATA.attributes.filter(function(a){ return !isYield(a); })
    .forEach(function(a, i){ ATTR_COLOR[a.key] = SERIES_COLORS[i % SERIES_COLORS.length]; });

  var MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function isRegularMonth(label){ return !/^Week-/i.test(label) && label !== "YTD"; }
  function monthSortKey(label){
    var parts = label.split("-");
    var mi = MONTH_ABBR.indexOf(parts[0]);
    var year = 2000 + parseInt(parts[1], 10);
    return year * 12 + mi;
  }
  var ALL_MONTHS = Array.from(new Set(YMR_DATA.rows.filter(function(r){return isRegularMonth(r.month);}).map(function(r){return r.month;})))
    .sort(function(a,b){ return monthSortKey(a) - monthSortKey(b); });

  // ---- financial year (July → June) ----
  function fyOf(monthLabel){
    var parts = monthLabel.split("-");
    var mi = MONTH_ABBR.indexOf(parts[0]);
    var year = 2000 + parseInt(parts[1], 10);
    var start = mi >= 6 ? year : year - 1;          // Jul (index 6) starts the FY
    return "FY " + start + "-" + String((start + 1) % 100).padStart(2, "0");
  }
  var ALL_FYS = Array.from(new Set(ALL_MONTHS.map(fyOf))).sort();
  function fyMonths(fy){
    if (fy === "all") return ALL_MONTHS.slice();
    return ALL_MONTHS.filter(function(m){ return fyOf(m) === fy; });
  }

  function currentMonthLabel(){
    var now = new Date();
    var label = MONTH_ABBR[now.getMonth()] + "-" + String(now.getFullYear() % 100).padStart(2,"0");
    if (ALL_MONTHS.indexOf(label) !== -1) return label;
    return ALL_MONTHS[ALL_MONTHS.length - 1];
  }

  /* ================= aggregation helpers ================= */
  var NUM_FIELDS = ["consumption","yield","totalWaste","shortfall","cGrade","yarnWaste","ucSmallLots","gainLoss"];
  function aggregate(rows){
    var out = {};
    NUM_FIELDS.forEach(function(f){ out[f] = 0; });
    rows.forEach(function(r){ NUM_FIELDS.forEach(function(f){ out[f] += r[f]; }); });
    return out;
  }
  function targetForRows(attr, rows){
    var byPlant = {};
    rows.forEach(function(r){ byPlant[r.plant] = (byPlant[r.plant] || 0) + r.consumption; });
    var plants = Object.keys(byPlant);
    if (plants.length === 0) return null;
    if (plants.length === 1) return attr.targets[plants[0]];
    var totalC = plants.reduce(function(s,p){ return s + byPlant[p]; }, 0);
    if (totalC === 0) return (attr.targets[plants[0]] + attr.targets[plants[1]]) / 2;
    return plants.reduce(function(s,p){ return s + attr.targets[p] * byPlant[p]; }, 0) / totalC;
  }
  function isFavorable(attr, actual, target){
    if (attr.direction === "Higher is Better") return actual >= target;
    return actual <= target;
  }
  function fmtPct(v){ return v == null ? "—" : (v * 100).toFixed(2) + "%"; }
  function fmtSigned(v){ return (v >= 0 ? "+" : "") + v.toFixed(2); }

  /* ================= state ================= */
  var PLANTS = ["Plant-05", "Plant-06"];
  var UNITS = ["Unit-01", "Unit-02"];
  var state = {
    location: "overall",       // 'overall' | 'Plant-05' | 'Plant-06'
    unit: "all",                // 'all' | 'Unit-01' | 'Unit-02'
    period: currentMonthLabel(),// a month label from the data, or 'YTD'
    fy: fyOf(currentMonthLabel()), // financial year (Jul → Jun), or 'all'
    insightsOpen: false,        // AI Insights panel starts closed, opened by its slicer button
    performanceOpen: false,     // Performance vs Target panel — opened by its slicer button
    compositionOpen: false      // Composition panel — opened by its slicer button
  };

  // A period is either a month label present in the data, or the YTD snapshot row.
  function periodMatches(row, mode, month){
    if (mode === "ytd") return row.month === "YTD";
    return row.month === month;
  }
  function currentPeriod(){
    return state.period === "YTD" ? { mode: "ytd", month: null } : { mode: "month", month: state.period };
  }
  function periodLabel(mode, month){
    if (mode === "ytd") return "Year to Date";
    return month;
  }
  function currentPeriodLabel(){
    var p = currentPeriod();
    return periodLabel(p.mode, p.month);
  }

  // The Unit slicer applies under Overall too — "Unit-01" then means Unit-01 of
  // both plants, rather than being ignored.
  function rowMatches(r, period, plant){
    if (!periodMatches(r, period.mode, period.month)) return false;
    if (plant && r.plant !== plant) return false;
    if (state.unit !== "all" && r.unit !== state.unit) return false;
    return true;
  }
  function scopeRows(period){
    var plant = state.location === "overall" ? null : state.location;
    return YMR_DATA.rows.filter(function(r){ return rowMatches(r, period, plant); });
  }
  function unitLabel(){ return state.unit === "all" ? "all units" : state.unit; }

  /* ================= filter UI builders ================= */
  function fillSelect(sel, options, value){
    sel.innerHTML = "";
    options.forEach(function(o){
      var opt = document.createElement("option");
      opt.value = o.value; opt.textContent = o.label;
      sel.appendChild(opt);
    });
    sel.value = value;
  }

  // Financial-year dropdown (header row, left). Narrowing the FY narrows the month
  // slicer and the trend chart; the YTD snapshot stays reachable either way.
  function buildFySelect(){
    var sel = document.getElementById("fySelect");
    fillSelect(sel,
      ALL_FYS.map(function(f){ return {label:f, value:f}; }).concat([{label:"All periods", value:"all"}]),
      state.fy);
    sel.onchange = function(){
      state.fy = sel.value;
      var months = fyMonths(state.fy);
      // YTD is not tied to a financial year, so it survives an FY change; a month
      // outside the new FY falls back to that FY's last month.
      if (state.period !== "YTD" && months.indexOf(state.period) === -1) {
        state.period = months[months.length - 1];
      }
      renderAll();
    };
  }

  // Plant dropdown (header row, centre) — the single plant control for the page.
  function buildPlantSelect(){
    var sel = document.getElementById("plantSelect");
    fillSelect(sel,
      [{label:"Overall (both plants)", value:"overall"}].concat(PLANTS.map(function(p){ return {label:p, value:p}; })),
      state.location);
    sel.onchange = function(){ state.location = sel.value; renderAll(); };
  }

  // Unit slicer — its own pills, available under Overall as well as per plant.
  function buildUnitSlicer(){
    var wrap = document.getElementById("unitSlicer");
    wrap.innerHTML = "";
    [{label:"All Units", value:"all"}].concat(UNITS.map(function(u){ return {label:u, value:u}; }))
      .forEach(function(opt){
        var on = state.unit === opt.value;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pill" + (on ? " active" : "");
        btn.textContent = opt.label;
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.addEventListener("click", function(){ state.unit = opt.value; renderAll(); });
        wrap.appendChild(btn);
      });
  }

  // Inside one financial year every pill would carry the same year suffix that the FY
  // dropdown already states, so the pill drops it and shows just "Jul". Under "All
  // periods" the months span more than one year, so the suffix is kept. The full label
  // stays on title/aria-label, and state.period always holds the full label either way.
  function monthPillLabel(p){
    if (p === "YTD" || state.fy === "all") return p;
    return p.split("-")[0];
  }

  // Month slicer — YTD first, then one pill per month present in the data.
  function buildMonthSlicer(){
    var wrap = document.getElementById("monthSlicer");
    wrap.innerHTML = "";
    ["YTD"].concat(fyMonths(state.fy)).forEach(function(p){
      var on = state.period === p;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill" + (on ? " active" : "");
      btn.textContent = monthPillLabel(p);
      btn.title = p;
      btn.setAttribute("aria-label", p);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.addEventListener("click", function(){ state.period = p; renderAll(); });
      wrap.appendChild(btn);
    });
    keepActivePillInView(wrap);
  }

  // The strip never wraps, so with a full financial year it can scroll. renderAll()
  // rebuilds it from scratch and that resets scrollLeft to 0, which would push the pill
  // the user just clicked out of sight — so bring the active one back into view.
  function keepActivePillInView(wrap){
    var act = wrap.querySelector(".pill.active");
    if (!act) return;
    var wr = wrap.getBoundingClientRect(), ar = act.getBoundingClientRect();
    if (ar.left >= wr.left && ar.right <= wr.right) return;
    wrap.scrollLeft += (ar.left - wr.left) - (wrap.clientWidth - ar.width) / 2;
  }

  /* ================= KPI cards ================= */
  function renderKpis(){
    var rows = scopeRows(currentPeriod());
    var agg = aggregate(rows);
    var grid = document.getElementById("kpiGrid");
    grid.innerHTML = "";

    YMR_DATA.attributes.forEach(function(attr){
      var actual = agg.consumption > 0 ? attr.compute(agg) : null;
      var target = targetForRows(attr, rows);
      var favorable = actual != null && target != null ? isFavorable(attr, actual, target) : null;

      var card = document.createElement("div");
      card.className = "kpi-card";

      var top = document.createElement("div");
      top.className = "kpi-top";
      var lbl = document.createElement("span");
      lbl.className = "kpi-label";
      lbl.textContent = attr.label;
      var pill = document.createElement("span");
      pill.className = "status-pill " + (favorable === null ? "neutral" : favorable ? "good" : "critical");
      pill.textContent = favorable === null ? "NO DATA" : favorable ? "ON TARGET" : "OFF TARGET";
      top.appendChild(lbl); top.appendChild(pill);

      var val = document.createElement("div");
      val.className = "kpi-value";
      val.textContent = fmtPct(actual);

      var sub = document.createElement("div");
      sub.className = "kpi-sub";
      sub.innerHTML = "<span>Target " + fmtPct(target) + "</span><span>" + attr.direction + "</span>";

      var track = document.createElement("div");
      track.className = "kpi-bar-track";
      var fill = document.createElement("div");
      fill.className = "kpi-bar-fill";
      var maxScale = Math.max(Math.abs(actual || 0), Math.abs(target || 0)) * 1.3 || 1;
      var pct = actual == null ? 0 : Math.min(100, Math.abs(actual) / maxScale * 100);
      fill.style.width = pct + "%";
      fill.style.background = favorable === null ? "var(--text-muted)" : favorable ? "var(--good)" : "var(--critical)";
      track.appendChild(fill);
      if (target != null) {
        var marker = document.createElement("div");
        marker.className = "kpi-bar-target";
        marker.style.left = Math.min(100, Math.abs(target) / maxScale * 100) + "%";
        track.appendChild(marker);
      }

      card.appendChild(top);
      card.appendChild(val);
      card.appendChild(sub);
      card.appendChild(track);
      grid.appendChild(card);
    });

    var scopeText = (state.location === "overall" ? "Overall (both plants)" : state.location)
      + " / " + unitLabel() + " · " + currentPeriodLabel();
    document.getElementById("scopeLabel").textContent = scopeText;
  }

  /* ================= composition — one pie, attributes inside it ================= */
  // Full pie (not a donut) so each attribute's name and share can sit inside its slice.
  function buildPieSVG(segments, size){
    size = size || 300;
    var r = size / 2 - 8;
    var cx = size / 2, cy = size / 2;
    var total = segments.reduce(function(s, seg){ return s + seg.magnitude; }, 0);
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", size); svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("role", "img");

    if (total <= 0) {
      var bg = document.createElementNS(svgNS, "circle");
      bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
      bg.setAttribute("fill", "var(--gridline)");
      svg.appendChild(bg);
      return svg;
    }

    var startAngle = -90;
    segments.forEach(function(seg){
      var share = seg.magnitude / total;
      var sweep = share * 360;
      var a0 = startAngle * Math.PI / 180;
      var a1 = (startAngle + sweep) * Math.PI / 180;
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      var largeArc = sweep > 180 ? 1 : 0;

      var path = document.createElementNS(svgNS, "path");
      var d = sweep >= 359.99
        ? "M " + cx + " " + (cy - r) + " A " + r + " " + r + " 0 1 1 " + (cx - 0.01).toFixed(2) + " " + (cy - r) + " Z"
        : "M " + cx + " " + cy + " L " + x0.toFixed(2) + " " + y0.toFixed(2) +
          " A " + r + " " + r + " 0 " + largeArc + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2) + " Z";
      path.setAttribute("d", d);
      path.setAttribute("fill", seg.color);
      path.setAttribute("stroke", "var(--surface-2)");
      path.setAttribute("stroke-width", 2);
      var title = document.createElementNS(svgNS, "title");
      title.textContent = seg.label + (seg.actualPct != null ? " — actual " + (seg.actualPct * 100).toFixed(2) + "%" : "")
        + " · " + Math.round(seg.value).toLocaleString() + " (" + (share * 100).toFixed(1) + "% of total)";
      path.appendChild(title);
      svg.appendChild(path);

      // Slice label, inside the pie, only where there is room for it.
      if (share >= 0.05) {
        var mid = (startAngle + sweep / 2) * Math.PI / 180;
        var lr = r * 0.62;
        var lx = cx + lr * Math.cos(mid), ly = cy + lr * Math.sin(mid);
        var name = document.createElementNS(svgNS, "text");
        name.setAttribute("x", lx.toFixed(1)); name.setAttribute("y", (ly - 4).toFixed(1));
        name.setAttribute("text-anchor", "middle");
        name.setAttribute("class", "pie-slice-label");
        name.textContent = seg.label;
        var pct = document.createElementNS(svgNS, "text");
        pct.setAttribute("x", lx.toFixed(1)); pct.setAttribute("y", (ly + 9).toFixed(1));
        pct.setAttribute("text-anchor", "middle");
        pct.setAttribute("class", "pie-slice-label sub");
        // the attribute's own actual % (Shortfall/Consumption etc.), not its share of the pie
        pct.textContent = seg.actualPct != null ? fmtPct(seg.actualPct) : (share * 100).toFixed(1) + "%";
        svg.appendChild(name);
        svg.appendChild(pct);
      }
      startAngle += sweep;
    });
    return svg;
  }

  // Slices are the attributes themselves, for one plant and the current Unit / Month
  // selection. Yield is excluded: it is the headline YMR % metric, not a loss bucket.
  // A slice's SIZE is its share of the total loss quantity, but the NUMBER shown is the
  // attribute's own actual percentage from the source formula (e.g. Shortfall/Consumption)
  // — the same figure as its KPI card, not its share of the pie.
  function compositionSegments(plant){
    var period = currentPeriod();
    var rows = YMR_DATA.rows.filter(function(r){ return rowMatches(r, period, plant); });
    var agg = aggregate(rows);
    return YMR_DATA.attributes
      .filter(function(a){ return !isYield(a); })
      .map(function(a){
        var value = agg[a.key] || 0;
        var actualPct = agg.consumption > 0 ? a.compute(agg) : null;
        return {
          label: a.label,
          color: ATTR_COLOR[a.key],
          value: value,
          magnitude: Math.abs(value),
          actualPct: actualPct,
          target: targetForRows(a, rows),
          attr: a
        };
      });
  }

  function buildPieCard(plant){
    var card = document.createElement("div");
    card.className = "pie-card";
    var h3 = document.createElement("h3");
    h3.textContent = plant + " — Attribute Breakup";
    var scope = document.createElement("div");
    scope.className = "pie-scope";
    scope.textContent = unitLabel() + " · " + currentPeriodLabel();
    card.appendChild(h3);
    card.appendChild(scope);

    var segs = compositionSegments(plant);
    var total = segs.reduce(function(s, g){ return s + g.magnitude; }, 0);
    if (total <= 0) {
      var empty = document.createElement("div");
      empty.className = "empty-note";
      empty.textContent = "No data for this selection.";
      card.appendChild(empty);
      return card;
    }

    var body = document.createElement("div");
    body.className = "pie-body";
    var card0 = document.getElementById("compositionCard");
    body.appendChild(buildPieSVG(segs, card0 && card0.classList.contains("fullview") ? 420 : 260));

    var legend = document.createElement("div");
    legend.className = "pie-legend";
    segs.forEach(function(g){
      var fav = g.actualPct != null && g.target != null ? isFavorable(g.attr, g.actualPct, g.target) : null;
      var statusColor = fav === null ? "var(--text-primary)" : fav ? "var(--good-text)" : "var(--critical)";
      var row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = "<span class='legend-name'><span class='swatch' style='background:" + g.color + "'></span>" + g.label + "</span>" +
        "<span class='legend-value' style='color:" + statusColor + "'>" + fmtPct(g.actualPct) +
        "<span style='color:var(--text-muted); font-weight:400;'> · " + Math.round(g.value).toLocaleString() + "</span></span>";
      legend.appendChild(row);
    });
    body.appendChild(legend);
    card.appendChild(body);
    return card;
  }

  // One pie per plant: both plants side by side under Overall, otherwise just the
  // selected plant.
  function renderComposition(){
    var wrap = document.getElementById("pieWrap");
    wrap.innerHTML = "";
    var plants = state.location === "overall" ? PLANTS : [state.location];
    plants.forEach(function(p){ wrap.appendChild(buildPieCard(p)); });

    var note = document.createElement("div");
    note.className = "hint";
    note.style.gridColumn = "1 / -1";
    note.textContent = "The % against each attribute is its actual value for this scope (the same figure as its KPI card), "
      + "coloured against its target. Slice size is that attribute's share of the total loss quantity, using absolute values so a "
      + "negative Gain/Loss still shows its size. Yield % is excluded — it is the headline YMR % metric, not a loss bucket.";
    wrap.appendChild(note);
  }

  /* ================= AI insights ================= */
  var ACTIONABLE = {
    "yield": function(scope, dev){ return "Yield (YMR %) at " + scope + " is " + dev.toFixed(2) + "pp below target — trace the biggest loss contributor (Shortfall / C-Grade / Waste) for this scope and act on it first."; },
    shortfall: function(scope, dev){ return "Investigate creel/count setting deviations and yarn feed calibration at " + scope + " — Shortfall is " + dev.toFixed(2) + "pp above target."; },
    cGrade: function(scope, dev){ return "Review quality-checkpoint adherence and machine settings at " + scope + " — C-Grade is " + dev.toFixed(2) + "pp above target."; },
    yarnWaste: function(scope, dev){ return "Audit winding/doffing waste handling at " + scope + " to bring Yarn Waste back within target (" + dev.toFixed(2) + "pp over)."; },
    ucSmallLots: function(scope, dev){ return "Review lot-sizing and batch planning at " + scope + " to reduce UC Small Lots (" + dev.toFixed(2) + "pp over target)."; },
    gainLoss: function(scope, dev){ return "Reconcile Gain/Loss variance at " + scope + " — check weighment/scale calibration and process losses (" + dev.toFixed(2) + "pp off target)."; }
  };

  // The panel has no controls of its own — it reports on exactly the scope the page is
  // already set to: the Plant dropdown, the Filter pills (period) and the Unit pills.
  // Findings are always grouped per plant, since a plant is what carries the targets;
  // with a Unit pill active each group is that unit of the plant, which rowMatches()
  // applies for us.
  function insightPlants(){
    return state.location === "overall" ? PLANTS : [state.location];
  }

  function computeInsights(){
    var period = currentPeriod();
    var groups = [];
    insightPlants().forEach(function(p){
      var rows = YMR_DATA.rows.filter(function(r){ return rowMatches(r, period, p); });
      if (!rows.length) return;
      groups.push({ scope: state.unit === "all" ? p : p + " / " + state.unit, plant: p, rows: rows });
    });

    var findings = [];
    groups.forEach(function(g){
      var agg = aggregate(g.rows);
      if (agg.consumption <= 0) return;
      YMR_DATA.attributes.forEach(function(attr){
        var actual = attr.compute(agg);
        var target = attr.targets[g.plant];
        var favorable = isFavorable(attr, actual, target);
        if (favorable) return;
        var deviationPct = (attr.direction === "Higher is Better" ? (target - actual) : (actual - target)) * 100;
        findings.push({ scope: g.scope, attr: attr, actual: actual, target: target, deviationPct: deviationPct });
      });
    });
    findings.sort(function(a, b){ return b.deviationPct - a.deviationPct; });
    return findings.slice(0, 8);
  }

  function renderInsights(){
    var list = document.getElementById("insightList");
    list.innerHTML = "";
    var findings = computeInsights();
    document.getElementById("insightsCount").textContent = String(findings.length);

    // The panel takes its scope from the row above rather than from controls of its own,
    // so it spells that scope out — otherwise there is nothing in here saying what it read.
    document.getElementById("insightScopeLabel").textContent =
      (state.location === "overall" ? "Overall (both plants)" : state.location)
      + " / " + unitLabel() + " · " + currentPeriodLabel();

    if (findings.length === 0) {
      var scope = state.location === "overall" ? "either plant" : state.location;
      list.innerHTML = '<div class="empty-note">No red-flagged areas at ' + scope + ' for '
        + currentPeriodLabel() + ' — all visible attributes are on target.</div>';
      return;
    }
    var maxDev = Math.max.apply(null, findings.map(function(f){ return f.deviationPct; }));
    findings.forEach(function(f){
      var item = document.createElement("div");
      item.className = "insight-item";
      var head = document.createElement("div");
      head.className = "insight-head";
      head.innerHTML = "<div><div class='insight-scope'>" + f.scope + "</div><div class='insight-attr'>" + f.attr.label + "</div></div>" +
        "<div class='insight-dev'>" + fmtSigned(f.deviationPct) + "pp</div>";
      var metrics = document.createElement("div");
      metrics.className = "insight-metrics";
      metrics.textContent = "Actual " + fmtPct(f.actual) + " · Target " + fmtPct(f.target) + " · " + f.attr.direction;
      var sevTrack = document.createElement("div");
      sevTrack.className = "insight-sev-track";
      var sevFill = document.createElement("div");
      sevFill.className = "insight-sev-fill";
      sevFill.style.width = (maxDev > 0 ? (f.deviationPct / maxDev * 100) : 0) + "%";
      sevTrack.appendChild(sevFill);
      var action = document.createElement("div");
      action.className = "insight-action";
      action.innerHTML = "<b>Actionable:</b> " + ACTIONABLE[f.attr.key](f.scope, f.deviationPct);

      item.appendChild(head);
      item.appendChild(metrics);
      item.appendChild(sevTrack);
      item.appendChild(action);
      list.appendChild(item);
    });
  }

  /* ================= AI insights slicer button ================= */
  function applyInsightsOpen(){
    var btn = document.getElementById("insightsToggle");
    var panel = document.getElementById("insightsPanel");
    btn.classList.toggle("open", state.insightsOpen);
    btn.setAttribute("aria-expanded", state.insightsOpen ? "true" : "false");
    document.getElementById("insightsChev").textContent = state.insightsOpen ? "▲" : "▼";
    panel.hidden = !state.insightsOpen;
  }

  function buildInsightsToggle(){
    document.getElementById("insightsToggle").addEventListener("click", function(){
      state.insightsOpen = !state.insightsOpen;
      applyInsightsOpen();
      if (state.insightsOpen) {
        renderInsights();
        document.getElementById("insightsPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    applyInsightsOpen();
  }

  /* ================= panel slicer buttons (filters row, right) ================= */
  // Performance vs Target and Composition both start closed and are opened by their own
  // button in the filters row. The buttons only control visibility — what is
  // rendered inside each panel still follows the filters.
  function applyPanelOpen(btnId, chevId, panelId, open){
    var btn = document.getElementById(btnId);
    btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    document.getElementById(chevId).textContent = open ? "▲" : "▼";
    document.getElementById(panelId).hidden = !open;
  }

  function applyPerformanceOpen(){
    applyPanelOpen("performanceToggle", "performanceChev", "performancePanel", state.performanceOpen);
  }
  function applyCompositionOpen(){
    applyPanelOpen("compositionToggle", "compositionChev", "compositionCard", state.compositionOpen);
  }

  function buildPanelToggle(btnId, panelId, get, set, apply, render){
    document.getElementById(btnId).addEventListener("click", function(){
      set(!get());
      apply();
      if (get()) {
        render();
        document.getElementById(panelId).scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    apply();
  }

  function buildPerformanceToggle(){
    buildPanelToggle("performanceToggle", "performancePanel",
      function(){ return state.performanceOpen; },
      function(v){ state.performanceOpen = v; },
      applyPerformanceOpen, renderKpis);
  }

  function buildCompositionToggle(){
    buildPanelToggle("compositionToggle", "compositionCard",
      function(){ return state.compositionOpen; },
      function(v){ state.compositionOpen = v; },
      applyCompositionOpen, renderComposition);
  }

  /* ================= Yield % trend (line chart) ================= */
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(name, attrs, text){
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function(k){ el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }
  function yieldAttr(){ return ATTR_BY_KEY[YIELD_KEY]; }

  // The chart has no controls of its own — it follows the filters row. It plots the months
  // of the selected financial year, scoped by the Plant dropdown and the Unit pills, with
  // the active month pill highlighted on the x-axis.
  function trendPoints(){
    var attr = yieldAttr();
    var plant = state.location === "overall" ? null : state.location;
    function pointFor(label, rows){
      var scoped = rows.filter(function(r){
        if (plant && r.plant !== plant) return false;
        if (state.unit !== "all" && r.unit !== state.unit) return false;
        return true;
      });
      var agg = aggregate(scoped);
      if (!scoped.length || agg.consumption <= 0) return null;
      return { label: label, value: attr.compute(agg), target: targetForRows(attr, scoped) };
    }

    return fyMonths(state.fy).map(function(m){
      return pointFor(m, YMR_DATA.rows.filter(function(r){ return r.month === m; }));
    }).filter(Boolean);
  }

  function trendEmptyNote(){
    return "No Yield % data for this selection.";
  }

  function renderTrend(){
    var wrap = document.getElementById("trendWrap");
    wrap.innerHTML = "";

    var pts = trendPoints();
    if (pts.length < 2) {
      var note = document.createElement("div");
      note.className = "empty-note";
      note.style.maxWidth = "760px";
      note.style.margin = "0 auto";
      note.textContent = trendEmptyNote();
      wrap.appendChild(note);
      return;
    }

    var W = 960, H = 380, mL = 58, mR = 148, mT = 30, mB = 52;
    var plotW = W - mL - mR, plotH = H - mT - mB;
    var values = pts.map(function(p){ return p.value; });
    var targets = pts.map(function(p){ return p.target; }).filter(function(t){ return t != null; });
    var lo = Math.min.apply(null, values.concat(targets));
    var hi = Math.max.apply(null, values.concat(targets));
    var pad = Math.max((hi - lo) * 0.25, 0.01);
    lo = lo - pad; hi = hi + pad;
    var x = function(i){ return mL + (pts.length === 1 ? plotW / 2 : (i / (pts.length - 1)) * plotW); };
    var y = function(v){ return mT + plotH - ((v - lo) / (hi - lo)) * plotH; };

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "class": "trend", role: "img",
      "aria-label": "Yield percent trend against target" });

    // horizontal gridlines + y-axis labels
    for (var t = 0; t <= 4; t++) {
      var v = lo + (hi - lo) * (t / 4);
      var gy = y(v);
      svg.appendChild(svgEl("line", { x1: mL, y1: gy, x2: mL + plotW, y2: gy, "class": "grid" }));
      svg.appendChild(svgEl("text", { x: mL - 10, y: gy + 4, "text-anchor": "end", "class": "axis-text" },
        (v * 100).toFixed(1) + "%"));
    }

    // highlight the month currently selected in the month slicer
    var selIdx = pts.findIndex(function(p){ return p.label === state.period; });
    if (selIdx !== -1 && pts.length > 1) {
      var half = plotW / (pts.length - 1) / 2;
      svg.appendChild(svgEl("rect", { x: Math.max(mL, x(selIdx) - half), y: mT,
        width: Math.min(half * 2, plotW), height: plotH, "class": "sel-band" }));
    }

    // target line + its value, spelled out on the chart
    var tPts = pts.map(function(p, i){ return x(i) + "," + y(p.target != null ? p.target : lo); });
    svg.appendChild(svgEl("polyline", { points: tPts.join(" "), "class": "target-line", fill: "none" }));
    var lastTarget = pts[pts.length - 1].target;
    svg.appendChild(svgEl("text", { x: mL + plotW + 8, y: y(lastTarget) + 4, "class": "target-text" },
      "Target " + fmtPct(lastTarget)));

    // achieved line
    svg.appendChild(svgEl("polyline", {
      points: pts.map(function(p, i){ return x(i) + "," + y(p.value); }).join(" "),
      "class": "series-line"
    }));
    var lastVal = pts[pts.length - 1];
    svg.appendChild(svgEl("text", { x: mL + plotW + 8, y: y(lastVal.value) + 4, "class": "value-text",
      fill: isFavorable(yieldAttr(), lastVal.value, lastVal.target) ? "var(--good)" : "var(--critical)" },
      "Achieved " + fmtPct(lastVal.value)));

    // points, their values, and the x-axis labels
    pts.forEach(function(p, i){
      var good = p.target == null || isFavorable(yieldAttr(), p.value, p.target);
      var color = good ? "var(--good)" : "var(--critical)";
      svg.appendChild(svgEl("circle", { cx: x(i), cy: y(p.value), r: 4.5, fill: color,
        stroke: "var(--surface-2)", "stroke-width": 1.5 }));
      var above = p.target == null || p.value >= p.target;
      // the last point's value is already spelled out in the "Achieved" label at the
      // right edge — labelling it twice just collides
      if (i !== pts.length - 1) {
        svg.appendChild(svgEl("text", { x: x(i), y: y(p.value) + (above ? -12 : 18), "text-anchor": "middle",
          "class": "value-text", fill: color }, (p.value * 100).toFixed(1) + "%"));
      }
      svg.appendChild(svgEl("text", { x: x(i), y: mT + plotH + 22, "text-anchor": "middle", "class": "axis-text" },
        p.label));
    });

    wrap.appendChild(svg);
  }

  /* ================= full view (square button) ================= */
  // Expands the Composition card to fill the window so the pies can be read large.
  // Nothing about the data changes — the active filters still apply.
  function initFullView(){
    var card = document.getElementById("compositionCard");
    var btn = document.getElementById("compFullBtn");
    function setOpen(open){
      card.classList.toggle("fullview", open);
      document.body.classList.toggle("fullview-lock", open);
      btn.classList.toggle("on", open);
      btn.setAttribute("aria-pressed", open ? "true" : "false");
      btn.title = open ? "Exit full view" : "Full view";
      renderComposition();               // re-lay the pies at the new width
    }
    btn.addEventListener("click", function(){ setOpen(!card.classList.contains("fullview")); });
    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && card.classList.contains("fullview")) setOpen(false);
    });
  }

  /* ================= theme ================= */
  // Theme selector (header row, right): System / Light / Dark mode / Anti-Gravity.
  function applyTheme(theme){
    if (theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }

  function initTheme(){
    var sel = document.getElementById("themeSelect");
    var saved = localStorage.getItem("ymr-theme") || "system";
    if (!Array.prototype.some.call(sel.options, function(o){ return o.value === saved; })) saved = "system";
    sel.value = saved;
    applyTheme(saved);
    sel.onchange = function(){
      applyTheme(sel.value);
      localStorage.setItem("ymr-theme", sel.value);
    };
  }

  // Use an official logo file if one has been dropped in assets/, otherwise keep the
  // built-in wordmark (which follows the theme).
  function initLogo(){
    var img = document.getElementById("brandLogoImg");
    var word = document.getElementById("brandLogoWord");
    // `hidden` is an HTMLElement property, so the wordmark (an SVGElement) has to be
    // toggled through the attribute for the CSS `[hidden]` rule to catch it.
    function setHidden(el, hide){
      if (hide) el.setAttribute("hidden", "");
      else el.removeAttribute("hidden");
    }
    function show(ok){
      setHidden(img, !ok);
      setHidden(word, ok);
    }
    img.addEventListener("load", function(){ show(true); });
    img.addEventListener("error", function(){ show(false); });
    // A cached logo can finish loading before DOMContentLoaded runs this, in which case
    // neither event will fire again — decide from the image's own state instead.
    if (img.complete) show(img.naturalWidth > 0);
  }

  /* ================= init / render ================= */
  function renderAll(){
    buildFySelect();
    buildPlantSelect();
    buildUnitSlicer();
    buildMonthSlicer();
    renderKpis();
    renderTrend();
    renderComposition();
    renderInsights();
  }

  function init(){
    initTheme();
    initLogo();
    document.getElementById("sourceFileLabel").textContent = YMR_DATA.sourceFile || "Data/YMR.xlsx";
    buildInsightsToggle();
    initFullView();
    buildPerformanceToggle();
    buildCompositionToggle();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
