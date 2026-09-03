"use client";

import { useEffect, useRef, useState } from "react";

export type ShareableSop = {
  reference: string;
  title: string;
  revision: string;
};

function buildShareUrl(reference: string) {
  const url = new URL("/vivadocs", window.location.origin);
  url.searchParams.set("view", "library");
  url.searchParams.set("procedure", reference);
  return url.toString();
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("The link could not be copied.");
}

export function SopShareActions({ sop }: { sop: ShareableSop }) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [message, setMessage] = useState("");
  const copyButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    copyButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function showDialog() {
    setShareUrl(buildShareUrl(sop.reference));
    setMessage("");
    setOpen(true);
  }

  async function copyLink(label = "SOP link copied. It is ready to paste into Job Talk.") {
    try {
      await copyText(shareUrl);
      setMessage(label);
    } catch {
      setMessage("The link could not be copied automatically. Select the link above and copy it manually.");
    }
  }

  async function shareOnDevice() {
    if (!navigator.share) {
      await copyLink("This device does not support the share menu, so the SOP link was copied instead.");
      return;
    }
    try {
      await navigator.share({
        title: `${sop.reference} · ${sop.title}`,
        text: `Open ${sop.reference} in the Vivad SPARK SOP library.`,
        url: shareUrl,
      });
      setMessage("SOP shared successfully.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("The device share menu could not be opened. You can copy the link instead.");
    }
  }

  return (
    <>
      <button className="secondary sop-share-trigger" type="button" onClick={showDialog}>
        Share SOP <b aria-hidden="true">↗</b>
      </button>
      {open && (
        <div
          className="vivadocs-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="vivadocs-modal sop-share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-sop-title"
            aria-describedby="share-sop-description"
          >
            <div>
              <span>SHARE CONTROLLED DOCUMENT</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Share SOP dialog">×</button>
            </div>
            <h2 id="share-sop-title">Share SOP</h2>
            <p id="share-sop-description">
              Create a stable link to {sop.reference} · Rev {sop.revision}. The link opens this SOP in the
              Vivad SPARK library on Job Talk or another device.
            </p>

            <div className="sop-share-summary">
              <span>{sop.reference} · REV {sop.revision}</span>
              <strong>{sop.title}</strong>
            </div>
            <label>
              <span>Direct link</span>
              <input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            </label>
            <button className="sop-share-primary" type="button" onClick={() => void copyLink()} ref={copyButtonRef}>
              Create and copy link
            </button>

            <div className="sop-share-destinations">
              <span>PUBLISHING DESTINATIONS</span>
              <h3>Job Talk and other devices</h3>
              <p>
                The shared page uses the current live site and always opens the matching SOP reference.
                Normal Vivad SPARK access rules still apply.
              </p>
              <div>
                <button type="button" onClick={() => void copyLink()}>Copy Job Talk link</button>
                <button type="button" onClick={() => void shareOnDevice()}>Share on this device</button>
              </div>
            </div>
            <p className="sop-share-status" role="status" aria-live="polite">{message}</p>
          </section>
        </div>
      )}
    </>
  );
}
