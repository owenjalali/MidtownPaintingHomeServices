$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$testEnvPath = Join-Path $repoRoot "test.env"
$baseEnvPath = Join-Path $repoRoot ".env"
$logsDir = Join-Path $repoRoot "logs"
$runtimeEnvPath = Join-Path $logsDir "field-test.runtime.env"

if (-not (Test-Path $testEnvPath)) {
  throw "Missing test env file at $testEnvPath"
}

New-Item -ItemType Directory -Force $logsDir | Out-Null

function Read-EnvMap([string]$path) {
  $map = @{}

  if (-not (Test-Path $path)) {
    return $map
  }

  foreach ($line in Get-Content $path) {
    if (-not $line) {
      continue
    }

    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or $trimmed -notmatch "=") {
      continue
    }

    $parts = $trimmed -split "=", 2
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $map[$name] = $value
  }

  return $map
}

function Is-PlaceholderValue([string]$value) {
  if (-not $value) {
    return $true
  }

  $normalized = $value.Trim().ToLowerInvariant()
  return $normalized.Contains("replace_me") -or
    $normalized.Contains("replace-with") -or
    $normalized.Contains("xxxxxxxx") -or
    $normalized -eq "tr_dev_replace_me"
}

$testEnv = Read-EnvMap $testEnvPath
$baseEnv = Read-EnvMap $baseEnvPath

foreach ($key in @("TRIGGER_SECRET_KEY", "TRIGGER_PROJECT_REF")) {
  if (Is-PlaceholderValue $testEnv[$key]) {
    if ($baseEnv.ContainsKey($key) -and -not (Is-PlaceholderValue $baseEnv[$key])) {
      $testEnv[$key] = $baseEnv[$key]
    }
  }
}

$runtimeLines = @()
foreach ($entry in $testEnv.GetEnumerator() | Sort-Object Name) {
  $runtimeLines += "$($entry.Name)=$($entry.Value)"
}
Set-Content -Path $runtimeEnvPath -Value $runtimeLines

$frontendBaseUrl = if ($testEnv.ContainsKey("CORS_ORIGIN") -and $testEnv["CORS_ORIGIN"]) {
  $testEnv["CORS_ORIGIN"].Trim().TrimEnd("/")
} else {
  "http://localhost:5173"
}
$apiBaseUrl = if ($testEnv.ContainsKey("PORT") -and $testEnv["PORT"]) {
  "http://localhost:$($testEnv["PORT"].Trim())"
} else {
  "http://localhost:8787"
}
$fieldAccessKey = if ($testEnv.ContainsKey("FIELD_TEST_INTAKE_SECRET") -and $testEnv["FIELD_TEST_INTAKE_SECRET"]) {
  $testEnv["FIELD_TEST_INTAKE_SECRET"].Trim()
} elseif ($testEnv.ContainsKey("FIELD_INTAKE_SECRET") -and $testEnv["FIELD_INTAKE_SECRET"]) {
  $testEnv["FIELD_INTAKE_SECRET"].Trim()
} else {
  ""
}
$previewOutboundOverrideEnabled = if ($testEnv.ContainsKey("FIELD_TEST_FORCE_OUTBOUND_ENABLED")) {
  $testEnv["FIELD_TEST_FORCE_OUTBOUND_ENABLED"].Trim().ToLowerInvariant() -eq "true"
} else {
  $false
}
$previewOutboundPhone = if ($testEnv.ContainsKey("FIELD_TEST_FORCE_OUTBOUND_PHONE")) {
  $testEnv["FIELD_TEST_FORCE_OUTBOUND_PHONE"].Trim()
} else {
  ""
}
$previewOutboundEmail = if ($testEnv.ContainsKey("FIELD_TEST_FORCE_OUTBOUND_EMAIL")) {
  $testEnv["FIELD_TEST_FORCE_OUTBOUND_EMAIL"].Trim()
} else {
  ""
}

Get-NetTCPConnection -LocalPort 78,8787,5173 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
  }

$frontendLog = Join-Path $logsDir "field-test-frontend.log"
$frontendErrLog = Join-Path $logsDir "field-test-frontend.err.log"
$serverLog = Join-Path $logsDir "field-test-server.log"
$serverErrLog = Join-Path $logsDir "field-test-server.err.log"
$triggerLog = Join-Path $logsDir "field-test-trigger.log"
$triggerErrLog = Join-Path $logsDir "field-test-trigger.err.log"

$frontend = Start-Process powershell `
  -WorkingDirectory $repoRoot `
  -ArgumentList "-NoLogo", "-NoProfile", "-Command", "npm run dev" `
  -RedirectStandardOutput $frontendLog `
  -RedirectStandardError $frontendErrLog `
  -PassThru

$server = Start-Process powershell `
  -WorkingDirectory $repoRoot `
  -ArgumentList "-NoLogo", "-NoProfile", "-Command", "node server/bootstrap.mjs `"$runtimeEnvPath`"" `
  -RedirectStandardOutput $serverLog `
  -RedirectStandardError $serverErrLog `
  -PassThru

$trigger = Start-Process powershell `
  -WorkingDirectory $repoRoot `
  -ArgumentList "-NoLogo", "-NoProfile", "-Command", "trigger dev --env-file `"$runtimeEnvPath`"" `
  -RedirectStandardOutput $triggerLog `
  -RedirectStandardError $triggerErrLog `
  -PassThru

Write-Output "Started field test processes."
Write-Output "Frontend PID: $($frontend.Id)"
Write-Output "Server PID: $($server.Id)"
Write-Output "Trigger PID: $($trigger.Id)"
Write-Output "Test env: $testEnvPath"
Write-Output "Runtime env: $runtimeEnvPath"
Write-Output "Frontend log: $frontendLog"
Write-Output "Server log: $serverLog"
Write-Output "Trigger log: $triggerLog"
Write-Output "Health URL: $apiBaseUrl/api/health"
if ($fieldAccessKey) {
  Write-Output "Rep intake URL: $frontendBaseUrl/field/$fieldAccessKey"
} else {
  Write-Warning "FIELD_TEST_INTAKE_SECRET is not set, so no rep intake URL could be printed."
}
Write-Output "Smoke test command: npm run test:smoke:field"
if ($previewOutboundOverrideEnabled) {
  Write-Output "Preview outbound override: enabled"
  if ($previewOutboundPhone) {
    Write-Output "Forced SMS target: $previewOutboundPhone"
  }
  if ($previewOutboundEmail) {
    Write-Output "Forced email target: $previewOutboundEmail"
  }
} else {
  Write-Warning "Preview outbound override is disabled. Field texts/emails will use the homeowner and owner recipients from this test flow."
}
