param(
    [switch]$InstallDocker,
    [switch]$InstallPostgres,
    [switch]$InstallAll
)

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")){
    Write-Error "Please run this script from an elevated PowerShell (Run as Administrator)."
    exit 1
}

if ($InstallAll){ $InstallDocker = $true; $InstallPostgres = $true }

function Has-Command([string]$cmd){
    return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

function Try-WingetInstall([string]$id){
    Write-Host "Installing $id via winget..."
    winget install --id $id -e --accept-package-agreements --accept-source-agreements
    return $LASTEXITCODE -eq 0
}

function Try-ChocoInstall([string]$pkg){
    Write-Host "Installing $pkg via choco..."
    choco install $pkg -y
    return $LASTEXITCODE -eq 0
}

if (-not (Has-Command "winget") -and -not (Has-Command "choco")){
    Write-Warning "Neither winget nor chocolatey (choco) was found. The script will attempt winget first where available."
}

if ($InstallDocker){
    if (Has-Command "docker"){
        Write-Host "Docker already installed. Skipping."
    } else {
        if (Has-Command "winget"){
            if (-not (Try-WingetInstall "Docker.DockerDesktop")){
                Write-Warning "winget failed to install Docker.DockerDesktop."
            }
        } elseif (Has-Command "choco"){
            if (-not (Try-ChocoInstall "docker-desktop")){
                Write-Warning "choco failed to install docker-desktop."
            }
        } else {
            Write-Warning "No package manager found. Please install Docker Desktop manually: https://www.docker.com/get-started"
        }
        Write-Host "After Docker Desktop install you may need to enable WSL2 and reboot."
    }
}

if ($InstallPostgres){
    if (Has-Command "psql"){
        Write-Host "psql (Postgres client) already installed. Skipping."
    } else {
        if (Has-Command "winget"){
            if (-not (Try-WingetInstall "PostgreSQL.PostgreSQL")){
                Write-Warning "winget failed to install PostgreSQL.PostgreSQL."
            }
        } elseif (Has-Command "choco"){
            if (-not (Try-ChocoInstall "postgresql")){
                Write-Warning "choco failed to install postgresql."
            }
        } else {
            Write-Warning "No package manager found. Please install the PostgreSQL client or server manually: https://www.postgresql.org/download/windows/"
        }
    }
}

Write-Host "Installation attempts finished. Verify the installed commands:"
if (Has-Command "docker"){ docker --version } else { Write-Host "docker: NOT FOUND" }
if (Has-Command "psql"){ psql --version } else { Write-Host "psql: NOT FOUND" }

Write-Host "If Docker was installed, please log out/login or reboot if requested by the installer."
exit 0
