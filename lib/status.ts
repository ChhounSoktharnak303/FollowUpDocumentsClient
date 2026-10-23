import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import type {
  Activity,
  AppSettings,
  CaseRecord,
  CaseStatus,
  LabelPair,
  Lang,
  ListOption,
  ActivityStatus,
} from "@/lib/types";

export const CASE_STATUSES: CaseStatus[] = [
  "in_progress",
  "waiting",
  "done",
  "success",
  "rejected",
];

export const ACTIVITY_STATUSES: ActivityStatus[] = [
  "in_progress",
  "waiting",
  "done",
  "rejected",
];

export const DEFAULT_STATUS_LABELS: Record<CaseStatus, LabelPair> = {
  in_progress: { en: "In progress", kh: "កំពុងដំណើរការ" },
  waiting: { en: "Waiting", kh: "កំពុងរង់ចាំ" },
  done: { en: "Done", kh: "រួចរាល់" },
  success: { en: "Success", kh: "ជោគជ័យ" },
  rejected: { en: "Rejected", kh: "បដិសេធ" },
};

export const DEFAULT_SERVICE_TYPES: ListOption[] = [
  {
    id: "ownership-transfer",
    kh: "ផ្ទេរកម្មសិទ្ធ",
    en: "Ownership transfer",
  },
  { id: "vat-zero", kh: "VAT 0%", en: "VAT 0%" },
  { id: "other", kh: "ផ្សេងៗ", en: "Other" },
];

export const DEFAULT_MINISTRIES: ListOption[] = [
  {
    id: "land-ministry",
    kh: "ក្រសួងរៀបចំដែនដី",
    en: "Land Ministry",
  },
  {
    id: "gdt",
    kh: "អគ្គនាយកដ្ឋានពន្ធដារ",
    en: "GDT",
  },
  {
    id: "commerce-ministry",
    kh: "ក្រសួងពាណិជ្ជកម្ម",
    en: "Ministry of Commerce",
  },
];

export const DEFAULT_WARNING_ORANGE_DAYS = 7;
export const DEFAULT_WARNING_RED_DAYS = 14;

export function isCaseStatus(value: string): value is CaseStatus {
  return CASE_STATUSES.includes(value as CaseStatus);
}

export function isActivityStatus(value: string): value is ActivityStatus {
  return ACTIVITY_STATUSES.includes(value as ActivityStatus);
}

export function statusLabel(
  status: CaseStatus | ActivityStatus,
  lang: Lang,
  settings?: Pick<AppSettings, "statusLabels">,
): string {
  const pair = settings?.statusLabels[status] ?? DEFAULT_STATUS_LABELS[status];
  return pair[lang];
}

export function optionLabel(
  value: string,
  lang: Lang,
  options: ListOption[],
): string {
  if (!value) return "—";
  const option = options.find((item) => item.id === value);
  if (!option) return value;
  return option[lang];
}

export function optionSecondaryLabel(
  value: string,
  lang: Lang,
  options: ListOption[],
): string {
  const option = options.find((item) => item.id === value);
  if (!option) return "";
  const other = lang === "en" ? option.kh : option.en;
  return other === option[lang] ? "" : other;
}

export function daysSince(isoDate: string, today = new Date()): number {
  const date = parseISO(isoDate);
  if (!isValid(date)) return 0;
  return Math.max(0, differenceInCalendarDays(today, date));
}

export function daysBetween(startIso: string, endIso: string): number {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  if (!isValid(start) || !isValid(end)) return 0;
  return Math.max(0, differenceInCalendarDays(end, start));
}

export function isCaseClosed(caseRecord: Pick<CaseRecord, "status">): boolean {
  return caseRecord.status === "done" || caseRecord.status === "success";
}

export function caseUpdateDate(
  caseRecord: Pick<CaseRecord, "startDate">,
  activities: Pick<Activity, "date">[],
): string {
  if (activities.length === 0) return caseRecord.startDate;
  return activities.reduce((latest, activity) => {
    return activity.date > latest ? activity.date : latest;
  }, caseRecord.startDate);
}

export type WarningTone = "normal" | "orange" | "red";

export function warningTone(
  days: number,
  orangeDays: number,
  redDays: number,
): WarningTone {
  if (days >= redDays) return "red";
  if (days >= orangeDays) return "orange";
  return "normal";
}

export function needsAttention(
  item: {
    status: CaseStatus;
    daysSinceUpdate: number;
    ministry: string;
  },
  settings: Pick<AppSettings, "warningOrangeDays" | "warningRedDays">,
): boolean {
  if (item.status === "done" || item.status === "success") return false;
  if (item.status === "rejected") return true;
  if (item.status === "waiting" && item.daysSinceUpdate >= settings.warningOrangeDays) {
    return true;
  }
  return item.daysSinceUpdate >= settings.warningOrangeDays;
}

export function attentionReason(
  item: { status: CaseStatus; daysSinceUpdate: number },
  settings: Pick<AppSettings, "warningOrangeDays" | "warningRedDays">,
): "rejected" | "waiting" | "stale" | null {
  if (item.status === "rejected") return "rejected";
  if (item.status === "done" || item.status === "success") return null;
  if (item.status === "waiting" && item.daysSinceUpdate >= settings.warningOrangeDays) {
    return "waiting";
  }
  if (item.daysSinceUpdate >= settings.warningOrangeDays) return "stale";
  return null;
}

export function isOverdue(
  daysSinceUpdate: number,
  settings: Pick<AppSettings, "warningRedDays">,
): boolean {
  return daysSinceUpdate >= settings.warningRedDays;
}
