-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "technicalNotes" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "technicalNotes" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "technical_documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "quoteId" TEXT,
    "orderId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'CLEAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technical_documents_storageKey_key" ON "technical_documents"("storageKey");

-- CreateIndex
CREATE INDEX "technical_documents_userId_idx" ON "technical_documents"("userId");

-- CreateIndex
CREATE INDEX "technical_documents_guestId_idx" ON "technical_documents"("guestId");

-- CreateIndex
CREATE INDEX "technical_documents_quoteId_idx" ON "technical_documents"("quoteId");

-- CreateIndex
CREATE INDEX "technical_documents_orderId_idx" ON "technical_documents"("orderId");

-- AddForeignKey
ALTER TABLE "technical_documents" ADD CONSTRAINT "technical_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_documents" ADD CONSTRAINT "technical_documents_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_documents" ADD CONSTRAINT "technical_documents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
