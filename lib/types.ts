export type Lang = "en" | "kh";

export type CaseStatus =
  | "in_progress"
  | "waiting"
  | "done"
  | "success"
  | "rejected";

export type ActivityStatus = "in_progress" | "waiting" | "done" | "rejected";

export interface Client {
  id: string;
  nameKh: string;
  nameEn: string;
  phone: string;
  note: string;
  createdAt: string;
}

export interface ClientWithStats extends Client {
  caseCount: number;
  openCaseCount: number;
  latestCaseDate: string;
}

export interface CaseRecord {
  id: string;
  clientId: string;
  serviceType: string;
  ministry: string;
  description: string;
  startDate: string;
  endDate: string;
  status: CaseStatus;
  shareToken: string;
  createdAt: string;
}

export interface CaseListItem extends CaseRecord {
  client: Client;
  lastActivityDate: string;
  daysSinceUpdate: number;
  daysOpen: number;
  activityCount: number;
}

export interface Activity {
  id: string;
  caseId: string;
  date: string;
  ministry: string;
  action: string;
  status: ActivityStatus;
  signed: boolean;
  note: string;
  createdAt: string;
}

export interface CaseDetail {
  case: CaseRecord;
  client: Client;
  activities: Activity[];
  lastActivityDate: string;
}

export interface Template {
  id: string;
  textKh: string;
  textEn: string;
}

export interface LabelPair {
  en: string;
  kh: string;
}

export interface ListOption {
  id: string;
  en: string;
  kh: string;
}

export interface AppSettings {
  serviceTypes: ListOption[];
  ministries: ListOption[];
  statusLabels: Record<CaseStatus, LabelPair>;
  warningOrangeDays: number;
  warningRedDays: number;
}

export interface CaseStats {
  openCases: number;
  waiting: number;
  overdue: number;
  completedThisMonth: number;
}

export interface CaseFilters {
  q?: string;
  status?: string;
  ministry?: string;
  serviceType?: string;
  sort?: string;
}

export interface CasePickerItem {
  id: string;
  clientNameKh: string;
  clientNameEn: string;
  serviceType: string;
  ministry: string;
  status: CaseStatus;
}

export interface JourneyStep {
  key: string;
  label: string;
  secondaryLabel: string;
  kind: "client" | "ministry";
  date: string;
  isCurrent: boolean;
  daysFromPrevious: number | null;
}

export type Theme = "light" | "dark";
