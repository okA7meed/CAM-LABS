-- CreateTable
CREATE TABLE "cad_file_versions" (
    "id" TEXT NOT NULL,
    "cadFileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadStatus" TEXT NOT NULL DEFAULT 'STORED',
    "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "dimensions" TEXT,
    "volume" TEXT,
    "meshTriangles" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cad_processing_jobs" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cad_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfm_reports" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dfm_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cad_file_versions_storageKey_key" ON "cad_file_versions"("storageKey");
CREATE UNIQUE INDEX "cad_file_versions_cadFileId_version_key" ON "cad_file_versions"("cadFileId", "version");
CREATE UNIQUE INDEX "cad_file_versions_cadFileId_checksum_key" ON "cad_file_versions"("cadFileId", "checksum");
CREATE INDEX "cad_file_versions_cadFileId_createdAt_idx" ON "cad_file_versions"("cadFileId", "createdAt");
CREATE INDEX "cad_file_versions_processingStatus_scanStatus_idx" ON "cad_file_versions"("processingStatus", "scanStatus");
CREATE UNIQUE INDEX "cad_processing_jobs_versionId_operation_key" ON "cad_processing_jobs"("versionId", "operation");
CREATE INDEX "cad_processing_jobs_status_availableAt_idx" ON "cad_processing_jobs"("status", "availableAt");
CREATE UNIQUE INDEX "dfm_reports_versionId_key" ON "dfm_reports"("versionId");

-- AddForeignKey
ALTER TABLE "cad_file_versions" ADD CONSTRAINT "cad_file_versions_cadFileId_fkey" FOREIGN KEY ("cadFileId") REFERENCES "cad_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cad_processing_jobs" ADD CONSTRAINT "cad_processing_jobs_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "cad_file_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dfm_reports" ADD CONSTRAINT "dfm_reports_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "cad_file_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;