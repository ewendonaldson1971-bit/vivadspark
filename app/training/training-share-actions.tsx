"use client";

import { useEffect, useRef, useState } from "react";

export type ShareableTrainingCourse = {
  id: string;
  title: string;
  category: string;
  duration: string;
};

function buildTrainingShareUrl(id: string) {
  const url = new URL("/training", window.location.origin);
  url.searchParams.set("video", id);
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

export function TrainingShareActions({ course }: { course: ShareableTrainingCourse }) {
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
    setShareUrl(buildTrainingShareUrl(course.id));
    setMessage("");
    setOpen(true);
  }

  async function copyLink(label = "Training video link copied. It is ready to paste into Job Talk or another device.") {
    try {
      await copyText(shareUrl);
      setMessage(label);
    } catch {
      setMessage("The link could not be copied automatically. Select the link above and copy it manually.");
    }
  }

  async function shareOnDevice() {
    if (!navigator.share) {
      await copyLink("This device does not support the share menu, so the training video link was copied instead.");
      return;
    }
    try {
      await navigator.share({
        title: course.title,
        text: `Open ${course.title} in the Vivad SPARK Training Academy.`,
        url: shareUrl,
      });
      setMessage("Training video shared successfully.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("The device share menu could not be opened. You can copy the link instead.");
    }
  }

  return (
    <>
      <button className="training-share-trigger" type="button" onClick={showDialog}>
        Share video <b aria-hidden="true">↗</b>
      </button>
      {open && (
        <div
          className="vivadocs-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="vivadocs-modal sop-share-modal training-share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-training-title"
            aria-describedby="share-training-description"
          >
            <div>
              <span>SHARE TRAINING VIDEO</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Share video dialog">×</button>
            </div>
            <h2 id="share-training-title">Share video</h2>
            <p id="share-training-description">
              Create a stable link that opens this video directly in the Vivad SPARK Training Academy.
            </p>

            <div className="sop-share-summary">
              <span>{course.category} · {course.duration}</span>
              <strong>{course.title}</strong>
            </div>
            <label>
              <span>Direct link</span>
              <input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            </label>
            <button className="sop-share-primary" type="button" onClick={() => void copyLink()} ref={copyButtonRef}>
              Create and copy link
            </button>

            <div className="sop-share-destinations">
              <span>SHARING DESTINATIONS</span>
              <h3>Job Talk and other devices</h3>
              <p>
                The shared link uses the current live site and always opens this training video. Normal Vivad SPARK access rules still apply.
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
