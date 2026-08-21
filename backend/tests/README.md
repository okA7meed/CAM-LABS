# Authentication Tests

Run the suite from the repository root with:

```bash
npm test
```

The tests exercise the real Express authentication routes, password service, session-cookie boundary, RBAC policy, and ownership middleware. Because the supplied development environment has no PostgreSQL server, the test file substitutes an isolated in-memory repository at the Prisma boundary. It does not alter application runtime behavior and does not use a developer or production database.

For CI or local database-backed integration tests, provision a separate PostgreSQL database and export the values from `backend/.env.test.example` before adding those tests. Never run destructive test cleanup against a normal development or production database.