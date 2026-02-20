import type { OrgRole } from "@/generated/prisma/index.js";

export interface OrgUserResponseDTO {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: OrgRole;
  profileImageUrl: string | null;
  isActive: boolean;
  revokedAt: Date | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgUserActivityDTO {
  id: string;
  action: string;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
