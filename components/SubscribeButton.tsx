"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

type Props = {
  priceId: string;
  label: string;
  highlight?: boolean;
};

export function SubscribeButton({ priceId, label, highlight }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onClick() {
    setLoading(true);
    const supabase = createBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push(
        `/auth/login?next=${encodeURIComponent("/pricing")}`,
      );
      return;
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/account?checkout=success`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      },
    );

    if (!res.ok) {
      setLoading(false);
      alert("Could not start checkout. Please try again.");
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
      className={`mt-6 w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-60 ${
        highlight
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "border border-black/10 dark:border-white/20"
      }`}
    >
      {loading ? "Loading..." : label}
    </button>
  );
}
