import { PageContainer } from "@/components/layout/primitives";
import { getSetting } from "@/lib/settings/service";

/**
 * Operator announcement.
 *
 * Renders nothing at all when no announcement is set, which is the default, so
 * the approved layout is unchanged until someone deliberately publishes one.
 * Plain text only - the registry schema permits no markup, so this cannot
 * become a way to inject content into every page.
 */
export async function AnnouncementBanner() {
  const message = await getSetting("site.announcement");
  if (!message.trim()) return null;

  return (
    <div className="border-b border-border bg-surface-raised">
      <PageContainer className="py-2.5">
        <p className="body-sm text-center text-foreground-secondary" role="status">
          {message}
        </p>
      </PageContainer>
    </div>
  );
}
