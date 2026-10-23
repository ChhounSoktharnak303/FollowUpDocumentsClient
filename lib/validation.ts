import { z } from "zod";
import type { CaseStatus, ActivityStatus } from "@/lib/types";

const caseStatusValues = [
  "in_progress",
  "waiting",
  "done",
  "success",
  "rejected",
] as const;

const activityStatusValues = [
  "in_progress",
  "waiting",
  "done",
  "rejected",
] as const;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid date");

const nameSchema = z.string().trim().max(160);

export const loginSchema = z.object({
  password: z.string().min(1).max(300),
});

export const preferencesSchema = z.object({
  lang: z.enum(["en", "kh"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

export const clientCreateSchema = z
  .object({
    nameKh: nameSchema.default(""),
    nameEn: nameSchema.default(""),
    phone: z.string().trim().max(60).default(""),
    note: z.string().trim().max(3000).default(""),
  })
  .refine((data) => data.nameKh.length > 0 || data.nameEn.length > 0, {
    message: "At least one name is required",
    path: ["nameKh"],
  });

export const clientUpdateSchema = clientCreateSchema;

export const caseCreateSchema = z.object({
  clientId: z.string().trim().min(1).max(100),
  serviceType: z.string().trim().min(1).max(140),
  ministry: z.string().trim().max(140).default(""),
  description: z.string().trim().max(3000).default(""),
  startDate: isoDateSchema,
  endDate: z.union([isoDateSchema, z.literal("")]).default(""),
  status: z.enum(caseStatusValues).default("in_progress"),
});

export const caseUpdateSchema = z.object({
  status: z.enum(caseStatusValues).optional(),
  ministry: z.string().trim().max(140).optional(),
  description: z.string().trim().max(3000).optional(),
  endDate: z.union([isoDateSchema, z.literal("")]).optional(),
});

const activityFields = {
  date: isoDateSchema,
  ministry: z.string().trim().max(140).default(""),
  action: z.string().trim().min(1).max(2000),
  status: z.enum(activityStatusValues).default("in_progress"),
  signed: z.boolean().default(false),
  note: z.string().trim().max(5000).default(""),
};

export const activityCreateSchema = z.object({
  caseId: z.string().trim().min(1).max(100),
  ...activityFields,
});

export const activityUpdateSchema = z.object(activityFields);

const listOptionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  kh: z.string().trim().min(1).max(200),
  en: z.string().trim().min(1).max(200),
});

const labelPairSchema = z.object({
  en: z.string().trim().min(1).max(100),
  kh: z.string().trim().min(1).max(100),
});

export const settingsUpdateSchema = z
  .object({
    serviceTypes: z.array(listOptionSchema).min(1).max(50),
    ministries: z.array(listOptionSchema).min(1).max(50),
    warningOrangeDays: z.coerce.number().int().min(1).max(365),
    warningRedDays: z.coerce.number().int().min(1).max(365),
    statusLabels: z.object({
      in_progress: labelPairSchema,
      waiting: labelPairSchema,
      done: labelPairSchema,
      success: labelPairSchema,
      rejected: labelPairSchema,
    }),
  })
  .refine((data) => data.warningRedDays > data.warningOrangeDays, {
    message: "Red must be later than orange",
    path: ["warningRedDays"],
  });

export const templateCreateSchema = z.object({
  textKh: z.string().trim().min(1).max(500),
  textEn: z.string().trim().min(1).max(500),
});

export const templateUpdateSchema = templateCreateSchema;

export type LoginInput = z.infer<typeof loginSchema>;
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type CaseCreateInput = z.infer<typeof caseCreateSchema>;
export type CaseUpdateInput = z.infer<typeof caseUpdateSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
export type ActivityUpdateInput = z.infer<typeof activityUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type TemplateInput = z.infer<typeof templateCreateSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export function isCaseStatusValue(value: string): value is CaseStatus {
  return (caseStatusValues as readonly string[]).includes(value);
}

export function isActivityStatusValue(value: string): value is ActivityStatus {
  return (activityStatusValues as readonly string[]).includes(value);
}
