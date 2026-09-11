import { ContentImage } from "@/components/ui/content-image";
import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Flame } from "lucide-react";
import { PageContainer, Section, SectionHeader } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { listPujas, PUJA_MODE_LABEL } from "@/lib/puja/catalog";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Online Puja | Book Vedic Rituals with Verified Pandits",
  description:
    "Book a Vedic puja performed on your behalf by a verified practitioner. Every ritual lists its purpose, materials and process before you book.",
  alternates: { canonical: `${brand.url}/puja` },
};

/**
 * The puja catalogue.
 *
 * Content comes from the database, not from a hardcoded list: an operator adds
 * a ritual through the admin and it appears here. Only `active` rituals are
 * queried, so an unpublished one is invisible by construction.
 */
export default async function PujaPage() {
  const pujas = await listPujas();

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <SectionHeader
          text="Rituals performed on your behalf by verified practitioners. Every listing shows its traditional purpose, the materials involved and how it is performed, so you know what you are booking."
          title="Online Puja"
        />

        {pujas.length === 0 ? (
          <EmptyState
            message="Our puja services are being prepared. Please check back shortly."
            title="No pujas listed yet"
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pujas.map((puja) => (
              <li className="h-full" key={puja.id}>
                <Card className="group h-full overflow-hidden" variant="interactive">
                  <Link
                    className="flex h-full flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                    href={`/puja/${puja.slug}`}
                    prefetch={false}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-surface-raised">
                      {puja.imageUrl ? (
                        <ContentImage
                          alt=""
                          className="size-full object-cover transition duration-[var(--motion-normal)] group-hover:scale-105"
                          height={400}
                          src={puja.imageUrl}
                          width={640}
                        />
                      ) : (
                        <div aria-hidden="true" className="grid size-full place-items-center text-foreground-muted">
                          <Flame size={28} />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="heading-sm text-foreground">{puja.title}</h2>
                      <p className="mt-2 line-clamp-2 body-sm text-foreground-secondary">
                        {puja.shortDescription}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 caption text-foreground-muted">
                        {puja.durationMinutes ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock aria-hidden="true" size={12} />
                            {puja.durationMinutes} min
                          </span>
                        ) : null}
                        {puja.modes.length > 0 ? <span>{PUJA_MODE_LABEL[puja.modes[0]]}</span> : null}
                      </div>

                      <p className="mt-auto pt-4 body-md font-semibold text-foreground">
                        {formatMoneyMinor(puja.pricePaise, puja.currency)}
                      </p>
                    </div>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </Section>
  );
}
