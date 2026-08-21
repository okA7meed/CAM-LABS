ALTER TABLE "cad_files" ADD COLUMN "guestId" TEXT;

CREATE INDEX "cad_files_guestId_updatedAt_idx" ON "cad_files"("guestId", "updatedAt");