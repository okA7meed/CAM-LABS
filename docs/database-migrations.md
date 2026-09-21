# Database migrations

## Rule

**Prisma schema, Prisma Client, and the database must always agree.**
If `schema.prisma` gains fields/tables, the matching migration must be applied
to every environment before (re)starting the backend. A regenerated Prisma
Client queries the new columns immediately — an unapplied migration turns
every affected endpoint into an HTTP 500 (e.g. Prisma `P2022: column does not
exist`), even though the code, types, and tests all pass.

## Commands

From `backend/`:

```sh
# Inspect (read-only, safe anywhere):
npx prisma migrate status --schema=src/database/prisma/schema.prisma

# Validate the schema file:
npm run prisma:validate

# Regenerate the client after schema edits:
npm run prisma:generate

# Apply pending migrations (dev AND production procedure):
npx prisma migrate deploy --schema=src/database/prisma/schema.prisma
```

## Safety rules

- NEVER `prisma migrate reset`, `db push` against a shared database, drop
  tables, or point `DATABASE_URL` elsewhere to "fix" an error.
- New columns for existing rows must be nullable or carry a default/backfill.
- `npm start` (`node dist/server.js`) does NOT apply migrations automatically;
  deployment must run `prisma migrate deploy` first.
- New migrations must be additive-only unless a destructive change is
  explicitly reviewed and announced.
