import { redirect } from '@/i18n/navigation';

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/features#pricing', locale });
}
