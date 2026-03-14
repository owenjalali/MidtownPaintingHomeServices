import assert from "node:assert/strict";
import test from "node:test";
import {
  appendFieldLeadRow,
  getFieldLeadRowByBookedEventId,
  getMissingFieldLeadStoreEnvVars,
  resetFieldLeadSheetTabsForDemo,
  setFieldLeadStoreTestOverrides,
  syncFieldLeadSheetTabs,
  updateFieldLeadRowByNumber,
} from "./fieldLeadStore.mjs";
import { FIELD_LEAD_COLUMNS } from "./fieldLeadCore.mjs";

const LEGACY_FIELD_LEAD_HEADER = [
  "leadId",
  "createdAtIso",
  "status",
  "repId",
  "repName",
  "customerName",
  "customerPhoneE164",
  "projectNotes",
  "bookingTokenHash",
  "bookingExpiresAtIso",
  "initialSmsTaskRunId",
  "initialSmsStatus",
  "initialSmsSentAtIso",
  "followup1TaskRunId",
  "followup1Status",
  "followup1ScheduledForIso",
  "followup1SentAtIso",
  "followup2TaskRunId",
  "followup2Status",
  "followup2ScheduledForIso",
  "followup2SentAtIso",
  "bookedAtIso",
  "bookedSlotStartIso",
  "bookedEventId",
  "clientManageLink",
  "carterManageLink",
  "closedAtIso",
  "closedReason",
  "lastError",
];

const withEnv = async (overrides, run) => {
  const snapshot = { ...process.env };
  process.env = {
    ...snapshot,
    ...overrides,
  };

  try {
    await run();
  } finally {
    process.env = snapshot;
    setFieldLeadStoreTestOverrides();
  }
};

const createFakeSheetsClient = (initialSheets = []) => {
  let nextSheetId = 10;
  let nextBandingId = 100;
  const sheets = initialSheets.map((sheet, index) => ({
    properties: {
      sheetId: sheet.sheetId ?? nextSheetId++,
      title: sheet.title,
      hidden: Boolean(sheet.hidden),
      index: sheet.index ?? index,
      gridProperties: {
        rowCount: sheet.rowCount ?? 200,
        frozenRowCount: 0,
      },
    },
    values: Array.isArray(sheet.values) ? sheet.values.map((row) => [...row]) : [],
    conditionalFormats: Array.isArray(sheet.conditionalFormats) ? [...sheet.conditionalFormats] : [],
    bandedRanges: Array.isArray(sheet.bandedRanges) ? [...sheet.bandedRanges] : [],
  }));

  const getSheet = (title) =>
    sheets.find((sheet) => sheet.properties.title === title) || null;

  const listSheets = () => sheets.map((sheet) => ({ ...sheet, properties: { ...sheet.properties } }));

  const parseRange = (range) => {
    const [sheetToken = "", cells = ""] = String(range || "").split("!");
    const title = sheetToken.replace(/^'/, "").replace(/'$/, "");
    const match = cells.match(/^A(\d+)?(?::[A-Z]+(\d+)?)?$/i);
    return {
      title,
      startRow: match?.[1] ? Number(match[1]) : null,
      endRow: match?.[2] ? Number(match[2]) : null,
    };
  };

  const setRows = (sheet, startRow, values) => {
    const startIndex = Math.max(0, (startRow || 1) - 1);
    values.forEach((row, offset) => {
      sheet.values[startIndex + offset] = [...row];
    });
  };

  const client = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: sheets.map((sheet) => ({
            properties: {
              ...sheet.properties,
              gridProperties: { ...sheet.properties.gridProperties },
            },
            conditionalFormats: [...sheet.conditionalFormats],
            bandedRanges: sheet.bandedRanges.map((range) => ({ ...range })),
          })),
        },
      }),
      values: {
        get: async ({ range }) => {
          const { title, startRow, endRow } = parseRange(range);
          const sheet = getSheet(title);
          if (!sheet) {
            return { data: { values: [] } };
          }

          if (startRow === 1 && endRow === 1) {
            return {
              data: {
                values: sheet.values[0] ? [[...sheet.values[0]]] : [],
              },
            };
          }

          if (startRow === 2 && endRow === null) {
            return {
              data: {
                values: sheet.values.slice(1).map((row) => [...row]),
              },
            };
          }

          if (startRow && endRow && startRow === endRow) {
            const row = sheet.values[startRow - 1];
            return {
              data: {
                values: row ? [[...row]] : [],
              },
            };
          }

          return { data: { values: sheet.values.map((row) => [...row]) } };
        },
        update: async ({ range, requestBody }) => {
          const { title, startRow } = parseRange(range);
          const sheet = getSheet(title);
          setRows(sheet, startRow, requestBody.values || []);
          return {
            data: {
              updatedRange: range,
            },
          };
        },
        append: async ({ range, requestBody }) => {
          const { title } = parseRange(range);
          const sheet = getSheet(title);
          const nextRow = [...(requestBody.values?.[0] || [])];
          sheet.values.push(nextRow);
          const rowNumber = sheet.values.length;
          return {
            data: {
              updates: {
                updatedRange: `${range.replace("A2:AC", "")}A${rowNumber}:AC${rowNumber}`,
              },
            },
          };
        },
        clear: async ({ range }) => {
          const { title, startRow } = parseRange(range);
          const sheet = getSheet(title);
          if (!sheet) {
            return { data: {} };
          }

          if (startRow === 2) {
            sheet.values = sheet.values.slice(0, 1);
          } else {
            sheet.values = [];
          }
          return { data: {} };
        },
      },
      batchUpdate: async ({ requestBody }) => {
        for (const request of requestBody.requests || []) {
          if (request.addSheet) {
            sheets.push({
              properties: {
                sheetId: nextSheetId++,
                title: request.addSheet.properties.title,
                hidden: Boolean(request.addSheet.properties.hidden),
                index: sheets.length,
                gridProperties: {
                  rowCount: 200,
                  frozenRowCount: 0,
                },
              },
              values: [],
              conditionalFormats: [],
              bandedRanges: [],
            });
            continue;
          }

          if (request.updateSheetProperties) {
            const sheet = sheets.find(
              (candidate) => candidate.properties.sheetId === request.updateSheetProperties.properties.sheetId
            );
            if (!sheet) {
              continue;
            }

            Object.assign(sheet.properties, request.updateSheetProperties.properties);
            if (request.updateSheetProperties.properties.gridProperties) {
              sheet.properties.gridProperties = {
                ...sheet.properties.gridProperties,
                ...request.updateSheetProperties.properties.gridProperties,
              };
            }
            continue;
          }

          if (request.deleteConditionalFormatRule) {
            const sheet = sheets.find(
              (candidate) => candidate.properties.sheetId === request.deleteConditionalFormatRule.sheetId
            );
            if (sheet) {
              sheet.conditionalFormats.splice(request.deleteConditionalFormatRule.index, 1);
            }
            continue;
          }

          if (request.addConditionalFormatRule) {
            const sheet = sheets.find(
              (candidate) =>
                candidate.properties.sheetId === request.addConditionalFormatRule.rule.ranges[0].sheetId
            );
            if (sheet) {
              sheet.conditionalFormats.splice(
                request.addConditionalFormatRule.index,
                0,
                request.addConditionalFormatRule.rule
              );
            }
            continue;
          }

          if (request.deleteBanding) {
            for (const sheet of sheets) {
              const index = sheet.bandedRanges.findIndex(
                (range) => range.bandedRangeId === request.deleteBanding.bandedRangeId
              );
              if (index >= 0) {
                sheet.bandedRanges.splice(index, 1);
                break;
              }
            }
            continue;
          }

          if (request.addBanding) {
            const sheet = sheets.find(
              (candidate) =>
                candidate.properties.sheetId === request.addBanding.bandedRange.range.sheetId
            );
            if (sheet) {
              sheet.bandedRanges.push({
                bandedRangeId: nextBandingId++,
                ...request.addBanding.bandedRange,
              });
            }
          }
        }

        return { data: {} };
      },
    },
  };

  return {
    client,
    getSheet,
    listSheets,
  };
};

test("field lead store env requirements stay empty for local-file mode", async () => {
  await withEnv(
    {
      FIELD_TEST_STORE_MODE: "local-file",
      FIELD_TEST_SHEETS_SPREADSHEET_ID: "",
      FIELD_TEST_SHEETS_TAB_NAME: "",
      FIELD_TEST_SHEETS_CLIENT_EMAIL: "",
      FIELD_TEST_SHEETS_PRIVATE_KEY: "",
    },
    async () => {
      assert.deepEqual(getMissingFieldLeadStoreEnvVars(), []);
    }
  );
});

test("field lead store env requirements switch to dedicated sheets vars in google-sheets mode", async () => {
  await withEnv(
    {
      FIELD_TEST_STORE_MODE: "google-sheets",
      FIELD_TEST_SHEETS_SPREADSHEET_ID: "",
      FIELD_TEST_SHEETS_TAB_NAME: "",
      FIELD_TEST_SHEETS_CLIENT_EMAIL: "",
      FIELD_TEST_SHEETS_PRIVATE_KEY: "",
    },
    async () => {
      assert.deepEqual(getMissingFieldLeadStoreEnvVars(), [
        "FIELD_TEST_SHEETS_SPREADSHEET_ID",
        "FIELD_TEST_SHEETS_TAB_NAME",
        "FIELD_TEST_SHEETS_CLIENT_EMAIL",
        "FIELD_TEST_SHEETS_PRIVATE_KEY",
      ]);
    }
  );
});

test("sheet sync migrates legacy headers, hides the raw tab, and generates the CRM tab", async () => {
  await withEnv(
    {
      FIELD_TEST_STORE_MODE: "google-sheets",
      FIELD_TEST_SHEETS_SPREADSHEET_ID: "sheet_123",
      FIELD_TEST_SHEETS_TAB_NAME: "Field Leads",
      FIELD_TEST_SHEETS_CLIENT_EMAIL: "svc@example.com",
      FIELD_TEST_SHEETS_PRIVATE_KEY: "private-key",
    },
    async () => {
      const { client, getSheet } = createFakeSheetsClient([
        {
          title: "Field Leads",
          values: [
            LEGACY_FIELD_LEAD_HEADER,
            [
              "fld_123",
              "2026-03-09T15:00:00.000Z",
              "booked",
              "sam",
              "Sam",
              "Jane Smith",
              "+16475551234",
              "Exterior trim",
              "hash",
              "2026-03-16T15:00:00.000Z",
              "",
              "sent",
              "2026-03-09T15:05:00.000Z",
              "run_followup",
              "queued",
              "2026-03-10T15:05:00.000Z",
              "",
              "",
              "",
              "",
              "",
              "2026-03-09T15:10:00.000Z",
              "2026-03-10T18:00:00.000Z",
              "evt_123",
              "https://midtown.test/client",
              "https://midtown.test/carter",
              "",
              "",
              "",
            ],
          ],
        },
      ]);

      setFieldLeadStoreTestOverrides({
        sheetsClientFactory: () => client,
      });

      const summary = await syncFieldLeadSheetTabs();
      const rawSheet = getSheet("Field Leads");
      const crmSheet = getSheet("Field Leads CRM");

      assert.equal(summary.ok, true);
      assert.equal(summary.rowCount, 1);
      assert.deepEqual(rawSheet.values[0], FIELD_LEAD_COLUMNS);
      assert.equal(rawSheet.properties.hidden, true);
      assert.equal(rawSheet.values[1][FIELD_LEAD_COLUMNS.indexOf("followupStatus")], "queued");
      assert.equal(rawSheet.values[1][FIELD_LEAD_COLUMNS.indexOf("appointmentStatus")], "scheduled");
      assert.deepEqual(crmSheet.values[0], [
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
      assert.equal(crmSheet.values[1][7], "Booked");
      assert.equal(crmSheet.values[1][16], '=HYPERLINK("https://midtown.test/client","Open")');
      assert.equal(crmSheet.conditionalFormats.length > 0, true);
      assert.equal(crmSheet.bandedRanges.length, 1);
    }
  );
});

test("google sheets mode appends, updates, and finds rows by booked event id", async () => {
  await withEnv(
    {
      FIELD_TEST_STORE_MODE: "google-sheets",
      FIELD_TEST_SHEETS_SPREADSHEET_ID: "sheet_123",
      FIELD_TEST_SHEETS_TAB_NAME: "Field Leads",
      FIELD_TEST_SHEETS_CLIENT_EMAIL: "svc@example.com",
      FIELD_TEST_SHEETS_PRIVATE_KEY: "private-key",
    },
    async () => {
      const { client, getSheet } = createFakeSheetsClient();
      setFieldLeadStoreTestOverrides({
        sheetsClientFactory: () => client,
      });

      const appended = await appendFieldLeadRow({
        leadId: "fld_123",
        createdAtIso: "2026-03-09T15:00:00.000Z",
        status: "booked",
        repId: "sam",
        repName: "Sam",
        customerName: "Jane Smith",
        customerPhoneE164: "+16475551234",
        projectNotes: "Exterior trim",
        bookingTokenHash: "hash",
        bookingExpiresAtIso: "2026-03-16T15:00:00.000Z",
        bookedAtIso: "2026-03-09T15:10:00.000Z",
        bookedSlotStartIso: "2026-03-10T18:00:00.000Z",
        bookedEventId: "evt_123",
        clientManageLink: "https://midtown.test/client",
        carterManageLink: "https://midtown.test/carter",
      });

      const updated = await updateFieldLeadRowByNumber(2, {
        followupStatus: "queued",
        followupScheduledForIso: "2026-03-09T15:15:00.000Z",
        appointmentStatus: "rescheduled",
        lastManagedReason: "Customer needed a later time",
      });
      const foundByEventId = await getFieldLeadRowByBookedEventId("evt_123");
      const rawSheet = getSheet("Field Leads");
      const crmSheet = getSheet("Field Leads CRM");

      assert.equal(appended.rowNumber, 2);
      assert.equal(updated.followupStatus, "queued");
      assert.equal(updated.appointmentStatus, "rescheduled");
      assert.equal(updated.lastManagedReason, "Customer needed a later time");
      assert.equal(foundByEventId?.leadId, "fld_123");
      assert.equal(rawSheet.values[1][FIELD_LEAD_COLUMNS.indexOf("followupStatus")], "queued");
      assert.equal(rawSheet.values[1][FIELD_LEAD_COLUMNS.indexOf("appointmentStatus")], "rescheduled");
      assert.equal(crmSheet.values[1][9], "Queued");
      assert.equal(crmSheet.values[1][10], "Rescheduled");
    }
  );
});

test("google sheets append keeps the raw row even if CRM sync fails", async () => {
  await withEnv(
    {
      FIELD_TEST_STORE_MODE: "google-sheets",
      FIELD_TEST_SHEETS_SPREADSHEET_ID: "sheet_123",
      FIELD_TEST_SHEETS_TAB_NAME: "Field Leads",
      FIELD_TEST_SHEETS_CLIENT_EMAIL: "svc@example.com",
      FIELD_TEST_SHEETS_PRIVATE_KEY: "private-key",
    },
    async () => {
      const { client, getSheet } = createFakeSheetsClient([
        {
          title: "Field Leads",
        },
        {
          title: "Field Leads CRM",
        },
      ]);
      const originalUpdate = client.spreadsheets.values.update;
      client.spreadsheets.values.update = async (request) => {
        if (String(request?.range || "").includes("Field Leads CRM")) {
          throw new Error("crm sync failed");
        }
        return originalUpdate(request);
      };

      setFieldLeadStoreTestOverrides({
        sheetsClientFactory: () => client,
      });

      const appended = await appendFieldLeadRow({
        leadId: "fld_123",
        createdAtIso: "2026-03-09T15:00:00.000Z",
        status: "initial_sms_queued",
        repId: "sam",
        repName: "Sam",
        customerName: "Jane Smith",
        customerPhoneE164: "+16475551234",
        projectNotes: "Exterior trim",
        bookingTokenHash: "hash",
        bookingExpiresAtIso: "2026-03-16T15:00:00.000Z",
      });

      const rawSheet = getSheet("Field Leads");
      assert.equal(appended.rowNumber, 2);
      assert.equal(rawSheet.values[1][FIELD_LEAD_COLUMNS.indexOf("leadId")], "fld_123");
      assert.equal(rawSheet.values[1][FIELD_LEAD_COLUMNS.indexOf("status")], "initial_sms_queued");
    }
  );
});

test("preview demo reset archives existing rows and rebuilds an empty crm tab", async () => {
  await withEnv(
    {
      FIELD_TEST_STORE_MODE: "google-sheets",
      FIELD_TEST_SHEETS_SPREADSHEET_ID: "sheet_123",
      FIELD_TEST_SHEETS_TAB_NAME: "Field Leads",
      FIELD_TEST_SHEETS_CLIENT_EMAIL: "svc@example.com",
      FIELD_TEST_SHEETS_PRIVATE_KEY: "private-key",
      NODE_ENV: "development",
      VERCEL_ENV: "preview",
    },
    async () => {
      const { client, getSheet, listSheets } = createFakeSheetsClient([
        {
          title: "Field Leads",
          values: [
            FIELD_LEAD_COLUMNS,
            [
              "fld_123",
              "2026-03-09T15:00:00.000Z",
              "initial_sms_sent",
              "sam",
              "Sam",
              "Jane Smith",
              "+16475551234",
              "123 Example Street",
              "Exterior trim",
              "hash",
              "2026-03-16T15:00:00.000Z",
              "run_initial",
              "sent",
              "2026-03-09T15:05:00.000Z",
              "run_followup",
              "queued",
              "2026-03-09T15:35:00.000Z",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "https://midtown.test/client",
              "https://midtown.test/carter",
              "",
              "",
              "",
              "",
              "",
            ],
          ],
        },
        {
          title: "Field Leads CRM",
        },
      ]);

      setFieldLeadStoreTestOverrides({
        sheetsClientFactory: () => client,
      });

      const result = await resetFieldLeadSheetTabsForDemo();
      const rawSheet = getSheet("Field Leads");
      const crmSheet = getSheet("Field Leads CRM");
      const archiveSheet = listSheets().find((sheet) =>
        sheet.properties.title.startsWith("Field Leads Archive ")
      );

      assert.equal(result.ok, true);
      assert.equal(result.archivedRowCount, 1);
      assert.equal(rawSheet.values.length, 1);
      assert.deepEqual(rawSheet.values[0], FIELD_LEAD_COLUMNS);
      assert.equal(crmSheet.values.length, 1);
      assert.equal(crmSheet.values[0][0], "Lead ID");
      assert.ok(archiveSheet);
      assert.equal(archiveSheet.properties.hidden, true);
      assert.equal(archiveSheet.values.length, 2);
      assert.equal(archiveSheet.values[1][0], "fld_123");
    }
  );
});
