# Carapace STRICT LITERAL Safe Launch Script
# Resolves persistent 'Error 1411' with symbol-free PID hunt

$ErrorActionPreference = 'SilentlyContinue'
Write-Host '--- Initializing STRICT LITERAL Safe Launch ---'

# 1. Nuclear PID Hunt
Write-Host 'Searching for hidden window locks...'
$targets = @('carapace', 'WebView2', 'tauri', 'vite', 'node')
foreach ($t in $targets) {
    # Match by process name or command line
    $pids = Get-WmiObject Win32_Process | Where-Object { $_.Name -match $t -or $_.CommandLine -match $t } | Select-Object -ExpandProperty ProcessId
    if ($pids) {
        foreach ($pid in $pids) {
            Write-Host "   Targeted PID $pid for $t. Terminating..."
            taskkill /f /t /pid $pid
            Stop-Process -Id $pid -Force
        }
    }
}

# 2. Relentless Kill Loop for Port 1425
function KillPort($p) {
    Write-Host "Checking Port $p status..." 
    for ($i = 1; $i -le 10; $i++) {
        $netstat = netstat -ano | Select-String 'LISTENING' | Select-String ":$p"
        if ($netstat) {
            foreach ($line in $netstat) {
                $parts = $line.ToString().Split(' ') | Where-Object { $_ -ne '' }
                $pid = $parts[-1]
                if ($pid -match '^\d+$' -and $pid -gt 0) {
                   Write-Host "   Found PID $pid on port $p. Killing..."
                   taskkill /f /t /pid $pid
                   Stop-Process -Id $pid -Force
                }
            }
            Start-Sleep -Seconds 1
        } else {
            Write-Host "Port $p is confirmed empty."
            return $true
        }
    }
    return $false
}

# 3. Verify Port 1425
if (-not (KillPort 1425)) {
    Write-Host 'WARNING: Port 1425 could not be cleared. System may require manual reboot.'
}

Write-Host 'System Flushed. Rebuilding and Launching...'

# 4. Launch the terminal
npm run tauri dev
