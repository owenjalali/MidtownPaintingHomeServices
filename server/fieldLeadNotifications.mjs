import nodemailer from "nodemailer";
import twilio from "twilio";
import { normalizePhoneForTwilio, normalizeText } from "./fieldLeadCore.mjs";
import {
  getFieldLeadPreviewOutboundTargets,
  getFieldLeadSmtpConfig,
  getFieldLeadTwilioConfig,
  getMissingFieldLeadSmtpEnvVars,
  getMissingFieldLeadTwilioEnvVars,
} from "./fieldLeadEnv.mjs";

const getFirstName = (fullName) => {
  const firstToken = normalizeText(fullName).split(/\s+/)[0];
  return firstToken || "there";
};

const summarizeNotes = (notes) => {
  const normalized = normalizeText(notes).replace(/\s+/g, " ");
  if (!normalized) {
    return "No project notes provided.";
  }

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137)}...`;
};

const createSmtpTransporter = () => {
  const smtpConfig = getFieldLeadSmtpConfig();

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
};

const createTwilioClient = () => {
  const twilioConfig = getFieldLeadTwilioConfig();
  return twilio(twilioConfig.accountSid, twilioConfig.authToken);
};

const createNotificationResult = () => ({
  ownerEmailAttempted: false,
  ownerEmailSent: false,
  ownerSmsAttempted: false,
  ownerSmsSent: false,
  customerSmsAttempted: false,
  customerSmsSent: false,
});

export const getFieldLeadNotificationAvailability = () => ({
  smtpConfigured: getMissingFieldLeadSmtpEnvVars().length === 0,
  twilioConfigured: getMissingFieldLeadTwilioEnvVars().length === 0,
});

export const resolveFieldLeadEmailRecipient = (to) => {
  const normalizedTo = normalizeText(to);
  const override = getFieldLeadPreviewOutboundTargets();
  if (override.enabled && override.email) {
    return override.email;
  }
  return normalizedTo;
};

export const resolveFieldLeadSmsRecipient = (to) => {
  const normalizedTo = normalizePhoneForTwilio(to);
  const override = getFieldLeadPreviewOutboundTargets();
  if (override.enabled && override.phone) {
    return normalizePhoneForTwilio(override.phone);
  }
  return normalizedTo;
};

export const buildFieldInitialSmsBody = ({ customerName, bookingLink }) =>
  [
    `Hi ${getFirstName(customerName)}, thanks for speaking with Carter's team.`,
    "Book your 15-minute call with Carter here:",
    normalizeText(bookingLink),
  ].join("\n");

export const buildFieldBookingConfirmationSmsBody = ({
  customerName,
  displayDate,
  displayTime,
  manageLink,
}) =>
  [
    `Hi ${getFirstName(customerName)}, your 15-minute call with Carter is booked for ${normalizeText(
      displayDate
    )}, ${normalizeText(displayTime)}.`,
    "Manage your booking here:",
    normalizeText(manageLink) || "Manage link unavailable. Contact Carter's team for help.",
  ].join("\n");

export const buildFieldOwnerBookingEmail = ({
  customerName,
  customerPhone,
  customerAddress,
  displayDate,
  displayTime,
  repName,
  projectNotes,
  clientManageLink,
  carterManageLink,
  eventId,
}) => ({
  subject: `New Field Lead Consultation Booked - ${normalizeText(customerName)}`,
  text: [
    `A field lead consultation was booked with ${normalizeText(customerName)}.`,
    "",
    `When: ${normalizeText(displayDate)}, ${normalizeText(displayTime)}`,
    `Customer phone: ${normalizeText(customerPhone) || "Unavailable"}`,
    `Address: ${normalizeText(customerAddress) || "Not provided"}`,
    `Captured by: ${normalizeText(repName) || "Unknown rep"}`,
    "",
    "Project notes:",
    normalizeText(projectNotes) || "Not provided",
    "",
    `Calendar event id: ${normalizeText(eventId) || "Unavailable"}`,
    "",
    "Manage booking (Carter):",
    normalizeText(carterManageLink) || "Unavailable",
    "",
    "Manage booking (Customer):",
    normalizeText(clientManageLink) || "Unavailable",
  ].join("\n"),
});

export const buildFieldOwnerBookingSmsBody = ({
  customerName,
  customerAddress,
  displayDate,
  displayTime,
  repName,
  projectNotes,
}) =>
  [
    `Midtown: Field lead booked with ${normalizeText(customerName)} for ${normalizeText(
      displayDate
    )}, ${normalizeText(displayTime)}.`,
    `Address: ${normalizeText(customerAddress) || "Not provided"}.`,
    `Rep: ${normalizeText(repName) || "Unknown rep"}.`,
    `Notes: ${summarizeNotes(projectNotes)}`,
  ].join(" ");

export const buildFieldReminderNotifications = ({
  customerName,
  customerAddress,
  displayDate,
  displayTime,
  reminderMinutesBefore,
  repName,
  projectNotes,
}) => {
  const normalizedReminderMinutes = Number(reminderMinutesBefore) || 0;
  return {
    ownerSubject: `Reminder: Field lead call in ${normalizedReminderMinutes} minutes`,
    ownerText: [
      `Reminder: field lead call with ${normalizeText(customerName)} starts in ${normalizedReminderMinutes} minutes.`,
      "",
      `When: ${normalizeText(displayDate)}, ${normalizeText(displayTime)}`,
      `Captured by: ${normalizeText(repName) || "Unknown rep"}`,
      "",
      `Address: ${normalizeText(customerAddress) || "Not provided"}`,
      "",
      "Project notes:",
      normalizeText(projectNotes) || "Not provided",
    ].join("\n"),
    ownerSmsBody: [
      `Midtown reminder: ${normalizeText(customerName)} in ${normalizedReminderMinutes}m.`,
      `${normalizeText(displayDate)}, ${normalizeText(displayTime)}.`,
      `Address: ${normalizeText(customerAddress) || "Not provided"}.`,
      `Rep: ${normalizeText(repName) || "Unknown rep"}.`,
      `Notes: ${summarizeNotes(projectNotes)}`,
    ].join(" "),
    customerSmsBody: [
      `Hi ${getFirstName(customerName)}, reminder that your call with Carter starts in ${normalizedReminderMinutes} minutes.`,
      `${normalizeText(displayDate)}, ${normalizeText(displayTime)}.`,
    ].join(" "),
  };
};

export const buildFieldCustomerFollowupSmsBody = ({
  customerName,
  bookingLink,
}) =>
  [
    `Hi ${getFirstName(customerName)}, just checking in.`,
    "You can still book your 15-minute call with Carter here:",
    normalizeText(bookingLink),
  ].join("\n");

export const buildFieldOwnerFollowupEmail = ({
  customerName,
  customerPhone,
  customerAddress,
  repName,
  projectNotes,
  bookingLink,
  elapsedLabel,
  currentStatus,
}) => ({
  subject: `Field lead follow-up needed - ${normalizeText(customerName)}`,
  text: [
    `An unbooked field lead follow-up was sent to ${normalizeText(customerName)}.`,
    "",
    `Customer phone: ${normalizeText(customerPhone) || "Unavailable"}`,
    `Address: ${normalizeText(customerAddress) || "Not provided"}`,
    `Captured by: ${normalizeText(repName) || "Unknown rep"}`,
    `Elapsed since first SMS: ${normalizeText(elapsedLabel) || "Unavailable"}`,
    `Current sheet status: ${normalizeText(currentStatus) || "Unavailable"}`,
    "",
    "Project notes:",
    normalizeText(projectNotes) || "Not provided",
    "",
    "Booking link:",
    normalizeText(bookingLink) || "Unavailable",
  ].join("\n"),
});

export const buildFieldOwnerFollowupSmsBody = ({
  customerName,
  customerPhone,
  customerAddress,
  repName,
  projectNotes,
  elapsedLabel,
  currentStatus,
  bookingLink,
}) =>
  [
    `Midtown follow-up: ${normalizeText(customerName)} is still unbooked after ${normalizeText(
      elapsedLabel
    )}.`,
    `Phone: ${normalizeText(customerPhone) || "Unavailable"}.`,
    `Address: ${normalizeText(customerAddress) || "Not provided"}.`,
    `Rep: ${normalizeText(repName) || "Unknown rep"}.`,
    `Status: ${normalizeText(currentStatus) || "Unavailable"}.`,
    `Notes: ${summarizeNotes(projectNotes)}`,
    normalizeText(bookingLink),
  ].join(" ");

export const buildFieldManageNotifications = ({
  action,
  actor,
  customerName,
  reason,
  previousDisplay,
  nextDisplay,
}) => {
  const actorLabel = actor === "carter" ? "Carter" : "Customer";
  const normalizedReason = normalizeText(reason).replace(/\s+/g, " ");
  const normalizedAction = action === "rescheduled" ? "rescheduled" : "cancelled";
  const customerActionSentence =
    normalizedAction === "cancelled"
      ? `Your consultation was cancelled by ${actorLabel.toLowerCase()}.`
      : `Your consultation was rescheduled by ${actorLabel.toLowerCase()}.`;

  return {
    ownerSubject:
      normalizedAction === "cancelled"
        ? `Field lead consultation cancelled - ${normalizeText(customerName)}`
        : `Field lead consultation rescheduled - ${normalizeText(customerName)}`,
    ownerText: [
      `${normalizeText(customerName)} was ${normalizedAction} by ${actorLabel}.`,
      "",
      `Previous time: ${normalizeText(previousDisplay?.displayDate)}, ${normalizeText(
        previousDisplay?.displayTime
      )}`,
      nextDisplay
        ? `New time: ${normalizeText(nextDisplay.displayDate)}, ${normalizeText(
            nextDisplay.displayTime
          )}`
        : "New time: N/A",
      `Reason: ${normalizedReason || "Not provided"}`,
    ].join("\n"),
    ownerSmsBody:
      normalizedAction === "cancelled"
        ? `Midtown: ${normalizeText(customerName)} cancelled the field lead consultation. Reason: ${
            normalizedReason || "Not provided"
          }`
        : `Midtown: ${normalizeText(customerName)} rescheduled the field lead consultation to ${normalizeText(
            nextDisplay?.displayDate
          )}, ${normalizeText(nextDisplay?.displayTime)}. Reason: ${
            normalizedReason || "Not provided"
          }`,
    customerSmsBody:
      normalizedAction === "cancelled"
        ? `${customerActionSentence} Reason: ${normalizedReason || "Not provided"}`
        : `${customerActionSentence} New time: ${normalizeText(nextDisplay?.displayDate)}, ${normalizeText(
            nextDisplay?.displayTime
          )}. Reason: ${normalizedReason || "Not provided"}`,
  };
};

const sendEmailIfPossible = async ({ to, subject, text, replyTo }) => {
  const normalizedTo = resolveFieldLeadEmailRecipient(to);
  if (!normalizedTo) {
    return false;
  }

  if (getMissingFieldLeadSmtpEnvVars().length > 0) {
    return false;
  }

  const smtpConfig = getFieldLeadSmtpConfig();
  const transporter = createSmtpTransporter();
  await transporter.sendMail({
    from: smtpConfig.from,
    to: normalizedTo,
    replyTo: normalizeText(replyTo) || undefined,
    subject,
    text,
  });
  return true;
};

const sendSmsIfPossible = async ({ to, body }) => {
  const normalizedTo = resolveFieldLeadSmsRecipient(to);
  if (!normalizedTo) {
    return false;
  }

  if (getMissingFieldLeadTwilioEnvVars().length > 0) {
    return false;
  }

  const twilioConfig = getFieldLeadTwilioConfig();
  const twilioClient = createTwilioClient();
  await twilioClient.messages.create({
    from: twilioConfig.fromNumber,
    to: normalizedTo,
    body,
  });
  return true;
};

export const sendFieldLeadInitialSmsDirect = async ({ customerName, customerPhone, bookingLink }) => {
  return sendSmsIfPossible({
    to: customerPhone,
    body: buildFieldInitialSmsBody({
      customerName,
      bookingLink,
    }),
  });
};

export const sendFieldLeadBookingNotificationsDirect = async ({
  customerName,
  customerPhone,
  customerAddress,
  displayDate,
  displayTime,
  repName,
  projectNotes,
  ownerEmail,
  ownerPhone,
  clientManageLink,
  carterManageLink,
  eventId,
}) => {
  const notifications = createNotificationResult();
  const ownerEmailPayload = buildFieldOwnerBookingEmail({
    customerName,
    customerPhone,
    customerAddress,
    displayDate,
    displayTime,
    repName,
    projectNotes,
    clientManageLink,
    carterManageLink,
    eventId,
  });
  const ownerSmsBody = buildFieldOwnerBookingSmsBody({
    customerName,
    customerAddress,
    displayDate,
    displayTime,
    repName,
    projectNotes,
  });
  const customerSmsBody = buildFieldBookingConfirmationSmsBody({
    customerName,
    displayDate,
    displayTime,
    manageLink: clientManageLink,
  });

  notifications.ownerEmailAttempted = Boolean(normalizeText(ownerEmail));
  try {
    notifications.ownerEmailSent = await sendEmailIfPossible({
      to: ownerEmail,
      subject: ownerEmailPayload.subject,
      text: ownerEmailPayload.text,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send owner booking email", error);
  }

  notifications.ownerSmsAttempted = Boolean(normalizePhoneForTwilio(ownerPhone));
  try {
    notifications.ownerSmsSent = await sendSmsIfPossible({
      to: ownerPhone,
      body: ownerSmsBody,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send owner booking sms", error);
  }

  notifications.customerSmsAttempted = Boolean(normalizePhoneForTwilio(customerPhone));
  try {
    notifications.customerSmsSent = await sendSmsIfPossible({
      to: customerPhone,
      body: customerSmsBody,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send customer booking sms", error);
  }

  return notifications;
};

export const sendFieldLeadReminderNotificationsDirect = async ({
  customerName,
  customerPhone,
  customerAddress,
  ownerEmail,
  ownerPhone,
  displayDate,
  displayTime,
  reminderMinutesBefore,
  repName,
  projectNotes,
  sendOwnerEmail = true,
  sendSms = true,
}) => {
  const notifications = createNotificationResult();
  const reminderPayload = buildFieldReminderNotifications({
    customerName,
    customerAddress,
    displayDate,
    displayTime,
    reminderMinutesBefore,
    repName,
    projectNotes,
  });

  if (sendOwnerEmail) {
    notifications.ownerEmailAttempted = Boolean(normalizeText(ownerEmail));
    try {
      notifications.ownerEmailSent = await sendEmailIfPossible({
        to: ownerEmail,
        subject: reminderPayload.ownerSubject,
        text: reminderPayload.ownerText,
      });
    } catch (error) {
      console.warn("[field-lead] unable to send owner reminder email", error);
    }
  }

  if (sendSms) {
    notifications.ownerSmsAttempted = Boolean(normalizePhoneForTwilio(ownerPhone));
    try {
      notifications.ownerSmsSent = await sendSmsIfPossible({
        to: ownerPhone,
        body: reminderPayload.ownerSmsBody,
      });
    } catch (error) {
      console.warn("[field-lead] unable to send owner reminder sms", error);
    }

    notifications.customerSmsAttempted = Boolean(normalizePhoneForTwilio(customerPhone));
    try {
      notifications.customerSmsSent = await sendSmsIfPossible({
        to: customerPhone,
        body: reminderPayload.customerSmsBody,
      });
    } catch (error) {
      console.warn("[field-lead] unable to send customer reminder sms", error);
    }
  }

  return notifications;
};

export const sendFieldLeadFollowupNotificationsDirect = async ({
  customerName,
  customerPhone,
  customerAddress,
  ownerEmail,
  ownerPhone,
  repName,
  projectNotes,
  bookingLink,
  elapsedLabel,
  currentStatus,
}) => {
  const notifications = createNotificationResult();
  const ownerEmailPayload = buildFieldOwnerFollowupEmail({
    customerName,
    customerPhone,
    customerAddress,
    repName,
    projectNotes,
    bookingLink,
    elapsedLabel,
    currentStatus,
  });
  const ownerSmsBody = buildFieldOwnerFollowupSmsBody({
    customerName,
    customerPhone,
    customerAddress,
    repName,
    projectNotes,
    elapsedLabel,
    currentStatus,
    bookingLink,
  });
  const customerSmsBody = buildFieldCustomerFollowupSmsBody({
    customerName,
    bookingLink,
  });

  notifications.ownerEmailAttempted = Boolean(resolveFieldLeadEmailRecipient(ownerEmail));
  try {
    notifications.ownerEmailSent = await sendEmailIfPossible({
      to: ownerEmail,
      subject: ownerEmailPayload.subject,
      text: ownerEmailPayload.text,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send owner follow-up email", error);
  }

  notifications.ownerSmsAttempted = Boolean(resolveFieldLeadSmsRecipient(ownerPhone));
  try {
    notifications.ownerSmsSent = await sendSmsIfPossible({
      to: ownerPhone,
      body: ownerSmsBody,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send owner follow-up sms", error);
  }

  notifications.customerSmsAttempted = Boolean(resolveFieldLeadSmsRecipient(customerPhone));
  try {
    notifications.customerSmsSent = await sendSmsIfPossible({
      to: customerPhone,
      body: customerSmsBody,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send customer follow-up sms", error);
  }

  return notifications;
};

export const sendFieldLeadManageNotificationsDirect = async ({
  action,
  actor,
  customerName,
  customerPhone,
  ownerEmail,
  ownerPhone,
  reason,
  previousDisplay,
  nextDisplay,
}) => {
  const notifications = createNotificationResult();
  const managePayload = buildFieldManageNotifications({
    action,
    actor,
    customerName,
    reason,
    previousDisplay,
    nextDisplay,
  });

  notifications.ownerEmailAttempted = Boolean(normalizeText(ownerEmail));
  try {
    notifications.ownerEmailSent = await sendEmailIfPossible({
      to: ownerEmail,
      subject: managePayload.ownerSubject,
      text: managePayload.ownerText,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send owner manage email", error);
  }

  notifications.ownerSmsAttempted = Boolean(normalizePhoneForTwilio(ownerPhone));
  try {
    notifications.ownerSmsSent = await sendSmsIfPossible({
      to: ownerPhone,
      body: managePayload.ownerSmsBody,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send owner manage sms", error);
  }

  notifications.customerSmsAttempted = Boolean(normalizePhoneForTwilio(customerPhone));
  try {
    notifications.customerSmsSent = await sendSmsIfPossible({
      to: customerPhone,
      body: managePayload.customerSmsBody,
    });
  } catch (error) {
    console.warn("[field-lead] unable to send customer manage sms", error);
  }

  return notifications;
};
