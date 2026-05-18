$port = 8000
$url = "http://localhost:$port/"

Write-Host "Starting local server for Whistle Counter..."
Write-Host "Opening $url"
Write-Host "Press Ctrl+C to stop the server"

try {
  if (Get-Command chrome -ErrorAction SilentlyContinue) {
    Start-Process chrome $url
  } else {
    Start-Process $url
  }
} catch {
  Write-Host "Could not auto-open browser. Manually open $url"
}

py -m http.server $port
powershell -ExecutionPolicy Bypass -File .\start-server.ps1

