import type { OrgRole, SystemRole } from "@/generated/prisma/index.js";
import { UserType } from "@/modules/auth/auth.types.js";

export type AuthenticatedOrgUser = {
  type: "ORG";
  id: string;
  role: OrgRole;
  orgId: string; // always present for org users
};

export type AuthenticatedSysUser = {
  type: "SYSTEM";
  id: string;
  role: SystemRole;
};

export type AuthenticatedUser = AuthenticatedOrgUser | AuthenticatedSysUser;

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
