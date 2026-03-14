import { DateTime } from "luxon";
import {
  FIELD_LEAD_ID_KEY,
  normalizeText,
} from "./fieldLeadCore.mjs";

const TORONTO_TIMEZONE = "America/Toronto";
const CRM_HEADER_BACKGROUND = { red: 0.96, green: 0.86, blue: 0.72 };
const CRM_HEADER_TEXT = { red: 0.29, green: 0.18, blue: 0.09 };
const CRM_FIRST_BAND = { red: 0.99, green: 0.97, blue: 0.94 };
const CRM_SECOND_BAND = { red: 0.97, green: 0.93, blue: 0.87 };
const CRM_RULE_COLORS = Object.freeze({
  green: { red: 0.84, green: 0.94, blue: 0.84 },
  yellow: { red: 1, green: 0.95, blue: 0.74 },
  red: { red: 0.98, green: 0.84, blue: 0.84 },
  blue: { red: 0.84, green: 0.91, blue: 0.98 },
  gray: { red: 0.9, green: 0.9, blue: 0.9 },
  orange: { red: 0.99, green: 0.88, blue: 0.74 },
});

export const FIELD_LEAD_CRM_HEADERS = Object.freeze([
  "Lead ID",
  "Created",
  "Rep",
  "Homeowner",
  "Phone",
  "Address",
  "Project Notes",
  "Lead Status",
  "Initial SMS",
  "Follow-up",
  "Appointment Status",
  "Appointment Date",
  "Appointment Time",
  "Last Managed By",
  "Last Managed At",
  "Reason",
  "Customer Link",
  "Carter Link",
  "Closed At",
  "Closed Reason",
  "Last Error",
]);

const CRM_COLUMN_INDEX = Object.freeze({
  address: 5,
  leadStatus: 7,
  initialSms: 8,
  followup: 9,
  appointmentStatus: 10,
  projectNotes: 6,
  reason: 15,
  lastError: 20,
});

const TITLE_CASE = new Intl.DateTimeFormat("en-CA", {
  timeZone: TORONTO_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatDisplayDateTime = (iso) => {
  const parsed = DateTime.fromISO(normalizeText(iso), { setZone: true }).setZone(TORONTO_TIMEZONE);
  if (!parsed.isValid) {
    return "";
  }

  return `${TITLE_CASE.format(parsed.toJSDate())} ${parsed.toFormat("h:mm a")}`;
};

const formatDisplayDate = (iso) => {
  const parsed = DateTime.fromISO(normalizeText(iso), { setZone: true }).setZone(TORONTO_TIMEZONE);
  if (!parsed.isValid) {
    return "";
  }

  return TITLE_CASE.format(parsed.toJSDate());
};

const formatDisplayTime = (iso) => {
  const parsed = DateTime.fromISO(normalizeText(iso), { setZone: true }).setZone(TORONTO_TIMEZONE);
  if (!parsed.isValid) {
    return "";
  }

  return parsed.toFormat("h:mm a");
};

const humanizeToken = (value) =>
  normalizeText(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const buildLinkFormula = (url) => {
  const normalizedUrl = normalizeText(url);
  if (!normalizedUrl) {
    return "";
  }

  return `=HYPERLINK("${normalizedUrl.replace(/"/g, '""')}","Open")`;
};

const formatManagedBy = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized === "client") {
    return "Customer";
  }

  if (normalized === "carter") {
    return "Carter";
  }

  return humanizeToken(normalized);
};

export const getFieldLeadCrmTabName = (rawTabName) => `${normalizeText(rawTabName)} CRM`;

export const buildFieldLeadCrmValues = (row) => [
  normalizeText(row?.leadId),
  formatDisplayDateTime(row?.createdAtIso),
  normalizeText(row?.repName),
  normalizeText(row?.customerName),
  normalizeText(row?.customerPhoneE164),
  normalizeText(row?.customerAddress),
  normalizeText(row?.projectNotes),
  humanizeToken(row?.status),
  humanizeToken(row?.initialSmsStatus),
  humanizeToken(row?.followupStatus),
  humanizeToken(row?.appointmentStatus),
  formatDisplayDate(row?.bookedSlotStartIso),
  formatDisplayTime(row?.bookedSlotStartIso),
  formatManagedBy(row?.lastManagedBy),
  formatDisplayDateTime(row?.lastManagedAtIso),
  normalizeText(row?.lastManagedReason),
  buildLinkFormula(row?.clientManageLink),
  buildLinkFormula(row?.carterManageLink),
  formatDisplayDateTime(row?.closedAtIso),
  normalizeText(row?.closedReason),
  normalizeText(row?.lastError),
];

const toSortableTimestamp = (iso) => {
  const parsed = DateTime.fromISO(normalizeText(iso), { setZone: true }).toMillis();
  return Number.isFinite(parsed) ? parsed : -Infinity;
};

export const sortFieldLeadCrmRows = (rows) =>
  [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const createdDelta = toSortableTimestamp(right?.createdAtIso) - toSortableTimestamp(left?.createdAtIso);
    if (createdDelta !== 0) {
      return createdDelta;
    }

    return Number(right?.rowNumber || 0) - Number(left?.rowNumber || 0);
  });

const getColumnLetter = (columnNumber) => {
  let current = Number(columnNumber);
  let output = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    current = Math.floor((current - 1) / 26);
  }
  return output || "A";
};

const quoteSheetName = (tabName) => {
  const normalized = normalizeText(tabName);
  return normalized.includes(" ") ? `'${normalized}'` : normalized;
};

const findSheetByTitle = (metadata, title) =>
  Array.isArray(metadata?.sheets)
    ? metadata.sheets.find((sheet) => normalizeText(sheet?.properties?.title) === normalizeText(title)) || null
    : null;

const getMetadata = async (sheetsClient, spreadsheetId) =>
  sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: [
      "sheets.properties.sheetId",
      "sheets.properties.title",
      "sheets.properties.hidden",
      "sheets.properties.index",
      "sheets.properties.gridProperties.rowCount",
      "sheets.conditionalFormats",
      "sheets.bandedRanges.bandedRangeId",
    ].join(","),
  });

export const ensureFieldLeadTabs = async ({ sheetsClient, spreadsheetId, rawTabName }) => {
  const crmTabName = getFieldLeadCrmTabName(rawTabName);
  let metadata = (await getMetadata(sheetsClient, spreadsheetId)).data;
  let rawSheet = findSheetByTitle(metadata, rawTabName);
  let crmSheet = findSheetByTitle(metadata, crmTabName);

  const requests = [];
  if (!rawSheet) {
    requests.push({
      addSheet: {
        properties: {
          title: rawTabName,
        },
      },
    });
  }
  if (!crmSheet) {
    requests.push({
      addSheet: {
        properties: {
          title: crmTabName,
        },
      },
    });
  }

  if (requests.length > 0) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests,
      },
    });
    metadata = (await getMetadata(sheetsClient, spreadsheetId)).data;
    rawSheet = findSheetByTitle(metadata, rawTabName);
    crmSheet = findSheetByTitle(metadata, crmTabName);
  }

  const presentationRequests = [];
  const rawIndex = Number(rawSheet?.properties?.index ?? 0);
  const crmIndex = Number(crmSheet?.properties?.index ?? rawIndex);

  if (crmSheet?.properties?.hidden) {
    presentationRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: crmSheet.properties.sheetId,
          hidden: false,
        },
        fields: "hidden",
      },
    });
  }

  if (crmIndex >= rawIndex) {
    presentationRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: crmSheet.properties.sheetId,
          index: rawIndex,
        },
        fields: "index",
      },
    });
  }

  if (!rawSheet?.properties?.hidden) {
    presentationRequests.push({
      updateSheetProperties: {
        properties: {
          sheetId: rawSheet.properties.sheetId,
          hidden: true,
        },
        fields: "hidden",
      },
    });
  }

  if (presentationRequests.length > 0) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: presentationRequests,
      },
    });
    metadata = (await getMetadata(sheetsClient, spreadsheetId)).data;
    rawSheet = findSheetByTitle(metadata, rawTabName);
    crmSheet = findSheetByTitle(metadata, crmTabName);
  }

  return {
    metadata,
    rawSheet,
    crmSheet,
    crmTabName,
  };
};

const buildConditionalFormatRule = ({ sheetId, columnIndex, value, color, rowCount }) => ({
  addConditionalFormatRule: {
    index: 0,
    rule: {
      ranges: [
        {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
      ],
      booleanRule: {
        condition: {
          type: "CUSTOM_FORMULA",
          values: [
            {
              userEnteredValue: `=$${getColumnLetter(columnIndex + 1)}2="${value}"`,
            },
          ],
        },
        format: {
          backgroundColor: color,
        },
      },
    },
  },
});

const buildNonEmptyRule = ({ sheetId, columnIndex, rowCount }) => ({
  addConditionalFormatRule: {
    index: 0,
    rule: {
      ranges: [
        {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1,
        },
      ],
      booleanRule: {
        condition: {
          type: "CUSTOM_FORMULA",
          values: [
            {
              userEnteredValue: `=LEN($${getColumnLetter(columnIndex + 1)}2)>0`,
            },
          ],
        },
        format: {
          backgroundColor: CRM_RULE_COLORS.red,
        },
      },
    },
  },
});

const buildCrmPresentationRequests = ({ crmSheet, rowCount }) => {
  const sheetId = crmSheet.properties.sheetId;
  const requests = [];
  const existingRuleCount = Array.isArray(crmSheet.conditionalFormats) ? crmSheet.conditionalFormats.length : 0;
  const existingBanding = Array.isArray(crmSheet.bandedRanges) ? crmSheet.bandedRanges : [];

  for (let index = existingRuleCount - 1; index >= 0; index -= 1) {
    requests.push({
      deleteConditionalFormatRule: {
        sheetId,
        index,
      },
    });
  }

  for (const bandedRange of existingBanding) {
    requests.push({
      deleteBanding: {
        bandedRangeId: bandedRange.bandedRangeId,
      },
    });
  }

  requests.push(
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: FIELD_LEAD_CRM_HEADERS.length,
          },
        },
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: rowCount,
          startColumnIndex: 0,
          endColumnIndex: FIELD_LEAD_CRM_HEADERS.length,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: FIELD_LEAD_CRM_HEADERS.length,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: CRM_HEADER_BACKGROUND,
            textFormat: {
              bold: true,
              foregroundColor: CRM_HEADER_TEXT,
            },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: CRM_COLUMN_INDEX.address,
          endColumnIndex: CRM_COLUMN_INDEX.address + 1,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat.wrapStrategy",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: CRM_COLUMN_INDEX.projectNotes,
          endColumnIndex: CRM_COLUMN_INDEX.projectNotes + 1,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat.wrapStrategy",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: CRM_COLUMN_INDEX.reason,
          endColumnIndex: CRM_COLUMN_INDEX.reason + 1,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat.wrapStrategy",
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: CRM_COLUMN_INDEX.lastError,
          endColumnIndex: CRM_COLUMN_INDEX.lastError + 1,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat.wrapStrategy",
      },
    },
    {
      addBanding: {
        bandedRange: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: FIELD_LEAD_CRM_HEADERS.length,
          },
          rowProperties: {
            headerColor: CRM_HEADER_BACKGROUND,
            firstBandColor: CRM_FIRST_BAND,
            secondBandColor: CRM_SECOND_BAND,
          },
        },
      },
    },
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: FIELD_LEAD_CRM_HEADERS.length,
        },
      },
    }
  );

  for (const [columnIndex, pixelSize] of [
    [CRM_COLUMN_INDEX.address, 220],
    [CRM_COLUMN_INDEX.projectNotes, 320],
    [CRM_COLUMN_INDEX.reason, 220],
    [CRM_COLUMN_INDEX.lastError, 280],
  ]) {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: columnIndex,
          endIndex: columnIndex + 1,
        },
        properties: {
          pixelSize,
        },
        fields: "pixelSize",
      },
    });
  }

  for (const [columnIndex, value, color] of [
    [CRM_COLUMN_INDEX.leadStatus, "Booked", CRM_RULE_COLORS.green],
    [CRM_COLUMN_INDEX.leadStatus, "Initial Sms Queued", CRM_RULE_COLORS.yellow],
    [CRM_COLUMN_INDEX.leadStatus, "Initial Sms Sent", CRM_RULE_COLORS.blue],
    [CRM_COLUMN_INDEX.leadStatus, "Cancelled", CRM_RULE_COLORS.red],
    [CRM_COLUMN_INDEX.leadStatus, "Closed No Booking", CRM_RULE_COLORS.gray],
    [CRM_COLUMN_INDEX.leadStatus, "Expired", CRM_RULE_COLORS.gray],
    [CRM_COLUMN_INDEX.leadStatus, "Initial Sms Failed", CRM_RULE_COLORS.orange],
    [CRM_COLUMN_INDEX.initialSms, "Sent", CRM_RULE_COLORS.green],
    [CRM_COLUMN_INDEX.initialSms, "Queued", CRM_RULE_COLORS.yellow],
    [CRM_COLUMN_INDEX.initialSms, "Failed", CRM_RULE_COLORS.red],
    [CRM_COLUMN_INDEX.followup, "Sent", CRM_RULE_COLORS.green],
    [CRM_COLUMN_INDEX.followup, "Queued", CRM_RULE_COLORS.yellow],
    [CRM_COLUMN_INDEX.followup, "Skipped", CRM_RULE_COLORS.gray],
    [CRM_COLUMN_INDEX.followup, "Failed", CRM_RULE_COLORS.red],
    [CRM_COLUMN_INDEX.appointmentStatus, "Scheduled", CRM_RULE_COLORS.green],
    [CRM_COLUMN_INDEX.appointmentStatus, "Rescheduled", CRM_RULE_COLORS.blue],
    [CRM_COLUMN_INDEX.appointmentStatus, "Cancelled", CRM_RULE_COLORS.red],
  ]) {
    requests.push(buildConditionalFormatRule({ sheetId, columnIndex, value, color, rowCount }));
  }

  requests.push(
    buildNonEmptyRule({
      sheetId,
      columnIndex: CRM_COLUMN_INDEX.lastError,
      rowCount,
    })
  );

  return requests;
};

export const syncFieldLeadCrmTabs = async ({
  sheetsClient,
  spreadsheetId,
  rawTabName,
  rawRows,
}) => {
  const { crmSheet, crmTabName } = await ensureFieldLeadTabs({
    sheetsClient,
    spreadsheetId,
    rawTabName,
  });
  const crmRows = sortFieldLeadCrmRows(rawRows);

  const crmValues = [
    FIELD_LEAD_CRM_HEADERS,
    ...crmRows.map((row) => buildFieldLeadCrmValues(row)),
  ];
  const crmColumnLetter = getColumnLetter(FIELD_LEAD_CRM_HEADERS.length);

  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteSheetName(crmTabName)}!A:${crmColumnLetter}`,
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetName(crmTabName)}!A1:${crmColumnLetter}${crmValues.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: crmValues,
    },
  });

  const refreshed = await getMetadata(sheetsClient, spreadsheetId);
  const refreshedCrmSheet = findSheetByTitle(refreshed.data, crmTabName);
  const rowCount = Math.max(
    Number(refreshedCrmSheet?.properties?.gridProperties?.rowCount ?? 0),
    crmValues.length + 25,
    2
  );

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: buildCrmPresentationRequests({
        crmSheet: refreshedCrmSheet,
        rowCount,
      }),
    },
  });

  return {
    crmTabName,
    rawRowCount: rawRows.length,
  };
};

export const syncFieldLeadRowPatch = async ({
  leadId = "",
  eventId = "",
  privateProps = {},
  patch = {},
  getFieldLeadRow,
  getFieldLeadRowByBookedEventId,
  updateFieldLeadRowByNumber,
}) => {
  let matchedBy = "";
  let row = null;

  const normalizedLeadId = normalizeText(leadId);
  if (normalizedLeadId && typeof getFieldLeadRow === "function") {
    row = await getFieldLeadRow(normalizedLeadId);
    if (row?.rowNumber) {
      matchedBy = "leadId";
    }
  }

  const privateLeadId = normalizeText(privateProps?.[FIELD_LEAD_ID_KEY]);
  if (!row?.rowNumber && privateLeadId && typeof getFieldLeadRow === "function") {
    row = await getFieldLeadRow(privateLeadId);
    if (row?.rowNumber) {
      matchedBy = "privateProps";
    }
  }

  const normalizedEventId = normalizeText(eventId);
  if (
    !row?.rowNumber &&
    normalizedEventId &&
    typeof getFieldLeadRowByBookedEventId === "function"
  ) {
    row = await getFieldLeadRowByBookedEventId(normalizedEventId);
    if (row?.rowNumber) {
      matchedBy = "bookedEventId";
    }
  }

  if (!row?.rowNumber) {
    return {
      ok: false,
      matchedBy: "",
      row: null,
    };
  }

  return {
    ok: true,
    matchedBy,
    row: await updateFieldLeadRowByNumber(row.rowNumber, patch),
  };
};
