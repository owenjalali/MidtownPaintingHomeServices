export type FieldRepOption = {
  id: string;
  name: string;
};

export type FieldLeadStatus =
  | "new"
  | "initial_sms_queued"
  | "initial_sms_sent"
  | "initial_sms_failed"
  | "booked"
  | "cancelled"
  | "expired"
  | "closed_no_booking";

export type FieldLeadContextState = "open" | "booked" | "expired" | "closed";

export type FieldLeadCreateRequest = {
  accessKey: string;
  repId: string;
  fullName: string;
  phone: string;
  address: string;
  projectNotes: string;
};

export type FieldLeadCreateResponse = {
  ok: true;
  message?: string;
  leadId: string;
  status: FieldLeadStatus;
  bookingExpiresAtIso: string;
  initialSmsTaskRunId: string | null;
  initialSmsScheduledForIso: string;
  manualTest?: {
    bookingLink: string;
    outboundOverrideEnabled: boolean;
  };
};

export type FieldLeadContextResponse = {
  ok: true;
  message?: string;
  state: FieldLeadContextState;
  status: FieldLeadStatus;
  lead: {
    leadId: string;
    customerName: string;
    customerPhoneE164: string;
    customerAddress: string;
    repId: string;
    repName: string;
    projectNotes: string;
    bookingExpiresAtIso: string;
  };
  booking?: {
    bookedAtIso: string;
    slotStartIso: string;
    eventId: string;
    displayDate: string;
    displayTime: string;
    clientManageLink: string;
  };
};

export type FieldLeadBookingRequest = {
  token: string;
  slotStartIso: string;
};

export type FieldLeadBookingResponse = {
  ok: true;
  message: string;
  leadId: string;
  leadLogUpdated: boolean;
  booking: {
    eventId: string | null;
    displayDate: string;
    displayTime: string;
    timezone: string;
    startIso: string;
    endIso: string;
    manageLinks: {
      client: string | null;
      carter: string | null;
    };
  };
  notifications: {
    ownerEmailAttempted: boolean;
    ownerEmailSent: boolean;
    ownerSmsAttempted: boolean;
    ownerSmsSent: boolean;
    customerSmsAttempted: boolean;
    customerSmsSent: boolean;
  };
  reminders: Array<{
    reminderMinutesBefore: number;
    sendEmail: boolean;
    sendSms: boolean;
    reminderAtIso: string;
    reminderAtLabel: string;
    runId: string | null;
    delayApplied: boolean;
  }>;
};
