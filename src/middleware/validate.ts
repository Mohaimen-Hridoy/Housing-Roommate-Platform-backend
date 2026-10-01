import { RequestHandler } from "express";
import { ZodError, ZodSchema } from "zod";
import { ValidationError } from "../common/errors";

type SchemaMap = { [key: string]: ZodSchema };

const formatZodErrors = (error: ZodError) => {
  return error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "body",
    message: issue.message,
    code: issue.code,
  }));
};

export const validate =
  (schemas: SchemaMap): RequestHandler =>
  (req, _res, next) => {
    try {
      const parsed: Record<string, unknown> = {};
      if (schemas.body) parsed.body = schemas.body.parse(req.body);
      if (schemas.query) parsed.query = schemas.query.parse(req.query);
      if (schemas.params) parsed.params = schemas.params.parse(req.params);

      for (const key of Object.keys(parsed)) {
        (req as unknown as Record<string, unknown>)[key] = parsed[key];
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError("Validation failed", formatZodErrors(err)));
      }
      next(err);
    }
  };
