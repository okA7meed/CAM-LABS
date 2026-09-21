-- Super Admin-controlled shipping methods (replaces hardcoded 70/100 constants).
-- Additive only: new table + idempotent seed. Historical quote snapshots untouched.

CREATE TABLE IF NOT EXISTS "shipping_methods" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "eta" TEXT NOT NULL DEFAULT '',
  "priceEgp" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "shipping_methods_isEnabled_idx" ON "shipping_methods"("isEnabled");
CREATE INDEX IF NOT EXISTS "shipping_methods_sortOrder_idx" ON "shipping_methods"("sortOrder");

-- Seed the two previously-hardcoded methods. Idempotent: safe to re-apply,
-- never duplicates, never overwrites a Super Admin-edited price.
-- (Fixed ids — no extension dependency.)
INSERT INTO "shipping_methods" ("id", "code", "name", "description", "eta", "priceEgp", "currency", "isEnabled", "sortOrder")
VALUES
  ('00000000-0000-4000-8000-000000000701', 'STANDARD', 'Standard Shipping', 'Reliable delivery within 2 to 5 business days', '2–5 Days', 70, 'EGP', true, 0),
  ('00000000-0000-4000-8000-000000000702', 'PRIORITY', 'Priority Shipping', 'Expedited handling and courier dispatch', '1–2 Days', 100, 'EGP', true, 1)
ON CONFLICT ("code") DO NOTHING;
