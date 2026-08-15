(function(){
  "use strict";

  if (typeof YMR_DATA === "undefined") {
    document.getElementById("dataMeta").textContent = "assets/data.js not found — run Update_Dashboard.bat first.";
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
  var SERIES_HEX_LIGHT = {"var(--series-1)":"#2a78d6","var(--series-2)":"#eb6834","var(--series-3)":"#1baf7a","var(--series-4)":"#eda100","var(--series-5)":"#e87ba4"};

  var MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function isRegularMonth(label){ return label !== "Week-01" && label !== "YTD"; }
  function monthSortKey(label){
    var parts = label.split("-");
    var mi = MONTH_ABBR.indexOf(parts[0]);
    var year = 2000 + parseInt(parts[1], 10);
    return year * 12 + mi;
  }
  var ALL_MONTHS = Array.from(new Set(YMR_DATA.rows.filter(function(r){return isRegularMonth(r.month);}).map(function(r){return r.month;})))
    .sort(function(a,b){ return monthSortKey(a) - monthSortKey(b); });

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
  function fmtNum(v){ return v == null ? "—" : Math.round(v).toLocaleString(); }
  function fmtSigned(v){ return (v >= 0 ? "+" : "") + v.toFixed(2); }

  /* ================= state ================= */
  var PLANTS = ["Plant-05", "Plant-06"];
  var UNITS = ["Unit-01", "Unit-02"];
  var state = {
    location: "overall",       // 'overall' | 'Plant-05' | 'Plant-06'
    unit: "all",                // 'all' | 'Unit-01' | 'Unit-02'
    periodMode: "month",        // 'month' | 'week' | 'ytd'
    month: currentMonthLabel(),
    visibleAttrs: new Set(YMR_DATA.attributes.map(function(a){ return a.key; })),
    insightView: "month",       // 'week' | 'month' | 'ytd'
    insightBreakdown: "plant"   // 'plant' | 'unit'
  };

  function periodMatches(row, mode, month){
    if (mode === "week") return row.month === "Week-01";
    if (mode === "ytd") return row.month === "YTD";
    return row.month === month;
  }
  function currentPeriod(){ return { mode: state.periodMode, month: state.month }; }
  function periodLabel(mode, month){
    if (mode === "week") return "Current Week (Week-01)";
    if (mode === "ytd") return "Year to Date";
    return month;
  }

  function scopeRows(period){
    return YMR_DATA.rows.filter(function(r){
      if (!periodMatches(r, period.mode, period.month)) return false;
      if (state.location !== "overall" && r.plant !== state.location) return false;
      if (state.location !== "overall" && state.unit !== "all" && r.unit !== state.unit) return false;
      return true;
    });
  }

  /* ================= filter UI builders ================= */
  function segmented(container, options, activeValue, onPick){
    container.innerHTML = "";
    options.forEach(function(opt){
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.label;
      if (opt.value === activeValue) btn.className = "active";
      btn.addEventListener("click", function(){ onPick(opt.value); });
      container.appendChild(btn);
    });
  }

  function buildLocationSeg(){
    segmented(document.getElementById("locationSeg"),
      [{label:"Overall", value:"overall"}, {label:"Plant-05", value:"Plant-05"}, {label:"Plant-06", value:"Plant-06"}],
      state.location,
      function(v){ state.location = v; state.unit = "all"; renderAll(); }
    );
    document.getElementById("unitGroup").style.display = state.location === "overall" ? "none" : "flex";
  }

  function buildUnitSelect(){
    var sel = document.getElementById("unitSelect");
    sel.innerHTML = "";
    var optAll = document.createElement("option");
    optAll.value = "all"; optAll.textContent = "All Units";
    sel.appendChild(optAll);
    UNITS.forEach(function(u){
      var o = document.createElement("option");
      o.value = u; o.textContent = u;
      sel.appendChild(o);
    });
    sel.value = state.unit;
    sel.onchange = function(){ state.unit = sel.value; renderAll(); };
  }

  function buildPeriodSeg(){
    segmented(document.getElementById("periodSeg"),
      [{label:"Month", value:"month"}, {label:"Week", value:"week"}, {label:"YTD", value:"ytd"}],
      state.periodMode,
      function(v){ state.periodMode = v; renderAll(); }
    );
    document.getElementById("monthGroup").style.display = state.periodMode === "month" ? "flex" : "none";
  }

  function buildMonthSelect(){
    var sel = document.getElementById("monthSelect");
    sel.innerHTML = "";
    ALL_MONTHS.forEach(function(m){
      var o = document.createElement("option");
      o.value = m; o.textContent = m;
      sel.appendChild(o);
    });
    sel.value = state.month;
    sel.onchange = function(){ state.month = sel.value; renderAll(); };
  }

  function buildAttrChecks(){
    var wrap = document.getElementById("attrChecks");
    wrap.innerHTML = "";
    YMR_DATA.attributes.forEach(function(a){
      var label = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.visibleAttrs.has(a.key);
      if (!cb.checked) label.className = "unchecked";
      cb.addEventListener("change", function(){
        if (cb.checked) state.visibleAttrs.add(a.key); else state.visibleAttrs.delete(a.key);
        label.className = cb.checked ? "" : "unchecked";
        renderAll();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(a.label));
      wrap.appendChild(label);
    });
  }

  function buildInsightControls(){
    segmented(document.getElementById("insightViewSeg"),
      [{label:"Current Week", value:"week"}, {label:"Current Month", value:"month"}, {label:"YTD", value:"ytd"}],
      state.insightView,
      function(v){ state.insightView = v; renderInsights(); }
    );
    segmented(document.getElementById("insightBreakdownSeg"),
      [{label:"Plant-wise", value:"plant"}, {label:"Unit-wise", value:"unit"}],
      state.insightBreakdown,
      function(v){ state.insightBreakdown = v; renderInsights(); }
    );
  }

  /* ================= KPI cards ================= */
  function renderKpis(){
    var rows = scopeRows(currentPeriod());
    var agg = aggregate(rows);
    var grid = document.getElementById("kpiGrid");
    grid.innerHTML = "";

    var visible = YMR_DATA.attributes.filter(function(a){ return state.visibleAttrs.has(a.key); });
    if (visible.length === 0) {
      grid.innerHTML = '<div class="empty-note">No attributes selected — check at least one above.</div>';
      return;
    }

    visible.forEach(function(attr){
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
      pill.textContent = favorable === null ? "NO DATA" : favorable ? "✓ ON TARGET" : "✗ OFF TARGET";
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

    var scopeText = (state.location === "overall" ? "Overall (both plants)" : state.location + (state.unit !== "all" ? " / " + state.unit : " / all units"))
      + " · " + periodLabel(state.periodMode, state.month);
    document.getElementById("scopeLabel").textContent = scopeText;
  }

  /* ================= breakdown table ================= */
  function renderBreakdown(){
    var period = currentPeriod();
    var title = document.getElementById("breakdownTitle");
    var groups;
    if (state.location === "overall") {
      title.textContent = "Plant-wise Breakdown";
      groups = PLANTS.map(function(p){
        return { label: p, plant: p, rows: YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === p; }) };
      });
    } else {
      title.textContent = state.location + " — Unit-wise Breakdown";
      groups = UNITS.map(function(u){
        return { label: u, plant: state.location, rows: YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === state.location && r.unit === u; }) };
      });
    }
    groups = groups.filter(function(g){ return g.rows.length > 0; });

    var visible = YMR_DATA.attributes.filter(function(a){ return state.visibleAttrs.has(a.key); });
    var table = document.getElementById("breakdownTable");
    if (groups.length === 0 || visible.length === 0) {
      table.innerHTML = '<tr><td class="empty-note">No data for this selection.</td></tr>';
      return;
    }

    var thead = "<thead><tr><th>" + (state.location === "overall" ? "Plant" : "Unit") + "</th><th class='num'>Consumption</th>";
    visible.forEach(function(a){ thead += "<th class='num'>" + a.label + " (Actual / Target)</th>"; });
    thead += "</tr></thead>";

    var tbody = "<tbody>";
    groups.forEach(function(g){
      var agg = aggregate(g.rows);
      tbody += "<tr><td>" + g.label + "</td><td class='num'>" + fmtNum(agg.consumption) + "</td>";
      visible.forEach(function(attr){
        var actual = agg.consumption > 0 ? attr.compute(agg) : null;
        var target = attr.targets[g.plant];
        var fav = actual != null ? isFavorable(attr, actual, target) : null;
        var statusClass = fav === null ? "" : fav ? "good" : "critical";
        tbody += "<td class='num'><span class='cell-status'>" + (fav === null ? "" : "<span class='dot " + statusClass + "'></span>") +
          fmtPct(actual) + " <span style='color:var(--text-muted); font-weight:400;'>/ " + fmtPct(target) + "</span></span></td>";
      });
      tbody += "</tr>";
    });
    tbody += "</tbody>";
    table.innerHTML = thead + tbody;
  }

  /* ================= pie / donut composition ================= */
  function buildDonutSVG(segments, size){
    size = size || 120;
    var r = size / 2 - 6;
    var cx = size / 2, cy = size / 2;
    var total = segments.reduce(function(s, seg){ return s + seg.magnitude; }, 0);
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", size); svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);

    if (total <= 0) {
      var bg = document.createElementNS(svgNS, "circle");
      bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
      bg.setAttribute("fill", "none");
      bg.setAttribute("stroke", "var(--gridline)");
      bg.setAttribute("stroke-width", 16);
      svg.appendChild(bg);
      return svg;
    }

    var startAngle = -90;
    var gapDeg = segments.length > 1 ? 2 : 0;
    segments.forEach(function(seg){
      var sweep = (seg.magnitude / total) * (360 - gapDeg * segments.length);
      var a0 = startAngle * Math.PI / 180;
      var a1 = (startAngle + sweep) * Math.PI / 180;
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      var largeArc = sweep > 180 ? 1 : 0;
      var path = document.createElementNS(svgNS, "path");
      var d = "M " + x0.toFixed(2) + " " + y0.toFixed(2) +
              " A " + r + " " + r + " 0 " + largeArc + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2);
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", seg.color);
      path.setAttribute("stroke-width", 16);
      path.setAttribute("stroke-linecap", "butt");
      svg.appendChild(path);
      startAngle += sweep + gapDeg;
    });
    return svg;
  }

  function compositionGroups(attr, period){
    if (state.location === "overall") {
      return PLANTS.map(function(p, i){
        var rows = YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === p; });
        var agg = aggregate(rows);
        return { label: p, value: agg[attr.key], color: SERIES_COLORS[i] };
      });
    }
    if (state.unit === "all") {
      return UNITS.map(function(u, i){
        var rows = YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === state.location && r.unit === u; });
        var agg = aggregate(rows);
        return { label: u, value: agg[attr.key], color: SERIES_COLORS[i] };
      });
    }
    var otherUnit = state.unit === "Unit-01" ? "Unit-02" : "Unit-01";
    var thisRows = YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === state.location && r.unit === state.unit; });
    var otherRows = YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === state.location && r.unit === otherUnit; });
    return [
      { label: state.unit, value: aggregate(thisRows)[attr.key], color: SERIES_COLORS[0] },
      { label: "Rest of " + state.location, value: aggregate(otherRows)[attr.key], color: SERIES_COLORS[1] }
    ];
  }

  function renderPies(){
    var period = currentPeriod();
    var grid = document.getElementById("pieGrid");
    grid.innerHTML = "";
    var visible = YMR_DATA.attributes.filter(function(a){ return state.visibleAttrs.has(a.key); });
    if (visible.length === 0) {
      grid.innerHTML = '<div class="empty-note">No attributes selected — check at least one above.</div>';
      return;
    }

    visible.forEach(function(attr){
      var groups = compositionGroups(attr, period).filter(function(g){ return g.value !== 0 || true; });
      var hasAny = groups.some(function(g){ return g.value !== 0; });

      var card = document.createElement("div");
      card.className = "pie-card";
      var h3 = document.createElement("h3");
      h3.textContent = attr.label + " — Composition";
      card.appendChild(h3);

      if (!hasAny) {
        var empty = document.createElement("div");
        empty.className = "empty-note";
        empty.textContent = "No data for this period.";
        card.appendChild(empty);
        grid.appendChild(card);
        return;
      }

      var segs = groups.map(function(g){ return { label: g.label, color: g.color, magnitude: Math.abs(g.value), value: g.value }; });
      var body = document.createElement("div");
      body.className = "pie-body";
      body.appendChild(buildDonutSVG(segs, 120));

      var total = segs.reduce(function(s, g){ return s + g.magnitude; }, 0);
      var legend = document.createElement("div");
      legend.className = "pie-legend";
      groups.forEach(function(g){
        var share = total > 0 ? (Math.abs(g.value) / total * 100) : 0;
        var row = document.createElement("div");
        row.className = "legend-row";
        row.innerHTML = "<span class='legend-name'><span class='swatch' style='background:" + g.color + "'></span>" + g.label + "</span>" +
          "<span class='legend-value'>" + Math.round(g.value).toLocaleString() + " (" + share.toFixed(0) + "%)</span>";
        legend.appendChild(row);
      });
      body.appendChild(legend);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  /* ================= AI insights ================= */
  var ACTIONABLE = {
    shortfall: function(scope, dev){ return "Investigate creel/count setting deviations and yarn feed calibration at " + scope + " — Shortfall is " + dev.toFixed(2) + "pp above target."; },
    cGrade: function(scope, dev){ return "Review quality-checkpoint adherence and machine settings at " + scope + " — C-Grade is " + dev.toFixed(2) + "pp above target."; },
    yarnWaste: function(scope, dev){ return "Audit winding/doffing waste handling at " + scope + " to bring Yarn Waste back within target (" + dev.toFixed(2) + "pp over)."; },
    ucSmallLots: function(scope, dev){ return "Review lot-sizing and batch planning at " + scope + " to reduce UC Small Lots (" + dev.toFixed(2) + "pp over target)."; },
    gainLoss: function(scope, dev){ return "Reconcile Gain/Loss variance at " + scope + " — check weighment/scale calibration and process losses (" + dev.toFixed(2) + "pp off target)."; }
  };

  function insightPeriod(){
    if (state.insightView === "week") return { mode: "week", month: null };
    if (state.insightView === "ytd") return { mode: "ytd", month: null };
    return { mode: "month", month: currentMonthLabel() };
  }

  function computeInsights(){
    var period = insightPeriod();
    var groups = [];
    if (state.insightBreakdown === "plant") {
      PLANTS.forEach(function(p){
        var rows = YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === p; });
        if (rows.length) groups.push({ scope: p, plant: p, rows: rows });
      });
    } else {
      PLANTS.forEach(function(p){
        UNITS.forEach(function(u){
          var rows = YMR_DATA.rows.filter(function(r){ return periodMatches(r, period.mode, period.month) && r.plant === p && r.unit === u; });
          if (rows.length) groups.push({ scope: p + " / " + u, plant: p, rows: rows });
        });
      });
    }

    var findings = [];
    groups.forEach(function(g){
      var agg = aggregate(g.rows);
      if (agg.consumption <= 0) return;
      YMR_DATA.attributes.forEach(function(attr){
        if (!state.visibleAttrs.has(attr.key)) return;
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
    if (state.visibleAttrs.size === 0) {
      list.innerHTML = '<div class="empty-note">No attributes selected — check at least one above.</div>';
      return;
    }
    var findings = computeInsights();
    if (findings.length === 0) {
      list.innerHTML = '<div class="empty-note">No red-flagged areas for ' + periodLabel(insightPeriod().mode, insightPeriod().month) + ' — all visible attributes are on target.</div>';
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

  /* ================= theme toggle ================= */
  function initTheme(){
    var saved = localStorage.getItem("ymr-theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    document.getElementById("themeToggle").addEventListener("click", function(){
      var current = document.documentElement.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("ymr-theme", next);
    });
  }

  /* ================= init / render ================= */
  function renderAll(){
    buildLocationSeg();
    buildUnitSelect();
    buildPeriodSeg();
    buildMonthSelect();
    renderKpis();
    renderBreakdown();
    renderPies();
  }

  function init(){
    initTheme();
    document.getElementById("dataMeta").textContent = "Data generated " + (YMR_DATA.generatedAt || "—");
    document.getElementById("sourceFileLabel").textContent = YMR_DATA.sourceFile || "Data/YMR.xlsx";
    buildAttrChecks();
    buildInsightControls();
    renderAll();
    renderInsights();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
