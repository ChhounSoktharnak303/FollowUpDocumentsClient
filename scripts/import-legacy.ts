import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { todayIso } from "@/lib/format";
import {
  createActivity,
  createCase,
  createClient,
  getSettings,
  listCases,
  listClients,
  updateCase,
  updateSettings,
} from "@/lib/store";
import type {
  ActivityStatus,
  AppSettings,
  CaseStatus,
  Client,
  ListOption,
} from "@/lib/types";

const DEFAULT_SOURCE = path.join(
  process.cwd(),
  "data",
  "legacy",
  "Document_Follow_Up_Tracker.xlsx",
);
const OVERVIEW_NAME = "ទិដ្ឋភាពទូទៅ";
const REPORT_PATH = path.join(
  process.cwd(),
  "data",
  "legacy",
  "import-report.json",
);

type DateConvention = "ymd" | "ydm";

interface RawActivity {
  dateRaw: unknown;
  action: string;
  statusRaw: string;
  signedRaw: string;
  note: string;
  rowNumber: number;
}

interface SheetData {
  name: string;
  clientName: string;
  activities: RawActivity[];
  convention: DateConvention;
  conventionSource: "sequence" | "default";
  ymdInversions: number;
  ydmInversions: number;
}

interface OverviewStage {
  ministryRaw: string;
  startRaw: unknown;
}

interface OverviewRecord {
  clientName: string;
  serviceRaw: string;
  startRaw: unknown;
  endRaw: unknown;
  statusRaw: string;
  descriptionParts: string[];
  noteParts: string[];
  stages: OverviewStage[];
}

interface PlannedActivity {
  date: string;
  ministry: string;
  action: string;
  status: ActivityStatus;
  signed: boolean;
  note: string;
  sourceRow: number;
}

interface PlannedCase {
  clientName: string;
  sheetName: string | null;
  serviceType: string;
  ministry: string;
  description: string;
  startDate: string;
  endDate: string;
  status: CaseStatus;
  activities: PlannedActivity[];
}

interface OptionState {
  options: ListOption[];
  added: ListOption[];
  prefix: string;
}

interface BuildStats {
  duplicateActivities: number;
  warnings: string[];
}

const CASE_STATUS_ALIASES: Record<string, CaseStatus> = {
  "inprogress": "in_progress",
  "in_progress": "in_progress",
  "កំពុងដំណើរការ": "in_progress",
  "waiting": "waiting",
  "រង់ចាំ": "waiting",
  "កំពុងរង់ចាំ": "waiting",
  "done": "done",
  "រួចរាល់": "done",
  "success": "success",
  "ជោគជ័យ": "success",
  "rejected": "rejected",
  "បដិសេធ": "rejected",
};

function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return isoFromDate(value) ?? "";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("result" in record) return clean(record.result);
    if ("text" in record) return clean(record.text);
    if (Array.isArray(record.richText)) {
      return clean(
        record.richText
          .map((part) =>
            part && typeof part === "object" && "text" in part
              ? String((part as { text: unknown }).text)
              : "",
          )
          .join(""),
      );
    }
    return String(value);
  }
  return String(value).replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
}

function normalizeLabel(value: string): string {
  return clean(value).toLowerCase().replace(/\s+/g, "");
}

function normalizeName(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/^អតិថិជន\s*[៖:\-]?\s*/u, "")
    .replace(/[^a-z0-9\u1780-\u17ff]/g, "");
}

function clientNameFromSheet(sheetName: string): string {
  const stripped = sheetName
    .replace(/^អតិថិជន\s*[៖:\-]?\s*/u, "")
    .trim();
  return stripped || sheetName.trim();
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function uniqueParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const cleaned = clean(part);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }
  return result;
}

function mapCaseStatus(raw: string): CaseStatus | null {
  return CASE_STATUS_ALIASES[normalizeLabel(raw)] ?? null;
}

function mapActivityStatus(raw: string): ActivityStatus | null {
  const status = mapCaseStatus(raw);
  if (!status) return null;
  return status === "success" ? "done" : status;
}

function parseSigned(raw: string): boolean {
  const value = clean(raw).toLowerCase();
  if (!value) return false;
  return [
    "មាន",
    "បាន",
    "ហត្ថលេខា",
    "yes",
    "true",
    "1",
    "x",
    "signed",
    "✓",
    "☑",
    "√",
  ].includes(value);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string | null {
  let normalizedYear = year;
  if (normalizedYear >= 2400 && normalizedYear <= 2600) {
    normalizedYear -= 543;
  }
  if (normalizedYear >= 0 && normalizedYear < 100) {
    normalizedYear += 2000;
  }
  if (normalizedYear < 1900 || normalizedYear > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(normalizedYear, month - 1, day));
  if (
    date.getUTCFullYear() !== normalizedYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${normalizedYear}-${pad(month)}-${pad(day)}`;
}

function isoFromDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;
  return toIsoDate(
    value.getUTCFullYear(),
    value.getUTCMonth() + 1,
    value.getUTCDate(),
  );
}

function excelSerialToIso(value: number): string | null {
  if (!Number.isFinite(value) || value < 1 || value > 2958465) return null;
  const date = new Date(Math.round((value - 25569) * 86400000));
  return isoFromDate(date);
}

function parseDateValue(
  value: unknown,
  convention: DateConvention,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isoFromDate(value);
  if (typeof value === "number") return excelSerialToIso(value);

  const text = clean(value)
    .replace(/[០-៩]/g, (digit) =>
      String("០១២៣៤៥៦៧៨៩".indexOf(digit)),
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  if (/^\d{5}(?:\.\d+)?$/.test(text)) {
    return excelSerialToIso(Number(text));
  }

  const iso = text.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/,
  );
  if (iso) {
    const year = Number(iso[1]);
    const first = Number(iso[2]);
    const second = Number(iso[3]);
    if (first > 12 && second <= 12) {
      return toIsoDate(year, second, first);
    }
    if (second > 12 && first <= 12) {
      return toIsoDate(year, first, second);
    }
    if (first <= 12 && second <= 12) {
      return convention === "ydm"
        ? toIsoDate(year, second, first)
        : toIsoDate(year, first, second);
    }
    return null;
  }

  const dmy = text.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T].*)?$/,
  );
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (first > 12 && second <= 12) {
      return toIsoDate(year, second, first);
    }
    if (second > 12 && first <= 12) {
      return toIsoDate(year, first, second);
    }
    return toIsoDate(year, second, first);
  }

  return null;
}

function inversionCount(dates: Array<string | null>): number {
  let previous = "";
  let count = 0;
  for (const date of dates) {
    if (!date) continue;
    if (previous && date < previous) count += 1;
    previous = date;
  }
  return count;
}

function findHeaderRow(
  sheet: ExcelJS.Worksheet,
  needles: string[],
): number {
  const lowerNeedles = needles.map((needle) => needle.toLowerCase());
  const maxRow = Math.min(sheet.rowCount, 20);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      const text = clean(row.getCell(column).value).toLowerCase();
      if (lowerNeedles.some((needle) => text.includes(needle))) {
        return rowNumber;
      }
    }
  }
  return 3;
}

function headerMap(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.getRow(headerRow);
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const text = clean(row.getCell(column).value).toLowerCase();
    if (text && !map.has(text)) map.set(text, column);
  }
  return map;
}

function headerIndex(
  map: Map<string, number>,
  aliases: string[],
  fallback: number,
): number {
  for (const alias of aliases) {
    const index = map.get(alias.toLowerCase());
    if (index) return index;
  }
  return fallback;
}

function readSheets(
  workbook: ExcelJS.Workbook,
  overviewSheetName: string,
  warnings: string[],
): SheetData[] {
  const sheets: SheetData[] = [];
  for (const worksheet of workbook.worksheets) {
    const name = worksheet.name;
    if (name === overviewSheetName || name.toLowerCase() === "sheet1") {
      continue;
    }
    const headerRow = findHeaderRow(worksheet, [
      "កាលបរិច្ឆេទ",
      "ឯកសារ / សកម្មភាព",
    ]);
    const headers = headerMap(worksheet, headerRow);
    const dateColumn = headerIndex(headers, ["កាលបរិច្ឆេទ", "date"], 2);
    const actionColumn = headerIndex(
      headers,
      ["ឯកសារ / សកម្មភាព", "action"],
      3,
    );
    const statusColumn = headerIndex(
      headers,
      ["ស្ថានភាព", "status"],
      4,
    );
    const signedColumn = headerIndex(
      headers,
      ["ហត្ថលេខា", "signed"],
      5,
    );
    const noteColumn = headerIndex(
      headers,
      ["កំណត់ចំណាំ", "note"],
      6,
    );

    const activities: RawActivity[] = [];
    for (
      let rowNumber = headerRow + 1;
      rowNumber <= worksheet.rowCount;
      rowNumber += 1
    ) {
      const row = worksheet.getRow(rowNumber);
      const action = clean(row.getCell(actionColumn).value);
      if (!action) continue;
      activities.push({
        dateRaw: row.getCell(dateColumn).value,
        action,
        statusRaw: clean(row.getCell(statusColumn).value),
        signedRaw: clean(row.getCell(signedColumn).value),
        note: clean(row.getCell(noteColumn).value),
        rowNumber,
      });
    }

    const ymdInversions = inversionCount(
      activities.map((activity) =>
        parseDateValue(activity.dateRaw, "ymd"),
      ),
    );
    const ydmInversions = inversionCount(
      activities.map((activity) =>
        parseDateValue(activity.dateRaw, "ydm"),
      ),
    );

    sheets.push({
      name,
      clientName: clientNameFromSheet(name),
      activities,
      convention: "ymd",
      conventionSource: "default",
      ymdInversions,
      ydmInversions,
    });
  }

  if (sheets.length === 0) {
    warnings.push("No client sheets were found in the legacy workbook.");
  }
  return sheets;
}

function readOverview(
  worksheet: ExcelJS.Worksheet,
  warnings: string[],
): OverviewRecord[] {
  const headerRow = findHeaderRow(worksheet, ["ឈ្មោះអតិថិជន"]);
  const headers = headerMap(worksheet, headerRow);
  const nameColumn = headerIndex(
    headers,
    ["ឈ្មោះអតិថិជន", "client"],
    2,
  );
  const serviceColumn = headerIndex(
    headers,
    ["ប្រភេទសេវាកម្ម", "service"],
    3,
  );
  const ministryColumn = headerIndex(headers, ["ក្រសួង", "ministry"], 4);
  const descriptionColumn = headerIndex(
    headers,
    ["បរិយាយ", "description"],
    5,
  );
  const startColumn = headerIndex(
    headers,
    ["ថ្ងៃចាប់ផ្តើម", "start"],
    6,
  );
  const endColumn = headerIndex(headers, ["ថ្ងៃបញ្ចប់", "end"], 7);
  const statusColumn = headerIndex(
    headers,
    ["status", "ស្ថានភាព"],
    8,
  );
  const noteColumn = headerIndex(headers, ["សម្គាល់", "note"], 9);

  const records: OverviewRecord[] = [];
  const signatures = new Set<string>();
  let current: OverviewRecord | null = null;

  for (
    let rowNumber = headerRow + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const clientName = clean(row.getCell(nameColumn).value);
    const serviceRaw = clean(row.getCell(serviceColumn).value);
    const ministryRaw = clean(row.getCell(ministryColumn).value);
    const description = clean(row.getCell(descriptionColumn).value);
    const startRaw = row.getCell(startColumn).value;
    const endRaw = row.getCell(endColumn).value;
    const statusRaw = clean(row.getCell(statusColumn).value);
    const note = clean(row.getCell(noteColumn).value);

    if (clientName) {
      const signature = [
        normalizeName(clientName),
        serviceRaw,
        clean(startRaw),
        clean(endRaw),
        statusRaw,
        description,
        note,
      ].join("|");
      if (signatures.has(signature)) {
        warnings.push(
          `Skipped a duplicate overview row for "${clientName}".`,
        );
        current = null;
        continue;
      }
      signatures.add(signature);
      current = {
        clientName,
        serviceRaw,
        startRaw,
        endRaw,
        statusRaw,
        descriptionParts: description ? [description] : [],
        noteParts: note ? [note] : [],
        stages: [],
      };
      records.push(current);
    }

    if (!current) continue;

    if (ministryRaw) {
      const previousStage = current.stages[current.stages.length - 1];
      if (
        previousStage &&
        normalizeLabel(previousStage.ministryRaw) ===
          normalizeLabel(ministryRaw)
      ) {
        if (!clean(previousStage.startRaw) && clean(startRaw)) {
          previousStage.startRaw = startRaw;
        }
      } else {
        current.stages.push({ ministryRaw, startRaw });
      }
    }

    if (description) current.descriptionParts.push(description);
    if (note) current.noteParts.push(note);
    if (!current.serviceRaw && serviceRaw) current.serviceRaw = serviceRaw;
    if (!current.statusRaw && statusRaw) current.statusRaw = statusRaw;
    if (!clean(current.endRaw) && clean(endRaw)) current.endRaw = endRaw;
  }

  return records;
}

function optionSlug(raw: string, prefix: string, count: number): string {
  const ascii = raw
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `${prefix}-${count}`;
}

function uniqueOptionId(
  state: OptionState,
  raw: string,
  count: number,
): string {
  const base = optionSlug(raw, state.prefix, count);
  let candidate = base;
  let suffix = 2;
  while (state.options.some((option) => option.id === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function resolveOption(
  raw: string,
  state: OptionState,
  emptyFallback: string,
): string {
  const cleaned = clean(raw);
  if (!cleaned) return emptyFallback;
  const normalized = normalizeLabel(cleaned);
  const existing = state.options.find(
    (option) =>
      normalizeLabel(option.kh) === normalized ||
      normalizeLabel(option.en) === normalized,
  );
  if (existing) return existing.id;
  const option: ListOption = {
    id: uniqueOptionId(state, cleaned, state.added.length + 1),
    kh: cleaned,
    en: cleaned,
  };
  state.options.push(option);
  state.added.push(option);
  return option.id;
}

function fallbackOptionId(options: ListOption[], preferred: string): string {
  return (
    options.find((option) => option.id === preferred)?.id ??
    options[0]?.id ??
    ""
  );
}

function assignMinistry(
  date: string,
  stages: Array<{ id: string; startDate: string }>,
  fallback: string,
): string {
  if (stages.length === 0) return fallback;
  const dated = stages.filter((stage) => stage.startDate);
  if (dated.length === 0) return stages[0].id || fallback;
  let chosen = dated[0].id;
  for (const stage of dated) {
    if (stage.startDate <= date) chosen = stage.id;
  }
  return chosen || fallback;
}

function buildActivities(
  sheet: SheetData | null,
  convention: DateConvention,
  stages: Array<{ id: string; startDate: string }>,
  fallbackMinistry: string,
  fallbackStart: string,
  stats: BuildStats,
): PlannedActivity[] {
  if (!sheet) return [];
  const result: PlannedActivity[] = [];
  const seen = new Set<string>();
  let previousDate = "";

  for (const rawActivity of sheet.activities) {
    const parsed = parseDateValue(rawActivity.dateRaw, convention);
    let date = parsed;
    if (!date) {
      date = previousDate || fallbackStart;
      if (clean(rawActivity.dateRaw)) {
        stats.warnings.push(
          `Sheet "${sheet.name}" row ${rawActivity.rowNumber}: unreadable date "${clean(
            rawActivity.dateRaw,
          )}" replaced with ${date}.`,
        );
      }
    }
    previousDate = date;

    const status =
      mapActivityStatus(rawActivity.statusRaw) ?? "in_progress";
    if (!mapActivityStatus(rawActivity.statusRaw) && clean(rawActivity.statusRaw)) {
      stats.warnings.push(
        `Sheet "${sheet.name}" row ${rawActivity.rowNumber}: unknown status "${rawActivity.statusRaw}" imported as in progress.`,
      );
    }

    const action = clip(rawActivity.action, 2000);
    const note = clip(rawActivity.note, 5000);
    const signed = parseSigned(rawActivity.signedRaw);
    const key = [date, action, status, signed, note].join("|");
    if (seen.has(key)) {
      stats.duplicateActivities += 1;
      continue;
    }
    seen.add(key);

    result.push({
      date,
      ministry: assignMinistry(date, stages, fallbackMinistry),
      action,
      status,
      signed,
      note,
      sourceRow: rawActivity.rowNumber,
    });
  }

  return result;
}

function earliestDate(activities: PlannedActivity[]): string {
  return activities.reduce(
    (earliest, activity) =>
      !earliest || activity.date < earliest ? activity.date : earliest,
    "",
  );
}

function latestDate(activities: PlannedActivity[]): string {
  return activities.reduce(
    (latest, activity) =>
      activity.date > latest ? activity.date : latest,
    "",
  );
}

function planOverviewCase(
  record: OverviewRecord,
  sheet: SheetData | null,
  convention: DateConvention,
  serviceState: OptionState,
  ministryState: OptionState,
  fallbackService: string,
  stats: BuildStats,
): PlannedCase {
  const overviewStart = parseDateValue(record.startRaw, convention);
  const stages = record.stages
    .filter((stage) => clean(stage.ministryRaw))
    .map((stage) => ({
      id: resolveOption(stage.ministryRaw, ministryState, ""),
      startDate: parseDateValue(stage.startRaw, convention) ?? "",
    }));
  const primaryMinistry = stages[0]?.id ?? "";
  const fallbackStart = overviewStart ?? todayIso();
  const activities = buildActivities(
    sheet,
    convention,
    stages,
    primaryMinistry,
    fallbackStart,
    stats,
  );
  const firstActivity = earliestDate(activities);
  let startDate = overviewStart || firstActivity || todayIso();
  if (overviewStart && firstActivity && firstActivity < overviewStart) {
    stats.warnings.push(
      `Case "${record.clientName}" starts at ${firstActivity} because an activity is earlier than the overview start ${overviewStart}.`,
    );
    startDate = firstActivity;
  } else if (firstActivity && !overviewStart) {
    startDate = firstActivity;
  }

  const status = mapCaseStatus(record.statusRaw) ?? "in_progress";
  if (!mapCaseStatus(record.statusRaw) && clean(record.statusRaw)) {
    stats.warnings.push(
      `Case "${record.clientName}" has unknown status "${record.statusRaw}" and was imported as in progress.`,
    );
  }

  let endDate = "";
  if (status === "done" || status === "success") {
    const latestActivity = latestDate(activities);
    endDate =
      parseDateValue(record.endRaw, convention) ||
      latestActivity ||
      todayIso();
    if (endDate > todayIso()) {
      stats.warnings.push(
        `Case "${record.clientName}" has a future end date ${endDate}; used ${
          latestActivity && latestActivity <= todayIso()
            ? latestActivity
            : todayIso()
        } instead.`,
      );
      endDate =
        latestActivity && latestActivity <= todayIso()
          ? latestActivity
          : todayIso();
    }
    if (endDate < startDate) {
      stats.warnings.push(
        `Case "${record.clientName}" ends before it starts; end date set to ${startDate}.`,
      );
      endDate = startDate;
    }
  }

  const currentMinistry =
    activities[activities.length - 1]?.ministry ||
    primaryMinistry ||
    stages[stages.length - 1]?.id;
  const description = clip(
    uniqueParts([...record.descriptionParts, ...record.noteParts]).join(
      " · ",
    ),
    3000,
  );

  return {
    clientName: record.clientName,
    sheetName: sheet?.name ?? null,
    serviceType: resolveOption(
      record.serviceRaw,
      serviceState,
      fallbackService,
    ),
    ministry: currentMinistry,
    description,
    startDate,
    endDate,
    status,
    activities,
  };
}

function planSheetOnlyCase(
  sheet: SheetData,
  convention: DateConvention,
  serviceState: OptionState,
  ministryState: OptionState,
  fallbackService: string,
  stats: BuildStats,
): PlannedCase {
  const activities = buildActivities(
    sheet,
    convention,
    [],
    "",
    todayIso(),
    stats,
  );
  const startDate = earliestDate(activities) || todayIso();
  const lastStatus = activities[activities.length - 1]?.status;
  const status: CaseStatus =
    lastStatus === "rejected" ? "rejected" : "in_progress";
  stats.warnings.push(
    `Client sheet "${sheet.name}" has no overview row; imported with default service and no ministry.`,
  );
  return {
    clientName: sheet.clientName,
    sheetName: sheet.name,
    serviceType: resolveOption("", serviceState, fallbackService),
    ministry: "",
    description: "",
    startDate,
    endDate: "",
    status,
    activities,
  };
}

function clientNames(raw: string): Pick<Client, "nameKh" | "nameEn"> {
  const name = clip(clean(raw), 160);
  if (/[\u1780-\u17ff]/u.test(name)) {
    return { nameKh: name, nameEn: "" };
  }
  return { nameKh: "", nameEn: name };
}

async function main(): Promise<void> {
  const sourcePath = path.resolve(process.argv[2] ?? DEFAULT_SOURCE);
  const sourceStat = await fs.stat(sourcePath).catch(() => null);
  if (!sourceStat?.isFile()) {
    throw new Error(`Legacy workbook not found: ${sourcePath}`);
  }

  const existingClients = await listClients();
  const existingCases = await listCases();
  const settings = await getSettings();
  if (existingClients.length > 0 || existingCases.length > 0) {
    console.error(
      "Import aborted: data/tracker.xlsx already contains clients or cases.",
    );
    console.error(
      "Back up and remove data/tracker.xlsx, then run npm run import again.",
    );
    process.exitCode = 1;
    return;
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(sourcePath);
  } catch (error) {
    throw new Error(`The legacy workbook could not be read: ${sourcePath}`, {
      cause: error,
    });
  }

  const warnings: string[] = [];
  const overviewSheet =
    workbook.worksheets.find((sheet) => sheet.name === OVERVIEW_NAME) ??
    workbook.worksheets.find((sheet) => {
      const headerRow = findHeaderRow(sheet, ["ឈ្មោះអតិថិជន"]);
      return clean(
        sheet.getRow(headerRow).getCell(2).value,
      ).toLowerCase().includes("ឈ្មោះអតិថិជន");
    });
  if (!overviewSheet) {
    throw new Error("The legacy overview sheet could not be found.");
  }

  const overview = readOverview(overviewSheet, warnings);
  if (overview.length === 0) {
    throw new Error("The legacy overview sheet has no client rows.");
  }

  const sheets = readSheets(workbook, overviewSheet.name, warnings);

  const defaultConvention: DateConvention = "ymd";
  for (const sheet of sheets) {
    if (sheet.ymdInversions < sheet.ydmInversions) {
      sheet.convention = "ymd";
      sheet.conventionSource = "sequence";
    } else if (sheet.ydmInversions < sheet.ymdInversions) {
      sheet.convention = "ydm";
      sheet.conventionSource = "sequence";
    } else {
      sheet.convention = defaultConvention;
      sheet.conventionSource = "default";
      const hasAmbiguous = sheet.activities.some((activity) => {
        if (typeof activity.dateRaw !== "string") return false;
        const text = clean(activity.dateRaw);
        const match = text.match(
          /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
        );
        if (!match) return false;
        const first = Number(match[2]);
        const second = Number(match[3]);
        return first <= 12 && second <= 12;
      });
      if (hasAmbiguous) {
        warnings.push(
          `Sheet "${sheet.name}" had no date sequence to infer order; ambiguous dates were read as year-month-day.`,
        );
      }
    }

    const chosenInversions =
      sheet.convention === "ymd"
        ? sheet.ymdInversions
        : sheet.ydmInversions;
    if (chosenInversions > 0) {
      warnings.push(
        `Sheet "${sheet.name}" contains dates that are out of chronological order; rows were imported as entered.`,
      );
    }
  }

  const serviceState: OptionState = {
    options: [...settings.serviceTypes],
    added: [],
    prefix: "legacy-service",
  };
  const ministryState: OptionState = {
    options: [...settings.ministries],
    added: [],
    prefix: "legacy-ministry",
  };
  const fallbackService = fallbackOptionId(
    serviceState.options,
    "other",
  );

  const usedSheets = new Set<SheetData>();
  const plans: PlannedCase[] = [];
  const stats: BuildStats = { duplicateActivities: 0, warnings };

  for (const record of overview) {
    const normalizedClient = normalizeName(record.clientName);
    const sheet =
      sheets.find(
        (candidate) =>
          !usedSheets.has(candidate) &&
          (normalizeName(candidate.clientName) === normalizedClient ||
            normalizeName(candidate.name).includes(normalizedClient) ||
            normalizedClient.includes(normalizeName(candidate.clientName))),
      ) ?? null;
    if (sheet) usedSheets.add(sheet);
    else {
      warnings.push(
        `No client sheet was found for "${record.clientName}"; the case was imported without activities.`,
      );
    }
    plans.push(
      planOverviewCase(
        record,
        sheet,
        sheet?.convention ?? defaultConvention,
        serviceState,
        ministryState,
        fallbackService,
        stats,
      ),
    );
  }

  for (const sheet of sheets) {
    if (usedSheets.has(sheet)) continue;
    plans.push(
      planSheetOnlyCase(
        sheet,
        sheet.convention,
        serviceState,
        ministryState,
        fallbackService,
        stats,
      ),
    );
  }

  for (const plan of plans) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate)) {
      throw new Error(
        `Invalid start date for "${plan.clientName}": ${plan.startDate}`,
      );
    }
    if (plan.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(plan.endDate)) {
      throw new Error(
        `Invalid end date for "${plan.clientName}": ${plan.endDate}`,
      );
    }
    for (const activity of plan.activities) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(activity.date)) {
        throw new Error(
          `Invalid activity date for "${plan.clientName}": ${activity.date}`,
        );
      }
    }
  }

  if (serviceState.added.length > 0 || ministryState.added.length > 0) {
    const nextSettings: AppSettings = {
      ...settings,
      serviceTypes: serviceState.options,
      ministries: ministryState.options,
    };
    await updateSettings(nextSettings);
  }

  const clientMap = new Map<string, Client>();
  let clientCount = 0;
  let caseCount = 0;
  let activityCount = 0;

  for (const plan of plans) {
    const key = normalizeName(plan.clientName) || plan.clientName;
    let client = clientMap.get(key);
    if (!client) {
      client = await createClient({
        ...clientNames(plan.clientName),
        phone: "",
        note: "",
      });
      clientMap.set(key, client);
      clientCount += 1;
    }

    const caseRecord = await createCase({
      clientId: client.id,
      serviceType: plan.serviceType,
      ministry: plan.ministry,
      description: plan.description,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: plan.status,
    });
    caseCount += 1;

    for (const activity of plan.activities) {
      await createActivity({
        caseId: caseRecord.id,
        date: activity.date,
        ministry: activity.ministry,
        action: activity.action,
        status: activity.status,
        signed: activity.signed,
        note: activity.note,
      });
      activityCount += 1;
    }

    await updateCase(caseRecord.id, {
      status: plan.status,
      ministry: plan.ministry,
      description: plan.description,
      endDate: plan.endDate,
    });
  }

  const report = {
    source: sourcePath,
    importedAt: new Date().toISOString(),
    counts: {
      clients: clientCount,
      cases: caseCount,
      activities: activityCount,
      duplicateActivities: stats.duplicateActivities,
      newServiceTypes: serviceState.added.length,
      newMinistries: ministryState.added.length,
    },
    defaultDateConvention: defaultConvention,
    sheets: sheets.map((sheet) => ({
      name: sheet.name,
      clientName: sheet.clientName,
      convention: sheet.convention,
      conventionSource: sheet.conventionSource,
      ymdInversions: sheet.ymdInversions,
      ydmInversions: sheet.ydmInversions,
    })),
    cases: plans.map((plan) => ({
      clientName: plan.clientName,
      sheetName: plan.sheetName,
      serviceType: plan.serviceType,
      ministry: plan.ministry,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: plan.status,
      activityCount: plan.activities.length,
    })),
    warnings,
  };
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(
    REPORT_PATH,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  console.log("Legacy import complete.");
  console.log(`  Clients: ${clientCount}`);
  console.log(`  Cases: ${caseCount}`);
  console.log(`  Activities: ${activityCount}`);
  console.log(
    `  Duplicate activities skipped: ${stats.duplicateActivities}`,
  );
  console.log(`  New service types: ${serviceState.added.length}`);
  console.log(`  New ministries: ${ministryState.added.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Report: ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log("Workbook: data/tracker.xlsx");
}

main().catch((error: unknown) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
