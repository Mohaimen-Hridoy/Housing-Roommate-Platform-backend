import { Router } from "express";
import { stripeWebhook } from "./stripe.controller";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/", stripeWebhook);
