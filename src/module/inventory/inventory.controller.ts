import type { Request, Response } from "express";
import { forecastProduct } from "./forecast.service.js";
import { sendSuccess, sendError } from "@/utils/response.js";
import { forecastQuerySchema, forecastParaSchema } from "./inventory.schema.js";
import { ZodError } from "zod";

type Params= {
    id: string;
}

export const getForecast = async (
  req: Request<Params>,
  res: Response
): Promise<void> => {
  try {
    const params = forecastParaSchema.parse(req.params);
    const query = forecastQuerySchema.parse(req.query);

    const result = await forecastProduct(params.id, query.days);
    sendSuccess(res, result, 200, "Forecast retrieved successfully");
  } catch (error) {
    if (error instanceof ZodError) {
      sendError(res, "Validation Failed", 422, error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      })))
      return;
    }

    sendError(res, error instanceof Error ? error.message : "Unexpected error occurred", 500);
  }
};