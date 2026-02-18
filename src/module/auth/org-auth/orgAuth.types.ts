import type { OrgRole } from "@/generated/prisma/index.js";

export interface ValidatedUser {
  id: string;
  role: OrgRole;
}

export interface OrgUserResponseDTO {
  id: string;
  organizationId: string;

  name: String;
  email: string;
  role: OrgRole;
  profileImgUrl: string | null;

  isActive: Boolean;
  revokedAt: Date | null;

  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
