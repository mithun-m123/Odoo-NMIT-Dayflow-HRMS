Installing required applications for `hr-data`

This repository can apply migrations and seed data to a PostgreSQL database. Two convenient ways to run it are:

- Docker Desktop (recommended): runs a Postgres container and applies migrations.
- PostgreSQL client (`psql`) installed locally: run migrations directly against an existing server.

Automated helper

There is a PowerShell helper `install_requirements.ps1` that attempts to install Docker Desktop and/or PostgreSQL using `winget` or `choco`.

Usage (Run PowerShell as Administrator):

```powershell
Set-Location hr-data
# Install both Docker Desktop and PostgreSQL client
.\install_requirements.ps1 -InstallAll
# Or install only Docker
.\install_requirements.ps1 -InstallDocker
# Or only PostgreSQL client
.\install_requirements.ps1 -InstallPostgres
```

Notes
- Docker Desktop installation may require enabling WSL2 and a system reboot.
- If you prefer manual installs, use the official pages:
  - Docker Desktop: https://www.docker.com/get-started
  - PostgreSQL: https://www.postgresql.org/download/

After installing Docker, run the migrations with:

```powershell
Set-Location hr-data
.\run_with_docker.ps1 -PostgresPassword "example"
```

Or, if you installed `psql` and have a Postgres server running locally, run:

```powershell
Set-Location hr-data
.\run_migrations.ps1 -Host localhost -Port 5432 -DbName dayflow_hrms -User postgres -Password "your_password"
```
