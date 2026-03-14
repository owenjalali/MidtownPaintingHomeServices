import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import {
  getFieldLeadStoreMode,
  getFieldLeadStorePath,
  getFieldLeadSheetsConfig,
  getMissingFieldLeadSheetsEnvVars,
  isProductionRuntime,
} from "./fieldLeadEnv.mjs";
import {
  FIELD_LEAD_COLUMNS,
  createFieldLeadHttpError,
  createFieldLeadRow,
  fieldLeadRowToValues,
  mapFieldLeadRow,
  normalizeText,
} from "./fieldLeadCore.mjs";
import {
  ensureFieldLeadTabs,
  getFieldLeadCrmTabName,
  syncFieldLeadCrmTabs,
} from "./fieldLeadCrmSync.mjs";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const FIELD_LEAD_SHEETS_CACHE_TTL_MS = 15 * 1000;
const fieldLeadStoreTestOverrides = {
  sheetsClientFactory: null,
  storeFilePath: "",
};
const fieldLeadSheetsStateCache = new Map();

export const setFieldLeadStoreTestOverrides = (overrides = {}) => {
  fieldLeadStoreTestOverrides.sheetsClientFactory =
    typeof overrides.sheetsClientFactory === "function" ? overrides.sheetsClientFactory : null;
  fieldLeadStoreTestOverrides.storeFilePath = normalizeText(overrides.storeFilePath);
  fieldLeadSheetsStateCache.clear();
};

const getStoreFilePath = () =>
  path.resolve(process.cwd(), fieldLeadStoreTestOverrides.storeFilePath || getFieldLeadStorePath());

const getSheetsCacheKey = (spreadsheetId, rawTabName) =>
  `${normalizeText(spreadsheetId)}::${normalizeText(rawTabName)}`;

const getCachedCanonicalSheetsRows = (cacheKey) => {
  if (FIELD_LEAD_SHEETS_CACHE_TTL_MS <= 0) {
    return null;
  }

  const cached = fieldLeadSheetsStateCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    fieldLeadSheetsStateCache.delete(cacheKey);
    return null;
  }

  return cached.value;
};

const setCachedCanonicalSheetsRows = ({ sheetsClient, sheetsConfig, rawTabName, rows }) => {
  if (FIELD_LEAD_SHEETS_CACHE_TTL_MS <= 0) {
    return;
  }

  const cacheKey = getSheetsCacheKey(sheetsConfig.spreadsheetId, rawTabName);
  fieldLeadSheetsStateCache.set(cacheKey, {
    value: {
      sheetsClient,
      sheetsConfig,
      rawTabName,
      rows: Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [],
    },
    expiresAt: Date.now() + FIELD_LEAD_SHEETS_CACHE_TTL_MS,
  });
};

const ensureParentDirectory = async () => {
  await mkdir(path.dirname(getStoreFilePath()), { recursive: true });
};

const readLocalStoreData = async () => {
  const filePath = getStoreFilePath();
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows)) {
      return { rows: [] };
    }
    return {
      rows: parsed.rows.map((row) => createFieldLeadRow(row)),
    };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { rows: [] };
    }
    throw error;
  }
};

const writeLocalStoreData = async (data) => {
  await ensureParentDirectory();
  const filePath = getStoreFilePath();
  const tempPath = `${filePath}.tmp`;
  await writeFile(
    tempPath,
    JSON.stringify(
      {
        rows: Array.isArray(data?.rows) ? data.rows.map((row) => createFieldLeadRow(row)) : [],
      },
      null,
      2
    ),
    "utf8"
  );
  await rename(tempPath, filePath);
};

const getSheetsClient = () => {
  if (typeof fieldLeadStoreTestOverrides.sheetsClientFactory === "function") {
    return fieldLeadStoreTestOverrides.sheetsClientFactory();
  }

  const sheetsConfig = getFieldLeadSheetsConfig();
  const auth = new google.auth.JWT({
    email: sheetsConfig.clientEmail,
    key: sheetsConfig.privateKey,
    scopes: [SHEETS_SCOPE],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
};

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

const RAW_COLUMN_LETTER = getColumnLetter(FIELD_LEAD_COLUMNS.length);

const quoteSheetName = (tabName) => {
  const normalized = normalizeText(tabName);
  return normalized.includes(" ") ? `'${normalized}'` : normalized;
};

const getArchiveTabTitle = (rawTabName) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${normalizeText(rawTabName)} Archive ${timestamp}`.slice(0, 100);
};

const parseUpdatedRowNumber = (updatedRange) => {
  const normalized = normalizeText(updatedRange);
  const match = normalized.match(/[A-Z]+(\d+):[A-Z]+\d+$/i) || normalized.match(/[A-Z]+(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const getRawTabName = () => {
  const tabName = normalizeText(getFieldLeadSheetsConfig().tabName);
  if (!tabName) {
    throw createFieldLeadHttpError(500, "Field lead sheet tab name is not configured.");
  }

  return tabName;
};

const getTabHeaderRange = (tabName) => `${quoteSheetName(tabName)}!A1:${RAW_COLUMN_LETTER}1`;
const getTabDataRange = (tabName) => `${quoteSheetName(tabName)}!A2:${RAW_COLUMN_LETTER}`;
const getTabRowRange = (tabName, rowNumber) =>
  `${quoteSheetName(tabName)}!A${rowNumber}:${RAW_COLUMN_LETTER}${rowNumber}`;

const headerMatchesCanonicalShape = (headerValues) =>
  Array.isArray(headerValues) &&
  headerValues.length === FIELD_LEAD_COLUMNS.length &&
  FIELD_LEAD_COLUMNS.every(
    (columnName, index) => normalizeText(headerValues[index]) === columnName
  );

const rewriteRawSheetCanonical = async ({ sheetsClient, spreadsheetId, rawTabName, rows }) => {
  const canonicalRows = Array.isArray(rows) ? rows.map((row) => createFieldLeadRow(row)) : [];
  const values = [FIELD_LEAD_COLUMNS, ...canonicalRows.map((row) => fieldLeadRowToValues(row))];

  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quoteSheetName(rawTabName)}!A:${RAW_COLUMN_LETTER}`,
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetName(rawTabName)}!A1:${RAW_COLUMN_LETTER}${values.length}`,
    valueInputOption: "RAW",
    requestBody: {
      values,
    },
  });

  return canonicalRows.map((row, index) => ({
    ...row,
    rowNumber: index + 2,
  }));
};

const readCanonicalSheetsRows = async () => {
  const sheetsClient = getSheetsClient();
  const sheetsConfig = getFieldLeadSheetsConfig();
  const rawTabName = getRawTabName();
  const cacheKey = getSheetsCacheKey(sheetsConfig.spreadsheetId, rawTabName);
  const cached = getCachedCanonicalSheetsRows(cacheKey);
  if (cached) {
    return {
      sheetsClient: cached.sheetsClient || sheetsClient,
      sheetsConfig,
      rawTabName,
      rows: cached.rows.map((row) => ({ ...row })),
    };
  }

  await ensureFieldLeadTabs({
    sheetsClient,
    spreadsheetId: sheetsConfig.spreadsheetId,
    rawTabName,
  });

  const [headerResponse, rowsResponse] = await Promise.all([
    sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetsConfig.spreadsheetId,
      range: getTabHeaderRange(rawTabName),
    }),
    sheetsClient.spreadsheets.values.get({
      spreadsheetId: sheetsConfig.spreadsheetId,
      range: getTabDataRange(rawTabName),
    }),
  ]);

  const headerValues = Array.isArray(headerResponse.data.values?.[0]) ? headerResponse.data.values[0] : [];
  const rowValues = Array.isArray(rowsResponse.data.values) ? rowsResponse.data.values : [];
  const sourceColumns = headerValues.length > 0 ? headerValues : FIELD_LEAD_COLUMNS;
  const rows = rowValues.map((values, index) => mapFieldLeadRow(values, index + 2, sourceColumns));

  if (headerMatchesCanonicalShape(headerValues)) {
    setCachedCanonicalSheetsRows({
      sheetsClient,
      sheetsConfig,
      rawTabName,
      rows,
    });
    return {
      sheetsClient,
      sheetsConfig,
      rawTabName,
      rows,
    };
  }

  const canonicalRows = await rewriteRawSheetCanonical({
    sheetsClient,
    spreadsheetId: sheetsConfig.spreadsheetId,
    rawTabName,
    rows,
  });
  setCachedCanonicalSheetsRows({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: canonicalRows,
  });

  return {
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: canonicalRows,
  };
};

const syncSheetsCrmFromRows = async ({ sheetsClient, sheetsConfig, rawTabName, rows }) =>
  syncFieldLeadCrmTabs({
    sheetsClient,
    spreadsheetId: sheetsConfig.spreadsheetId,
    rawTabName,
    rawRows: rows.map((row) => createFieldLeadRow(row)),
  });

const syncSheetsCrmFromRowsBestEffort = async ({ sheetsClient, sheetsConfig, rawTabName, rows }) => {
  try {
    await syncSheetsCrmFromRows({
      sheetsClient,
      sheetsConfig,
      rawTabName,
      rows,
    });
  } catch (error) {
    console.warn("[field-lead] unable to sync CRM tab from raw rows", {
      rawTabName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const createArchiveSheet = async ({ sheetsClient, spreadsheetId, archiveTabName, rows }) => {
  const archiveValues = [
    FIELD_LEAD_COLUMNS,
    ...rows.map((row) => fieldLeadRowToValues(createFieldLeadRow(row))),
  ];
  const archiveColumnLetter = getColumnLetter(FIELD_LEAD_COLUMNS.length);

  await sheetsClient.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: archiveTabName,
              hidden: true,
            },
          },
        },
      ],
    },
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetName(archiveTabName)}!A1:${archiveColumnLetter}${archiveValues.length}`,
    valueInputOption: "RAW",
    requestBody: {
      values: archiveValues,
    },
  });
};

const appendFieldLeadRowLocal = async (rowInput) => {
  const row = createFieldLeadRow(rowInput);
  const storeData = await readLocalStoreData();
  const nextRows = [...storeData.rows, row];
  await writeLocalStoreData({ rows: nextRows });

  return {
    ...row,
    rowNumber: nextRows.length + 1,
  };
};

const appendFieldLeadRowSheets = async (rowInput) => {
  const row = createFieldLeadRow(rowInput);
  const { sheetsClient, sheetsConfig, rawTabName, rows } = await readCanonicalSheetsRows();
  const response = await sheetsClient.spreadsheets.values.append({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: getTabDataRange(rawTabName),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [fieldLeadRowToValues(row)],
    },
  });

  const rowNumber = parseUpdatedRowNumber(response.data.updates?.updatedRange) ?? rows.length + 2;
  const appendedRow = {
    ...row,
    rowNumber,
  };
  const nextRows = [...rows, appendedRow];

  setCachedCanonicalSheetsRows({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: nextRows,
  });

  await syncSheetsCrmFromRowsBestEffort({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: nextRows,
  });

  return appendedRow;
};

const getFieldLeadRowLocal = async (leadId) => {
  const normalizedLeadId = normalizeText(leadId);
  if (!normalizedLeadId) {
    return null;
  }

  const storeData = await readLocalStoreData();
  const rowIndex = storeData.rows.findIndex((row) => row.leadId === normalizedLeadId);
  if (rowIndex < 0) {
    return null;
  }

  return mapFieldLeadRow(storeData.rows[rowIndex], rowIndex + 2);
};

const getFieldLeadRowSheets = async (leadId) => {
  const normalizedLeadId = normalizeText(leadId);
  if (!normalizedLeadId) {
    return null;
  }

  const { rows } = await readCanonicalSheetsRows();
  return rows.find((row) => row.leadId === normalizedLeadId) || null;
};

const getFieldLeadRowByBookedEventIdLocal = async (eventId) => {
  const normalizedEventId = normalizeText(eventId);
  if (!normalizedEventId) {
    return null;
  }

  const storeData = await readLocalStoreData();
  const rowIndex = storeData.rows.findIndex((row) => normalizeText(row.bookedEventId) === normalizedEventId);
  if (rowIndex < 0) {
    return null;
  }

  return mapFieldLeadRow(storeData.rows[rowIndex], rowIndex + 2);
};

const getFieldLeadRowByBookedEventIdSheets = async (eventId) => {
  const normalizedEventId = normalizeText(eventId);
  if (!normalizedEventId) {
    return null;
  }

  const { rows } = await readCanonicalSheetsRows();
  return rows.find((row) => normalizeText(row.bookedEventId) === normalizedEventId) || null;
};

const updateFieldLeadRowByNumberLocal = async (rowNumber, patchInput) => {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw createFieldLeadHttpError(500, "Field lead row number is invalid.");
  }

  const storeData = await readLocalStoreData();
  const rowIndex = rowNumber - 2;
  const existingRow = storeData.rows[rowIndex];
  if (!existingRow) {
    throw createFieldLeadHttpError(404, "Field lead row could not be found.");
  }

  const nextRow = createFieldLeadRow({
    ...existingRow,
    ...patchInput,
  });
  const nextRows = [...storeData.rows];
  nextRows[rowIndex] = nextRow;
  await writeLocalStoreData({ rows: nextRows });

  return {
    ...nextRow,
    rowNumber,
  };
};

const updateFieldLeadRowByNumberSheets = async (rowNumber, patchInput) => {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw createFieldLeadHttpError(500, "Field lead row number is invalid.");
  }

  const { sheetsClient, sheetsConfig, rawTabName, rows } = await readCanonicalSheetsRows();
  const rowIndex = rowNumber - 2;
  const existingRow = rows[rowIndex];
  if (!existingRow) {
    throw createFieldLeadHttpError(404, "Field lead row could not be found.");
  }

  const nextRow = createFieldLeadRow({
    ...existingRow,
    ...patchInput,
  });

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: getTabRowRange(rawTabName, rowNumber),
    valueInputOption: "RAW",
    requestBody: {
      values: [fieldLeadRowToValues(nextRow)],
    },
  });

  const nextRows = [...rows];
  nextRows[rowIndex] = {
    ...nextRow,
    rowNumber,
  };
  setCachedCanonicalSheetsRows({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: nextRows,
  });

  await syncSheetsCrmFromRowsBestEffort({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: nextRows,
  });

  return {
    ...nextRow,
    rowNumber,
  };
};

const syncFieldLeadSheetTabsInternal = async () => {
  const { sheetsClient, sheetsConfig, rawTabName, rows } = await readCanonicalSheetsRows();
  const crmSync = await syncSheetsCrmFromRows({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows,
  });

  return {
    ok: true,
    rawTabName,
    crmTabName: crmSync.crmTabName,
    rowCount: rows.length,
  };
};

const resetFieldLeadSheetTabsForDemoInternal = async () => {
  const { sheetsClient, sheetsConfig, rawTabName, rows } = await readCanonicalSheetsRows();
  const archivedRowCount = rows.length;
  const archiveTabName = archivedRowCount > 0 ? getArchiveTabTitle(rawTabName) : "";

  if (archivedRowCount > 0) {
    await createArchiveSheet({
      sheetsClient,
      spreadsheetId: sheetsConfig.spreadsheetId,
      archiveTabName,
      rows,
    });
  }

  await sheetsClient.spreadsheets.values.clear({
    spreadsheetId: sheetsConfig.spreadsheetId,
    range: getTabDataRange(rawTabName),
  });

  setCachedCanonicalSheetsRows({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: [],
  });

  await syncSheetsCrmFromRows({
    sheetsClient,
    sheetsConfig,
    rawTabName,
    rows: [],
  });

  return {
    ok: true,
    rawTabName,
    crmTabName: getFieldLeadCrmTabName(rawTabName),
    archiveTabName,
    archivedRowCount,
  };
};

export const getMissingFieldLeadStoreEnvVars = () =>
  getFieldLeadStoreMode() === "google-sheets" ? getMissingFieldLeadSheetsEnvVars() : [];

export const appendFieldLeadRow = async (rowInput) =>
  getFieldLeadStoreMode() === "google-sheets"
    ? appendFieldLeadRowSheets(rowInput)
    : appendFieldLeadRowLocal(rowInput);

export const getFieldLeadRow = async (leadId) =>
  getFieldLeadStoreMode() === "google-sheets"
    ? getFieldLeadRowSheets(leadId)
    : getFieldLeadRowLocal(leadId);

export const getFieldLeadRowByBookedEventId = async (eventId) =>
  getFieldLeadStoreMode() === "google-sheets"
    ? getFieldLeadRowByBookedEventIdSheets(eventId)
    : getFieldLeadRowByBookedEventIdLocal(eventId);

export const updateFieldLeadRowByNumber = async (rowNumber, patchInput) =>
  getFieldLeadStoreMode() === "google-sheets"
    ? updateFieldLeadRowByNumberSheets(rowNumber, patchInput)
    : updateFieldLeadRowByNumberLocal(rowNumber, patchInput);

export const updateFieldLeadRow = async (leadId, patchInput) => {
  const existingRow = await getFieldLeadRow(leadId);
  if (!existingRow?.rowNumber) {
    throw createFieldLeadHttpError(404, "Field lead could not be found.");
  }

  return updateFieldLeadRowByNumber(existingRow.rowNumber, patchInput);
};

export const syncFieldLeadSheetTabs = async () => {
  if (getFieldLeadStoreMode() !== "google-sheets") {
    throw createFieldLeadHttpError(
      400,
      "Field lead sheet sync requires FIELD[_TEST]_STORE_MODE=google-sheets."
    );
  }

  return syncFieldLeadSheetTabsInternal();
};

export const resetFieldLeadSheetTabsForDemo = async () => {
  if (getFieldLeadStoreMode() !== "google-sheets") {
    throw createFieldLeadHttpError(
      400,
      "Field lead sheet reset requires FIELD[_TEST]_STORE_MODE=google-sheets."
    );
  }

  if (isProductionRuntime()) {
    throw createFieldLeadHttpError(
      403,
      "Field lead demo reset is blocked in production."
    );
  }

  return resetFieldLeadSheetTabsForDemoInternal();
};
