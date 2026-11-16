"use client";

// Browser-side helpers for the Social pages: Edge Function calls with the
// admin's session, and uploads straight into the private social-media bucket
// (052_social.sql), which only admins may write. Uploads go by XHR rather
// than supabase-js so the planner can show progress on a large video.

import { createBrowserClient } from "@/lib/supabase/client";

export const BUCKET = "social-media";

async function accessToken(): Promise<string> {
  const supabase = createBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

export async function callFunction(name: string, body?: unknown): Promise<Response> {
  return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** A bucket path for a new upload: random, with a readable tail. */
export function uploadPath(folder: "videos" | "covers", fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = (dot > 0 ? fileName.slice(dot + 1) : "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${folder}/${crypto.randomUUID()}${stem ? `-${stem}` : ""}.${ext || "bin"}`;
}

export function uploadToBucket(
  file: File,
  path: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return accessToken().then(
    (token) =>
      new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
        );
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded / e.total);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve();
          let message = `${xhr.status}`;
          try {
            const body = JSON.parse(xhr.responseText);
            message = body.message ?? body.error ?? message;
          } catch {
            // Not JSON; the status will do.
          }
          reject(new Error(message));
        };
        xhr.onerror = () => reject(new Error("network error"));
        xhr.send(file);
      }),
  );
}

export async function signedUrl(path: string): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** "14.2 MB" */
export function megabytes(bytes: number | null): string {
  if (!bytes) return "";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PLATFORM_LABEL = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
} as const;

/**
 * Starts a platform login (marketing-oauth) and leaves for the platform's page.
 * The platform sends the browser back to the page this was called from,
 * localhost included, with ?connected= or ?error= on it. Resolves to an
 * error message only if it could not start.
 */
export async function connectPlatform(
  platform: keyof typeof PLATFORM_LABEL,
): Promise<string | null> {
  const returnTo = `${window.location.origin}${window.location.pathname}`;
  const res = await callFunction("marketing-oauth", { platform, returnTo }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  if (!res?.ok || !body?.url)
    return `Couldn't start the ${PLATFORM_LABEL[platform]} login. Is the latest marketing-oauth deployed?`;
  window.location.assign(body.url);
  return null;
}

const CONNECT_ERRORS: Record<string, string> = {
  expired: "That connect link expired or wasn't ours. Try Connect again.",
  declined: "The login was cancelled, so nothing was connected.",
  exchange: "The platform refused the login. Check the app's ID, secret and redirect address.",
  wrong_channel:
    "That Google login is for a different YouTube channel. Connect again and pick the SaleLinx channel.",
  no_instagram:
    "Connected Facebook, but the SaleLinx Page has no Instagram account linked. Link them (Page settings > Linked accounts, or Meta Business Suite), then press Instagram again.",
};

/** Why no Facebook Page came back, from how many Pages the login could see. */
function noPage(seen: number, igConnected: boolean): string {
  const lead = igConnected ? "Instagram connected, but no Facebook Page came through. " : "";
  if (seen > 1)
    return `${lead}The login could see ${seen} Pages and none is clearly SaleLinx: set FACEBOOK_PAGE_ID to the SaleLinx Page's id, then connect again.`;
  return `${lead}The login could see no Facebook Page. Check the Facebook Login for Business configuration has Pages as an asset, then connect again and tick the SaleLinx Page on Meta's screen. The Facebook account used must manage the Page.`;
}

/** The line to show after marketing-oauth sends the browser back. */
export function connectNotice(notice: {
  connected?: string;
  error?: string;
  seen?: string;
  ig?: string;
  diag?: string;
}): string | null {
  const details = notice.diag ? ` Details: ${notice.diag}` : "";
  if (notice.connected) {
    const name = PLATFORM_LABEL[notice.connected as keyof typeof PLATFORM_LABEL] ?? notice.connected;
    return `${name} connected. Press Sync now on Stats to read its videos.`;
  }
  if (notice.error === "facebook_page")
    return noPage(Number(notice.seen ?? 0), notice.ig === "1") + details;
  if (notice.error)
    return (CONNECT_ERRORS[notice.error] ?? "Something went wrong connecting.") + details;
  return null;
}
