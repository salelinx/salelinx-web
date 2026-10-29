import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { deletedEmailHash } from "../lib/admin/deleted-email-hash";

describe("deletedEmailHash", () => {
  it("hashes the trimmed, lowercased address like public.deleted_email_hash()", async () => {
    const expected = createHash("sha256").update("slx-deleted:seller@example.com").digest("hex");
    expect(await deletedEmailHash("  Seller@Example.com ")).toBe(expected);
  });
});
