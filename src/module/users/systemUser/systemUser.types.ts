import type { OrgRole } from "@/generated/prisma/index.js";

// ─── Organization ─────────────────────────────────────────────────────────────

export interface OrgSummaryDTO {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgDetailDTO extends OrgSummaryDTO {
  users: OrgUserSummaryDTO[];
}

// ─── Org Users (as seen by a system admin) ───────────────────────────────────

export interface OrgUserSummaryDTO {
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}

// ─── System Users ────────────────────────────────────────────────────────────

export interface SysUserListItemDTO {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}
