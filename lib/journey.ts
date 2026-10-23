import { t } from "@/lib/i18n";
import {
  daysBetween,
  optionLabel,
  optionSecondaryLabel,
} from "@/lib/status";
import type {
  AppSettings,
  CaseRecord,
  JourneyStep,
  Lang,
} from "@/lib/types";

interface JourneyInput {
  case: CaseRecord;
  activities: Array<{ date: string; ministry: string }>;
  settings: AppSettings;
  lang: Lang;
}

interface DraftStep {
  key: string;
  label: string;
  secondaryLabel: string;
  kind: "client" | "ministry";
  date: string;
}

export function buildJourney({
  case: caseRecord,
  activities,
  settings,
  lang,
}: JourneyInput): JourneyStep[] {
  const otherLang: Lang = lang === "kh" ? "en" : "kh";
  const ordered = [...activities].sort((a, b) =>
    (a.date || "").localeCompare(b.date || ""),
  );
  const drafts: DraftStep[] = [
    {
      key: "client-start",
      label: t(lang, "journeyClient"),
      secondaryLabel: t(otherLang, "journeyClient"),
      kind: "client",
      date: caseRecord.startDate,
    },
  ];

  let lastMinistryId = "";
  let lastDate = caseRecord.startDate;
  for (const activity of ordered) {
    if (!activity.ministry) continue;
    if (activity.date) lastDate = activity.date;
    if (activity.ministry === lastMinistryId) continue;
    lastMinistryId = activity.ministry;
    drafts.push({
      key: `ministry-${drafts.length}-${activity.ministry}`,
      label: optionLabel(activity.ministry, lang, settings.ministries),
      secondaryLabel: optionSecondaryLabel(
        activity.ministry,
        lang,
        settings.ministries,
      ),
      kind: "ministry",
      date: activity.date || lastDate,
    });
  }

  if (drafts.length === 1 && caseRecord.ministry) {
    drafts.push({
      key: `ministry-current-${caseRecord.ministry}`,
      label: optionLabel(caseRecord.ministry, lang, settings.ministries),
      secondaryLabel: optionSecondaryLabel(
        caseRecord.ministry,
        lang,
        settings.ministries,
      ),
      kind: "ministry",
      date: ordered.length > 0 ? ordered[ordered.length - 1].date : caseRecord.startDate,
    });
  }

  if (caseRecord.status === "done" || caseRecord.status === "success") {
    const endDate =
      caseRecord.endDate ||
      drafts[drafts.length - 1]?.date ||
      caseRecord.startDate;
    drafts.push({
      key: "client-end",
      label: t(lang, "journeyClient"),
      secondaryLabel: t(otherLang, "journeyClient"),
      kind: "client",
      date: endDate,
    });
  }

  return drafts.map((draft, index) => ({
    ...draft,
    isCurrent: index === drafts.length - 1,
    daysFromPrevious:
      index === 0
        ? null
        : daysBetween(drafts[index - 1].date, draft.date),
  }));
}
