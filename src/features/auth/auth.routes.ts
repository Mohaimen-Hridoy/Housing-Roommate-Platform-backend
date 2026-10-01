import { Router } from "express";
import {
  registerTenantCtrl,
  registerOwnerCtrl,
  loginCtrl,
  refreshTokenCtrl,
  logoutCtrl,
  googleSignInCtrl,
  meCtrl,
  resendVerificationCtrl,
  verifyEmailCtrl,
  forgotPasswordCtrl,
  resetPasswordCtrl,
  changePasswordCtrl,
} from "./auth.controller";
import { validate } from "../../middleware/validate";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  googleAuthSchema,
  requestVerificationSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schema";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";

export const authRouter = Router();

authRouter.post("/register/tenant", validate({ body: registerSchema }), registerTenantCtrl);
authRouter.post("/register/owner", validate({ body: registerSchema }), registerOwnerCtrl);
authRouter.post("/login", validate({ body: loginSchema }), loginCtrl);
authRouter.post("/refresh", validate({ body: refreshTokenSchema }), refreshTokenCtrl);
authRouter.post("/logout", authenticate, logoutCtrl);
authRouter.get("/me", authenticate, meCtrl);
authRouter.post("/google", validate({ body: googleAuthSchema }), googleSignInCtrl);
authRouter.post("/verify/resend", validate({ body: requestVerificationSchema }), resendVerificationCtrl);
authRouter.post("/verify", validate({ body: verifyEmailSchema }), verifyEmailCtrl);
authRouter.post("/password/forgot", validate({ body: forgotPasswordSchema }), forgotPasswordCtrl);
authRouter.post("/password/reset", validate({ body: resetPasswordSchema }), resetPasswordCtrl);
authRouter.post("/password/change", authenticate, authorize(Role.OWNER, Role.TENANT, Role.ADMIN), validate({ body: changePasswordSchema }), changePasswordCtrl);
