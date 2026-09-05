# Operations artifacts

These files record the verified user-level infrastructure deployed on the Rocky Linux server. They contain no credentials.

```text
ops/
|- scripts/tzz-postgres-backup
|- systemd/user/tzz-postgresql.service
|- systemd/user/tzz-postgres-backup.service
|- systemd/user/tzz-postgres-backup.timer
|- systemd/user/tzz-website.service
`- ADMIN_TODO.md
```

The checked-in units mirror the current host-specific `/home/wyz` paths. Install them only for the `wyz` user on the documented server, or adapt and re-verify every absolute path first.

Verification commands:

```bash
systemd-analyze --user verify ops/systemd/user/*.service ops/systemd/user/*.timer
bash -n ops/scripts/tzz-postgres-backup
```

Do not copy `.env.local` or `/home/wyz/.config/tzz/tzz-website.env` into this repository.
