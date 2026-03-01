import prisma from "@/config/prisma.js";
import { jest } from "@jest/globals";

/**
 * Deep mocked Prisma client
 * Converts ALL methods into jest mocks with correct typing
 */
export const mockPrisma = prisma as unknown as jest.Mocked<typeof prisma>;
