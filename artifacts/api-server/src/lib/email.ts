import nodemailer from "nodemailer";
import { logger } from "./logger";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!transporter) {
    logger.info({ to, subject }, "Email not configured — skipping send");
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@putnamcountysheriff.gov",
      to,
      subject,
      text,
    });
    logger.info({ to, subject }, "Email sent");
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email");
  }
}
