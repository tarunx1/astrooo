import { ContentImage } from "@/components/ui/content-image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, Flame } from "lucide-react";
import { PageContainer, Section } from "@/components/layout/primitives";
import { PujaBookingForm } from "@/components/puja/puja-booking-form";
import { getPuja, PUJA_MODE_LABEL } from "@/lib/puja/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { brand } from "@/config/brand";

/**
 * One ritual.
 *
 * Server-rendered so the purpose, materials and process are indexable and
 * readable without JavaScript; only the booking form is interactive.
 *
 * Benefits are presented as traditional association, never as a promised
 * outcome - the same separation the gemstone pages make between a measured
 * property and a tradition.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const puja = await getPuja(slug);

  if (!puja) return { title: "Puja not found", robots: { index: false, follow: false } };

  return {
    title: `${puja.title} | Online Puja Booking`,
    description: puja.shortDescription.slice(0, 200),
    alternates: { canonical: `${brand.url}/puja/${puja.slug}` },
    openGraph: {
      title: puja.title,
      description: puja.shortDescription.slice(0, 200),
      url: `${brand.url}/puja/${puja.slug}`,
      type: "website",
      ...(puja.imageUrl ? { images: [{ url: puja.imageUrl }] } : {}),
    },
  };
}

export default async function PujaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [puja, user] = await Promise.all([getPuja(slug), getCurrentUser()]);

  if (!puja) notFound();

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link className="caption text-foreground-muted underline transition hover:text-foreground" href="/puja">
            ← All pujas
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="grid gap-8">
            <header>
              <h1 className="heading-xl">{puja.title}</h1>
              {puja.purpose ? (
                <p className="mt-3 body-lg text-foreground-secondary">{puja.purpose}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 body-sm text-foreground-muted">
                {puja.durationMinutes ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden="true" size={14} />
                    {puja.durationMinutes} minutes
                  </span>
                ) : null}
                {puja.modes.map((mode) => (
                  <span className="inline-flex items-center gap-1.5" key={mode}>
                    <Flame aria-hidden="true" size={14} />
                    {PUJA_MODE_LABEL[mode]}
                  </span>
                ))}
              </div>
            </header>

            {puja.images.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <ContentImage
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                  height={720}
                  priority
                  src={puja.images[0]}
                  width={1280}
                />
              </div>
            ) : null}

            <section aria-labelledby="about-heading">
              <h2 className="heading-md" id="about-heading">
                About this puja
              </h2>
              <p className="mt-3 whitespace-pre-wrap body-md text-foreground-secondary">
                {puja.description}
              </p>
            </section>

            {puja.benefits.length > 0 ? (
              <section aria-labelledby="benefits-heading">
                <h2 className="heading-md" id="benefits-heading">
                  Traditionally performed for
                </h2>
                <p className="mt-1 caption text-foreground-muted">
                  Traditional association, described as it is practised. Not a promised outcome.
                </p>
                <ul className="mt-3 grid gap-2">
                  {puja.benefits.map((benefit) => (
                    <li className="flex items-start gap-2.5 body-sm text-foreground-secondary" key={benefit}>
                      <Check aria-hidden="true" className="mt-0.5 shrink-0 text-premium" size={15} />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {puja.vidhi.length > 0 ? (
              <section aria-labelledby="vidhi-heading">
                <h2 className="heading-md" id="vidhi-heading">
                  How it is performed
                </h2>
                <ol className="mt-3 grid gap-3">
                  {puja.vidhi.map((step, index) => (
                    <li className="flex gap-3" key={step.title}>
                      <span
                        aria-hidden="true"
                        className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-[10px] font-semibold text-foreground-muted"
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="body-sm font-semibold text-foreground">{step.title}</p>
                        {step.description ? (
                          <p className="mt-0.5 body-sm text-foreground-secondary">{step.description}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {puja.samagri.length > 0 ? (
              <section aria-labelledby="samagri-heading">
                <h2 className="heading-md" id="samagri-heading">
                  Samagri
                </h2>
                <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full border-collapse text-left">
                    <caption className="sr-only">Materials used in this puja</caption>
                    <thead>
                      <tr className="border-b border-border bg-surface-raised">
                        <th className="px-4 py-2.5 caption uppercase tracking-wider text-foreground-muted" scope="col">
                          Item
                        </th>
                        <th className="px-4 py-2.5 caption uppercase tracking-wider text-foreground-muted" scope="col">
                          Quantity
                        </th>
                        <th className="px-4 py-2.5 caption uppercase tracking-wider text-foreground-muted" scope="col">
                          Provided by
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {puja.samagri.map((item) => (
                        <tr key={item.name}>
                          <td className="px-4 py-3 body-sm text-foreground">{item.name}</td>
                          <td className="px-4 py-3 body-sm text-foreground-secondary">
                            {item.quantity ?? "—"}
                          </td>
                          <td className="px-4 py-3 body-sm text-foreground-secondary">
                            {item.providedByCustomer ? "You" : "Us"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {puja.requirements.length > 0 ? (
              <section aria-labelledby="requirements-heading">
                <h2 className="heading-md" id="requirements-heading">
                  What we need from you
                </h2>
                <ul className="mt-3 grid gap-2">
                  {puja.requirements.map((requirement) => (
                    <li className="body-sm text-foreground-secondary" key={requirement}>
                      · {requirement}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <PujaBookingForm
              currency={puja.currency}
              modes={puja.modes}
              pricePaise={puja.pricePaise}
              slug={puja.slug}
              title={puja.title}
              viewer={user ? { signedIn: true, name: user.name, email: user.email } : null}
            />
          </aside>
        </div>
      </PageContainer>
    </Section>
  );
}
