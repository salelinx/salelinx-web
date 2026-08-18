"use client";

// A "now" that is safe to render relative timestamps against.
//
// The problem it solves: the admin tables are Client Components, which Next
// also renders on the server. Reading the clock independently on each side
// produces different text for the same row and React reports a hydration
// mismatch. Reading it in an effect instead is a cascading render (and the
// repo's react-hooks/set-state-in-effect lint rule rejects it).
//
// useSyncExternalStore is the built-in answer: React uses getServerSnapshot
// for the server render AND for hydration, then switches to getSnapshot. So
// this returns null on both sides of hydration (callers render absolute dates
// only), then a real timestamp once the client takes over.
//
// The store also ticks once a minute, so a console left open overnight does not
// keep insisting a heartbeat was "2m ago". The interval only runs while a
// component is subscribed.

import { useSyncExternalStore } from "react";

const TICK_MS = 60_000;

const listeners = new Set<() => void>();
let snapshot = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (timer === null) {
    timer = setInterval(() => {
      snapshot = Date.now();
      for (const listener of listeners) listener();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Must return a cached value, not a fresh Date.now(): a getSnapshot that
// changes on every call makes React re-render forever.
function getSnapshot(): number {
  if (snapshot === 0) snapshot = Date.now();
  return snapshot;
}

function getServerSnapshot(): number | null {
  return null;
}

export function useClientNow(): number | null {
  return useSyncExternalStore<number | null>(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}
