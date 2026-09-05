# Converts Data\YMR.xlsx into assets\data.js — same output as scripts\refresh_data.py,
# but with no Python and no Excel required. It reads the .xlsx (a zip of XML parts)
# directly with the .NET libraries that ship with Windows.
#
# Run it from Update_Dashboard.bat, or directly:
#     powershell -ExecutionPolicy Bypass -File scripts\refresh_data.ps1

$ErrorActionPreference = "Stop"

$root       = Split-Path -Parent $PSScriptRoot
$sourceFile = Join-Path $root "Data\YMR.xlsx"
$outputFile = Join-Path $root "assets\data.js"
$sheetName  = "YMR Factors"

# Source column header (row A:K) -> camelCase field name used by the dashboard.
$FIELD_MAP = @{
  "Month"         = "month"
  "Plant"         = "plant"
  "Unit"          = "unit"
  "Consumption"   = "consumption"
  "Yield"         = "yield"
  "Total Waste"   = "totalWaste"
  "Shortfall"     = "shortfall"
  "C-Grade"       = "cGrade"
  "Yarn Waste"    = "yarnWaste"
  "UC Small Lots" = "ucSmallLots"
  "Gain/Loss"     = "gainLoss"
}
$TEXT_FIELDS = @("month", "plant", "unit")

# Attribute label in the source M:Q table -> key + label used by the dashboard.
# "Yield %" is the headline YMR % metric.
$ATTRIBUTE_MAP = [ordered]@{
  "Yield %"         = @{ key = "yield";       label = "Yield %" }
  "Shortfall %"     = @{ key = "shortfall";   label = "Shortfall" }
  "C-Grade %"       = @{ key = "cGrade";      label = "C Grade" }
  "Yarn Waste %"    = @{ key = "yarnWaste";   label = "Yarn Waste" }
  "UC Small Lots %" = @{ key = "ucSmallLots"; label = "UC Small Lot" }
  "Gain/Loss %"     = @{ key = "gainLoss";    label = "Gain/Loss" }
}
$ATTRIBUTE_ORDER = @("yield", "shortfall", "cGrade", "yarnWaste", "ucSmallLots", "gainLoss")

if (-not (Test-Path $sourceFile)) {
  throw "source file not found: $sourceFile"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryXml($zip, $entryName) {
  $entry = $zip.Entries | Where-Object { $_.FullName -eq $entryName }
  if (-not $entry) { return $null }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
  return [xml]$text
}

# ---- open the workbook and locate the sheet part for $sheetName ----
$zip = [System.IO.Compression.ZipFile]::OpenRead($sourceFile)
try {
  $workbook = Read-ZipEntryXml $zip "xl/workbook.xml"
  $rels     = Read-ZipEntryXml $zip "xl/_rels/workbook.xml.rels"

  $sheetEntry = $workbook.workbook.sheets.sheet | Where-Object { $_.name -eq $sheetName }
  if (-not $sheetEntry) {
    $names = ($workbook.workbook.sheets.sheet | ForEach-Object { $_.name }) -join ", "
    throw "sheet '$sheetName' not found. Sheets present: $names"
  }
  $relId  = $sheetEntry.id
  $target = ($rels.Relationships.Relationship | Where-Object { $_.Id -eq $relId }).Target
  $target = $target -replace "^/xl/", "" -replace "^/", ""
  $sheetPath = if ($target -like "xl/*") { $target } else { "xl/$target" }

  $sharedXml = Read-ZipEntryXml $zip "xl/sharedStrings.xml"
  $sheetXml  = Read-ZipEntryXml $zip $sheetPath
  if (-not $sheetXml) { throw "could not read sheet part '$sheetPath' from the workbook" }
} finally {
  $zip.Dispose()
}

# ---- shared strings table ----
$shared = New-Object System.Collections.ArrayList
if ($sharedXml) {
  foreach ($si in $sharedXml.sst.si) {
    $text = ""
    if ($null -ne $si.t) {
      $text = if ($si.t -is [string]) { $si.t } else { $si.t.InnerText }
    } elseif ($null -ne $si.r) {
      # rich text: concatenate the runs
      $text = ($si.r | ForEach-Object { if ($_.t -is [string]) { $_.t } else { $_.t.InnerText } }) -join ""
    }
    [void]$shared.Add($text)
  }
}

# ---- read every cell into $grid[rowNumber][columnLetter] ----
$grid = @{}
foreach ($row in $sheetXml.worksheet.sheetData.row) {
  $rowNum = [int]$row.r
  $cells = @{}
  foreach ($c in $row.c) {
    if (-not $c.r) { continue }
    $col = ($c.r -replace '[0-9]', '')
    $value = $null
    if ($c.t -eq "s") {
      if ($null -ne $c.v -and $c.v -ne "") { $value = $shared[[int]$c.v] }
    } elseif ($c.t -eq "inlineStr") {
      if ($null -ne $c.is) { $value = $c.is.InnerText }
    } elseif ($c.t -eq "str") {
      $value = $c.v
    } else {
      # numeric (or a formula cell — <v> holds the cached result)
      if ($null -ne $c.v -and $c.v -ne "") { $value = [double]$c.v }
    }
    if ($null -ne $value) { $cells[$col] = $value }
  }
  $grid[$rowNum] = $cells
}

function Get-Cell([int]$rowNum, [string]$col) {
  if (-not $grid.ContainsKey($rowNum)) { return $null }
  $cells = $grid[$rowNum]
  if (-not $cells.ContainsKey($col)) { return $null }
  return $cells[$col]
}

function Find-HeaderRow([string]$col, [string]$marker, [int]$maxScan = 20) {
  for ($r = 1; $r -le $maxScan; $r++) {
    if ((Get-Cell $r $col) -eq $marker) { return $r }
  }
  throw "could not find header cell $col='$marker' in the first $maxScan rows"
}

function ToNum($v) {
  if ($null -eq $v -or $v -eq "") { return 0 }
  return [double]$v
}

# ---- data table (A:K) ----
$dataHeaderRow = Find-HeaderRow "A" "Month"
$colToField = @{}
foreach ($col in $grid[$dataHeaderRow].Keys) {
  $header = $grid[$dataHeaderRow][$col]
  if ($header -is [string] -and $FIELD_MAP.ContainsKey($header)) {
    $colToField[$col] = $FIELD_MAP[$header]
  }
}

$rows = New-Object System.Collections.ArrayList
$r = $dataHeaderRow + 1
while ($true) {
  $monthVal = Get-Cell $r "A"
  if ($null -eq $monthVal) {
    # tolerate a single blank row inside the table, stop after two in a row
    if ($null -eq (Get-Cell ($r + 1) "A")) { break }
    $r++
    continue
  }
  $record = [ordered]@{}
  foreach ($field in @("month","plant","unit","consumption","yield","totalWaste","shortfall","cGrade","yarnWaste","ucSmallLots","gainLoss")) {
    $col = ($colToField.GetEnumerator() | Where-Object { $_.Value -eq $field } | Select-Object -First 1).Key
    if (-not $col) { continue }
    $raw = Get-Cell $r $col
    if ($TEXT_FIELDS -contains $field) { $record[$field] = [string]$raw }
    else { $record[$field] = ToNum $raw }
  }
  [void]$rows.Add($record)
  $r++
}

# ---- attribute / target table (M:Q) ----
$attrHeaderRow = Find-HeaderRow "M" "Attribute"
$attrsByKey = @{}
for ($r = $attrHeaderRow + 1; $r -le $attrHeaderRow + 40; $r++) {
  $label = Get-Cell $r "M"
  if ($null -eq $label -or -not ($label -is [string])) { continue }
  if (-not $ATTRIBUTE_MAP.Contains($label)) { continue }   # e.g. "Waste %" and the composite rows
  $meta = $ATTRIBUTE_MAP[$label]
  $attrsByKey[$meta.key] = [ordered]@{
    key         = $meta.key
    label       = $meta.label
    sourceLabel = $label
    formula     = [string](Get-Cell $r "N")
    direction   = [string](Get-Cell $r "Q")
    targets     = [ordered]@{
      "Plant-05" = ToNum (Get-Cell $r "O")
      "Plant-06" = ToNum (Get-Cell $r "P")
    }
  }
}

$missing = $ATTRIBUTE_ORDER | Where-Object { -not $attrsByKey.ContainsKey($_) }
if ($missing) {
  Write-Host ("WARNING: could not find attribute definitions for: " + ($missing -join ", "))
}

# Keep attributes in the fixed spec order regardless of source row order.
$attributes = New-Object System.Collections.ArrayList
foreach ($key in $ATTRIBUTE_ORDER) {
  if ($attrsByKey.ContainsKey($key)) { [void]$attributes.Add($attrsByKey[$key]) }
}

# ---- write assets\data.js ----
$payload = [ordered]@{
  generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
  sourceFile  = "Data/YMR.xlsx"
  rows        = @($rows)
  attributes  = @($attributes)
}

$outDir = Split-Path -Parent $outputFile
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$json = $payload | ConvertTo-Json -Depth 8
$js = "// AUTO-GENERATED by scripts/refresh_data.ps1 - do not edit by hand.`r`n" +
      "// Re-run the script (or double-click Update_Dashboard.bat) after changing Data/YMR.xlsx.`r`n" +
      "const YMR_DATA = " + $json + ";`r`n"
Set-Content -Path $outputFile -Value $js -Encoding utf8

Write-Host ("OK: wrote {0} data rows and {1} attributes to {2}" -f $rows.Count, $attributes.Count, $outputFile)
