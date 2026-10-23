"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import { apiErrorKey, sendJson } from "@/lib/client-api";

function subscribeToOrigin() {
  return () => undefined;
}

function getOrigin(): string {
  return window.location.origin;
}

function getServerOrigin(): string {
  return "";
}

export function ShareLinkCard({
  caseId,
  initialToken,
}: {
  caseId: string;
  initialToken: string;
}) {
  const { tr } = useI18n();
  const toast = useToast();
  const [token, setToken] = useState(initialToken);
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getOrigin,
    getServerOrigin,
  );
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sharePath = `/track/${token}`;
  const shareUrl = `${origin}${sharePath}`;

  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopied(true);
      toast.push(tr("copied"));
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.push(tr("errorGeneric"), "error");
    }
  };

  const regenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await sendJson<{ token: string }>(
        `/api/cases/${caseId}/share`,
        "POST",
      );
      setToken(result.token);
      setConfirmOpen(false);
      toast.push(tr("toastShareRegenerated"));
    } catch (requestError) {
      toast.push(tr(apiErrorKey(requestError)), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Link2 size={15} className="text-accent" strokeWidth={1.8} />
        <h3 className="section-title !text-sm">{tr("shareLinkTitle")}</h3>
      </div>
      <p className="hint">{tr("shareLinkDesc")}</p>
      {token ? (
        <>
          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              readOnly
              value={origin ? shareUrl : sharePath}
              className="input !min-h-8 !py-1.5 text-[0.68rem] text-muted"
              aria-label={tr("shareLinkTitle")}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void copy()}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? tr("copied") : tr("copyShareLink")}
            </button>
            <Link
              href={sharePath}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-quiet"
            >
              <ExternalLink size={13} />
              {tr("openSharePage")}
            </Link>
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
            >
              <RefreshCw size={13} />
              {tr("regenerate")}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-secondary mt-2"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          <RefreshCw size={13} />
          {tr("regenerateShareLink")}
        </button>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={tr("regenerateShareLink")}
        description={tr("regenerateShareConfirm")}
        confirmLabel={tr("regenerate")}
        onConfirm={() => void regenerate()}
        onCancel={() => setConfirmOpen(false)}
        busy={busy}
      />
    </div>
  );
}
