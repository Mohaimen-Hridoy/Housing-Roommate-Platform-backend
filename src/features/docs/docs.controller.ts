import { Router, Request, Response } from "express";
import { env } from "../../config";
import openapiSpec from "../../../docs/openapi.json";

export const openapiRouter = Router();

openapiRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Apollo B7A6 Housing & Roommate Platform",
    version: "1.0.0",
    docs: {
      openapi: `${env.apiBaseUrl}/docs/openapi.json`,
      swaggerUI: "/docs",
    },
  });
});

openapiRouter.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openapiSpec);
});

export const docsRedirect = (_req: Request, res: Response) => {
  res.redirect(`${env.apiBaseUrl}/docs/openapi.json`);
};

export { openapiSpec };
