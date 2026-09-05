# TZZ server infrastructure state — 2026-09-05

This document records the verified Rocky Linux deployment state without copying credentials, database contents, dumps, or uploaded files into Git.

## Current architecture

```text
Browser
  -> VPS HTTPS gateway (future production route)
  -> Tailscale
  -> Rocky Linux 8.9
       |- Next.js origin: 127.0.0.1:3000 (not deployed yet)
       |- PostgreSQL 17.11: 127.0.0.1:5432
       `- local file storage: /home/wyz/tzz-data
```

The final download contract remains:

```text
Browser -> authenticated File API -> X-Accel-Redirect -> Nginx internal alias -> blob
```

Nginx and X-Accel are not installed/configured for TZZ yet. Development may use a Node `createReadStream` fallback, but that is not the production delivery path.

## Storage

TZZ storage is constrained to `/home/wyz`. `/home` is a local XFS filesystem on `/dev/sdc`, mounted read/write. At verification time it had approximately 6.8 TB free and was 94% used.

```text
/home/wyz/tzz-data            wyz:group 2750
|- blobs                       wyz:group 2770
|- tmp                         wyz:group 2770
|- quarantine                  wyz:group 2770
|- exports                     wyz:group 2770
`- thumbnails                  wyz:group 2770

/home/wyz/tzz-backups         wyz:group 0700
`- postgres                    wyz:group 0700
```

All five application directories passed create/read/delete tests and inherit group `group` through setgid. Test files were removed. `/home` is not mounted with `noexec`, so the application must never execute, spawn, import, or require uploaded content.

The database must store only relative `storageKey` values such as `ab/cd/UUID.ext`. Absolute paths, empty path components, `.` and `..` are invalid. The server combines a validated key with the configured storage root.

The future root-admin layout may expose a stable application path through a safe bind mount from `/home/wyz/tzz-data` to `/srv/tzz-data` with effective `rw,nodev,nosuid,noexec` options. Physical storage must remain under `/home/wyz`. No `/srv` or `/etc/fstab` changes have been made.

## PostgreSQL

- Binary: `/home/wyz/miniconda3/envs/tzz_db/bin/postgres`
- PGDATA: `/home/wyz/tzz/postgres/data`
- Database: `tzz_workspace`
- Application role: `tzz_app` (non-superuser)
- Listener: `127.0.0.1:5432`
- HBA: zero `trust` rules and zero parse errors
- Application authentication: SCRAM-SHA-256, verified with `SELECT 1`
- Local administration: Linux user `wyz` maps to PostgreSQL role `wyz` through peer authentication

PostgreSQL is now managed by the enabled user service `tzz-postgresql.service`. `Linger=no`, so reboot-time startup before the first `wyz` login is not guaranteed. An administrator must either enable linger for `wyz` or migrate the verified unit to a system service. Never run both managers at the same time.

## Secrets

The live production environment file is outside the repository:

```text
/home/wyz/.config/tzz/tzz-website.env  mode 0600
```

It contains the existing `DATABASE_URL` plus the production storage variables. Its value must never be committed. `.env.local` remains ignored by Git.

## Local PostgreSQL backups

- Script: `/home/wyz/bin/tzz-postgres-backup`
- Destination: `/home/wyz/tzz-backups/postgres`
- Format: PostgreSQL custom dump
- Validation: every dump is checked with `pg_restore --list` before its `.partial` suffix is removed
- Timer: enabled user timer, daily at 02:30 with up to 15 minutes randomized delay
- Retention: none yet; the first version never deletes backups

The dump and file storage are on the same `/dev/sdc` storage system. Local dumps are fast-recovery copies, not disk-failure disaster recovery. An off-host backup and restore test remain required.

## Tailscale and legacy data

- Rocky Tailscale IP: `100.121.222.86`
- VPS Tailscale IP: `100.126.209.95`
- Observed path: DERP `cn-sh-temp`, approximately 22–23 ms; direct path not established
- `iperf3` exists locally, but throughput testing is pending trusted SSH host-key enrollment for the VPS
- Legacy path `/home/wyz/tzz/files` exists and was empty at verification time; it was not modified

## Production blockers

The server is ready for File/RBAC backend development using the `/home/wyz` contract. Production file delivery remains blocked on the administrator tasks in `ops/ADMIN_TODO.md`: service account/group, optional `/srv` safe bind mount, Nginx internal alias, read-only Nginx ACL, source-restricted firewall rule, reboot-safe service management, and remote backup.
