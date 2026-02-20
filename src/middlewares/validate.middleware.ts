import { sendError } from "@/utils/response.js";
import type { Request, Response, NextFunction } from "express";
import { ZodObject, ZodError } from "zod";

export const validate =
  (schema: ZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          path: String(issue.path[issue.path.length - 1] ?? "unknown"),
          message: issue.message,
        }));

        return sendError(res, "Validation failed", 422, errors);
      }
      next(error);
    }
  };
