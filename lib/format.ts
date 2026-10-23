import { format, isValid, parseISO } from "date-fns";
import type { Client, Lang } from "@/lib/types";

const KHMER_MONTHS = [
  "មករា",
  "កុម្ភៈ",
  "មីនា",
  "មេសា",
  "ឧសភា",
  "មិថុនា",
  "កក្កដា",
  "សីហា",
  "កញ្ញា",
  "តុលា",
  "វិច្ឆិកា",
  "ធ្នូ",
];

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDisplayDate(isoDate: string, lang: Lang): string {
  if (!isoDate) return "—";
  const date = parseISO(isoDate);
  if (!isValid(date)) return isoDate;
  if (lang === "kh") {
    return `${date.getDate()} ${KHMER_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }
  return format(date, "d MMM yyyy");
}

export function formatDisplayDateTime(isoDate: string, lang: Lang): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const day = formatDisplayDate(
    format(date, "yyyy-MM-dd"),
    lang,
  );
  return `${day}, ${format(date, "HH:mm")}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function clientName(client: Pick<Client, "nameKh" | "nameEn">, lang: Lang): string {
  if (lang === "kh") {
    return client.nameKh || client.nameEn || "—";
  }
  return client.nameEn || client.nameKh || "—";
}

export function clientSecondaryName(
  client: Pick<Client, "nameKh" | "nameEn">,
  lang: Lang,
): string {
  const primary = clientName(client, lang);
  const secondary = lang === "kh" ? client.nameEn : client.nameKh;
  return secondary && secondary !== primary ? secondary : "";
}

export function initials(client: Pick<Client, "nameKh" | "nameEn">): string {
  const source = client.nameEn || client.nameKh;
  if (!source) return "?";
  return source
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function shortCaseId(id: string): string {
  const compact = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact.length <= 7) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(-3)}`;
}

export function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
