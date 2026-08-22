param(
    [string]$Host = "localhost",
    [int]$Port = 5432,
    [string]$DbName = "dayflow_hrms",
    [string]$User = "postgres",
    [string]$Password = ""
)

function Ensure-Command($cmd){
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $found) { return $false }
    return $true
}

if (-not (Ensure-Command "psql")){
    Write-Error "psql not found in PATH. Install PostgreSQL client tools and retry."
    exit 2
}

if ($Password -ne ""){
    $env:PGPASSWORD = $Password
}

$psqlBase = "psql -h $Host -p $Port -U $User -d $DbName --set ON_ERROR_STOP=on"

Write-Host "Running migrations against database '$DbName' on $Host:$Port as $User"

$migrationFiles = Get-ChildItem -Path (Join-Path $PSScriptRoot 'migrations') -Filter '*.sql' | Sort-Object Name
if ($migrationFiles.Count -eq 0){
    Write-Warning "No migration files found in migrations/."
}

foreach ($f in $migrationFiles){
    Write-Host "Applying $($f.Name)..."
    & psql -h $Host -p $Port -U $User -d $DbName -f $f.FullName
    if ($LASTEXITCODE -ne 0){
        Write-Error "Migration $($f.Name) failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}

$seedFile = Join-Path $PSScriptRoot 'seed\seed_data.sql'
if (Test-Path $seedFile){
    Write-Host "Applying seed data..."
    & psql -h $Host -p $Port -U $User -d $DbName -f $seedFile
    if ($LASTEXITCODE -ne 0){
        Write-Error "Seeding failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} else {
    Write-Warning "Seed file not found at seed/seed_data.sql"
}

Write-Host "All done."
exit 0
