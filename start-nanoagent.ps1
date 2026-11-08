$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-FreePort([int]$port) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
  try { $listener.Start(); return $true }
  catch { return $false }
  finally { $listener.Stop() }
}

$port = 4173
while ($port -lt 4190 -and -not (Test-FreePort $port)) { $port++ }
if ($port -ge 4190) {
  Write-Host 'No free NanoAgent port was found between 4173 and 4189.' -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}

$env:NANOAGENT_PORT = [string]$port
$env:NANOAGENT_OPEN_BROWSER = '1'
$serverScript = Join-Path $appRoot 'server.ps1'
Write-Host "Starting NanoAgent at http://127.0.0.1:$port" -ForegroundColor Green
Write-Host 'Keep this window open while you use the app. Press Ctrl+C to stop it.'
& $serverScript
