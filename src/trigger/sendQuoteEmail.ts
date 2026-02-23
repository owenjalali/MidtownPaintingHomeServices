import nodemailer from "nodemailer";
import { logger, task } from "@trigger.dev/sdk";

type QuoteAttachment = {
  contentBase64: string;
  contentType: string;
  filename: string;
};

type QuotePayload = {
  addressLine1: string;
  budget?: string;
  callGoal?: string;
  city: string;
  country: string;
  email: string;
  fullName: string;
  images?: QuoteAttachment[];
  phone: string;
  phoneCountryCode?: string;
  phoneNationalNumber?: string;
  postalCode: string;
  provinceState: string;
  projectDetails: string;
  projectType: string;
  submittedAtIso?: string;
};

const requiredEnvVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "QUOTE_TO_EMAIL"] as const;

const getMissingEnvVars = () =>
  requiredEnvVars.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const sendQuoteEmail = task({
  id: "send-quote-email",
  run: async (payload: QuotePayload) => {
    const missingEnvVars = getMissingEnvVars();
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required SMTP env vars: ${missingEnvVars.join(", ")}`);
    }

    const smtpPort = Number(process.env.SMTP_PORT ?? 587);
    const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const submittedAt = payload.submittedAtIso ?? new Date().toISOString();
    const normalizedBudget = payload.budget ? `$${Number(payload.budget).toLocaleString()}+` : "Not provided";
    const images = payload.images ?? [];

    const textLines = [
      "New quote request from Midtown Painting Home Services website",
      `Submitted at: ${submittedAt}`,
      "",
      `Full name: ${payload.fullName}`,
      `Phone: ${payload.phone}`,
      `Email: ${payload.email}`,
      `Address: ${payload.addressLine1}`,
      `City: ${payload.city}`,
      `Province/State: ${payload.provinceState}`,
      `Postal/ZIP: ${payload.postalCode}`,
      `Country: ${payload.country}`,
      `Project type: ${payload.projectType}`,
      `Project details: ${payload.projectDetails}`,
      `Budget expectation: ${normalizedBudget}`,
      `Call goal: ${payload.callGoal || "Not provided"}`,
      `Uploaded images: ${images.length} file(s)`,
    ];

    const htmlRows = [
      ["Submitted at", submittedAt],
      ["Full name", payload.fullName],
      ["Phone", payload.phone],
      ["Email", payload.email],
      ["Address", payload.addressLine1],
      ["City", payload.city],
      ["Province/State", payload.provinceState],
      ["Postal/ZIP", payload.postalCode],
      ["Country", payload.country],
      ["Project type", payload.projectType],
      ["Project details", payload.projectDetails],
      ["Budget expectation", normalizedBudget],
      ["Call goal", payload.callGoal || "Not provided"],
      ["Uploaded images", `${images.length} file(s)`],
    ].map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`
    );

    const attachments = images.map((image, index) => ({
      filename: (image.filename || `image-${index + 1}`).replace(/[^\w.\-() ]+/g, "_"),
      content: Buffer.from(image.contentBase64, "base64"),
      contentType: image.contentType,
    }));

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.QUOTE_TO_EMAIL,
      replyTo: payload.email,
      subject: `New Quote Request - Midtown Painting Home Services - ${payload.fullName}`,
      text: textLines.join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
          <h2 style="margin:0 0 16px;">New Quote Request</h2>
          <p style="margin:0 0 16px;">A new request was submitted from the Midtown Painting Home Services form.</p>
          <table style="border-collapse:collapse;width:100%;max-width:760px;">
            ${htmlRows.join("")}
          </table>
        </div>
      `,
      attachments,
    });

    logger.info("Quote email sent from Trigger task", {
      accepted: info.accepted,
      messageId: info.messageId,
      to: process.env.QUOTE_TO_EMAIL,
    });

    return {
      accepted: info.accepted,
      messageId: info.messageId,
      to: process.env.QUOTE_TO_EMAIL,
    };
  },
});
