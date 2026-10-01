import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import {
  registerTenant,
  registerOwner,
  login,
  refresh,
  logout,
  googleSignIn,
  requestPasswordReset,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
} from "./auth.service";
import { successResponse, ApiResponse } from "../../common/apiResponse";
import { TokenBundle } from "./auth.service";

interface AuthRequest extends Request {
  body: Record<string, unknown>;
  user?: { id: string; role: Role; email: string; name: string | null };
  cookies: Record<string, string>;
}

function tokenResponse(data: TokenBundle, message: string) {
  return successResponse(
    { accessToken: data.accessToken, refreshToken: data.refreshToken, tokenType: "Bearer", expiresIn: data.expiresIn },
    { message }
  );
}

export const registerTenantCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { name?: string; email?: string; password?: string; phone?: string };
    const tokens = await registerTenant({ name: body.name!, email: body.email!, password: body.password!, phone: body.phone });
    res.status(201).json(tokenResponse(tokens, "Tenant registered successfully"));
  } catch (err) {
    next(err);
  }
};

export const registerOwnerCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { name?: string; email?: string; password?: string; phone?: string };
    const tokens = await registerOwner({ name: body.name!, email: body.email!, password: body.password!, phone: body.phone });
    res.status(201).json(tokenResponse(tokens, "Owner registered successfully"));
  } catch (err) {
    next(err);
  }
};

export const loginCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { email?: string; password?: string };
    const tokens = await login(body.email!, body.password!, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.json(tokenResponse(tokens, "Login successful"));
  } catch (err) {
    next(err);
  }
};

export const refreshTokenCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { refreshToken?: string };
    const token = body.refreshToken ?? req.cookies?.refreshToken;
    const tokens = await refresh(token!);
    res.json(tokenResponse(tokens, "Token refreshed"));
  } catch (err) {
    next(err);
  }
};

export const logoutCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      await logout(userId, { ip: req.ip, userAgent: req.get("user-agent") });
    }
    res.clearCookie("refreshToken");
    res.json(successResponse(null, { message: "Logged out successfully" }));
  } catch (err) {
    next(err);
  }
};

export const googleSignInCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { idToken?: string };
    const tokens = await googleSignIn(body.idToken!, { ip: req.ip, userAgent: req.get("user-agent") });
    res.json(tokenResponse(tokens, "Google login successful"));
  } catch (err) {
    next(err);
  }
};

export const meCtrl = (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ success: false, statusCode: 401, message: "Unauthorized", data: null } as ApiResponse);
    return;
  }
  res.json(successResponse({ id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role }));
};

export const resendVerificationCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { email?: string };
    await resendVerification(body.email!);
    res.json(successResponse(null, { message: "If the account exists, a verification email has been sent" }));
  } catch (err) {
    next(err);
  }
};

export const verifyEmailCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { token?: string };
    await verifyEmail(body.token!);
    res.json(successResponse(null, { message: "Email verified successfully" }));
  } catch (err) {
    next(err);
  }
};

export const forgotPasswordCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { email?: string };
    await requestPasswordReset(body.email!);
    res.json(successResponse(null, { message: "If the account exists, a reset email has been sent" }));
  } catch (err) {
    next(err);
  }
};

export const resetPasswordCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { token?: string; password?: string };
    await resetPassword(body.token!, body.password!);
    res.json(successResponse(null, { message: "Password reset successfully" }));
  } catch (err) {
    next(err);
  }
};

export const changePasswordCtrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { currentPassword?: string; newPassword?: string };
    const userId = req.user!.id;
    await changePassword(userId, body.currentPassword!, body.newPassword!);
    res.json(successResponse(null, { message: "Password changed successfully" }));
  } catch (err) {
    next(err);
  }
};
