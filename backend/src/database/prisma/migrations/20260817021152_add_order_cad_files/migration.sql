-- DropIndex
DROP INDEX "cad_file_versions_viewerAssetKey_key";

-- CreateTable
CREATE TABLE "order_cad_files" (
    "orderId" TEXT NOT NULL,
    "cadFileId" TEXT NOT NULL,
    "configuration" JSONB,
    "totalCost" TEXT,

    CONSTRAINT "order_cad_files_pkey" PRIMARY KEY ("orderId","cadFileId")
);

-- CreateIndex
CREATE INDEX "order_cad_files_cadFileId_idx" ON "order_cad_files"("cadFileId");

-- CreateIndex
CREATE INDEX "cad_files_userId_updatedAt_idx" ON "cad_files"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "order_cad_files" ADD CONSTRAINT "order_cad_files_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_cad_files" ADD CONSTRAINT "order_cad_files_cadFileId_fkey" FOREIGN KEY ("cadFileId") REFERENCES "cad_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
