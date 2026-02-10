import type { Role } from "@/generated/prisma/index.js";

export interface JwtPayload {
  userId: string;
  role: Role;
}

export interface UserResponseDTO {
  id: string;
  name: String;
  email: string;
  role: Role;
}

export interface ValidatedUser {
  id: string;
  role: Role;
}
