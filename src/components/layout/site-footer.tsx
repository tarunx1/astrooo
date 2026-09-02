import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/layout/primitives";
import { brand } from "@/config/brand";
import { navigation } from "@/config/navigation";

export function SiteFooter() {
  const groups = navigation.filter((item) => !("utilityOnly" in item)).slice(0, 6);

  return (
    <footer className="border-t border-border bg-background-subtle">
      <PageContainer className="grid gap-10 py-14 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full border border-premium/70 text-caption text-premium">{brand.logo.mark}</span>
            <span className="font-display text-2xl">{brand.name}</span>
          </div>
          <p className="mt-5 max-w-sm body-sm text-foreground-secondary">{brand.description}</p>
          <div className="mt-6 flex gap-3">
            {Object.entries(brand.social).map(([label, href]) => (
              <Link className="body-sm capitalize text-foreground-muted transition hover:text-premium" href={href} key={label} prefetch={false}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="caption uppercase text-foreground">{group.label}</h3>
              <div className="mt-4 grid gap-2">
                {group.items.slice(0, 4).map((item) => (
                  <Link className="body-sm text-foreground-secondary transition hover:text-foreground" href={item.href} key={item.label} prefetch={false}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
      <PageContainer className="flex flex-col gap-3 border-t border-border py-5 body-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 {brand.name}. All rights reserved.</span>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck size={16} className="text-premium" /> Secure payments · Verified astrologers
        </span>
      </PageContainer>
    </footer>
  );
}
