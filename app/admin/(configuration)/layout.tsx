import { ConfigurationTabs } from "@/components/admin/ConfigurationTabs";

// Tier limits, feature flags and the roadmap share one sidebar entry,
// Configuration, and switch between each other with these tabs. A route group,
// so their URLs (and the roadmap actions' revalidatePath) are unchanged. Each
// page lays itself out at h-screen; inside the tabs it takes the space left.

export default function ConfigurationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <ConfigurationTabs />
      <div className="min-h-0 flex-1 [&>div]:!h-full">{children}</div>
    </div>
  );
}
