# PowerShell script to create PostgreSQL backup for AI_Scheduling_Meetings
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$backupDir = Join-Path $backendDir "backups"

if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFile = Join-Path $backupDir "ai_scheduling_$timestamp.dump"

$envFile = Join-Path $backendDir ".env"
$dbName = "AI_Scheduling_Meetings"
$dbUser = "postgres"
$dbHost = "localhost"
$dbPort = "5432"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*DB_NAME\s*=\s*(.*)$") { $dbName = $matches[1].Trim() }
        if ($_ -match "^\s*DB_USER\s*=\s*(.*)$") { $dbUser = $matches[1].Trim() }
        if ($_ -match "^\s*DB_PASSWORD\s*=\s*(.*)$") { $env:PGPASSWORD = $matches[1].Trim() }
        if ($_ -match "^\s*DB_HOST\s*=\s*(.*)$") { $dbHost = $matches[1].Trim() }
        if ($_ -match "^\s*DB_PORT\s*=\s*(.*)$") { $dbPort = $matches[1].Trim() }
    }
}

Write-Host "Creating backup of $dbName to $dumpFile..." -ForegroundColor Cyan

& pg_dump -h $dbHost -p $dbPort -U $dbUser -F c -b -f $dumpFile $dbName

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $dumpFile).Length / 1KB
    Write-Host "Backup completed successfully! Size: $([math]::Round($size, 2)) KB" -ForegroundColor Green
} else {
    Write-Host "Backup failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
