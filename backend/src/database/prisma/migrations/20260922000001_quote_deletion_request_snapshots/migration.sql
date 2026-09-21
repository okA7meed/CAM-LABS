-- Retain deletion-request audit history after the Quote row is removed.
-- The request keeps immutable snapshots (reference, part, customer display)
-- so the admin queue stays a complete record; the live Quote link detaches
-- (SET NULL) instead of cascading away the APPROVED row.

ALTER TABLE "quote_deletion_requests"
  ADD COLUMN "quoteReference" TEXT,
  ADD COLUMN "quotePartName" TEXT,
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "customerEmail" TEXT;

ALTER TABLE "quote_deletion_requests"
  DROP CONSTRAINT "quote_deletion_requests_quoteId_fkey";

ALTER TABLE "quote_deletion_requests"
  ALTER COLUMN "quoteId" DROP NOT NULL;

ALTER TABLE "quote_deletion_requests"
  ADD CONSTRAINT "quote_deletion_requests_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "quotes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
