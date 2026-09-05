# TZZ ADMIN_TODO

Run these steps only from an administrator-owned root shell. Do not grant broad sudo access to `wyz`. Stop if any precondition differs.

## 1. Production account and data group

```bash
getent group tzzdata || groupadd --system tzzdata
getent passwd tzzapp || useradd --system --gid tzzdata --home-dir /var/lib/tzzapp --create-home --shell /sbin/nologin tzzapp
usermod -aG tzzdata wyz

chown root:tzzdata /home/wyz/tzz-data
chmod 2750 /home/wyz/tzz-data
for d in blobs tmp quarantine exports thumbnails; do
  chown root:tzzdata "/home/wyz/tzz-data/$d"
  chmod 2770 "/home/wyz/tzz-data/$d"
done

id tzzapp
getent group tzzdata
find /home/wyz/tzz-data -maxdepth 1 -type d -printf '%M %u %g %p\n'
```

Open a new SSH login for `wyz` after `usermod`; do not force group changes into an existing shell.

## 2. Stable, non-executable bind mount

```bash
mkdir -p /srv/tzz-data
test -z "$(find /srv/tzz-data -mindepth 1 -maxdepth 1 -print -quit)"
mount --bind /home/wyz/tzz-data /srv/tzz-data
mount -o remount,bind,rw,nodev,nosuid,noexec /srv/tzz-data
findmnt -T /srv/tzz-data -o TARGET,SOURCE,FSTYPE,OPTIONS
```

Only after the live mount reports `rw,nodev,nosuid,noexec`, back up `/etc/fstab`, add a persistent bind entry appropriate for Rocky 8/util-linux 2.32.1, run `findmnt --verify --verbose`, then test one `umount /srv/tzz-data` followed by `mount /srv/tzz-data`. Do not rely on fstab text without rechecking the effective options.

## 3. PostgreSQL boot persistence: choose one

Option A, minimal: keep the verified user service and enable boot-time user management:

```bash
loginctl enable-linger wyz
loginctl show-user wyz -p Linger
```

Option B, preferred long-term: create a system `tzz-postgresql.service` with `User=wyz`, the existing Conda binary and PGDATA. During a maintenance window, stop the current user unit before starting the system unit. Verify there is exactly one postmaster, `pg_isready` succeeds, SCRAM works, and only `127.0.0.1:5432` is listening.

## 4. TZZ Nginx origin and protected blobs

Configure a separate TZZ server; do not edit the OASIS container. Bind only the Rocky Tailscale address on a high port, for example `100.121.222.86:8443`, and proxy the application to `127.0.0.1:3000`.

```nginx
location ^~ /_protected_files/ {
    internal;
    alias /srv/tzz-data/blobs/;
    autoindex off;
}
```

Give Nginx read-only ACLs; do not add it to the writable `tzzdata` group:

```bash
setfacl -m u:nginx:--x /home/wyz/tzz-data
setfacl -R -m u:nginx:r-X /home/wyz/tzz-data/blobs
setfacl -m d:u:nginx:r-X /home/wyz/tzz-data/blobs
nginx -t
```

Run the production Next.js service as `tzzapp`, with `UMask=0007`, after its release and File API are ready.

## 5. Firewall scope

Allow only `sh-vps` (`100.126.209.95/32`) to reach the chosen TZZ origin port on Tailscale. Do not place `tailscale0` in the `trusted` zone. Verify both an allowed VPS connection and a denied connection from another Tailnet node. Do not change rules for OASIS, MariaDB, NFS or Slurm.

## 6. Remaining independent backup

`/home/wyz/tzz-data` and `/home/wyz/tzz-backups` are on the same `/dev/sdc` storage system. Configure an authenticated remote/off-host backup target and perform a restore test; the local PostgreSQL dumps are not disk-failure disaster recovery.
