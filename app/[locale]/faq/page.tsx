import { redirect } from '@/i18n/navigation';

// FAQ moved under the support hub. Keep this stub so old /faq links and
// bookmarks resolve. Mirrors the /pricing and /roadmap redirect stubs.
export default async function FaqRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/help/faq', locale });
}
