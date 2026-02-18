import type { SystemRole } from "@/generated/prisma/index.js";

export interface SysUserResponseDTO {
  id: string;

  email: string;
  role: SystemRole;

  isActive: Boolean;

  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
