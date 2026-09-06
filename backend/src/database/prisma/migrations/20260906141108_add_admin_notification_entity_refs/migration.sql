-- AlterTable
ALTER TABLE "admin_notifications" ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT;

-- CreateIndex
CREATE INDEX "admin_notifications_entityType_entityId_idx" ON "admin_notifications"("entityType", "entityId");
