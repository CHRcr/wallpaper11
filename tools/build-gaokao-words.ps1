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
if (-not $OutFile) { $OutFile = Join-Path $PSScriptRoot '..\data\words\base-word-data.js' }

function Normalize-Text([string]$Value) {
  if ($null -eq $Value) { return '' }
  $wideOpen = [string][char]0xFF08
  $wideClose = [string][char]0xFF09
  $Value = $Value.Replace($wideOpen, '(').Replace($wideClose, ')')
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

$posTags = 'a|adj|ad|adv|n|num|pron|prep|conj|int|v|vt|vi|aux|modal|link|art'
$entryPattern = [regex]::new("^(?<head>.+?)\s+(?<tail>(?:$posTags)\.?.*)$", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$punctuatedHeadPattern = [regex]::new('^(?<head>[A-Za-z][A-Za-z0-9/ ]*)\.\s*(?<meaning>[^\x00-\x7F].*)$')
$tightEntryPattern = [regex]::new("^(?<head>.+)(?<tail>(?:$posTags)\..*)$", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$equalsFallbackPattern = [regex]::new('^(?<head>[A-Za-z][A-Za-z0-9]*)\s*=\s*(?<full>[A-Za-z][A-Za-z ]*?)(?<meaning>[^\x00-\x7F].+)$')
$genericFallbackPattern = [regex]::new('^(?<head>[A-Za-z][A-Za-z0-9/ ]*)(?<meaning>.+)$')
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
  $existing = @($Target.forms | Where-Object { $_.value -ieq $clean }) | Select-Object -First 1
  if ($existing) {
    if ($Label -ne $sourceFormLabel -and $existing.label -eq $sourceFormLabel) {
      $existing.label = $Label
    }
    return
  }
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

function Supports-Form($Target, [string]$Kind) {
  $pos = [string]$Target.pos
  switch ($Kind) {
    { $_ -in 'p', 'd', 'i', '3' } {
      return $pos -match '(?i)(?:^|\s|&)(?:v|vt|vi|aux|modal|link)\.?(?=\s|&|/|[^\x00-\x7F]|$)'
    }
    { $_ -in 'r', 't' } {
      return $pos -match '(?i)(?:^|\s|&)adj\.?(?=\s|&|/|[^\x00-\x7F]|$)|(?:^|\s|&)a\.(?=\s|&|/|[^\x00-\x7F]|$)'
    }
    's' {
      return $pos -match '(?i)(?:^|\s|&)n\.?(?=\s|&|/|[^\x00-\x7F]|$)'
    }
    default { return $false }
  }
}

function Parse-Exchange([string]$Exchange, $Target) {
  foreach ($part in ($Exchange -split '/')) {
    $match = [regex]::Match($part, '^(?<kind>[pd i3rts0-1]):(?<value>.+)$'.Replace(' ', ''))
    if (-not $match.Success) { continue }
    $kind = $match.Groups['kind'].Value
    if ($formLabel.ContainsKey($kind) -and (Supports-Form $Target $kind)) {
      Add-Form $Target $formLabel[$kind] $match.Groups['value'].Value
    }
  }
}

function Get-DictionaryWordSet([string]$CsvPath) {
  $words = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  $reader = $null
  try {
    $reader = New-Object Microsoft.VisualBasic.FileIO.TextFieldParser($CsvPath)
    $reader.TextFieldType = [Microsoft.VisualBasic.FileIO.FieldType]::Delimited
    $reader.SetDelimiters(',')
    $reader.HasFieldsEnclosedInQuotes = $true
    $header = $reader.ReadFields()
    $wordColumn = [array]::IndexOf($header, 'word')
    if ($wordColumn -lt 0) { throw "ECDICT CSV is missing required column: word" }
    while (-not $reader.EndOfData) {
      try { $fields = $reader.ReadFields() }
      catch [Microsoft.VisualBasic.FileIO.MalformedLineException] { continue }
      if ($fields -and $fields.Length -gt $wordColumn -and $fields[$wordColumn]) {
        [void]$words.Add($fields[$wordColumn])
      }
    }
  }
  finally {
    if ($reader) { $reader.Close() }
  }
  return $words
}

function Test-DictionaryHead([string]$RawHead, $DictionaryWords) {
  $head = Split-Head $RawHead
  return [bool]($head.word -and $DictionaryWords.Contains($head.word))
}

$sourceLines = Get-WordDocumentLines $Source
Add-Type -AssemblyName Microsoft.VisualBasic
$dictionaryWords = Get-DictionaryWordSet $DictionaryCsv
$entries = New-Object System.Collections.Generic.List[object]
$wantedExact = [System.Collections.Hashtable]::new([System.StringComparer]::Ordinal)
$wantedFolded = [System.Collections.Hashtable]::new([System.StringComparer]::OrdinalIgnoreCase)
$spellingsByFolded = [System.Collections.Hashtable]::new([System.StringComparer]::OrdinalIgnoreCase)
$skipped = New-Object System.Collections.Generic.List[string]

foreach ($line in $sourceLines) {
  if ($line -match '^[A-Z]$') { continue }
  if ($line -notmatch '[A-Za-z]') { continue }
  $match = $entryPattern.Match($line)
  $headRaw = ''
  $tail = ''
  if ($match.Success) {
    $headRaw = $match.Groups['head'].Value
    $tail = $match.Groups['tail'].Value
  }
  if (-not $match.Success) {
    $punctuatedMatch = $punctuatedHeadPattern.Match($line)
    $tightMatch = $tightEntryPattern.Match($line)
    $punctuatedKnown = $punctuatedMatch.Success -and (Test-DictionaryHead $punctuatedMatch.Groups['head'].Value $dictionaryWords)
    $tightKnown = $tightMatch.Success -and (Test-DictionaryHead $tightMatch.Groups['head'].Value $dictionaryWords)
    if ($punctuatedMatch.Success -and ($punctuatedKnown -or -not $tightKnown)) {
      $match = $punctuatedMatch
      $headRaw = $match.Groups['head'].Value
      $tail = 'n. ' + $match.Groups['meaning'].Value
    }
    elseif ($tightMatch.Success) {
      $match = $tightMatch
      $headRaw = $match.Groups['head'].Value
      $tail = $match.Groups['tail'].Value
    }
  }
  if (-not $match.Success) {
    $match = $equalsFallbackPattern.Match($line)
    if ($match.Success) {
      $headRaw = $match.Groups['head'].Value + ' = ' + $match.Groups['full'].Value
      $tail = 'n. ' + $match.Groups['meaning'].Value
    }
  }
  if (-not $match.Success) {
    $match = $genericFallbackPattern.Match($line)
    if ($match.Success) {
      $headRaw = $match.Groups['head'].Value
      $tail = 'n. ' + $match.Groups['meaning'].Value.TrimStart([char[]]@('.', ' '))
    }
  }
  if (-not $match.Success) {
    $skipped.Add($line)
    continue
  }
  $headInfo = Split-Head $headRaw
  if (-not $headInfo.word) {
    $skipped.Add($line)
    continue
  }
  $entry = [ordered]@{
    word = $headInfo.word
    pos = (Normalize-Text $tail)
    forms = New-Object System.Collections.Generic.List[object]
  }
  foreach ($form in (Get-SourceForms $headInfo.notes)) {
    Add-Form $entry $sourceFormLabel $form
  }
  $entries.Add($entry)
  $exactKey = [string]$entry.word
  if (-not $wantedExact.ContainsKey($exactKey)) {
    $wantedExact[$exactKey] = New-Object System.Collections.Generic.List[object]
  }
  $wantedExact[$exactKey].Add($entry)

  $foldedKey = $exactKey.ToLowerInvariant()
  if (-not $wantedFolded.ContainsKey($foldedKey)) {
    $wantedFolded[$foldedKey] = New-Object System.Collections.Generic.List[object]
    $spellingsByFolded[$foldedKey] = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
  }
  $wantedFolded[$foldedKey].Add($entry)
  [void]$spellingsByFolded[$foldedKey].Add($exactKey)
}

if ($skipped.Count) {
  throw "Could not parse $($skipped.Count) source entries. First: $($skipped[0])"
}

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

$dictionaryExact = [System.Collections.Hashtable]::new([System.StringComparer]::Ordinal)
$dictionaryFolded = [System.Collections.Hashtable]::new([System.StringComparer]::OrdinalIgnoreCase)
$malformedRows = 0
while (-not $reader.EndOfData) {
  try {
    $fields = $reader.ReadFields()
  }
  catch [Microsoft.VisualBasic.FileIO.MalformedLineException] {
    $malformedRows++
    continue
  }
  if (-not $fields -or $fields.Length -le $column.word) { continue }
  $word = $fields[$column.word]
  if (-not $word) { continue }
  $foldedKey = $word.ToLowerInvariant()
  if (-not $wantedFolded.ContainsKey($foldedKey)) { continue }
  $exchange = if ($fields.Length -gt $column.exchange) { $fields[$column.exchange] } else { '' }
  if (-not $dictionaryExact.ContainsKey($word)) {
    $dictionaryExact[$word] = New-Object System.Collections.Generic.List[string]
  }
  $dictionaryExact[$word].Add($exchange)
  if (-not $dictionaryFolded.ContainsKey($foldedKey)) {
    $dictionaryFolded[$foldedKey] = New-Object System.Collections.Generic.List[string]
  }
  $dictionaryFolded[$foldedKey].Add($exchange)
}
$reader.Close()

$matchedWordKeys = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
foreach ($pair in $wantedExact.GetEnumerator()) {
  $sourceWord = [string]$pair.Key
  $foldedKey = $sourceWord.ToLowerInvariant()
  $exchanges = $null
  if ($dictionaryExact.ContainsKey($sourceWord)) {
    $exchanges = $dictionaryExact[$sourceWord]
  } elseif ($spellingsByFolded[$foldedKey].Count -eq 1 -and $dictionaryFolded.ContainsKey($foldedKey)) {
    # A case-insensitive fallback is safe only when the source list has one
    # exact spelling for this folded key. AD/ad and Miss/miss never cross.
    $exchanges = $dictionaryFolded[$foldedKey]
  }
  if ($null -eq $exchanges) { continue }
  foreach ($exchange in $exchanges) {
    foreach ($entry in $pair.Value) { Parse-Exchange $exchange $entry }
  }
  [void]$matchedWordKeys.Add($sourceWord)
}

$duplicateKeys = @($wantedExact.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 } | ForEach-Object Key)
$withForms = @($entries | Where-Object { $_.forms.Count -gt 0 }).Count

$payload = [ordered]@{
  version = '2026.08.28'
  source = 'User-provided Word source + ECDICT (MIT)'
  count = $entries.Count
  words = $entries
}
$json = $payload | ConvertTo-Json -Depth 6 -Compress
$banner = @(
  '/*',
  ' * Base source generated by tools/build-gaokao-words.ps1. Do not edit by hand.',
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
Write-Host "[words] ECDICT matches: $($matchedWordKeys.Count); entries with forms: $withForms; no forms: $($entries.Count - $withForms)"
if ($malformedRows) { Write-Warning "Skipped $malformedRows malformed ECDICT CSV row(s) that were unrelated to the requested vocabulary." }
if ($duplicateKeys.Count) { Write-Warning "Duplicate headwords preserved: $($duplicateKeys -join ', ')" }
if (($entries.Count - $withForms) -gt 0) { Write-Warning "No inflection data for $($entries.Count - $withForms) entries; this is normal for many function words and proper nouns." }
