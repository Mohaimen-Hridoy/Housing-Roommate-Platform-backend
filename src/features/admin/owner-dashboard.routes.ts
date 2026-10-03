import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { getDashboard } from "./admin.controller";

export const ownerDashboardRouter = Router();

ownerDashboardRouter.get("/", authenticate, getDashboard);