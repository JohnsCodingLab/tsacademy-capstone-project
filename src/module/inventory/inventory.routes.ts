import { Router } from "express";
import { getForecast } from "./inventory.controller.js";

const router = Router();

router.get("/:id/forecast", getForecast);

export default router;