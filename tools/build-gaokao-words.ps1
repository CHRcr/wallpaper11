[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$Source,

  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$DictionaryCsv,

  [string]$OutFile = ''
)

$ErrorActionPreference = 'Stop'
if (-not $OutFile) { $OutFile = Join-Path $PSScriptRoot '..\app\js\word-data.js' }

function Normalize-Text([string]$Value) {
  if ($null -eq $Value) { return '' }
  return (($Value -replace '[\r\a\n]+', ' ' -replace '\s+', ' ').Trim())
}

function Get-WordDocumentLines([string]$Path) {
  $word = $null
  $document = $null
  try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    $document = $word.Documents.Open($resolvedPath, $false, $true)
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($paragraph in $document.Paragraphs) {
      $line = Normalize-Text $paragraph.Range.Text
      if ($line) { $lines.Add($line) }
    }
    return $lines
  }
  finally {
    if ($document) {
      try { $document.Close($false) } catch { }
      [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)
    }
    if ($word) {
      try { $word.Quit() } catch { }
      [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    }
  }
}

$posTags = 'a|adj|ad|adv|n|num|pron|prep|conj|int|v|vt|vi|aux|modal|link'
$entryPattern = [regex]::new("^(?<head>.+?)\s+(?<tail>(?:$posTags)\.?.*)$", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
function New-Label([int[]]$CodePoints) {
  return -join ($CodePoints | ForEach-Object { [char]$_ })
}

# Keep this script ASCII-only: Windows PowerShell 5.1 reads UTF-8 scripts as ANSI
# when they have no BOM. Generated vocabulary data still uses UTF-8 Chinese text.
$formLabel = @{
  'p' = New-Label @(36807, 21435, 24335)
  'd' = New-Label @(36807, 21435, 20998, 35789)
  'i' = New-Label @(29616, 22312, 20998, 35789)
  '3' = New-Label @(31532, 19977, 20154, 31216, 21333, 25968)
  'r' = New-Label @(27604, 36739, 32423)
  't' = New-Label @(26368, 39640, 32423)
  's' = New-Label @(22797, 25968)
}
$sourceFormLabel = New-Label @(35789, 34920, 26631, 27880)

function Add-Form($Target, [string]$Label, [string]$Value) {
  $clean = Normalize-Text $Value
  if (-not $clean -or $clean -eq '-' -or $clean -eq $Target.word) { return }
  if ($Target.forms | Where-Object { $_.value -ieq $clean }) { return }
  $Target.forms.Add([ordered]@{ label = $Label; value = $clean })
}

function Split-Head([string]$RawHead) {
  $head = Normalize-Text $RawHead
  $notes = New-Object System.Collections.Generic.List[string]
  foreach ($match in [regex]::Matches($head, '\((?<note>[^)]*)\)')) {
    $note = Normalize-Text $match.Groups['note'].Value
    if ($note) { $notes.Add($note) }
  }
  $head = Normalize-Text ($head -replace '\([^)]*\)', '')
  if ($head -match '^(?<short>[^=]+?)\s*=\s*(?<full>.+)$') {
    $notes.Add(('Full form: ' + (Normalize-Text $Matches.full)))
    $head = Normalize-Text $Matches.short
  }
  $head = $head -replace '(?<=[A-Za-z])\d+$', ''
  return [ordered]@{ word = $head; notes = $notes }
}

function Get-SourceForms($Notes) {
  $results = New-Object System.Collections.Generic.List[string]
  foreach ($note in $Notes) {
    if ($note -match 'Full form:') { continue }
    if ($note -match '[\p{IsCJKUnifiedIdeographs}]' -and $note -notmatch '^pl\.\s*') { continue }
    foreach ($piece in ($note -split '[/,;]|\s+or\s+')) {
      $value = Normalize-Text $piece
      $value = $value -replace '^pl\.\s*', ''
      if ($value -match '^[A-Za-z][A-Za-z''-]*$') { $results.Add($value) }
    }
  }
  return $results
}

function Parse-Exchange([string]$Exchange, $Target) {
  foreach ($part in ($Exchange -split '/')) {
    $match = [regex]::Match($part, '^(?<kind>[pd i3rts0-1]):(?<value>.+)$'.Replace(' ', ''))
    if (-not $match.Success) { continue }
    $kind = $match.Groups['kind'].Value
    if ($formLabel.ContainsKey($kind)) {
      Add-Form $Target $formLabel[$kind] $match.Groups['value'].Value
    }
  }
}

$sourceLines = Get-WordDocumentLines $Source
$entries = New-Object System.Collections.Generic.List[object]
$wanted = @{}
$skipped = New-Object System.Collections.Generic.List[string]

foreach ($line in $sourceLines) {
  if ($line -match '^[A-Z]$') { continue }
  $match = $entryPattern.Match($line)
  if (-not $match.Success) {
    $skipped.Add($line)
    continue
  }
  $headInfo = Split-Head $match.Groups['head'].Value
  if (-not $headInfo.word) {
    $skipped.Add($line)
    continue
  }
  $entry = [ordered]@{
    word = $headInfo.word
    pos = (Normalize-Text $match.Groups['tail'].Value)
    forms = New-Object System.Collections.Generic.List[object]
  }
  foreach ($form in (Get-SourceForms $headInfo.notes)) {
    Add-Form $entry $sourceFormLabel $form
  }
  $entries.Add($entry)
  $key = $entry.word.ToLowerInvariant()
  if (-not $wanted.ContainsKey($key)) { $wanted[$key] = New-Object System.Collections.Generic.List[object] }
  $wanted[$key].Add($entry)
}

if ($skipped.Count) {
  throw "Could not parse $($skipped.Count) source entries. First: $($skipped[0])"
}

Add-Type -AssemblyName Microsoft.VisualBasic
$reader = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($DictionaryCsv)
$reader.TextFieldType = [Microsoft.VisualBasic.FileIO.FieldType]::Delimited
$reader.SetDelimiters(',')
$reader.HasFieldsEnclosedInQuotes = $true
$header = $reader.ReadFields()
$column = @{}
for ($i = 0; $i -lt $header.Length; $i++) { $column[$header[$i]] = $i }
foreach ($required in 'word', 'exchange') {
  if (-not $column.ContainsKey($required)) { throw "ECDICT CSV is missing required column: $required" }
}

$dictionaryMatches = 0
while (-not $reader.EndOfData) {
  $fields = $reader.ReadFields()
  if (-not $fields -or $fields.Length -le $column.word) { continue }
  $word = $fields[$column.word]
  if (-not $word) { continue }
  $key = $word.ToLowerInvariant()
  if (-not $wanted.ContainsKey($key)) { continue }
  $exchange = if ($fields.Length -gt $column.exchange) { $fields[$column.exchange] } else { '' }
  foreach ($entry in $wanted[$key]) { Parse-Exchange $exchange $entry }
  $dictionaryMatches++
}
$reader.Close()

$duplicateKeys = @($wanted.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 } | ForEach-Object Key)
$withForms = @($entries | Where-Object { $_.forms.Count -gt 0 }).Count
$unmatched = @($wanted.Keys | Where-Object {
  $has = $false
  foreach ($entry in $wanted[$_]) { if ($entry.forms.Count -gt 0) { $has = $true; break } }
  -not $has
})

$payload = [ordered]@{
  version = '2026.08.28'
  source = 'User-provided Word source + ECDICT (MIT)'
  count = $entries.Count
  words = $entries
}
$json = $payload | ConvertTo-Json -Depth 6 -Compress
$banner = @(
  '/*',
  ' * Generated by tools/build-gaokao-words.ps1. Do not edit by hand.',
  ' * Main list: user-provided Word document.',
  ' * Inflection data: ECDICT, MIT License, https://github.com/skywind3000/ECDICT.',
  ' */',
  "window.W11_WORD_DATA = Object.freeze($json);",
  'window.W11_WORDS = window.W11_WORD_DATA.words;'
) -join "`n"

$outParent = Split-Path -Parent $OutFile
if (-not (Test-Path -LiteralPath $outParent)) { New-Item -ItemType Directory -Path $outParent | Out-Null }
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $outParent).Path + '\' + (Split-Path -Leaf $OutFile), $banner + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host "[words] wrote $($entries.Count) source entries to $OutFile"
Write-Host "[words] ECDICT matches: $dictionaryMatches; entries with forms: $withForms; no forms: $($entries.Count - $withForms)"
if ($duplicateKeys.Count) { Write-Warning "Duplicate headwords preserved: $($duplicateKeys -join ', ')" }
if ($unmatched.Count) { Write-Warning "No inflection data for $($unmatched.Count) entries; this is normal for many function words and proper nouns." }
