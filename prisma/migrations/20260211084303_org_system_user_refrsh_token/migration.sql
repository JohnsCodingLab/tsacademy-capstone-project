/*
  Warnings:

  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_orgUserId_fkey";

-- DropTable
DROP TABLE "RefreshToken";

-- CreateTable
CREATE TABLE "OrgRefreshToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orgUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "OrgRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SysRefreshToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sysUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SysRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgRefreshToken_jti_key" ON "OrgRefreshToken"("jti");

-- CreateIndex
CREATE INDEX "OrgRefreshToken_orgUserId_idx" ON "OrgRefreshToken"("orgUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SysRefreshToken_jti_key" ON "SysRefreshToken"("jti");

-- CreateIndex
CREATE INDEX "SysRefreshToken_sysUserId_idx" ON "SysRefreshToken"("sysUserId");

-- AddForeignKey
ALTER TABLE "OrgRefreshToken" ADD CONSTRAINT "OrgRefreshToken_orgUserId_fkey" FOREIGN KEY ("orgUserId") REFERENCES "OrgUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SysRefreshToken" ADD CONSTRAINT "SysRefreshToken_sysUserId_fkey" FOREIGN KEY ("sysUserId") REFERENCES "SystemUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
