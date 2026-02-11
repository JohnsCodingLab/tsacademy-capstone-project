import { UserType } from "@/modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        type: UserType;
        orgId?: string;
      };
    }
  }
}
