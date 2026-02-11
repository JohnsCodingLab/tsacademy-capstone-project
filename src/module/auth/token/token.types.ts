export type UserType = "SYSTEM" | "ORG";

export interface TokenPayload {
  sub: string;
  role: string;
  type: UserType;
  jti?: string;
  orgId?: string; // Optional for System users
}
