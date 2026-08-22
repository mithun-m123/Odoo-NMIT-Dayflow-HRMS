param(
    [string]$PostgresPassword = "example"
)

function Ensure-Command($cmd){
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $found) { return $false }
    return $true
}

if (-not (Ensure-Command "docker")){
    Write-Error "docker not found in PATH. Install Docker Desktop and retry."
    exit 2
}

Push-Location $PSScriptRoot

Write-Host "Starting Postgres container (background)..."
$env:POSTGRES_PASSWORD = $PostgresPassword

# Start only the db service
docker compose up -d db
if ($LASTEXITCODE -ne 0){
    Write-Error "Failed to start db service with docker compose"
    Pop-Location
    exit $LASTEXITCODE
}

Write-Host "Waiting for the database to accept connections..."
$maxWait = 120
$elapsed = 0
while ($true){
    $r = docker exec dayflow-db pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0){ break }
    Start-Sleep -Seconds 1
    $elapsed += 1
    if ($elapsed -ge $maxWait){
        Write-Error "Timed out waiting for Postgres to start."
        docker logs dayflow-db | Select-Object -Last 200
        docker compose down
        Pop-Location
        exit 3
    }
}

Write-Host "Running migrations and seed via migrate service..."
docker compose run --rm migrate
$exit = $LASTEXITCODE
if ($exit -ne 0){
    Write-Error "Migration service failed with exit code $exit"
    docker compose logs migrate --no-color
    Pop-Location
    exit $exit
}

Write-Host "Migrations applied successfully. Database available at localhost:5432"
Pop-Location
exit 0
