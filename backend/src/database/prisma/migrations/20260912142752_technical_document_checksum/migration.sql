/*
  Warnings:

  - Added the required column `checksum` to the `technical_documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "technical_documents" ADD COLUMN     "checksum" TEXT NOT NULL;
