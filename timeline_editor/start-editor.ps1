param([int]$Port = 8878)

$editorRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $editorRoot
$serverPath = Join-Path $editorRoot "tools\serve_editor.py"

# Reuse an editor that is already healthy on the preferred port instead of
# leaving several stale local servers running on successively higher ports.
$preferredUrl = "http://127.0.0.1:$Port/timeline_editor/"
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  try {
    $response = Invoke-WebRequest -Uri $preferredUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200 -and $response.Content -match "Timeline Desk") {
      Start-Process $preferredUrl
      Write-Output "Timeline Desk already running at $preferredUrl"
      exit 0
    }
  } catch {
    # The port belongs to something else or the old process is unhealthy.
  }
}

while (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  $Port++
}
Start-Process -FilePath python -ArgumentList @($serverPath, "--port", "$Port", "--directory", $projectRoot) -WindowStyle Hidden
$started = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 250
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    $started = $true
    break
  }
}
if (-not $started) {
  throw "Timeline Desk server did not start on port $Port."
}
Start-Process "http://127.0.0.1:$Port/timeline_editor/"
Write-Output "Timeline Desk opened at http://127.0.0.1:$Port/timeline_editor/"
