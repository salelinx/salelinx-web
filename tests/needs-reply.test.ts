import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countNeedsReply, loadOpenTicketCounts } from "@/lib/admin/needs-reply";

type Result = { data: unknown; error: unknown };

// Just enough of the query builder: every chained call returns the builder, and
// awaiting it resolves to that table's canned result.
function fakeClient(results: Record<string, Result>): SupabaseClient {
  return {
    from(table: string) {
      const builder = {
        select: () => builder,
        neq: () => builder,
        in: () => builder,
        order: () => builder,
        then: (resolve: (r: Result) => unknown) => resolve(results[table]),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const open = (id: string) => ({ id, status: "open" as const });
const reply = (ticket_id: string, is_admin: boolean) => ({ ticket_id, is_admin });

describe("countNeedsReply", () => {
  it("flags a ticket nobody has answered", () => {
    expect(countNeedsReply([open("a")], [])).toBe(1);
  });

  it("goes by whoever spoke last", () => {
    const tickets = [open("answered"), open("user-came-back")];
    const replies = [
      reply("answered", false),
      reply("answered", true),
      reply("user-came-back", true),
      reply("user-came-back", false),
    ];
    expect(countNeedsReply(tickets, replies)).toBe(1);
  });

  it("never flags a closed ticket", () => {
    const closed = { id: "a", status: "closed" as const };
    expect(countNeedsReply([closed], [reply("a", false)])).toBe(0);
  });
});

describe("loadOpenTicketCounts", () => {
  it("counts open tickets and those awaiting staff", async () => {
    const supabase = fakeClient({
      support_tickets: { data: [open("a"), open("b")], error: null },
      support_ticket_replies: { data: [reply("a", true)], error: null },
    });
    await expect(loadOpenTicketCounts(supabase)).resolves.toEqual({
      open: 2,
      needsReply: 1,
    });
  });

  it("reports nothing to do when no ticket is open", async () => {
    const supabase = fakeClient({
      support_tickets: { data: [], error: null },
    });
    await expect(loadOpenTicketCounts(supabase)).resolves.toEqual({
      open: 0,
      needsReply: 0,
    });
  });

  it("returns null when the tickets read fails", async () => {
    const supabase = fakeClient({
      support_tickets: { data: null, error: { message: "boom" } },
    });
    await expect(loadOpenTicketCounts(supabase)).resolves.toBeNull();
  });

  // Reading a failed replies query as "no replies" would flag every open ticket.
  it("returns null, not a full alert, when the replies read fails", async () => {
    const supabase = fakeClient({
      support_tickets: { data: [open("a"), open("b")], error: null },
      support_ticket_replies: { data: null, error: { message: "boom" } },
    });
    await expect(loadOpenTicketCounts(supabase)).resolves.toBeNull();
  });
});
