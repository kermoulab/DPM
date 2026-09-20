# Vectis — Database Backup & Restore

## Standard PostgreSQL Tools

Vectis uses a plain PostgreSQL database. All standard PostgreSQL backup and restore
tools work without modification:

```
pg_dump     — create a backup
pg_restore  — restore from backup
psql        — restore from plain SQL dump
```

No provider-specific backup API is required.

---

## Full Backup

### Plain SQL format (recommended for portability)

```bash
pg_dump "$DATABASE_URL" > vectis_backup.sql
```

### Custom format (compressed, supports selective restore)

```bash
pg_dump -Fc "$DATABASE_URL" > vectis_backup.dump
```

---

## Restore

### From plain SQL dump

```bash
psql "$NEW_DATABASE_URL" < vectis_backup.sql
```

### From custom format dump

```bash
pg_restore -d "$NEW_DATABASE_URL" vectis_backup.dump
```

---

## Migrating Between Providers

Vectis data is fully portable between any two PostgreSQL servers:

1. Dump the source database:
   ```bash
   pg_dump "$OLD_DATABASE_URL" > vectis_backup.sql
   ```

2. Create an empty database on the new provider.

3. Restore the dump:
   ```bash
   psql "$NEW_DATABASE_URL" < vectis_backup.sql
   ```

4. Update `DATABASE_URL` in your environment and restart Vectis.  
   No code changes required.

---

## Automated Backups

Most managed PostgreSQL providers (Render, Neon, Supabase, Railway, AWS RDS)
provide automatic daily backups via their dashboard.

For self-hosted PostgreSQL, schedule `pg_dump` with a cron job or task scheduler.

---

## Security Notes

- Never commit backup files to version control.
- Backup files contain **encrypted** credentials (AES-256-GCM). They are safe
  to store, but the `ENCRYPTION_KEY` must be backed up separately.
- Backups do **not** contain `JWT_SECRET` or `ENCRYPTION_KEY`. Store these in
  a password manager or secrets vault.