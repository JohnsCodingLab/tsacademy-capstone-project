/*
  Warnings:

  - You are about to drop the column `userId` on the `RefreshToken` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `UserActivity` table. All the data in the column will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StockMovement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `orgUserId` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgUserId` to the `UserActivity` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ORG_SUPER_ADMIN', 'ORG_ADMIN', 'ORG_USER');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SYSTEM_ADMIN');

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "UserActivity" DROP CONSTRAINT "UserActivity_userId_fkey";

-- DropIndex
DROP INDEX "RefreshToken_userId_idx";

-- DropIndex
DROP INDEX "UserActivity_userId_idx";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "userId",
ADD COLUMN     "orgUserId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserActivity" DROP COLUMN "userId",
ADD COLUMN     "orgUserId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "StockMovement";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "MovementType";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "OrgUser" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'ORG_USER',
    "profileImageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "SystemRole" NOT NULL DEFAULT 'SYSTEM_ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgUser_organizationId_idx" ON "OrgUser"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUser_organizationId_email_key" ON "OrgUser"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SystemUser_email_key" ON "SystemUser"("email");

-- CreateIndex
CREATE INDEX "RefreshToken_orgUserId_idx" ON "RefreshToken"("orgUserId");

-- CreateIndex
CREATE INDEX "UserActivity_orgUserId_idx" ON "UserActivity"("orgUserId");

-- AddForeignKey
ALTER TABLE "OrgUser" ADD CONSTRAINT "OrgUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_orgUserId_fkey" FOREIGN KEY ("orgUserId") REFERENCES "OrgUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_orgUserId_fkey" FOREIGN KEY ("orgUserId") REFERENCES "OrgUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
