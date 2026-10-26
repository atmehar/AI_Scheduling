# PowerShell script to restore PostgreSQL backup for AI_Scheduling_Meetings
param (
    [string]$DumpFile
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$backupDir = Join-Path $backendDir "backups"

if (-not $DumpFile) {
    # Pick the latest backup file in backups/
    $latest = Get-ChildItem -Path $backupDir -Filter "*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        $DumpFile = $latest.FullName
    } else {
        Write-Error "No .dump file found in $backupDir. Please provide -DumpFile path."
        exit 1
    }
}

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

Write-Host "Restoring $DumpFile into $dbName..." -ForegroundColor Cyan

& pg_restore -h $dbHost -p $dbPort -U $dbUser -d $dbName --clean --if-exists $DumpFile

if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1) {
    Write-Host "Database restore completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Database restore failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
