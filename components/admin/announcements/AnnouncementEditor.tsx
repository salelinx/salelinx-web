"use client";

// The sheet to write or change one announcement: the form on the left, in the
// order an admin thinks of it (what it says, how it looks, where, how often,
// who and when), and on the right a live preview of the extension with a
// plain summary under it.
//
// Copy is plain text, English required; a blank French, Spanish or German
// field shows the English text. The checks in lib/announcements/types.ts mirror
// the RPC's so mistakes show before saving; the RPC still decides. Admin text
// is only ever rendered as React text. The one dangerouslySetInnerHTML is the
// fixed icon markup in ANNOUNCEMENT_ICON_SVG, never anything an admin typed.
//
// Images upload from the browser straight into the public announcement-images
// bucket (only admins may write it) as soon as they are picked. An upload that
// is replaced, removed or left behind by Cancel before saving is deleted again
// (discardUploadedImage), and a saved image a message stops using is deleted
// by the save action. The console's CSP has no Storage host in img-src, so the
// thumbnails are blob URLs: the picked file itself, or the stored file
// downloaded with the admin's session.

import { useEffect, useRef, useState, useTransition } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconPlus,
  IconTrash,
  IconUpload,
  IconX,
} from "@/components/admin/social/icons";
import { useClientNow } from "@/lib/admin/use-client-now";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_BUTTON_LABEL_MAX,
  ANNOUNCEMENT_BUTTON_URL_MAX,
  ANNOUNCEMENT_BUTTONS_MAX,
  ANNOUNCEMENT_EDITOR_PLACEMENTS,
  ANNOUNCEMENT_EMOJI_MAX,
  ANNOUNCEMENT_ERROR_MESSAGE,
  ANNOUNCEMENT_FREQUENCIES,
  ANNOUNCEMENT_FREQUENCY_HINT,
  ANNOUNCEMENT_FREQUENCY_LABEL,
  ANNOUNCEMENT_ICONS,
  ANNOUNCEMENT_ICON_LABEL,
  ANNOUNCEMENT_IMAGE_BUCKET,
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  ANNOUNCEMENT_IMAGE_TYPES,
  ANNOUNCEMENT_LOCALES,
  ANNOUNCEMENT_LOCALE_LABEL,
  ANNOUNCEMENT_PANEL_PLACEMENTS,
  ANNOUNCEMENT_PLACEMENT_HINT,
  ANNOUNCEMENT_PLACEMENT_LABEL,
  ANNOUNCEMENT_PLATFORMS,
  ANNOUNCEMENT_PLATFORM_LABEL,
  ANNOUNCEMENT_PRESETS,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_PRIORITY_LABEL,
  ANNOUNCEMENT_RECIPIENTS_MAX,
  ANNOUNCEMENT_TABS,
  ANNOUNCEMENT_TAB_LABEL,
  ANNOUNCEMENT_THEMES,
  ANNOUNCEMENT_THEME_COLOR,
  ANNOUNCEMENT_THEME_LABEL,
  ANNOUNCEMENT_TIERS,
  ANNOUNCEMENT_TIER_LABEL,
  ANNOUNCEMENT_TITLE_MAX,
  announcementImagePath,
  announcementImageUrl,
  announcementPhase,
  audienceSummary,
  charCount,
  ctaUrlOk,
  editorPlacements,
  emailLooksOk,
  emojiOk,
  fromLocalInput,
  missingAnnouncementLocales,
  parseRecipientEmails,
  placementsForTabs,
  toLocalInput,
  togglePlacement,
  trimText,
  validateAnnouncementDraft,
  versionOk,
  type AnnouncementDraft,
  type AnnouncementFrequency,
  type AnnouncementIcon,
  type AnnouncementLocale,
  type AnnouncementPhase,
  type AnnouncementPlacement,
  type AnnouncementPlatform,
  type AnnouncementPreset,
  type AnnouncementPriority,
  type AnnouncementRow,
  type AnnouncementTab,
  type AnnouncementText,
  type AnnouncementTextInput,
  type AnnouncementTheme,
  type AnnouncementTier,
} from "@/lib/announcements/types";
import {
  discardUploadedImage,
  saveAnnouncement,
} from "@/app/admin/(configuration)/announcements/actions";
import { Preview } from "./AnnouncementPreview";
import {
  ChipToggle,
  EditorSection,
  FieldLabel,
  FilterRow,
  Glyph,
  GlyphTile,
  IconGlobe,
  PLACE_SHORT,
  PlaceDiagram,
  Segmented,
  alpha,
  errorClass,
  errorText,
  focusRing,
  ghostButton,
  hintClass,
  inputClass,
  listSentence,
  primaryButton,
  secondaryButton,
} from "./parts";

type ButtonForm = { label: AnnouncementTextInput; url: string };

// The editor's working copy. Times are datetime-local strings in the admin's
// own time zone until saving turns them into ISO; recipients are the
// textarea's text until saving parses it.
type Form = {
  priority: AnnouncementPriority;
  theme: AnnouncementTheme;
  icon: AnnouncementIcon;
  emoji: string;
  title: AnnouncementTextInput;
  body: AnnouncementTextInput;
  imagePath: string | null;
  buttons: ButtonForm[];
  placements: AnnouncementPlacement[];
  frequency: AnnouncementFrequency;
  tiers: AnnouncementTier[];
  platforms: AnnouncementPlatform[];
  locales: AnnouncementLocale[];
  tabs: string[];
  minVersion: string;
  maxVersion: string;
  signedInOnly: boolean;
  recipients: string;
  startMode: "now" | "at";
  startAt: string;
  endMode: "never" | "at";
  endAt: string;
  showAgain: boolean;
};

// A new message starts from the column defaults.
function formFrom(a: AnnouncementRow | null): Form {
  if (!a) {
    return {
      priority: "normal",
      theme: "blue",
      icon: "info",
      emoji: "",
      title: { en: "" },
      body: { en: "" },
      imagePath: null,
      buttons: [],
      placements: ["banner"],
      frequency: "until_closed",
      tiers: [],
      platforms: [],
      locales: [],
      tabs: [],
      minVersion: "",
      maxVersion: "",
      signedInOnly: false,
      recipients: "",
      startMode: "now",
      startAt: "",
      endMode: "never",
      endAt: "",
      showAgain: false,
    };
  }
  return {
    priority: a.priority,
    theme: a.theme,
    icon: a.icon,
    emoji: a.emoji ?? "",
    title: { ...a.title },
    body: { ...a.body },
    imagePath: a.image_path,
    buttons: (a.buttons ?? []).map((b) => ({ label: { ...b.label }, url: b.url })),
    // The offered places it has (the first design's toolbar places are dropped).
    placements: editorPlacements(a.placements),
    frequency: a.frequency,
    tiers: [...a.audience_tiers],
    platforms: [...a.audience_platforms],
    locales: [...a.audience_locales],
    tabs: [...a.audience_tabs],
    minVersion: a.min_version ?? "",
    maxVersion: a.max_version ?? "",
    signedInOnly: a.signed_in_only,
    recipients: a.recipients.join("\n"),
    // An existing one keeps its own start time unless "Now" is picked.
    startMode: "at",
    startAt: toLocalInput(a.starts_at),
    endMode: a.ends_at ? "at" : "never",
    endAt: a.ends_at ? toLocalInput(a.ends_at) : "",
    showAgain: false,
  };
}

function labelBlank(label: AnnouncementTextInput): boolean {
  return ANNOUNCEMENT_LOCALES.every((l) => !trimText(label[l] ?? ""));
}

// The draft the RPC takes, or the editor's own error code when a time that was
// asked for is missing.
function draftFrom(
  form: Form,
  id: string | null,
): AnnouncementDraft | "missing_start" | "missing_end" {
  const startsAt = form.startMode === "now" ? null : fromLocalInput(form.startAt);
  if (form.startMode === "at" && !startsAt) return "missing_start";
  const endsAt = form.endMode === "never" ? null : fromLocalInput(form.endAt);
  if (form.endMode === "at" && !endsAt) return "missing_end";

  return {
    id,
    priority: form.priority,
    theme: form.theme,
    icon: form.icon,
    emoji: trimText(form.emoji) || null,
    title: form.title,
    body: form.body,
    image_path: form.imagePath,
    // A button with no label in any language and no link is no button, as
    // the RPC reads it.
    buttons: form.buttons
      .map((b) => ({ label: b.label, url: trimText(b.url) }))
      .filter((b) => b.url || !labelBlank(b.label)),
    placements: form.placements,
    frequency: form.frequency,
    audience_tiers: form.tiers,
    audience_platforms: form.platforms,
    audience_locales: form.locales,
    audience_tabs: form.tabs,
    min_version: trimText(form.minVersion) || null,
    max_version: trimText(form.maxVersion) || null,
    signed_in_only: form.signedInOnly,
    starts_at: startsAt,
    ends_at: endsAt,
    recipients: parseRecipientEmails(form.recipients),
  };
}

// Copy with every value trimmed and blank ones left out, the shape
// missingAnnouncementLocales reads.
function trimmedText(text: AnnouncementTextInput): AnnouncementText {
  const out: AnnouncementText = { en: trimText(text.en ?? "") };
  for (const l of ANNOUNCEMENT_LOCALES) {
    const value = trimText(text[l] ?? "");
    if (l !== "en" && value) out[l] = value;
  }
  return out;
}

// True when the form has exactly what the preset fills in.
function presetMatches(p: AnnouncementPreset, f: Form): boolean {
  const places = placementsForTabs(p.placements, f.tabs);
  return (
    p.priority === f.priority &&
    p.theme === f.theme &&
    p.icon === f.icon &&
    p.frequency === f.frequency &&
    places.length === f.placements.length &&
    places.every((x) => f.placements.includes(x))
  );
}

function tabLabel(tab: string): string {
  return (ANNOUNCEMENT_TABS as readonly string[]).includes(tab)
    ? ANNOUNCEMENT_TAB_LABEL[tab as AnnouncementTab]
    : `${tab} (not listed)`;
}

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? [...list.filter((v) => v !== value), value] : list.filter((v) => v !== value);
}

// A datetime-local value as people read it, e.g. "Wed 26 Nov, 09:00".
function readableTime(value: string): string | null {
  const iso = fromLocalInput(value);
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A displayable address for the message's image: the picked file's own blob
// URL for a fresh upload, otherwise the stored file downloaded with the
// admin's session (the console's CSP blocks Storage URLs in <img>). Null while
// it loads, or when there is no image.
function useImageSrc(path: string | null, local: Record<string, string>): string | null {
  const [fetched, setFetched] = useState<{ path: string; src: string } | null>(null);
  const localSrc = path ? local[path] : undefined;
  useEffect(() => {
    if (!path || localSrc) return;
    let live = true;
    createBrowserClient()
      .storage.from(ANNOUNCEMENT_IMAGE_BUCKET)
      .download(path)
      .then(({ data }) => {
        if (live && data) setFetched({ path, src: URL.createObjectURL(data) });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path, localSrc]);
  if (!path) return null;
  return localSrc ?? (fetched?.path === path ? fetched.src : null);
}

const PHASE_PILL: Record<AnnouncementPhase, { label: string; dot: string; text: string }> = {
  live: { label: "Live", dot: "bg-emerald-500", text: "text-emerald-700" },
  scheduled: { label: "Scheduled", dot: "bg-sky-500", text: "text-sky-700" },
  ended: { label: "Ended", dot: "bg-zinc-400", text: "text-zinc-500" },
};

export function Editor({
  initial,
  onClose,
  onDone,
}: {
  initial: AnnouncementRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const isNew = initial === null;
  const [startForm] = useState<Form>(() => formFrom(initial));
  const [form, setForm] = useState<Form>(startForm);
  const [locale, setLocale] = useState<AnnouncementLocale>("en");
  const [previewLocale, setPreviewLocale] = useState<AnnouncementLocale>("en");
  const [error, setError] = useState<string | null>(null);
  const [unknownEmails, setUnknownEmails] = useState<string[]>([]);
  const [meNote, setMeNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [moreFilters, setMoreFilters] = useState(
    () => startForm.signedInOnly || Boolean(startForm.minVersion || startForm.maxVersion),
  );
  // Blob URLs of the files picked in this editor, by bucket path.
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // Paths uploaded in this editor and not yet saved, deleted if they never are.
  const fresh = useRef<string[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const clientNow = useClientNow();
  const imageSrc = useImageSrc(form.imagePath, localImages);
  const busy = pending || uploading;

  // Into the sheet on open, so the keyboard and screen readers start there.
  useEffect(() => {
    dialog.current?.focus();
  }, []);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setError(null);
    setForm((f) => ({ ...f, [key]: value }));
  }

  function update(change: (f: Form) => Partial<Form>) {
    setError(null);
    setForm((f) => ({ ...f, ...change(f) }));
  }

  function setText(field: "title" | "body", value: string) {
    update((f) => ({ [field]: { ...f[field], [locale]: value } }));
  }

  function setButton(index: number, change: (b: ButtonForm) => ButtonForm) {
    update((f) => ({ buttons: f.buttons.map((b, i) => (i === index ? change(b) : b)) }));
  }

  // A template sets the icon, so it clears an emoji that would hide it.
  function applyPreset(p: AnnouncementPreset) {
    update((f) => ({
      priority: p.priority,
      theme: p.theme,
      icon: p.icon,
      emoji: "",
      placements: placementsForTabs(p.placements, f.tabs),
      frequency: p.frequency,
    }));
  }

  function setTab(tab: string, on: boolean) {
    update((f) => {
      const tabs = toggle(f.tabs, tab, on);
      return { tabs, placements: placementsForTabs(f.placements, tabs) };
    });
  }

  function pickLocale(l: AnnouncementLocale) {
    setLocale(l);
    setPreviewLocale(l);
  }

  // Deletes this editor's unsaved uploads, all but `keep`.
  function discardFresh(keep: string | null) {
    const leftovers = fresh.current.filter((p) => p !== keep);
    fresh.current = [];
    for (const p of leftovers) void discardUploadedImage(p);
  }

  // An unsaved upload that is being let go of is deleted straight away. A
  // saved image stays until the save goes through without it.
  function dropIfFresh(path: string | null) {
    if (!path || !fresh.current.includes(path)) return;
    fresh.current = fresh.current.filter((p) => p !== path);
    void discardUploadedImage(path);
  }

  function close() {
    if (busy) return;
    discardFresh(null);
    onClose();
  }

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!(ANNOUNCEMENT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setImageError("Use a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
      setImageError(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Images can be at most ${ANNOUNCEMENT_IMAGE_MAX_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }
    const previous = form.imagePath;
    const path = announcementImagePath(file.type);
    setUploading(true);
    const { error: uploadError } = await createBrowserClient()
      .storage.from(ANNOUNCEMENT_IMAGE_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type })
      .catch((err: Error) => ({ error: err }));
    setUploading(false);
    if (uploadError) {
      setImageError(`Upload failed: ${uploadError.message}`);
      return;
    }
    dropIfFresh(previous);
    fresh.current.push(path);
    setLocalImages((m) => ({ ...m, [path]: URL.createObjectURL(file) }));
    set("imagePath", path);
  }

  function removeImage() {
    dropIfFresh(form.imagePath);
    setImageError(null);
    set("imagePath", null);
  }

  async function justMe() {
    setMeNote(null);
    const { data } = await createBrowserClient()
      .auth.getUser()
      .catch(() => ({ data: { user: null } }));
    const email = data.user?.email;
    if (!email) {
      setMeNote("Could not read your own email. Type it in instead.");
      return;
    }
    set("recipients", email.toLowerCase());
  }

  function save() {
    setError(null);
    setUnknownEmails([]);
    const draft = draftFrom(form, initial?.id ?? null);
    if (typeof draft === "string") {
      setError(errorText(draft));
      return;
    }
    const code = validateAnnouncementDraft(draft, Date.now());
    if (code) {
      setError(errorText(code));
      return;
    }
    startTransition(async () => {
      const res = await saveAnnouncement(
        draft,
        isNew,
        form.showAgain,
        initial?.image_path ?? null,
      );
      if (!res.ok) {
        if (res.error === "unknown_recipients") setUnknownEmails(res.emails ?? []);
        setError(errorText(res.error));
        return;
      }
      discardFresh(draft.image_path);
      const title = trimText(form.title.en ?? "");
      onDone(
        !isNew
          ? `Saved "${title}".${form.showAgain ? " People who closed it will see it again." : ""}`
          : form.startMode === "now"
            ? `Published "${title}". Open extensions show it within about 15 seconds.`
            : `Scheduled "${title}". It goes live at its start time.`,
      );
    });
  }

  // Live checks. The editor only opens after hydration, so the clock is set.
  const draft = draftFrom(form, initial?.id ?? null);
  const liveCode =
    typeof draft === "string" ? draft : validateAnnouncementDraft(draft, clientNow ?? 0);
  const recipients = parseRecipientEmails(form.recipients);
  const badEmails = recipients.filter((e) => !emailLooksOk(e));
  const unknownShown = unknownEmails.filter((e) => recipients.includes(e));
  const min = trimText(form.minVersion);
  const max = trimText(form.maxVersion);
  const versionError =
    (min && !versionOk(min)) || (max && !versionOk(max)) ? ANNOUNCEMENT_ERROR_MESSAGE.invalid_version : null;
  const emojiSet = trimText(form.emoji) !== "";
  const emojiError =
    emojiSet && !emojiOk(form.emoji)
      ? `An emoji is at most ${ANNOUNCEMENT_EMOJI_MAX} characters, with no spaces.`
      : null;
  const copyTitle = trimmedText(form.title);
  const copyBody = trimmedText(form.body);
  // Only once there is English to fall back to.
  const missing =
    copyTitle.en || copyBody.en
      ? missingAnnouncementLocales({
          title: copyTitle,
          body: copyBody,
          audience_locales: form.locales,
        })
      : [];
  const tabsChosen = form.tabs.length > 0;
  const extraTabs = [...new Set([...(initial?.audience_tabs ?? []), ...form.tabs])].filter(
    (t) => !(ANNOUNCEMENT_TABS as readonly string[]).includes(t),
  );
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const audience = audienceSummary({
    audience_tiers: form.tiers,
    audience_platforms: form.platforms,
    audience_locales: form.locales,
    audience_tabs: form.tabs,
    min_version: min,
    max_version: max,
    signed_in_only: form.signedInOnly,
    recipients,
  });
  const accent = ANNOUNCEMENT_THEME_COLOR[form.theme] ?? ANNOUNCEMENT_THEME_COLOR.blue;
  const phase = initial && clientNow ? announcementPhase(initial, clientNow) : null;
  const en = locale === "en";
  const changed = form !== startForm;

  const action = !isNew
    ? { label: "Save changes", busy: "Saving..." }
    : form.startMode === "now"
      ? { label: "Publish now", busy: "Publishing..." }
      : { label: "Schedule", busy: "Scheduling..." };

  // The plain-words summary under the preview.
  const places = ANNOUNCEMENT_EDITOR_PLACEMENTS.filter((p) => form.placements.includes(p)).map(
    (p, i) => (i === 0 ? PLACE_SHORT[p] : PLACE_SHORT[p].toLowerCase()),
  );
  const startWords =
    form.startMode === "now"
      ? isNew
        ? "From the moment you publish"
        : "From the moment you save"
      : `From ${readableTime(form.startAt) ?? "a time not picked yet"}`;
  const endWords =
    form.endMode === "never"
      ? "until you end it"
      : `until ${readableTime(form.endAt) ?? "a time not picked yet"}`;
  const summary: [string, string][] = [
    ["Where", places.length ? listSentence(places) : "Nowhere yet"],
    ["Who", audience],
    ["When", `${startWords} ${endWords}`],
    ["How often", ANNOUNCEMENT_FREQUENCY_LABEL[form.frequency]],
    ["Priority", ANNOUNCEMENT_PRIORITY_LABEL[form.priority]],
  ];

  function counter(value: string | undefined, maxChars: number) {
    const n = charCount(trimText(value ?? ""));
    return <span className={n > maxChars ? "text-red-600" : ""}>{`${n}/${maxChars}`}</span>;
  }

  const fileInput = (
    <input
      type="file"
      accept={ANNOUNCEMENT_IMAGE_TYPES.join(",")}
      className="sr-only"
      disabled={busy}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        void pickImage(file);
      }}
    />
  );

  const cardChoice = (on: boolean) =>
    on
      ? "border-zinc-900 ring-1 ring-zinc-900"
      : "border-[var(--admin-border)] hover:border-zinc-400";

  return (
    <>
      <div aria-hidden="true" className="slx-fade fixed inset-0 z-20 bg-black/40" />
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-editor-title"
        className="slx-slide fixed inset-y-0 right-0 z-20 flex w-full flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl outline-none lg:max-w-[1180px]"
      >
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-[var(--admin-border)] px-5 py-2 sm:px-7">
          <GlyphTile icon={form.icon} emoji={form.emoji} accent={accent} size={30} />
          <div className="min-w-0 flex-1">
            <h2 id="announcement-editor-title" className="truncate text-[15px] font-semibold">
              {isNew ? "New announcement" : "Edit announcement"}
            </h2>
            <p className="truncate text-xs text-zinc-500">
              {trimText(form.title.en ?? "") || "Untitled"}
            </p>
          </div>
          {phase && (
            <span
              className={`hidden items-center gap-1.5 rounded-full border border-[var(--admin-border)] px-2.5 py-0.5 text-xs font-medium sm:inline-flex ${PHASE_PILL[phase].text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${PHASE_PILL[phase].dot}`} />
              {PHASE_PILL[phase].label}
            </span>
          )}
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="-mr-2 shrink-0 rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
            aria-label="Close without saving"
            title="Close without saving"
          >
            <IconX size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,480px)] lg:overflow-hidden">
          <div className="lg:min-h-0 lg:overflow-y-auto">
            {isNew && (
              <EditorSection
                id="announcement-start"
                title="Start from a template"
                description="Fills in the look, the places, how often and the priority. You can change any of them after."
              >
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {ANNOUNCEMENT_PRESETS.map((p) => {
                    const on = presetMatches(p, form);
                    const color = ANNOUNCEMENT_THEME_COLOR[p.theme];
                    return (
                      <button
                        key={p.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => applyPreset(p)}
                        className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                          on ? "" : "border-[var(--admin-border)] hover:border-zinc-400"
                        }`}
                        style={
                          on
                            ? {
                                borderColor: color,
                                boxShadow: `0 0 0 1px ${color}`,
                                backgroundColor: alpha(color, 0.06),
                              }
                            : undefined
                        }
                      >
                        <GlyphTile icon={p.icon} emoji={null} accent={color} size={30} />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-zinc-900">{p.label}</span>
                          <span className="mt-0.5 hidden text-[11.5px] leading-snug text-zinc-500 sm:block">
                            {p.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </EditorSection>
            )}

            <EditorSection
              id="announcement-message"
              title="Message"
              description={
                en
                  ? "Plain text. English is required; a translation left blank shows the English."
                  : `${ANNOUNCEMENT_LOCALE_LABEL[locale]} is optional. Anything left blank shows the English.`
              }
              aside={
                <div
                  role="group"
                  aria-label="Language you are writing in"
                  className="inline-flex rounded-lg border border-[var(--admin-border)] bg-zinc-50 p-0.5"
                >
                  {ANNOUNCEMENT_LOCALES.map((l) => {
                    const filled = Boolean(
                      trimText(form.title[l] ?? "") || trimText(form.body[l] ?? ""),
                    );
                    const on = locale === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        aria-pressed={on}
                        onClick={() => pickLocale(l)}
                        title={`${ANNOUNCEMENT_LOCALE_LABEL[l]}${
                          l === "en" ? ", required" : filled ? ", translated" : ", shows the English"
                        }`}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                          on
                            ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-[var(--admin-border)]"
                            : "text-zinc-500 hover:text-zinc-900"
                        }`}
                      >
                        {l.toUpperCase()}
                        {l !== "en" && (
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${filled ? "bg-emerald-500" : "bg-zinc-300"}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              }
            >
              <div className="space-y-4">
                <div>
                  <FieldLabel htmlFor="announcement-title" end={counter(form.title[locale], ANNOUNCEMENT_TITLE_MAX)}>
                    Title
                  </FieldLabel>
                  <input
                    id="announcement-title"
                    type="text"
                    value={form.title[locale] ?? ""}
                    maxLength={ANNOUNCEMENT_TITLE_MAX}
                    placeholder={en ? "Vinted crosslisting is down" : form.title.en || "Title"}
                    onChange={(e) => setText("title", e.target.value)}
                    className={`${inputClass} text-[15px] font-medium`}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="announcement-body" end={counter(form.body[locale], ANNOUNCEMENT_BODY_MAX)}>
                    Message
                  </FieldLabel>
                  <textarea
                    id="announcement-body"
                    value={form.body[locale] ?? ""}
                    maxLength={ANNOUNCEMENT_BODY_MAX}
                    rows={4}
                    placeholder={
                      en ? "We're on it. Your listings are safe." : form.body.en || "Message"
                    }
                    onChange={(e) => setText("body", e.target.value)}
                    className={`${inputClass} resize-y leading-relaxed`}
                  />
                  <span className={hintClass}>Line breaks are kept.</span>
                </div>
                {missing.length > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <IconGlobe size={13} />
                    {listSentence(missing.map((l) => ANNOUNCEMENT_LOCALE_LABEL[l]))} readers see the English.
                  </p>
                )}
              </div>

              <div className="mt-6">
                <FieldLabel end={`${form.buttons.length} of ${ANNOUNCEMENT_BUTTONS_MAX}`}>Buttons</FieldLabel>
                <div className="space-y-2">
                  {form.buttons.map((b, i) => {
                    const url = trimText(b.url);
                    const urlBad = url !== "" && !ctaUrlOk(url);
                    return (
                      <div key={i} className="rounded-lg border border-[var(--admin-border)] p-3">
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-700">
                            {i === 0 ? "Main button" : "Second button"}
                            <span className="ml-1.5 font-normal text-zinc-400">
                              {i === 0 ? "filled with the colour" : "outlined"}
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove the ${i === 0 ? "main" : "second"} button`}
                            title="Remove"
                            onClick={() =>
                              update((f) => ({ buttons: f.buttons.filter((_, j) => j !== i) }))
                            }
                            className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                          <div>
                            <FieldLabel
                              htmlFor={`announcement-button-${i}-label`}
                              end={counter(b.label[locale], ANNOUNCEMENT_BUTTON_LABEL_MAX)}
                            >
                              Text ({ANNOUNCEMENT_LOCALE_LABEL[locale]})
                            </FieldLabel>
                            <input
                              id={`announcement-button-${i}-label`}
                              type="text"
                              value={b.label[locale] ?? ""}
                              maxLength={ANNOUNCEMENT_BUTTON_LABEL_MAX}
                              placeholder={
                                en ? (i === 0 ? "Update now" : "Learn more") : b.label.en || "Text"
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                setButton(i, (x) => ({
                                  ...x,
                                  label: { ...x.label, [locale]: value },
                                }));
                              }}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`announcement-button-${i}-url`}>
                              Link (every language)
                            </FieldLabel>
                            <input
                              id={`announcement-button-${i}-url`}
                              type="url"
                              inputMode="url"
                              value={b.url}
                              maxLength={ANNOUNCEMENT_BUTTON_URL_MAX}
                              placeholder="https://salelinx.com/docs/status"
                              onChange={(e) => {
                                const value = e.target.value;
                                setButton(i, (x) => ({ ...x, url: value }));
                              }}
                              className={`${inputClass} font-mono text-xs`}
                              aria-invalid={urlBad ? true : undefined}
                            />
                          </div>
                        </div>
                        {urlBad && (
                          <span className={errorClass}>
                            {ANNOUNCEMENT_ERROR_MESSAGE.invalid_button_url}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {form.buttons.length < ANNOUNCEMENT_BUTTONS_MAX && (
                  <button
                    type="button"
                    onClick={() =>
                      update((f) => ({ buttons: [...f.buttons, { label: { en: "" }, url: "" }] }))
                    }
                    className={`${form.buttons.length ? "mt-2" : ""} flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--admin-border)] px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900`}
                  >
                    <IconPlus size={14} />
                    {form.buttons.length ? "Add a second button" : "Add a button"}
                  </button>
                )}
                <span className={hintClass}>
                  Links can go to salelinx.com, the Chrome Web Store, Depop, Vinted or eBay, over https.
                </span>
              </div>

              <div className="mt-6">
                <FieldLabel end="Optional">Image</FieldLabel>
                {form.imagePath ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--admin-border)] p-2.5">
                    {imageSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a blob URL of the picked or stored file; next/image adds nothing here
                      <img
                        src={imageSrc}
                        alt=""
                        className="h-16 w-28 shrink-0 rounded-md border border-[var(--admin-border)] object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] text-zinc-500">
                        Loading
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      <label className={`${secondaryButton} cursor-pointer`}>
                        {uploading ? "Uploading..." : "Replace"}
                        {fileInput}
                      </label>
                      <button type="button" onClick={removeImage} disabled={busy} className={ghostButton}>
                        Remove
                      </button>
                      <a
                        href={announcementImageUrl(
                          form.imagePath,
                          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className={ghostButton}
                      >
                        Open
                      </a>
                    </div>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      if (!busy) void pickImage(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-zinc-500 ${
                      dragging
                        ? "border-zinc-500 bg-zinc-100"
                        : "border-[var(--admin-border)] hover:border-zinc-400 hover:bg-zinc-50"
                    }`}
                  >
                    <IconUpload size={18} className="text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-800">
                      {uploading ? "Uploading..." : "Upload an image"}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      or drop one here. PNG, JPEG, WebP or GIF, up to{" "}
                      {ANNOUNCEMENT_IMAGE_MAX_BYTES / 1024 / 1024} MB.
                    </span>
                    {fileInput}
                  </label>
                )}
                {imageError ? (
                  <span className={errorClass}>{imageError}</span>
                ) : (
                  <span className={hintClass}>
                    Shown above the text, in every language. It uploads as soon as you pick it.
                  </span>
                )}
              </div>
            </EditorSection>

            <EditorSection
              id="announcement-look"
              title="Look"
              description="The colour and icon it has wherever it shows."
              aside={
                !isNew && (
                  <select
                    aria-label="Apply a template"
                    value=""
                    onChange={(e) => {
                      const p = ANNOUNCEMENT_PRESETS.find((x) => x.key === e.target.value);
                      if (p) applyPreset(p);
                    }}
                    className="rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs text-zinc-700"
                  >
                    <option value="">Apply a template...</option>
                    {ANNOUNCEMENT_PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )
              }
            >
              <div className="space-y-5">
                <div>
                  <FieldLabel end={ANNOUNCEMENT_THEME_LABEL[form.theme]}>Colour</FieldLabel>
                  <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-3 px-0.5 py-0.5">
                    {ANNOUNCEMENT_THEMES.map((t) => {
                      const on = form.theme === t;
                      const color = ANNOUNCEMENT_THEME_COLOR[t];
                      return (
                        <label key={t} title={ANNOUNCEMENT_THEME_LABEL[t]} className="relative cursor-pointer">
                          <input
                            type="radio"
                            name="announcement-theme"
                            className="peer sr-only"
                            aria-label={ANNOUNCEMENT_THEME_LABEL[t]}
                            checked={on}
                            onChange={() => set("theme", t)}
                          />
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-white transition-shadow ${focusRing}`}
                            style={{
                              backgroundColor: color,
                              boxShadow: on
                                ? `0 0 0 2px var(--admin-surface), 0 0 0 4px ${color}`
                                : "inset 0 0 0 1px rgba(0, 0, 0, 0.12)",
                            }}
                          >
                            {on && <IconCheck size={14} />}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <FieldLabel
                    end={emojiSet ? "The emoji is shown instead" : ANNOUNCEMENT_ICON_LABEL[form.icon]}
                  >
                    Icon
                  </FieldLabel>
                  <div
                    role="radiogroup"
                    aria-label="Icon"
                    className={`flex flex-wrap gap-1.5 transition-opacity ${emojiSet ? "opacity-40" : ""}`}
                  >
                    {ANNOUNCEMENT_ICONS.map((i) => {
                      const on = form.icon === i;
                      return (
                        <label key={i} title={ANNOUNCEMENT_ICON_LABEL[i]} className="relative cursor-pointer">
                          <input
                            type="radio"
                            name="announcement-icon"
                            className="peer sr-only"
                            aria-label={ANNOUNCEMENT_ICON_LABEL[i]}
                            checked={on}
                            onChange={() => set("icon", i)}
                          />
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${focusRing} ${
                              on
                                ? ""
                                : "border-[var(--admin-border)] text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                            }`}
                            style={
                              on
                                ? { color: accent, borderColor: accent, backgroundColor: alpha(accent, 0.1) }
                                : undefined
                            }
                          >
                            {i === "none" ? (
                              <span className="text-[10px] font-medium">None</span>
                            ) : (
                              <Glyph icon={i} emoji={null} size={17} />
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="announcement-emoji">Or an emoji</FieldLabel>
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0">
                      <input
                        id="announcement-emoji"
                        type="text"
                        value={form.emoji}
                        placeholder="None"
                        onChange={(e) => set("emoji", e.target.value)}
                        className={`${inputClass} text-center`}
                        aria-invalid={emojiError ? true : undefined}
                      />
                    </span>
                    {emojiSet && (
                      <button type="button" onClick={() => set("emoji", "")} className={ghostButton}>
                        Use the icon
                      </button>
                    )}
                  </div>
                  {emojiError ? (
                    <span className={errorClass}>{emojiError}</span>
                  ) : (
                    <span className={hintClass}>Shown instead of the icon.</span>
                  )}
                </div>
              </div>
            </EditorSection>

            <EditorSection
              id="announcement-where"
              title="Where it shows"
              description="Pick one or more. The preview shows each one."
            >
              <div className="grid gap-2.5 sm:grid-cols-3">
                {ANNOUNCEMENT_EDITOR_PLACEMENTS.map((p) => {
                  const blocked = tabsChosen && !ANNOUNCEMENT_PANEL_PLACEMENTS.includes(p);
                  const on = form.placements.includes(p);
                  return (
                    <label
                      key={p}
                      title={blocked ? "Not for a message tied to panel tabs" : undefined}
                      className={`relative flex flex-col rounded-lg border p-3 transition-colors ${cardChoice(on)} ${
                        blocked ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={on}
                        disabled={blocked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          update((f) => ({
                            placements: togglePlacement(f.placements, p, checked, f.tabs),
                          }));
                        }}
                      />
                      <span
                        aria-hidden="true"
                        className={`absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded border ${focusRing} ${
                          on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
                        }`}
                      >
                        {on && <IconCheck size={11} />}
                      </span>
                      <span className="mb-2.5 text-zinc-500">
                        <PlaceDiagram place={p} accent={on ? accent : "currentColor"} className="h-12 w-[72px]" />
                      </span>
                      <span className="text-[13px] font-medium text-zinc-900">
                        {ANNOUNCEMENT_PLACEMENT_LABEL[p]}
                      </span>
                      <span className="mt-0.5 text-[11.5px] leading-snug text-zinc-500">
                        {ANNOUNCEMENT_PLACEMENT_HINT[p]}
                      </span>
                    </label>
                  );
                })}
              </div>
              {form.placements.length === 0 && (
                <p className={errorClass}>Tick at least one place.</p>
              )}
              {tabsChosen && (
                <p className={hintClass}>
                  It is for certain panel tabs (under Who sees it), so it can only show inside
                  the panel: as a banner or a popup.
                </p>
              )}
            </EditorSection>

            <EditorSection id="announcement-often" title="How often">
              <div role="radiogroup" aria-label="How often" className="grid gap-2 sm:grid-cols-2">
                {ANNOUNCEMENT_FREQUENCIES.map((q) => {
                  const on = form.frequency === q;
                  return (
                    <label
                      key={q}
                      className={`relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${cardChoice(on)}`}
                    >
                      <input
                        type="radio"
                        name="announcement-frequency"
                        className="peer sr-only"
                        checked={on}
                        onChange={() => set("frequency", q)}
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${focusRing} ${
                          on ? "border-zinc-900" : "border-zinc-300"
                        }`}
                      >
                        {on && <span className="h-2 w-2 rounded-full bg-zinc-900" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-zinc-900">
                          {ANNOUNCEMENT_FREQUENCY_LABEL[q]}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-zinc-500">
                          {ANNOUNCEMENT_FREQUENCY_HINT[q]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </EditorSection>

            <EditorSection
              id="announcement-priority"
              title="Priority"
              description="Decides the order when several show at once. Urgent is read out by screen readers straight away."
            >
              <Segmented
                name="announcement-priority"
                label="Priority"
                value={form.priority}
                onChange={(p) => set("priority", p)}
                options={ANNOUNCEMENT_PRIORITIES.map((p) => ({
                  value: p,
                  label: ANNOUNCEMENT_PRIORITY_LABEL[p],
                }))}
              />
            </EditorSection>

            <EditorSection
              id="announcement-who"
              title="Who sees it"
              description={
                <>
                  Pick nothing to reach everyone. Shown to:{" "}
                  <span className="font-medium text-zinc-800">{audience}</span>
                </>
              }
            >
              <div className="space-y-5">
                <FilterRow label="Plans">
                  <div className="flex flex-wrap gap-1.5">
                    {ANNOUNCEMENT_TIERS.map((t) => (
                      <ChipToggle
                        key={t}
                        checked={form.tiers.includes(t)}
                        onChange={(on) => set("tiers", toggle(form.tiers, t, on))}
                      >
                        {ANNOUNCEMENT_TIER_LABEL[t]}
                      </ChipToggle>
                    ))}
                  </div>
                </FilterRow>
                <FilterRow label="Marketplaces" hint="Anyone with at least one of them switched on.">
                  <div className="flex flex-wrap gap-1.5">
                    {ANNOUNCEMENT_PLATFORMS.map((p) => (
                      <ChipToggle
                        key={p}
                        checked={form.platforms.includes(p)}
                        onChange={(on) => set("platforms", toggle(form.platforms, p, on))}
                      >
                        {ANNOUNCEMENT_PLATFORM_LABEL[p]}
                      </ChipToggle>
                    ))}
                  </div>
                </FilterRow>
                <FilterRow label="Language" hint="The language the extension is set to.">
                  <div className="flex flex-wrap gap-1.5">
                    {ANNOUNCEMENT_LOCALES.map((l) => (
                      <ChipToggle
                        key={l}
                        checked={form.locales.includes(l)}
                        onChange={(on) => set("locales", toggle(form.locales, l, on))}
                      >
                        {ANNOUNCEMENT_LOCALE_LABEL[l]}
                      </ChipToggle>
                    ))}
                  </div>
                </FilterRow>
                <FilterRow
                  label="Panel tabs"
                  hint="Only while one of these tabs is open, so only as a banner or a popup."
                >
                  <div className="flex flex-wrap gap-1.5">
                    {[...ANNOUNCEMENT_TABS, ...extraTabs].map((t) => (
                      <ChipToggle key={t} checked={form.tabs.includes(t)} onChange={(on) => setTab(t, on)}>
                        {tabLabel(t)}
                      </ChipToggle>
                    ))}
                  </div>
                </FilterRow>
                <FilterRow label="Specific people">
                  <textarea
                    aria-label="Specific people, by email"
                    value={form.recipients}
                    rows={2}
                    placeholder="Emails, one per line or separated by commas"
                    onChange={(e) => set("recipients", e.target.value)}
                    className={`${inputClass} font-mono text-xs`}
                    aria-invalid={badEmails.length || unknownShown.length ? true : undefined}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => void justMe()} className={secondaryButton}>
                      Just me
                    </button>
                    {recipients.length > 0 && (
                      <span
                        className={`text-xs ${
                          recipients.length > ANNOUNCEMENT_RECIPIENTS_MAX ? "text-red-600" : "text-zinc-500"
                        }`}
                      >
                        {recipients.length === 1 ? "1 person" : `${recipients.length} people`}
                      </span>
                    )}
                    {meNote && <span className="text-xs text-red-600">{meNote}</span>}
                  </div>
                  {badEmails.length > 0 && (
                    <span className={errorClass}>Not an email address: {badEmails.join(", ")}</span>
                  )}
                  {recipients.length > ANNOUNCEMENT_RECIPIENTS_MAX && (
                    <span className={errorClass}>{ANNOUNCEMENT_ERROR_MESSAGE.too_many_recipients}</span>
                  )}
                  {unknownShown.length > 0 && (
                    <span className={errorClass}>No account has: {unknownShown.join(", ")}</span>
                  )}
                  <span className={hintClass}>
                    Only these people see it, and only while signed in. Leave empty for everyone.
                  </span>
                </FilterRow>

                <div>
                  <button
                    type="button"
                    aria-expanded={moreFilters}
                    onClick={() => setMoreFilters((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    <IconChevronDown
                      size={14}
                      className={`transition-transform ${moreFilters ? "" : "-rotate-90"}`}
                    />
                    Version and sign-in
                  </button>
                  {moreFilters && (
                    <div className="mt-4 space-y-4">
                      <FilterRow
                        label="Versions"
                        hint={
                          versionError
                            ? undefined
                            : 'Both included. For "please update", set the highest to the version before the new one.'
                        }
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-32">
                            <input
                              type="text"
                              aria-label="Lowest version"
                              value={form.minVersion}
                              placeholder="Lowest, any"
                              onChange={(e) => set("minVersion", e.target.value)}
                              className={`${inputClass} font-mono text-xs`}
                            />
                          </span>
                          <span className="text-xs text-zinc-400">to</span>
                          <span className="w-32">
                            <input
                              type="text"
                              aria-label="Highest version"
                              value={form.maxVersion}
                              placeholder="Highest, any"
                              onChange={(e) => set("maxVersion", e.target.value)}
                              className={`${inputClass} font-mono text-xs`}
                            />
                          </span>
                        </div>
                        {versionError && <span className={errorClass}>{versionError}</span>}
                      </FilterRow>
                      <FilterRow label="Sign-in">
                        <ChipToggle
                          checked={form.signedInOnly}
                          onChange={(on) => set("signedInOnly", on)}
                        >
                          Signed-in users only
                        </ChipToggle>
                      </FilterRow>
                    </div>
                  )}
                </div>
              </div>
            </EditorSection>

            <EditorSection
              id="announcement-when"
              title="When"
              description={`Times are in your time zone (${timeZone}).`}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <FieldLabel>Starts</FieldLabel>
                  <Segmented
                    name="announcement-start"
                    label="Starts"
                    value={form.startMode}
                    onChange={(v) => set("startMode", v)}
                    options={[
                      { value: "now", label: isNew ? "Now" : "Now, restart it" },
                      { value: "at", label: "At a set time" },
                    ]}
                  />
                  {form.startMode === "at" && (
                    <input
                      type="datetime-local"
                      aria-label="Start time"
                      value={form.startAt}
                      onChange={(e) => set("startAt", e.target.value)}
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </div>
                <div>
                  <FieldLabel>Ends</FieldLabel>
                  <Segmented
                    name="announcement-end"
                    label="Ends"
                    value={form.endMode}
                    onChange={(v) => set("endMode", v)}
                    options={[
                      { value: "never", label: "When I end it" },
                      { value: "at", label: "At a set time" },
                    ]}
                  />
                  {form.endMode === "at" && (
                    <input
                      type="datetime-local"
                      aria-label="End time"
                      value={form.endAt}
                      onChange={(e) => set("endAt", e.target.value)}
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </div>
              </div>

              {!isNew && (
                <label
                  className={`relative mt-5 flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${cardChoice(form.showAgain)}`}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={form.showAgain}
                    onChange={(e) => set("showAgain", e.target.checked)}
                  />
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${focusRing} ${
                      form.showAgain ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
                    }`}
                  >
                    {form.showAgain && <IconCheck size={11} />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-zinc-900">
                      Show it again to people who closed it
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-zinc-500">
                      Counts as a new revision. Leave it off for a typo fix.
                    </span>
                  </span>
                </label>
              )}
            </EditorSection>
          </div>

          <aside
            aria-label="Preview"
            className="border-t border-[var(--admin-border)] bg-[var(--admin-bg)] px-5 py-6 sm:px-7 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0"
          >
            <h3 className="mb-3 text-[13px] font-semibold">Preview</h3>
            <Preview
              message={{
                theme: form.theme,
                icon: form.icon,
                emoji: form.emoji,
                priority: form.priority,
                title: form.title,
                body: form.body,
                buttons: form.buttons.map((b) => b.label),
                hasImage: form.imagePath !== null,
                imageSrc,
                closable: form.frequency !== "always",
                placements: form.placements,
              }}
              locale={previewLocale}
              onLocale={setPreviewLocale}
            />

            <dl className="mt-5 divide-y divide-[var(--admin-border)] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs">
              {summary.map(([term, value]) => (
                <div key={term} className="flex gap-4 px-3.5 py-2.5">
                  <dt className="w-[72px] shrink-0 text-zinc-500">{term}</dt>
                  <dd className="min-w-0 flex-1 break-words text-zinc-800">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
              A close copy of the extension. Users see it in their own panel theme and
              language, and the extension writes its own labels, like Got it, in that
              language too.
            </p>
          </aside>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--admin-border)] px-5 py-3 sm:px-7">
          <p role="status" className="min-w-0 flex-1 text-xs">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : liveCode && changed ? (
              <span className="text-amber-700">{errorText(liveCode)}</span>
            ) : (
              <span className="hidden text-zinc-500 sm:inline">
                {isNew
                  ? form.startMode === "now"
                    ? "Open extensions show it within about 15 seconds of publishing."
                    : "It goes live by itself at its start time."
                  : "Open extensions pick up changes within about 15 seconds."}
              </span>
            )}
          </p>
          <button type="button" onClick={close} disabled={busy} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={`${primaryButton} px-4`}
          >
            {pending ? action.busy : action.label}
          </button>
        </footer>
      </div>
    </>
  );
}
