import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config";
import { logger } from "./logger";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (env.email.provider === "smtp") {
    if (!env.email.host) {
      logger.warn("SMTP host not configured; falling back to console");
      return null;
    }
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.secure,
      auth: env.email.user ? { user: env.email.user, pass: env.email.pass } : undefined,
    });
  } else {
    return null;
  }
  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const t = getTransporter();
  const from = env.email.from;
  if (!t) {
    logger.info(`[email] (console) to=${options.to} subject=${options.subject}`);
    logger.info(`[email] body: ${options.html}`);
    return;
  }
  await t.sendMail({ from, ...options });
}

export function renderVerificationEmail(token: string, name: string): EmailOptions {
  const verifyUrl = `${env.webAppUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const html = `<p>Hi ${name || "there"},</p><p>Please verify your email: <a href="${verifyUrl}">${verifyUrl}</a></p>`;
  return { to: "", subject: "Verify your email", html, text: verifyUrl };
}
