import { Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import * as userService from "./users.service";
import { successResponse, errorResponse } from "../../common/apiResponse";
import { AuthenticatedRequest } from "../../middleware/auth";
import { userSelect } from "./users.service";

type Res = Response;

export const listUsers = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await userService.listUsers({
      role: query.role as Role | undefined,
      isVerified: query.isVerified === "true",
      name: query.name as string | undefined,
      email: query.email as string | undefined,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
      sortBy: (query.sortBy as string) || "createdAt",
      sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
    });
    res.json(successResponse(result.rows, { meta: result.meta }));
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const user = await userService.getUser(req.params.id as string);
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const updated = await userService.updateUser(req.params.id as string, req.body as { name?: string; phone?: string }, { id: req.user.id, role: req.user.role });
    res.json(successResponse(updated, { message: "User updated" }));
  } catch (err) {
    next(err);
  }
};

export const changeUserRole = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const { role } = req.body as { role?: Role };
    if (!role) {
      res.status(400).json(errorResponse({ message: "Role is required", statusCode: 400 }));
      return;
    }
    const updated = await userService.changeUserRole(req.params.id as string, role, { id: req.user.id, role: req.user.role });
    res.json(successResponse(updated, { message: "Role updated" }));
  } catch (err) {
    next(err);
  }
};

export const changePasswordAdmin = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const { password } = req.body as { password?: string };
    await userService.changePasswordAdmin(req.params.id as string, password!, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Password updated" }));
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await userService.deleteUser(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "User deleted" }));
  } catch (err) {
    next(err);
  }
};

export const restoreUser = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await userService.restoreUser(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "User restored" }));
  } catch (err) {
    next(err);
  }
};

export { userSelect };
