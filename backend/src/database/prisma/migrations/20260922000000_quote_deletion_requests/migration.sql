-- Additive migration: customer Quote deletion requests (deletion-by-approval).
-- No existing tables are altered destructively; only a new table + indexes.
-- Customers file a PENDING request; an authorized admin APPROVES (deletes the
-- Quote transactionally) or REJECTS (Quote stays active).

CREATE TABLE "quote_deletion_requests" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByAdminId" TEXT,
  "adminNote" TEXT,
  CONSTRAINT "quote_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_deletion_requests_quoteId_idx" ON "quote_deletion_requests"("quoteId");
CREATE INDEX "quote_deletion_requests_requestedByUserId_idx" ON "quote_deletion_requests"("requestedByUserId");
CREATE INDEX "quote_deletion_requests_status_idx" ON "quote_deletion_requests"("status");

-- At most one active PENDING request per Quote (resolved APPROVED/REJECTED
-- rows never block a later request).
CREATE UNIQUE INDEX "quote_deletion_requests_one_pending_per_quote"
  ON "quote_deletion_requests"("quoteId")
  WHERE "status" = 'PENDING';

ALTER TABLE "quote_deletion_requests"
  ADD CONSTRAINT "quote_deletion_requests_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "quotes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
