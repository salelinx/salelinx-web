// Must match public.deleted_email_hash() in migration 043.
export async function deletedEmailHash(email: string): Promise<string> {
  const bytes = new TextEncoder().encode("slx-deleted:" + email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
