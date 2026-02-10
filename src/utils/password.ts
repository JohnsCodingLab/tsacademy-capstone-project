import bcrypt from "bcrypt";
import crypto from "crypto";

const SALT_ROUNDS = 12;

export const hashPassword = (password: string) =>
  bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const generateUnusablePassword = () => {
  return crypto.randomBytes(64).toString("hex");
};
