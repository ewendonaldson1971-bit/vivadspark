"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { SOP_DEPARTMENTS, SopInput, StoredSop, departmentPrefix } from "../../lib/vivadocs-model";
import { SopPdfActions } from "./sop-pdf-actions";

type EditorStep = StoredSop["steps"][number] & { file?: File; previewUrl?: string };
type EditorState = Omit<SopInput, "steps"> & { id?: string; reference?: string; steps: EditorStep[] };
type SopSummary = Pick<StoredSop, "id" | "reference" | "title" | "department" | "author" | "version" | "reviewDate" | "status"> & { stepCount: number };

const today = () => new Date().toISOString().slice(0, 10);
const mobileSafeId = () => typeof crypto.randomUUID === "function"
  ? crypto.randomUUID()
  : Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
const blankStep = (): EditorStep => ({ id: mobileSafeId(), position: 1, instruction: "", imageCaption: "", existingImageKey: null, existingImageUrl: null, uploadKey: null });
const blankEditor = (): EditorState => ({ title: "", department: "Prepress", author: "", createdDate: today(), version: "1.0", reviewDate: "", steps: [blankStep()] });
const MOBILE_IMAGE_TARGET_BYTES = 350 * 1024;
const MAX_SOP_UPLOAD_BYTES = Math.floor(3.75 * 1024 * 1024);
const MAX_IMAGE_DIMENSION = 1600;

async function optimiseSopImage(file: File) {
  const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (supported.includes(file.type) && file.size <= MOBILE_IMAGE_TARGET_BYTES) return file;
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)) {
    throw new Error("Choose a photo in JPEG, PNG, WebP, GIF, HEIC or HEIF format.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error("This phone photo could not be read. Export it as JPEG and try again."));
      candidate.src = objectUrl;
    });
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This device could not prepare the photo for upload.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob: Blob | null = null;
    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MOBILE_IMAGE_TARGET_BYTES) break;
    }
    if (!blob) throw new Error("This device could not convert the photo for upload.");
    const name = `${file.name.replace(/\.[^.]+$/, "") || "sop-photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function SopWorkflow({ onClose, onSaved }: { onClose(): void; onSaved?(): void }) {
  const [mode, setMode] = useState<"home" | "edit" | "detail">("home");
  const [editor, setEditor] = useState<EditorState>(blankEditor);
  const [saved, setSaved] = useState<StoredSop | null>(null);
  const [library, setLibrary] = useState<SopSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const original = useRef("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("sop");
    Promise.all([loadLibrary(), id ? loadSop(id) : Promise.resolve()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeWorkflow(); };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("beforeunload", warn); window.removeEventListener("keydown", escape); };
    // closeWorkflow intentionally tracks the latest dirty state through this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  async function loadLibrary() {
    try {
      const response = await fetch("/api/vivadocs/sops", { cache: "no-store" });
      if (response.ok) setLibrary((await response.json()).sops ?? []);
    } catch { /* The setup message below explains unavailable hosted storage. */ }
  }

  async function loadSop(id: string) {
    setBusy(true); setErrors([]);
    try {
      const response = await fetch(`/api/vivadocs/sops/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "SOP not found.");
      setSaved(result.sop); setMode("detail"); setDirty(false);
      window.history.replaceState({}, "", `/vivadocs?sop=${encodeURIComponent(id)}`);
    } catch (error) { setErrors([error instanceof Error ? error.message : "SOP not found."]); }
    finally { setBusy(false); }
  }

  function startNew() {
    const next = blankEditor(); setEditor(next); original.current = JSON.stringify(next); setDirty(false); setErrors([]); setMessage(""); setMode("edit");
  }

  function startEdit() {
    if (!saved) return;
    const next: EditorState = { ...saved, steps: saved.steps.map((step) => ({ ...step })) };
    setEditor(next); original.current = JSON.stringify(next); setDirty(false); setErrors([]); setMessage(""); setMode("edit");
  }

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => ({ ...current, [key]: value })); setDirty(true);
  }

  function updateStep(index: number, patch: Partial<EditorStep>) {
    setEditor((current) => ({ ...current, steps: current.steps.map((step, position) => position === index ? { ...step, ...patch } : step) })); setDirty(true);
  }

  function addStep() {
    const nextIndex = editor.steps.length;
    setEditor((current) => ({ ...current, steps: [...current.steps, { ...blankStep(), position: current.steps.length + 1 }] }));
    setErrors([]);
    setDirty(true);
    window.setTimeout(() => {
      const cards = document.querySelectorAll<HTMLElement>(".sop-step-card");
      const nextCard = cards[nextIndex];
      nextCard?.scrollIntoView({ behavior: "smooth", block: "start" });
      nextCard?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
    }, 0);
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= editor.steps.length) return;
    setEditor((current) => {
      const steps = [...current.steps]; [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps: steps.map((step, position) => ({ ...step, position: position + 1 })) };
    }); setDirty(true);
  }

  function removeStep(index: number) {
    const step = editor.steps[index];
    if (editor.steps.length === 1) { setErrors(["An SOP needs at least one step."]); return; }
    if ((step.instruction || step.file || step.existingImageKey) && !window.confirm(`Delete Step ${index + 1} and its content?`)) return;
    if (step.previewUrl) URL.revokeObjectURL(step.previewUrl);
    setEditor((current) => ({ ...current, steps: current.steps.filter((_, position) => position !== index).map((item, position) => ({ ...item, position: position + 1 })) }));
    setDirty(true);
  }

  async function chooseImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      setErrors(["This phone photo is larger than 30 MB. Choose a smaller photo."]); event.target.value = ""; return;
    }
    setBusy(true); setErrors([]); setMessage(`Optimising the Step ${index + 1} photo for mobile upload…`);
    try {
      const optimised = await optimiseSopImage(file);
      const previous = editor.steps[index].previewUrl; if (previous) URL.revokeObjectURL(previous);
      updateStep(index, { file: optimised, previewUrl: URL.createObjectURL(optimised), uploadKey: mobileSafeId() });
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The phone photo could not be prepared."]);
      event.target.value = "";
    } finally {
      setBusy(false); setMessage("");
    }
  }

  function removeImage(index: number) {
    const previous = editor.steps[index].previewUrl; if (previous) URL.revokeObjectURL(previous);
    updateStep(index, { file: undefined, previewUrl: undefined, uploadKey: null, existingImageKey: null, existingImageUrl: null });
  }

  async function finishSop() {
    const validation: string[] = [];
    if (!editor.title.trim()) validation.push("SOP title is required.");
    if (!editor.department) validation.push("Department is required.");
    if (!editor.author.trim()) validation.push("Author or owner is required.");
    editor.steps.forEach((step, index) => { if (!step.instruction.trim()) validation.push(`Step ${index + 1} instructions are required.`); });
    const uploadBytes = editor.steps.reduce((total, step) => total + (step.file?.size ?? 0), 0);
    if (uploadBytes > MAX_SOP_UPLOAD_BYTES) validation.push("The combined step photos are too large to save safely. Remove one photo or add it after saving the SOP.");
    if (validation.length) { setErrors(validation); document.querySelector(".sop-workflow")?.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setBusy(true); setErrors([]); setMessage(editor.id ? "Saving changes…" : "Allocating reference and saving…");
    try {
      const body = new FormData();
      body.set("sop", JSON.stringify({ ...editor, steps: editor.steps.map((step) => ({ id: step.id, instruction: step.instruction, imageCaption: step.imageCaption, existingImageKey: step.existingImageKey, existingImageUrl: step.existingImageUrl, uploadKey: step.uploadKey })) }));
      editor.steps.forEach((step) => { if (step.file && step.uploadKey) body.set(`image-${step.uploadKey}`, step.file); });
      const response = await fetch(editor.id ? `/api/vivadocs/sops/${encodeURIComponent(editor.id)}` : "/api/vivadocs/sops", { method: editor.id ? "PUT" : "POST", body });
      const result = await response.json().catch(() => ({
        error: response.status === 413
          ? "The phone photos made this SOP too large to upload. Re-select the photos so VivaDocs can optimise them, then save again."
          : "The SOP service returned an unreadable response. Please try again.",
      }));
      if (!response.ok) throw new Error(result.error || "The SOP could not be saved.");
      setSaved(result.sop); setMode("detail"); setDirty(false); setMessage(`${result.sop.reference} saved successfully.`);
      window.history.replaceState({}, "", `/vivadocs?sop=${encodeURIComponent(result.sop.id)}`);
      await loadLibrary();
      onSaved?.();
    } catch (error) { setErrors([error instanceof Error ? error.message : "The SOP could not be saved."]); setMessage(""); }
    finally { setBusy(false); }
  }

  function closeWorkflow() {
    if (dirty && !window.confirm("Leave without saving your SOP changes?")) return;
    window.history.replaceState({}, "", "/vivadocs"); onClose();
  }

  return <div className="sop-workflow-backdrop"><section className="sop-workflow" role="dialog" aria-modal="true" aria-labelledby="sop-workflow-title">
    <header><div><span>VIVADOCS · CONTROLLED PROCEDURES</span><h2 id="sop-workflow-title">{mode === "edit" ? editor.id ? "Edit SOP" : "Create a new SOP" : mode === "detail" ? saved?.title : "SOP workspace"}</h2></div><button type="button" aria-label="Close SOP workspace" onClick={closeWorkflow}>×</button></header>
    {message && <div className="sop-feedback" role="status">✓ {message}</div>}
    {errors.length > 0 && <div className="sop-errors" role="alert"><strong>Please check the following:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    {loading ? <div className="sop-loading" role="status">Loading VivaDocs…</div> : mode === "home" ? <div className="sop-workflow-home"><div className="sop-home-hero"><div><span>STANDARD OPERATING PROCEDURES</span><h3>Create clear, visual work instructions.</h3><p>Build controlled procedures step by step, then publish a mobile-ready view with professional PDF export.</p></div><button type="button" onClick={startNew}>＋ New SOP</button></div><div className="sop-saved-list"><div><h3>Saved SOPs</h3><span>{library.length} documents</span></div>{library.map((item) => <button type="button" key={item.id} onClick={() => loadSop(item.id)}><span><b>{item.reference}</b><strong>{item.title}</strong><small>{item.department} · {item.stepCount} steps · Version {item.version}</small></span><i>Open →</i></button>)}{!library.length && <p>No database SOPs yet. Select New SOP to create the first one.</p>}</div></div> : mode === "edit" ? <div className="sop-editor"><div className="sop-form-grid">
      <label className="wide"><span>SOP title *</span><input autoFocus value={editor.title} onChange={(event) => update("title", event.target.value)} /></label>
      <label><span>Department *</span><select required value={editor.department} onChange={(event) => update("department", event.target.value as EditorState["department"])}>{SOP_DEPARTMENTS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
      <label><span>SOP reference</span><input readOnly aria-readonly="true" value={editor.reference || `${departmentPrefix(editor.department)}-###### · assigned securely when saved`} /></label>
      <label><span>Author / owner *</span><input value={editor.author} onChange={(event) => update("author", event.target.value)} /></label>
      <label><span>Created date *</span><input type="date" value={editor.createdDate} onChange={(event) => update("createdDate", event.target.value)} /></label>
      <label><span>Revision / version *</span><input value={editor.version} onChange={(event) => update("version", event.target.value)} /></label>
      <label><span>Review / approval date</span><input type="date" value={editor.reviewDate} onChange={(event) => update("reviewDate", event.target.value)} /></label>
    </div><div className="sop-step-list">{editor.steps.map((step, index) => <article className="sop-step-card" key={step.id}><div className="sop-step-head"><span>STEP {index + 1}</span><div><button type="button" aria-label={`Move Step ${index + 1} up`} disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button><button type="button" aria-label={`Move Step ${index + 1} down`} disabled={index === editor.steps.length - 1} onClick={() => moveStep(index, 1)}>↓</button><button className="danger" type="button" aria-label={`Delete Step ${index + 1}`} onClick={() => removeStep(index)}>Delete</button></div></div><label><span>Instructions *</span><textarea rows={6} required value={step.instruction} onChange={(event) => updateStep(index, { instruction: event.target.value })} placeholder="Describe the action clearly and in the order it should be completed." /></label><div className="sop-image-field"><label><span>{step.file || step.existingImageUrl ? "Replace image" : "Add step image (optional)"}</span><input type="file" accept="image/*,.heic,.heif" onChange={(event) => void chooseImage(index, event)} disabled={busy} /><small>Phone photos are automatically resized and optimised before upload</small></label>{(step.previewUrl || step.existingImageUrl) && <div className="sop-image-preview"><img src={step.previewUrl || step.existingImageUrl || ""} alt={step.imageCaption || `Step ${index + 1} preview`} /><button type="button" onClick={() => removeImage(index)}>Remove image</button></div>}</div>{(step.file || step.existingImageUrl) && <label><span>Image caption or alt text</span><input value={step.imageCaption} onChange={(event) => updateStep(index, { imageCaption: event.target.value })} placeholder="Describe what operators should notice" /></label>}<div className="sop-step-next"><button type="button" onClick={addStep}>＋ Add Next Step</button><button type="button" disabled={busy} onClick={finishSop}>{busy ? "Preparing / saving…" : "Finish SOP"}</button></div></article>)}</div><div className="sop-editor-actions"><span>{editor.steps.length} {editor.steps.length === 1 ? "step" : "steps"}</span><button className="primary" type="button" disabled={busy} onClick={finishSop}>{busy ? "Preparing / saving…" : "Finish SOP"}</button></div></div> : saved ? <div className="sop-detail"><div className="sop-detail-actions"><button type="button" onClick={() => { setMode("home"); window.history.replaceState({}, "", "/vivadocs"); }}>← All SOPs</button><div><button type="button" onClick={startEdit}>Edit SOP</button><SopPdfActions sop={{ reference: saved.reference, title: saved.title, revision: saved.version, status: saved.status, owner: saved.author, location: saved.department, reviewDate: saved.reviewDate, steps: saved.steps.map((step) => ({ position: step.position, instruction: step.instruction, imageUrl: step.existingImageUrl, imageCaption: step.imageCaption })) }} /></div></div><article className="sop-document"><div className="sop-document-title"><div><span>{saved.reference} · VERSION {saved.version}</span><h3>{saved.title}</h3><p>{saved.department} · Controlled standard operating procedure</p></div></div><dl><div><dt>Owner</dt><dd>{saved.author}</dd></div><div><dt>Created</dt><dd>{formatDate(saved.createdDate)}</dd></div><div><dt>Review / approval</dt><dd>{saved.reviewDate ? formatDate(saved.reviewDate) : "Not scheduled"}</dd></div><div><dt>Status</dt><dd>{saved.status}</dd></div></dl><div className="sop-detail-steps">{saved.steps.map((step) => <section key={step.id}><span>STEP {step.position}</span><p>{step.instruction}</p>{step.existingImageUrl && <figure><img src={step.existingImageUrl} alt={step.imageCaption || `Step ${step.position}`} />{step.imageCaption && <figcaption>{step.imageCaption}</figcaption>}</figure>}</section>)}</div></article></div> : null}
  </section></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
