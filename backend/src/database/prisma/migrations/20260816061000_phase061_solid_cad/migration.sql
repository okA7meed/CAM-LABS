ALTER TABLE "cad_file_versions"
  ADD COLUMN "viewerAssetKey" TEXT,
  ADD COLUMN "viewerAssetSize" INTEGER,
  ADD COLUMN "processingDuration" INTEGER,
  ADD COLUMN "detectedUnit" TEXT,
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureMessage" TEXT;

CREATE UNIQUE INDEX "cad_file_versions_viewerAssetKey_key" ON "cad_file_versions"("viewerAssetKey");