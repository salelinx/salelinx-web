"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = createBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      return;
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-portal-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/account`,
        }),
      },
    );

    if (!res.ok) {
      setLoading(false);
      alert("Could not open the billing portal. Please try again.");
      return;
    }

    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-4 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
    >
      {loading ? "Loading..." : "Manage subscription"}
    </button>
  );
}
