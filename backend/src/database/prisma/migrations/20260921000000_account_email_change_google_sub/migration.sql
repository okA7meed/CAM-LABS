-- AlterTable: stable Google identity linkage (nullable, backward-compatible).
ALTER TABLE "users" ADD COLUMN "googleSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");

-- CreateTable: verified email-change challenges (mirrors password_reset_challenges).
CREATE TABLE "email_change_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_change_challenges_userId_idx" ON "email_change_challenges"("userId");

-- CreateIndex
CREATE INDEX "email_change_challenges_expiresAt_idx" ON "email_change_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "email_change_challenges" ADD CONSTRAINT "email_change_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
