import { Building2, UserRound } from "lucide-react";
import { formatDisplayDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { JourneyStep, Lang } from "@/lib/types";

export function JourneyLine({
  steps,
  lang,
}: {
  steps: JourneyStep[];
  lang: Lang;
}) {
  if (steps.length === 0) {
    return <p className="hint">{t(lang, "journeyNoActivity")}</p>;
  }

  return (
    <div className="journey-scroll">
      <ol className="journey-track" aria-label={t(lang, "journeyTitle")}>
        {steps.map((step, index) => {
          const Icon = step.kind === "client" ? UserRound : Building2;
          const next = steps[index + 1];
          return (
            <li key={step.key} className="journey-item">
              <div className="journey-node-wrap">
                <span className="journey-node" data-current={step.isCurrent}>
                  <Icon size={15} strokeWidth={1.7} />
                </span>
                <span className="journey-label" data-current={step.isCurrent}>
                  {step.label}
                </span>
                {step.secondaryLabel ? (
                  <span className="journey-secondary">{step.secondaryLabel}</span>
                ) : null}
                <span className="journey-date tnum">
                  {formatDisplayDate(step.date, lang)}
                </span>
                {step.isCurrent ? (
                  <span className="journey-current-tag">
                    {t(lang, "journeyCurrent")}
                  </span>
                ) : null}
              </div>
              {next ? (
                <div className="journey-segment" aria-hidden="true">
                  <span className="journey-segment-line" />
                  <span className="journey-segment-days">
                    {t(lang, "journeyDaysBetween", {
                      count: next.daysFromPrevious ?? 0,
                    })}
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
