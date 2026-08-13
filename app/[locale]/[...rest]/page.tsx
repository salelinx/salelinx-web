import { notFound } from 'next/navigation';

// Funnels every URL that matches no real route into the localized
// not-found page. Without this, unknown paths render Next's bare default
// 404 outside the [locale] layout (no Header/Footer, English only).
export default function CatchAllPage() {
  notFound();
}
