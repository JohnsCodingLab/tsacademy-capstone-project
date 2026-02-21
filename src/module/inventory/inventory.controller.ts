import type { Request, Response } from "express";
import { forecastProduct } from "./forecast.service.js";
import { sendSuccess, sendError } from "@/utils/response.js";
import type { forecastParaSchema } from "./inventory.schema.js";

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
 sendSuccess(res)
  }
  res.json(result);
};