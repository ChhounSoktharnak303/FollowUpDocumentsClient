import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import {
  ExcelLockedError,
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
} from "@/lib/errors";
import {
  ACTIVITY_STATUSES,
  CASE_STATUSES,
  DEFAULT_MINISTRIES,
  DEFAULT_SERVICE_TYPES,
  DEFAULT_STATUS_LABELS,
  DEFAULT_WARNING_ORANGE_DAYS,
  DEFAULT_WARNING_RED_DAYS,
  caseUpdateDate,
  daysBetween,
  daysSince,
  isActivityStatus,
  isCaseStatus,
} from "@/lib/status";
import type {
  Activity,
  ActivityStatus,
  AppSettings,
  CaseDetail,
  CaseFilters,
  CaseListItem,
  CasePickerItem,
  CaseRecord,
  CaseStats,
  CaseStatus,
  Client,
  ClientWithStats,
  LabelPair,
  ListOption,
  Template,
} from "@/lib/types";
import type {
  ActivityCreateInput,
  ActivityUpdateInput,
  CaseCreateInput,
  CaseUpdateInput,
  ClientCreateInput,
  SettingsUpdateInput,
  TemplateInput,
} from "@/lib/validation";
import { todayIso } from "@/lib/format";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "tracker.xlsx");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = 30;

type SheetName =
  | "Clients"
  | "Cases"
  | "Activities"
  | "Templates"
  | "Settings";

const SHEETS: Record<
  SheetName,
  { name: SheetName; columns: readonly string[] }
> = {
  Clients: {
    name: "Clients",
    columns: ["id", "name_kh", "name_en", "phone", "note", "created_at"],
  },
  Cases: {
    name: "Cases",
    columns: [
      "id",
      "client_id",
      "service_type",
      "ministry",
      "description",
      "start_date",
      "end_date",
      "status",
      "share_token",
      "created_at",
    ],
  },
  Activities: {
    name: "Activities",
    columns: [
      "id",
      "case_id",
      "date",
      "ministry",
      "action",
      "status",
      "signed",
      "note",
      "created_at",
    ],
  },
  Templates: {
    name: "Templates",
    columns: ["id", "text_kh", "text_en"],
  },
  Settings: {
    name: "Settings",
    columns: ["key", "value"],
  },
};

const SHEET_ORDER: SheetName[] = [
  "Clients",
  "Cases",
  "Activities",
  "Templates",
  "Settings",
];

const COLUMN_WIDTHS: Record<string, number> = {
  id: 30,
  client_id: 30,
  case_id: 30,
  name_kh: 28,
  name_en: 26,
  phone: 16,
  note: 40,
  created_at: 23,
  service_type: 22,
  ministry: 30,
  description: 42,
  start_date: 14,
  end_date: 14,
  status: 16,
  share_token: 30,
  date: 14,
  action: 50,
  signed: 11,
  text_kh: 46,
  text_en: 46,
  key: 26,
  value: 62,
};

const WRAPPED_COLUMNS = new Set([
  "note",
  "description",
  "action",
  "text_kh",
  "text_en",
  "value",
]);

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "tpl-received",
    textKh: "បានទទួលឯកសារពីអតិថិជន",
    textEn: "Received documents from client",
  },
  {
    id: "tpl-submitted",
    textKh: "បានដាក់ស្នើឯកសារទៅការិយាល័យ",
    textEn: "Submitted documents to the office",
  },
  {
    id: "tpl-waiting",
    textKh: "កំពុងរង់ចាំការឆ្លើយតប",
    textEn: "Waiting for a response",
  },
  {
    id: "tpl-collected",
    textKh: "បានទទួលឯកសារត្រឡប់មកវិញ",
    textEn: "Collected the documents back",
  },
  {
    id: "tpl-fee",
    textKh: "បានបង់ថ្លៃសេវា",
    textEn: "Service fee paid",
  },
];

type RawRecord = Record<string, string>;

interface Snapshot {
  clients: Client[];
  cases: CaseRecord[];
  activities: Activity[];
  templates: Template[];
  settings: AppSettings;
}

let initializePromise: Promise<void> | null = null;
let writeTail: Promise<void> = Promise.resolve();

function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = writeTail;
  let release: () => void = () => undefined;
  writeTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  return (async () => {
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  })();
}

function nowIso(): string {
  return new Date().toISOString();
}

function newShareToken(existing: Set<string>): string {
  for (;;) {
    const token = randomBytes(18).toString("base64url");
    if (!existing.has(token)) return token;
  }
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return format(value, "yyyy-MM-dd");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const record = value as {
      richText?: Array<{ text?: string }>;
      text?: string;
      result?: unknown;
      hyperlink?: string;
      error?: string;
    };
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => part.text ?? "").join("");
    }
    if (record.result !== undefined) return cellText(record.result);
    if (typeof record.text === "string") return record.text;
    if (typeof record.hyperlink === "string") return record.hyperlink;
    if (typeof record.error === "string") return record.error;
  }
  return String(value);
}

function isLockError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  if (
    candidate.code === "EBUSY" ||
    candidate.code === "EPERM" ||
    candidate.code === "EACCES"
  ) {
    return true;
  }
  return /lock|busy|being used|another program|EPERM|EBUSY/i.test(
    candidate.message ?? "",
  );
}

function translateFileError(error: unknown): Error {
  if (isLockError(error)) return new ExcelLockedError();
  return new Error("The tracker workbook could not be opened.", { cause: error });
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const row = sheet.getRow(1);
  row.height = 24;
  for (let index = 1; index <= columnCount; index += 1) {
    const cell = row.getCell(index);
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF0B5C56" } },
    };
  }
}

function styleDataRow(
  row: ExcelJS.Row,
  headers: readonly string[],
): void {
  headers.forEach((header, index) => {
    const cell = row.getCell(index + 1);
    cell.font = { name: "Calibri", size: 11, color: { argb: "FF14201F" } };
    cell.alignment = {
      vertical: "top",
      wrapText: WRAPPED_COLUMNS.has(header),
    };
    cell.border = {
      bottom: { style: "hair", color: { argb: "FFE4DED2" } },
    };
    if (header === "phone") cell.numFmt = "@";
  });
}

function configureSheet(sheet: ExcelJS.Worksheet, headers: readonly string[]): void {
  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = COLUMN_WIDTHS[header] ?? 20;
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  styleHeaderRow(sheet, headers.length);
  if (sheet.actualRowCount > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.actualRowCount), column: headers.length },
    };
  }
}

function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ZKTH Associates & Partners";
  workbook.lastModifiedBy = "ZKTH Associates & Partners";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = "ZKTH Associates & Partners";
  workbook.title = "Document Follow-Up Tracker";

  for (const sheetName of SHEET_ORDER) {
    const definition = SHEETS[sheetName];
    const sheet = workbook.addWorksheet(definition.name, {
      properties: { defaultRowHeight: 20 },
    });
    sheet.addRow([...definition.columns]);
    styleHeaderRow(sheet, definition.columns.length);
    definition.columns.forEach((header, index) => {
      sheet.getColumn(index + 1).width = COLUMN_WIDTHS[header] ?? 20;
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const settingsSheet = workbook.getWorksheet("Settings");
  const clientsSheet = workbook.getWorksheet("Clients");
  const casesSheet = workbook.getWorksheet("Cases");
  const activitiesSheet = workbook.getWorksheet("Activities");
  const templatesSheet = workbook.getWorksheet("Templates");
  if (
    !settingsSheet ||
    !clientsSheet ||
    !casesSheet ||
    !activitiesSheet ||
    !templatesSheet
  ) {
    throw new Error("Could not create workbook sheets");
  }

  const settingRows: Array<[string, string]> = [
    ["service_types", JSON.stringify(DEFAULT_SERVICE_TYPES)],
    ["ministries", JSON.stringify(DEFAULT_MINISTRIES)],
    ["status_labels", JSON.stringify(DEFAULT_STATUS_LABELS)],
    ["warning_orange_days", String(DEFAULT_WARNING_ORANGE_DAYS)],
    ["warning_red_days", String(DEFAULT_WARNING_RED_DAYS)],
  ];
  for (const [key, value] of settingRows) {
    const row = settingsSheet.addRow([key, value]);
    styleDataRow(row, SHEETS.Settings.columns);
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
  }

  for (const template of DEFAULT_TEMPLATES) {
    const row = templatesSheet.addRow([
      template.id,
      template.textKh,
      template.textEn,
    ]);
    styleDataRow(row, SHEETS.Templates.columns);
  }

  configureSheet(clientsSheet, SHEETS.Clients.columns);
  configureSheet(casesSheet, SHEETS.Cases.columns);
  configureSheet(activitiesSheet, SHEETS.Activities.columns);
  configureSheet(templatesSheet, SHEETS.Templates.columns);
  configureSheet(settingsSheet, SHEETS.Settings.columns);

  return workbook;
}

async function createStoreFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH, fsConstants.F_OK);
    return;
  } catch {
    initializePromise = null;
  }

  const tempPath = path.join(
    DATA_DIR,
    `.tracker-initial-${process.pid}-${Date.now()}.tmp.xlsx`,
  );
  const workbook = createWorkbook();
  try {
    await workbook.xlsx.writeFile(tempPath);
    await fs.rename(tempPath, FILE_PATH);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    if (isLockError(error)) throw new ExcelLockedError();
    throw new Error("The tracker workbook could not be created.", {
      cause: error,
    });
  }
}

async function ensureStoreFile(): Promise<void> {
  try {
    await fs.access(FILE_PATH, fsConstants.F_OK);
  } catch {
    initializePromise = null;
  }
  if (!initializePromise) {
    initializePromise = createStoreFile();
  }
  try {
    await initializePromise;
  } catch (error) {
    initializePromise = null;
    throw error;
  }
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  await ensureStoreFile();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(FILE_PATH);
    return workbook;
  } catch (error) {
    throw translateFileError(error);
  }
}

function readRecords(
  workbook: ExcelJS.Workbook,
  sheetName: SheetName,
): RawRecord[] {
  const sheet = workbook.getWorksheet(SHEETS[sheetName].name);
  if (!sheet) throw new Error(`Missing sheet: ${SHEETS[sheetName].name}`);
  const headerRow = sheet.getRow(1);
  const headers = SHEETS[sheetName].columns;
  const records: RawRecord[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: RawRecord = {};
    headers.forEach((header, index) => {
      record[header] = cellText(row.getCell(index + 1).value);
    });
    if (Object.values(record).every((value) => value === "")) return;
    records.push(record);
  });
  void headerRow;
  return records;
}

function toClient(record: RawRecord): Client | null {
  const id = record.id?.trim();
  if (!id) return null;
  return {
    id,
    nameKh: record.name_kh?.trim() ?? "",
    nameEn: record.name_en?.trim() ?? "",
    phone: record.phone?.trim() ?? "",
    note: record.note ?? "",
    createdAt: record.created_at ?? "",
  };
}

function normalizeCaseStatus(value: string): CaseStatus {
  return isCaseStatus(value) ? value : "in_progress";
}

function normalizeActivityStatus(value: string): ActivityStatus {
  return isActivityStatus(value) ? value : "in_progress";
}

function parseSigned(value: string): boolean {
  return ["true", "1", "yes", "x", "signed", "ពិត"].includes(
    value.trim().toLowerCase(),
  );
}

function toCase(record: RawRecord): CaseRecord | null {
  const id = record.id?.trim();
  const clientId = record.client_id?.trim();
  if (!id || !clientId) return null;
  return {
    id,
    clientId,
    serviceType: record.service_type ?? "",
    ministry: record.ministry ?? "",
    description: record.description ?? "",
    startDate: record.start_date ?? "",
    endDate: record.end_date ?? "",
    status: normalizeCaseStatus(record.status ?? ""),
    shareToken: record.share_token ?? "",
    createdAt: record.created_at ?? "",
  };
}

function toActivity(record: RawRecord): Activity | null {
  const id = record.id?.trim();
  const caseId = record.case_id?.trim();
  if (!id || !caseId) return null;
  return {
    id,
    caseId,
    date: record.date ?? "",
    ministry: record.ministry ?? "",
    action: record.action ?? "",
    status: normalizeActivityStatus(record.status ?? ""),
    signed: parseSigned(record.signed ?? ""),
    note: record.note ?? "",
    createdAt: record.created_at ?? "",
  };
}

function toTemplate(record: RawRecord): Template | null {
  const id = record.id?.trim();
  if (!id) return null;
  return {
    id,
    textKh: record.text_kh ?? "",
    textEn: record.text_en ?? "",
  };
}

function isListOption(value: unknown): value is ListOption {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["id", "kh", "en"].every(
    (key) => typeof item[key] === "string" && (item[key] as string).trim() !== "",
  );
}

function isLabelPair(value: unknown): value is LabelPair {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.en === "string" &&
    typeof item.kh === "string" &&
    item.en.trim() !== "" &&
    item.kh.trim() !== ""
  );
}

function parseListSetting(raw: string, fallback: ListOption[]): ListOption[] {
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const options = parsed.filter(isListOption);
    return options.length > 0 ? options : fallback;
  } catch {
    return fallback;
  }
}

function parseStatusLabels(raw: string): Record<CaseStatus, LabelPair> {
  const merged: Record<CaseStatus, LabelPair> = {
    ...DEFAULT_STATUS_LABELS,
  };
  if (!raw) return merged;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const status of CASE_STATUSES) {
      if (isLabelPair(parsed[status])) {
        merged[status] = parsed[status] as LabelPair;
      }
    }
  } catch {
    return merged;
  }
  return merged;
}

function parseWarningDays(raw: string, fallback: number): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1 || value > 365) return fallback;
  return value;
}

function settingsFromRecords(records: RawRecord[]): AppSettings {
  const values = new Map(records.map((record) => [record.key, record.value]));
  return {
    serviceTypes: parseListSetting(
      values.get("service_types") ?? "",
      DEFAULT_SERVICE_TYPES,
    ),
    ministries: parseListSetting(
      values.get("ministries") ?? "",
      DEFAULT_MINISTRIES,
    ),
    statusLabels: parseStatusLabels(values.get("status_labels") ?? ""),
    warningOrangeDays: parseWarningDays(
      values.get("warning_orange_days") ?? "",
      DEFAULT_WARNING_ORANGE_DAYS,
    ),
    warningRedDays: parseWarningDays(
      values.get("warning_red_days") ?? "",
      DEFAULT_WARNING_RED_DAYS,
    ),
  };
}

function snapshotFromWorkbook(workbook: ExcelJS.Workbook): Snapshot {
  const clients = readRecords(workbook, "Clients")
    .map(toClient)
    .filter((client): client is Client => client !== null);
  const cases = readRecords(workbook, "Cases")
    .map(toCase)
    .filter((item): item is CaseRecord => item !== null);
  const activities = readRecords(workbook, "Activities")
    .map(toActivity)
    .filter((item): item is Activity => item !== null)
    .sort(compareActivities);
  const templates = readRecords(workbook, "Templates")
    .map(toTemplate)
    .filter((item): item is Template => item !== null);
  const settings = settingsFromRecords(readRecords(workbook, "Settings"));
  return { clients, cases, activities, templates, settings };
}

async function readSnapshot(): Promise<Snapshot> {
  const workbook = await loadWorkbook();
  return snapshotFromWorkbook(workbook);
}

function compareDates(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

function compareActivities(a: Activity, b: Activity): number {
  return (
    compareDates(a.date, b.date) ||
    compareDates(a.createdAt, b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

function clientById(snapshot: Snapshot, clientId: string): Client | undefined {
  return snapshot.clients.find((client) => client.id === clientId);
}

function activitiesForCase(
  activities: Activity[],
  caseId: string,
): Activity[] {
  return activities
    .filter((activity) => activity.caseId === caseId)
    .sort(compareActivities);
}

function caseItem(
  caseRecord: CaseRecord,
  client: Client,
  activities: Activity[],
  today = new Date(),
): CaseListItem {
  const lastActivityDate = caseUpdateDate(caseRecord, activities);
  const closed = caseRecord.status === "done" || caseRecord.status === "success";
  const end = closed && caseRecord.endDate ? caseRecord.endDate : todayIso();
  return {
    ...caseRecord,
    client,
    lastActivityDate,
    daysSinceUpdate: daysSince(lastActivityDate, today),
    daysOpen: daysBetween(caseRecord.startDate, end),
    activityCount: activities.length,
  };
}

function searchCase(
  item: CaseListItem,
  query: string,
  settings: AppSettings,
): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  const service = settings.serviceTypes.find(
    (option) => option.id === item.serviceType,
  );
  const ministry = settings.ministries.find(
    (option) => option.id === item.ministry,
  );
  const haystack = [
    item.client.nameKh,
    item.client.nameEn,
    item.client.phone,
    item.description,
    item.serviceType,
    item.ministry,
    service?.kh,
    service?.en,
    ministry?.kh,
    ministry?.en,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

function sortCaseItems(
  items: CaseListItem[],
  sort: string | undefined,
): CaseListItem[] {
  const sorted = [...items];
  if (sort === "newest") {
    return sorted.sort(
      (a, b) => compareDates(b.startDate, a.startDate) || b.createdAt.localeCompare(a.createdAt),
    );
  }
  if (sort === "oldest") {
    return sorted.sort(
      (a, b) => compareDates(a.startDate, b.startDate) || a.createdAt.localeCompare(b.createdAt),
    );
  }
  if (sort === "days_open") {
    return sorted.sort((a, b) => b.daysOpen - a.daysOpen);
  }
  if (sort === "client") {
    return sorted.sort((a, b) => {
      const nameA = (a.client.nameEn || a.client.nameKh).toLowerCase();
      const nameB = (b.client.nameEn || b.client.nameKh).toLowerCase();
      return nameA.localeCompare(nameB) || compareDates(a.startDate, b.startDate);
    });
  }
  return sorted.sort((a, b) => {
    if (a.status === "rejected" && b.status !== "rejected") return -1;
    if (b.status === "rejected" && a.status !== "rejected") return 1;
    return (
      b.daysSinceUpdate - a.daysSinceUpdate ||
      compareDates(a.startDate, b.startDate)
    );
  });
}

function latestMinistry(
  caseRecord: CaseRecord,
  activities: Activity[],
): string {
  const ordered = activitiesForCase(activities, caseRecord.id)
    .filter((activity) => activity.ministry)
    .sort(compareActivities);
  if (ordered.length === 0) return caseRecord.ministry;
  return ordered[ordered.length - 1].ministry;
}

function findRowById(
  sheet: ExcelJS.Worksheet,
  id: string,
): number | null {
  const headers = SHEETS[
    (sheet.name as SheetName) in SHEETS ? (sheet.name as SheetName) : "Clients"
  ].columns;
  const idIndex = headers.indexOf("id");
  if (idIndex < 0) return null;
  let found: number | null = null;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1 || found !== null) return;
    if (cellText(row.getCell(idIndex + 1).value).trim() === id) {
      found = rowNumber;
    }
  });
  return found;
}

function rowExistsByCaseId(sheet: ExcelJS.Worksheet, id: string): number | null {
  return findRowById(sheet, id);
}

function insertRecord(
  sheet: ExcelJS.Worksheet,
  headers: readonly string[],
  values: Record<string, string>,
): void {
  const row = sheet.addRow(headers.map((header) => values[header] ?? ""));
  styleDataRow(row, headers);
}

function replaceRecord(
  row: ExcelJS.Row,
  headers: readonly string[],
  values: Record<string, string>,
): void {
  headers.forEach((header, index) => {
    row.getCell(index + 1).value = values[header] ?? "";
  });
}

function deleteRow(sheet: ExcelJS.Worksheet, rowNumber: number): void {
  sheet.spliceRows(rowNumber, 1);
}

function clientRecordValues(client: Client): Record<string, string> {
  return {
    id: client.id,
    name_kh: client.nameKh,
    name_en: client.nameEn,
    phone: client.phone,
    note: client.note,
    created_at: client.createdAt,
  };
}

function caseRecordValues(caseRecord: CaseRecord): Record<string, string> {
  return {
    id: caseRecord.id,
    client_id: caseRecord.clientId,
    service_type: caseRecord.serviceType,
    ministry: caseRecord.ministry,
    description: caseRecord.description,
    start_date: caseRecord.startDate,
    end_date: caseRecord.endDate,
    status: caseRecord.status,
    share_token: caseRecord.shareToken,
    created_at: caseRecord.createdAt,
  };
}

function activityRecordValues(activity: Activity): Record<string, string> {
  return {
    id: activity.id,
    case_id: activity.caseId,
    date: activity.date,
    ministry: activity.ministry,
    action: activity.action,
    status: activity.status,
    signed: activity.signed ? "TRUE" : "FALSE",
    note: activity.note,
    created_at: activity.createdAt,
  };
}

function templateRecordValues(template: Template): Record<string, string> {
  return {
    id: template.id,
    text_kh: template.textKh,
    text_en: template.textEn,
  };
}

async function createDailyBackup(): Promise<void> {
  const backupPath = path.join(
    BACKUP_DIR,
    `tracker-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  );
  try {
    await fs.copyFile(FILE_PATH, backupPath, fsConstants.COPYFILE_EXCL);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") {
      if (isLockError(error)) throw new ExcelLockedError();
      throw new Error("A daily backup could not be created.", { cause: error });
    }
  }

  try {
    const entries = (await fs.readdir(BACKUP_DIR))
      .filter((name) => /^tracker-\d{4}-\d{2}-\d{2}\.xlsx$/.test(name))
      .sort();
    const stale = entries.slice(0, Math.max(0, entries.length - MAX_BACKUPS));
    await Promise.all(
      stale.map((name) =>
        fs.rm(path.join(BACKUP_DIR, name), { force: true }).catch(() => undefined),
      ),
    );
  } catch (error) {
    console.error("[store] Could not prune old backups", error);
  }
}

async function mutateWorkbook<T>(
  operation: (workbook: ExcelJS.Workbook) => T | Promise<T>,
): Promise<T> {
  return withWriteLock(async () => {
    await ensureStoreFile();
    const workbook = await loadWorkbook();
    const result = await operation(workbook);
    for (const sheetName of SHEET_ORDER) {
      const sheet = workbook.getWorksheet(SHEETS[sheetName].name);
      if (sheet) configureSheet(sheet, SHEETS[sheetName].columns);
    }
    workbook.modified = new Date();
    workbook.lastModifiedBy = "ZKTH Associates & Partners";
    await createDailyBackup();
    const tempPath = path.join(
      DATA_DIR,
      `.tracker-${process.pid}-${Date.now()}.tmp.xlsx`,
    );
    try {
      await workbook.xlsx.writeFile(tempPath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw new Error("The workbook could not be written.", { cause: error });
    }
    try {
      await fs.rename(tempPath, FILE_PATH);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      if (isLockError(error)) throw new ExcelLockedError();
      throw new Error("The workbook could not be replaced.", { cause: error });
    }
    return result;
  });
}

function requireClient(snapshot: Snapshot, id: string): Client {
  const client = clientById(snapshot, id);
  if (!client) throw new StoreNotFoundError("Client not found");
  return client;
}

function requireCase(snapshot: Snapshot, id: string): CaseRecord {
  const found = snapshot.cases.find((item) => item.id === id);
  if (!found) throw new StoreNotFoundError("Case not found");
  return found;
}

function caseEndDateForStatus(
  status: CaseStatus,
  current: string,
  requested?: string,
): string {
  if (requested !== undefined) return requested;
  if (status === "done" || status === "success") return current || todayIso();
  if (status === "rejected") return current;
  return "";
}

export async function getSettings(): Promise<AppSettings> {
  return (await readSnapshot()).settings;
}

export async function updateSettings(
  input: SettingsUpdateInput,
): Promise<AppSettings> {
  return mutateWorkbook((workbook) => {
    const sheet = workbook.getWorksheet("Settings");
    if (!sheet) throw new Error("Settings sheet missing");
    const headers = SHEETS.Settings.columns;
    const updates: Record<string, string> = {
      service_types: JSON.stringify(input.serviceTypes),
      ministries: JSON.stringify(input.ministries),
      status_labels: JSON.stringify(input.statusLabels),
      warning_orange_days: String(input.warningOrangeDays),
      warning_red_days: String(input.warningRedDays),
    };
    const keyIndex = headers.indexOf("key");
    for (const [key, value] of Object.entries(updates)) {
      let foundRow: number | null = null;
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1 || foundRow !== null) return;
        if (cellText(row.getCell(keyIndex + 1).value) === key) {
          foundRow = rowNumber;
        }
      });
      if (foundRow !== null) {
        sheet.getRow(foundRow).getCell(2).value = value;
      } else {
        const row = sheet.addRow([key, value]);
        styleDataRow(row, headers);
      }
    }
    return {
      serviceTypes: input.serviceTypes,
      ministries: input.ministries,
      statusLabels: input.statusLabels,
      warningOrangeDays: input.warningOrangeDays,
      warningRedDays: input.warningRedDays,
    };
  });
}

export async function listTemplates(): Promise<Template[]> {
  return (await readSnapshot()).templates;
}

export async function createTemplate(input: TemplateInput): Promise<Template> {
  return mutateWorkbook((workbook) => {
    const ids = new Set(
      readRecords(workbook, "Templates").map((record) => record.id),
    );
    const template: Template = {
      id: randomUUID(),
      textKh: input.textKh,
      textEn: input.textEn,
    };
    if (ids.has(template.id)) throw new StoreConflictError();
    insertRecord(
      workbook.getWorksheet("Templates") as ExcelJS.Worksheet,
      SHEETS.Templates.columns,
      templateRecordValues(template),
    );
    return template;
  });
}

export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<Template> {
  return mutateWorkbook((workbook) => {
    const sheet = workbook.getWorksheet("Templates");
    if (!sheet) throw new Error("Templates sheet missing");
    const rowNumber = findRowById(sheet, id);
    if (!rowNumber) throw new StoreNotFoundError("Template not found");
    const template: Template = { id, ...input };
    replaceRecord(sheet.getRow(rowNumber), SHEETS.Templates.columns, templateRecordValues(template));
    return template;
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await mutateWorkbook((workbook) => {
    const sheet = workbook.getWorksheet("Templates");
    if (!sheet) throw new Error("Templates sheet missing");
    const rowNumber = findRowById(sheet, id);
    if (!rowNumber) throw new StoreNotFoundError("Template not found");
    deleteRow(sheet, rowNumber);
  });
}

export async function listClients(query = ""): Promise<ClientWithStats[]> {
  const snapshot = await readSnapshot();
  const needle = query.trim().toLowerCase();
  const items = snapshot.clients
    .map((client) => {
      const clientCases = snapshot.cases.filter(
        (item) => item.clientId === client.id,
      );
      const openCaseCount = clientCases.filter(
        (item) => item.status !== "done" && item.status !== "success",
      ).length;
      const latestCaseDate = clientCases.reduce(
        (latest, item) => (item.startDate > latest ? item.startDate : latest),
        "",
      );
      return {
        ...client,
        caseCount: clientCases.length,
        openCaseCount,
        latestCaseDate,
      };
    })
    .filter((client) => {
      if (!needle) return true;
      return [client.nameKh, client.nameEn, client.phone, client.note]
        .join("\n")
        .toLowerCase()
        .includes(needle);
    });
  return items.sort((a, b) => {
    const nameA = (a.nameEn || a.nameKh).toLowerCase();
    const nameB = (b.nameEn || b.nameKh).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

export async function getClient(id: string): Promise<Client | null> {
  return clientById(await readSnapshot(), id) ?? null;
}

export async function createClient(input: ClientCreateInput): Promise<Client> {
  return mutateWorkbook((workbook) => {
    const client: Client = {
      id: randomUUID(),
      nameKh: input.nameKh,
      nameEn: input.nameEn,
      phone: input.phone,
      note: input.note,
      createdAt: nowIso(),
    };
    insertRecord(
      workbook.getWorksheet("Clients") as ExcelJS.Worksheet,
      SHEETS.Clients.columns,
      clientRecordValues(client),
    );
    return client;
  });
}

export async function listCases(
  filters: CaseFilters = {},
): Promise<CaseListItem[]> {
  const snapshot = await readSnapshot();
  const items = snapshot.cases
    .map((caseRecord) => {
      const client = clientById(snapshot, caseRecord.clientId);
      if (!client) return null;
      return caseItem(
        caseRecord,
        client,
        activitiesForCase(snapshot.activities, caseRecord.id),
      );
    })
    .filter((item): item is CaseListItem => item !== null)
    .filter((item) => searchCase(item, filters.q ?? "", snapshot.settings))
    .filter(
      (item) =>
        !filters.status ||
        filters.status === "all" ||
        item.status === filters.status,
    )
    .filter(
      (item) =>
        !filters.ministry ||
        filters.ministry === "all" ||
        item.ministry === filters.ministry,
    )
    .filter(
      (item) =>
        !filters.serviceType ||
        filters.serviceType === "all" ||
        item.serviceType === filters.serviceType,
    );
  return sortCaseItems(items, filters.sort);
}

export async function getCase(id: string): Promise<CaseDetail> {
  const snapshot = await readSnapshot();
  const caseRecord = requireCase(snapshot, id);
  const client = requireClient(snapshot, caseRecord.clientId);
  const activities = activitiesForCase(snapshot.activities, id);
  return {
    case: caseRecord,
    client,
    activities,
    lastActivityDate: caseUpdateDate(caseRecord, activities),
  };
}

export async function createCase(input: CaseCreateInput): Promise<CaseRecord> {
  return mutateWorkbook((workbook) => {
    const snapshot = snapshotFromWorkbook(workbook);
    requireClient(snapshot, input.clientId);
    const existingTokens = new Set(
      snapshot.cases.map((item) => item.shareToken).filter(Boolean),
    );
    const status = normalizeCaseStatus(input.status);
    const startDate = input.startDate || todayIso();
    const endDate = caseEndDateForStatus(status, "", input.endDate);
    const caseRecord: CaseRecord = {
      id: randomUUID(),
      clientId: input.clientId,
      serviceType: input.serviceType,
      ministry: input.ministry,
      description: input.description,
      startDate,
      endDate,
      status,
      shareToken: newShareToken(existingTokens),
      createdAt: nowIso(),
    };
    insertRecord(
      workbook.getWorksheet("Cases") as ExcelJS.Worksheet,
      SHEETS.Cases.columns,
      caseRecordValues(caseRecord),
    );
    return caseRecord;
  });
}

export async function updateCase(
  id: string,
  patch: CaseUpdateInput,
): Promise<CaseRecord> {
  return mutateWorkbook((workbook) => {
    const sheet = workbook.getWorksheet("Cases");
    if (!sheet) throw new Error("Cases sheet missing");
    const rowNumber = rowExistsByCaseId(sheet, id);
    if (!rowNumber) throw new StoreNotFoundError("Case not found");
    const snapshot = snapshotFromWorkbook(workbook);
    const current = requireCase(snapshot, id);
    const status = patch.status ?? current.status;
    const next: CaseRecord = {
      ...current,
      status,
      ministry: patch.ministry ?? current.ministry,
      description: patch.description ?? current.description,
      endDate: patch.endDate !== undefined
        ? patch.endDate
        : caseEndDateForStatus(status, current.endDate, undefined),
    };
    if (next.status === "done" || next.status === "success") {
      if (!next.endDate) next.endDate = todayIso();
    }
    if (
      next.status === "in_progress" ||
      next.status === "waiting" ||
      next.status === "rejected"
    ) {
      if (patch.endDate === undefined) next.endDate = "";
    }
    replaceRecord(sheet.getRow(rowNumber), SHEETS.Cases.columns, caseRecordValues(next));
    return next;
  });
}

export async function listActivities(caseId: string): Promise<Activity[]> {
  const snapshot = await readSnapshot();
  requireCase(snapshot, caseId);
  return activitiesForCase(snapshot.activities, caseId);
}

export async function createActivity(
  input: ActivityCreateInput,
): Promise<Activity> {
  return mutateWorkbook((workbook) => {
    const snapshot = snapshotFromWorkbook(workbook);
    const caseRecord = requireCase(snapshot, input.caseId);
    const activity: Activity = {
      id: randomUUID(),
      caseId: input.caseId,
      date: input.date,
      ministry: input.ministry,
      action: input.action,
      status: normalizeActivityStatus(input.status),
      signed: input.signed,
      note: input.note,
      createdAt: nowIso(),
    };
    const activitiesSheet = workbook.getWorksheet("Activities");
    const casesSheet = workbook.getWorksheet("Cases");
    if (!activitiesSheet || !casesSheet) throw new Error("Required sheet missing");
    insertRecord(
      activitiesSheet,
      SHEETS.Activities.columns,
      activityRecordValues(activity),
    );

    const allActivities = [...snapshot.activities, activity];
    const nextCase: CaseRecord = {
      ...caseRecord,
      ministry: latestMinistry(caseRecord, allActivities),
      status: activity.status === "rejected" ? "rejected" : caseRecord.status,
    };
    const caseRow = rowExistsByCaseId(casesSheet, caseRecord.id);
    if (caseRow) {
      replaceRecord(
        casesSheet.getRow(caseRow),
        SHEETS.Cases.columns,
        caseRecordValues(nextCase),
      );
    }
    return activity;
  });
}

export async function updateActivity(
  id: string,
  input: ActivityUpdateInput,
): Promise<Activity> {
  return mutateWorkbook((workbook) => {
    const activitySheet = workbook.getWorksheet("Activities");
    const caseSheet = workbook.getWorksheet("Cases");
    if (!activitySheet || !caseSheet) throw new Error("Required sheet missing");
    const rowNumber = findRowById(activitySheet, id);
    if (!rowNumber) throw new StoreNotFoundError("Activity not found");
    const snapshot = snapshotFromWorkbook(workbook);
    const current = snapshot.activities.find((item) => item.id === id);
    if (!current) throw new StoreNotFoundError("Activity not found");
    const updated: Activity = {
      ...current,
      date: input.date,
      ministry: input.ministry,
      action: input.action,
      status: normalizeActivityStatus(input.status),
      signed: input.signed,
      note: input.note,
    };
    replaceRecord(
      activitySheet.getRow(rowNumber),
      SHEETS.Activities.columns,
      activityRecordValues(updated),
    );
    const caseRecord = requireCase(snapshot, updated.caseId);
    const allActivities = snapshot.activities.map((activity) =>
      activity.id === id ? updated : activity,
    );
    const nextMinistry = latestMinistry(caseRecord, allActivities);
    const caseRow = rowExistsByCaseId(caseSheet, caseRecord.id);
    if (caseRow && nextMinistry !== caseRecord.ministry) {
      const nextCase = { ...caseRecord, ministry: nextMinistry };
      replaceRecord(
        caseSheet.getRow(caseRow),
        SHEETS.Cases.columns,
        caseRecordValues(nextCase),
      );
    }
    return updated;
  });
}

export async function deleteActivity(id: string): Promise<void> {
  await mutateWorkbook((workbook) => {
    const activitySheet = workbook.getWorksheet("Activities");
    const caseSheet = workbook.getWorksheet("Cases");
    if (!activitySheet || !caseSheet) throw new Error("Required sheet missing");
    const rowNumber = findRowById(activitySheet, id);
    if (!rowNumber) throw new StoreNotFoundError("Activity not found");
    const snapshot = snapshotFromWorkbook(workbook);
    const current = snapshot.activities.find((item) => item.id === id);
    if (!current) throw new StoreNotFoundError("Activity not found");
    deleteRow(activitySheet, rowNumber);
    const remaining = snapshot.activities.filter((item) => item.id !== id);
    const caseRecord = snapshot.cases.find((item) => item.id === current.caseId);
    if (!caseRecord) return;
    const nextMinistry = latestMinistry(caseRecord, remaining);
    if (nextMinistry !== caseRecord.ministry) {
      const caseRow = rowExistsByCaseId(caseSheet, caseRecord.id);
      if (caseRow) {
        const nextCase = { ...caseRecord, ministry: nextMinistry };
        replaceRecord(
          caseSheet.getRow(caseRow),
          SHEETS.Cases.columns,
          caseRecordValues(nextCase),
        );
      }
    }
  });
}

export async function regenerateShareToken(caseId: string): Promise<string> {
  return mutateWorkbook((workbook) => {
    const sheet = workbook.getWorksheet("Cases");
    if (!sheet) throw new Error("Cases sheet missing");
    const rowNumber = rowExistsByCaseId(sheet, caseId);
    if (!rowNumber) throw new StoreNotFoundError("Case not found");
    const snapshot = snapshotFromWorkbook(workbook);
    const caseRecord = requireCase(snapshot, caseId);
    const existing = new Set(
      snapshot.cases
        .filter((item) => item.id !== caseId)
        .map((item) => item.shareToken)
        .filter(Boolean),
    );
    const token = newShareToken(existing);
    const next = { ...caseRecord, shareToken: token };
    replaceRecord(sheet.getRow(rowNumber), SHEETS.Cases.columns, caseRecordValues(next));
    return token;
  });
}

export async function getSharedCase(token: string): Promise<{
  case: CaseRecord;
  client: Client;
  activities: Array<
    Pick<Activity, "id" | "date" | "ministry" | "action" | "status">
  >;
  lastActivityDate: string;
} | null> {
  if (!token || token.length < 20) return null;
  const snapshot = await readSnapshot();
  const caseRecord = snapshot.cases.find((item) => item.shareToken === token);
  if (!caseRecord) return null;
  const client = clientById(snapshot, caseRecord.clientId);
  if (!client) return null;
  const activities = activitiesForCase(snapshot.activities, caseRecord.id).map(
    (activity) => ({
      id: activity.id,
      date: activity.date,
      ministry: activity.ministry,
      action: activity.action,
      status: activity.status,
    }),
  );
  return {
    case: caseRecord,
    client,
    activities,
    lastActivityDate: caseUpdateDate(caseRecord, activities),
  };
}

export async function getQuickAddData(): Promise<{
  cases: CasePickerItem[];
  templates: Template[];
  settings: AppSettings;
}> {
  const snapshot = await readSnapshot();
  const cases = snapshot.cases
    .map((caseRecord) => {
      const client = clientById(snapshot, caseRecord.clientId);
      if (!client) return null;
      return {
        id: caseRecord.id,
        clientNameKh: client.nameKh,
        clientNameEn: client.nameEn,
        serviceType: caseRecord.serviceType,
        ministry: caseRecord.ministry,
        status: caseRecord.status,
      } satisfies CasePickerItem;
    })
    .filter((item): item is CasePickerItem => item !== null)
    .sort((a, b) =>
      (a.clientNameEn || a.clientNameKh).localeCompare(
        b.clientNameEn || b.clientNameKh,
      ),
    );
  return {
    cases,
    templates: snapshot.templates,
    settings: snapshot.settings,
  };
}

export async function getTodayData(): Promise<{
  cases: CaseListItem[];
  stats: CaseStats;
  settings: AppSettings;
}> {
  const snapshot = await readSnapshot();
  const items = snapshot.cases
    .map((caseRecord) => {
      const client = clientById(snapshot, caseRecord.clientId);
      if (!client) return null;
      return caseItem(
        caseRecord,
        client,
        activitiesForCase(snapshot.activities, caseRecord.id),
      );
    })
    .filter((item): item is CaseListItem => item !== null);

  const settings = snapshot.settings;
  const open = items.filter(
    (item) => item.status !== "done" && item.status !== "success",
  );
  const monthPrefix = format(new Date(), "yyyy-MM");
  const stats: CaseStats = {
    openCases: open.length,
    waiting: open.filter((item) => item.status === "waiting").length,
    overdue: open.filter(
      (item) => item.daysSinceUpdate >= settings.warningRedDays,
    ).length,
    completedThisMonth: items.filter(
      (item) =>
        (item.status === "done" || item.status === "success") &&
        Boolean(item.endDate) &&
        item.endDate.startsWith(monthPrefix),
    ).length,
  };

  const attention = open
    .filter((item) => {
      if (item.status === "rejected") return true;
      if (item.status === "waiting") {
        return item.daysSinceUpdate >= settings.warningOrangeDays;
      }
      return item.daysSinceUpdate >= settings.warningOrangeDays;
    })
    .sort(
      (a, b) =>
        b.daysSinceUpdate - a.daysSinceUpdate ||
        compareDates(a.startDate, b.startDate),
    );

  return { cases: attention, stats, settings };
}

export function statusesForCase(): readonly CaseStatus[] {
  return CASE_STATUSES;
}

export function statusesForActivity(): readonly ActivityStatus[] {
  return ACTIVITY_STATUSES;
}

export function isWorkbookLockedError(error: unknown): boolean {
  return error instanceof ExcelLockedError;
}

export function assertDateRange(startDate: string, endDate: string): void {
  if (!endDate) return;
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new StoreValidationError("End date must be after start date");
  }
}
