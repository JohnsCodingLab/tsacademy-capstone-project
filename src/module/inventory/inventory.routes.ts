import { Router } from "express";
import { getForecast } from "./inventory.controller.js";

const router = Router();

router.get("/forecast/:id", getForecast);

export default router;