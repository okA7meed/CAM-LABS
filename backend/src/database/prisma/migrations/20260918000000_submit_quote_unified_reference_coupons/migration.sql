-- Submit Quote lifecycle: unified business reference + coupon system + address/payment snapshots
-- Extends quotes/orders/users without breaking existing PK formats (RFQ-xxx / CAM-xxx kept).

-- Users: structured address persistence ("Save this information for next time")
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "governorate" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'Egypt';

-- Quotes: unified reference + snapshots
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "contactSnapshot" JSONB;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'Egypt';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "governorate" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "shippingAddressSnapshot" JSONB;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "shippingMethod" TEXT DEFAULT 'STANDARD';
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "shippingCostAmount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "preferredPaymentMethod" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "billingSameAsShipping" BOOLEAN DEFAULT true;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "billingAddressSnapshot" JSONB;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponId" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponCodeSnapshot" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponDiscountTypeSnapshot" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponDiscountValueSnapshot" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponEligibleAmountSnapshot" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponDiscountAmountApplied" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponShippingDiscountApplied" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "estimatedTotalAmount" DOUBLE PRECISION;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "couponAppliedAt" TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_reference_key" ON "quotes"("reference");
CREATE INDEX IF NOT EXISTS "quotes_reference_idx" ON "quotes"("reference");
CREATE INDEX IF NOT EXISTS "quotes_couponId_idx" ON "quotes"("couponId");

-- Orders: unified reference + carried snapshots
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "preferredPaymentMethod" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingCostAmount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingAddressSnapshot" JSONB;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "billingAddressSnapshot" JSONB;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "contactSnapshot" JSONB;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponCodeSnapshot" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponDiscountTypeSnapshot" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponDiscountValueSnapshot" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponEligibleAmountSnapshot" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "couponDiscountAmountApplied" DOUBLE PRECISION DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_reference_key" ON "orders"("reference");
CREATE INDEX IF NOT EXISTS "orders_reference_idx" ON "orders"("reference");

-- Backfill unified references for legacy rows: Quote.reference = Order-matching CAM- id where converted, else CAM- derived from RFQ number.
-- Legacy Quote ids look like RFQ-2026-XXXXXX; map to CAM-2026-XXXXXX (same numeric suffix) when free, else keep NULL (nullable unique allows it).
DO $$
DECLARE r RECORD;
  candidate TEXT;
  suffix TEXT;
BEGIN
  FOR r IN SELECT id, "convertedOrderId" FROM "quotes" WHERE reference IS NULL LOOP
    IF r."convertedOrderId" IS NOT NULL THEN
      BEGIN
        UPDATE "orders" SET reference = r."convertedOrderId" WHERE id = r."convertedOrderId" AND reference IS NULL;
      EXCEPTION WHEN unique_violation THEN
        -- already referenced, skip
      END;
      BEGIN
        UPDATE "quotes" SET reference = r."convertedOrderId" WHERE id = r.id;
      EXCEPTION WHEN unique_violation THEN
        -- collision, leave NULL
      END;
    ELSE
      suffix := regexp_replace(r.id, '^.*-(\\d+)$', '\\1');
      IF suffix ~ '^\\d+$' THEN
        candidate := 'CAM-2026-' || suffix;
        BEGIN
          UPDATE "quotes" SET reference = candidate WHERE id = r.id;
        EXCEPTION WHEN unique_violation THEN
          -- leave NULL; new quotes will generate fresh unique refs
        END;
      END IF;
    END IF;
  END LOOP;
  -- Orders without reference: use their own id when it already matches CAM- pattern
  UPDATE "orders" SET reference = id WHERE reference IS NULL AND id LIKE 'CAM-%';
END $$;

-- Coupons
CREATE TABLE IF NOT EXISTS "coupons" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "discountType" TEXT NOT NULL,
  "discountValue" DOUBLE PRECISION NOT NULL,
  "maxDiscountAmount" DOUBLE PRECISION,
  "minQuoteAmount" DOUBLE PRECISION,
  "maxTotalUses" INTEGER,
  "usageLimitPerCustomer" INTEGER,
  "startAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "discountScope" TEXT NOT NULL DEFAULT 'SUBTOTAL_ONLY',
  "appliesToShipping" BOOLEAN NOT NULL DEFAULT false,
  "totalUses" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archivedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_isEnabled_idx" ON "coupons"("isEnabled");
CREATE INDEX IF NOT EXISTS "coupons_expiresAt_idx" ON "coupons"("expiresAt");

-- Coupon usages (immutable history)
CREATE TABLE IF NOT EXISTS "coupon_usages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "couponId" TEXT NOT NULL REFERENCES "coupons"("id") ON DELETE RESTRICT,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "quoteId" TEXT REFERENCES "quotes"("id") ON DELETE SET NULL,
  "couponCodeSnapshot" TEXT NOT NULL,
  "discountTypeSnapshot" TEXT NOT NULL,
  "discountValueSnapshot" DOUBLE PRECISION NOT NULL,
  "eligibleAmountSnapshot" DOUBLE PRECISION NOT NULL,
  "discountAmountApplied" DOUBLE PRECISION NOT NULL,
  "amountAfterDiscount" DOUBLE PRECISION NOT NULL,
  "shippingDiscountApplied" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quoteReference" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "coupon_usages_couponId_idx" ON "coupon_usages"("couponId");
CREATE INDEX IF NOT EXISTS "coupon_usages_userId_idx" ON "coupon_usages"("userId");
CREATE INDEX IF NOT EXISTS "coupon_usages_quoteId_idx" ON "coupon_usages"("quoteId");
CREATE INDEX IF NOT EXISTS "coupon_usages_createdAt_idx" ON "coupon_usages"("createdAt");

-- FKs for quote/order coupon link (nullable, set-null)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_couponId_fkey') THEN
    ALTER TABLE "quotes" ADD CONSTRAINT "quotes_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_couponId_fkey') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL;
  END IF;
END $$;
