import Link from "next/link";
import { Play, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/primitives";
import { brand } from "@/config/brand";
import { navigation } from "@/config/navigation";
import { getSettings } from "@/lib/settings/service";

/**
 * Site footer.
 *
 * Identity and contact details come from settings an operator can change,
 * falling back to the committed brand config when nothing has been saved. That
 * fallback is what keeps the site rendering correctly on a fresh database.
 */
export async function SiteFooter() {
  const groups = navigation.filter((item) => !("utilityOnly" in item)).slice(0, 6);

  const settings = await getSettings([
    "site.name",
    "site.legalName",
    "site.supportEmail",
    "site.contactPhone",
  ]);

  const siteName = settings["site.name"] || brand.name;
  const legalName = settings["site.legalName"] || siteName;
  const supportEmail = settings["site.supportEmail"];
  const contactPhone = settings["site.contactPhone"];

  return (
    <footer className="border-t border-premium/15 bg-transparent">
      <PageContainer className="grid gap-12 py-14 lg:grid-cols-[1.05fr_2fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full border border-premium/70 text-caption text-premium">{brand.logo.mark}</span>
            <span className="font-display text-2xl">{siteName}</span>
          </div>
          <p className="mt-5 max-w-sm body-sm text-foreground-secondary">{brand.description}</p>
          {supportEmail || contactPhone ? (
            <div className="mt-5 grid gap-1">
              {supportEmail ? (
                <a className="body-sm text-foreground-secondary transition hover:text-foreground" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
              ) : null}
              {contactPhone ? <span className="body-sm text-foreground-secondary">{contactPhone}</span> : null}
            </div>
          ) : null}
          <div className="mt-7 flex gap-2.5" aria-label="Social links">
            {Object.entries(brand.social).map(([label, href]) => (
              <Link
                aria-label={label}
                className="grid size-9 place-items-center rounded-full border border-border/80 bg-surface/50 text-foreground-muted transition hover:border-premium/50 hover:text-premium"
                href={href}
                key={label}
                prefetch={false}
              >
                <SocialIcon label={label} />
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="caption uppercase tracking-[0.16em] text-foreground">{group.label}</h3>
              <div className="mt-4 grid gap-1.5">
                {group.items.slice(0, 4).map((item) => (
                  <Link className="text-sm leading-7 text-foreground-secondary transition hover:text-premium" href={item.href} key={item.label} prefetch={false}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
      <PageContainer className="flex flex-col gap-3 border-t border-white/5 py-5 body-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 {legalName}. All rights reserved.</span>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={16} className="text-premium" /> Secure payments · Verified astrologers
        </span>
      </PageContainer>
    </footer>
  );
}

function SocialIcon({ label }: { label: string }) {
  if (label === "youtube") return <Play size={15} strokeWidth={2} />;
  return <span className="text-xs font-semibold uppercase">{label.slice(0, 1)}</span>;
}
