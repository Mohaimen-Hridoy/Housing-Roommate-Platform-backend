import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { userFilterSchema, userUpdateSchema, adminSetPasswordSchema } from "./users.schema";
import {
  listUsers,
  getUser,
  updateUser,
  changeUserRole,
  changePasswordAdmin,
  deleteUser,
  restoreUser,
} from "./users.controller";

export const usersRouter = Router();

usersRouter.use(authenticate, authorize(Role.ADMIN));

usersRouter.get("/", validate({ query: userFilterSchema }), listUsers);
usersRouter.get("/:id", getUser);
usersRouter.patch("/:id", validate({ body: userUpdateSchema }), updateUser);
usersRouter.patch("/:id/role", changeUserRole);
usersRouter.patch("/:id/password", validate({ body: adminSetPasswordSchema }), changePasswordAdmin);
usersRouter.delete("/:id", deleteUser);
usersRouter.patch("/:id/restore", restoreUser);
