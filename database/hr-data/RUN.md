Running migrations and seed for hr-data

Prerequisites
- PostgreSQL client (`psql`) must be installed and available in PATH.
- A PostgreSQL server reachable at the host/port specified.

Quick run (PowerShell)

```powershell
# from repository root
Set-Location hr-data
# prompts for password if you provide -Password, otherwise use env var PGPASSWORD
.\run_migrations.ps1 -Host localhost -Port 5432 -DbName dayflow_hrms -User postgres -Password "your_password"
```

Notes
- The script will run all `migrations/*.sql` in numeric order and then `seed/seed_data.sql`.
- If `psql` is not installed, install PostgreSQL or the client tools for your platform.
- If you prefer to run the original one-liner from the README, use:

```bash
for f in migrations/*.sql; do psql -d dayflow_hrms -f "$f"; done
psql -d dayflow_hrms -f seed/seed_data.sql
```
