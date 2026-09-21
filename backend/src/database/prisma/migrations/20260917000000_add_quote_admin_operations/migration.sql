-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "systemTotalPrice" TEXT,
ADD COLUMN     "priceOverrideReason" TEXT,
ADD COLUMN     "priceOverriddenBy" TEXT,
ADD COLUMN     "priceOverriddenAt" TIMESTAMP(3),
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "statusUpdatedBy" TEXT;

-- CreateTable
CREATE TABLE "quote_messages" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "senderId" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_messages_quoteId_idx" ON "quote_messages"("quoteId");

-- AddForeignKey
ALTER TABLE "quote_messages" ADD CONSTRAINT "quote_messages_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
