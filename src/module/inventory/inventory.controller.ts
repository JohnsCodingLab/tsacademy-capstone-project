import type { Request, Response } from "express";
import { forecastProduct } from "./forecast.service.js";
import { id } from "zod/locales";

type Params= {
    id: string;
}

export const getForecast = async (req: Request<Params>, res: Response) => {
  const result = await forecastProduct(req.params.id);
  res.json(result);
};