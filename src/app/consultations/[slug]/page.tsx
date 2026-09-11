import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsultationMode } from "@prisma/client";
import { BadgeCheck, Clock, Globe, MapPin, Star } from "lucide-react";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { BookingPanel } from "@/components/consultations/booking-panel";
import { RatingDisplay, formatRate } from "@/components/consultations/pandit-card";
import { getPublicPandit } from "@/lib/consultations/directory";
import { getCurrentUser } from "@/lib/auth/session";
import { brand } from "@/config/brand";

const MODE_LABEL: Record<ConsultationMode, string> = {
  [ConsultationMode.CHAT]: "Chat",
  [ConsultationMode.VOICE_CALL]: "Voice call",
  [ConsultationMode.VIDEO_CALL]: "Video call",
};

/**
 * A practitioner's public profile.
 *
 * Server-rendered, including the reviews and rates, so the page is indexable
 * and readable without JavaScript. Only the booking panel is interactive, and
 * only it is a client component - turning the whole page into one to
 * accommodate a calendar would trade the SEO value of the profile for nothing.
 *
 * `getPublicPandit` returns null for anyone not currently listed, so a
 * bookmarked URL for a suspended practitioner 404s rather than continuing to
 * show a profile that can no longer be booked.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pandit = await getPublicPandit(slug);

  if (!pandit) {
    return { title: "Practitioner not found", robots: { index: false, follow: false } };
  }

  const specialisations = pandit.expertise.slice(0, 3).join(", ");
  const description =
    pandit.headline ??
    `Book a consultation with ${pandit.displayName}${specialisations ? `, specialising in ${specialisations}` : ""}. Chat, voice and video sessions.`;

  return {
    title: `${pandit.displayName} | Consult a Verified Astrologer`,
    description: description.slice(0, 200),
    alternates: { canonical: `${brand.url}/consultations/${pandit.slug}` },
    openGraph: {
      title: `${pandit.displayName} · Tarun Astro`,
      description: description.slice(0, 200),
      url: `${brand.url}/consultations/${pandit.slug}`,
      type: "profile",
      ...(pandit.profileImageUrl ? { images: [{ url: pandit.profileImageUrl }] } : {}),
    },
  };
}

export default async function PanditProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [pandit, user] = await Promise.all([getPublicPandit(slug), getCurrentUser()]);

  if (!pandit) notFound();

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link
            className="caption text-foreground-muted underline transition hover:text-foreground"
            href="/consultations"
          >
            ← All practitioners
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-6">
            <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-border bg-surface-raised">
                {pandit.profileImageUrl ? (
                  <Image
                    alt=""
                    className="size-full object-cover"
                    height={192}
                    priority
                    src={pandit.profileImageUrl}
                    width={192}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-full place-items-center text-2xl font-semibold text-foreground-muted"
                  >
                    {pandit.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="heading-xl">{pandit.displayName}</h1>
                  {pandit.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent-cyan/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-cyan">
                      <BadgeCheck size={12} />
                      Verified
                    </span>
                  ) : null}
                </div>

                {pandit.headline ? (
                  <p className="mt-2 body-lg text-foreground-secondary">{pandit.headline}</p>
                ) : null}

                <div className="mt-3">
                  <RatingDisplay rating={pandit.rating} reviewCount={pandit.reviewCount} size="md" />
                </div>

                <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 body-sm text-foreground-secondary">
                  {pandit.yearsOfExperience !== null ? (
                    <div className="inline-flex items-center gap-1.5">
                      <Clock aria-hidden="true" size={14} />
                      <dt className="sr-only">Experience</dt>
                      <dd>{pandit.yearsOfExperience} years experience</dd>
                    </div>
                  ) : null}
                  {pandit.city ? (
                    <div className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden="true" size={14} />
                      <dt className="sr-only">Location</dt>
                      <dd>
                        {pandit.city}
                        {pandit.state ? `, ${pandit.state}` : ""}
                      </dd>
                    </div>
                  ) : null}
                  {pandit.languages.length > 0 ? (
                    <div className="inline-flex items-center gap-1.5">
                      <Globe aria-hidden="true" size={14} />
                      <dt className="sr-only">Languages</dt>
                      <dd>{pandit.languages.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </header>

            {pandit.expertise.length > 0 ? (
              <section aria-labelledby="expertise-heading">
                <h2 className="heading-sm" id="expertise-heading">
                  Specialisations
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {pandit.expertise.map((item) => (
                    <li
                      className="rounded-md border border-border bg-surface px-3 py-1.5 body-sm text-foreground-secondary"
                      key={item}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {pandit.bio ? (
              <section aria-labelledby="about-heading">
                <h2 className="heading-sm" id="about-heading">
                  About
                </h2>
                <p className="mt-3 whitespace-pre-wrap body-md text-foreground-secondary">{pandit.bio}</p>
              </section>
            ) : null}

            <section aria-labelledby="rates-heading">
              <h2 className="heading-sm" id="rates-heading">
                Consultation rates
              </h2>
              {pandit.services.length === 0 ? (
                <p className="mt-3 body-sm text-foreground-muted">
                  This practitioner has not published rates yet.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                  {pandit.services.map((service) => (
                    <li className="rounded-lg border border-border bg-surface p-4" key={service.mode}>
                      <p className="caption text-foreground-muted">{MODE_LABEL[service.mode]}</p>
                      <p className="mt-1 body-md font-semibold text-foreground">{formatRate(service)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {pandit.certifications.length > 0 ? (
              <section aria-labelledby="credentials-heading">
                <h2 className="heading-sm" id="credentials-heading">
                  Credentials
                </h2>
                <ul className="mt-3 grid gap-1.5">
                  {pandit.certifications.map((item) => (
                    <li className="body-sm text-foreground-secondary" key={item}>
                      · {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="reviews-heading">
              <h2 className="heading-sm" id="reviews-heading">
                Reviews
              </h2>

              {pandit.reviews.length === 0 ? (
                <p className="mt-3 body-sm text-foreground-muted">
                  No reviews yet. This practitioner has been verified but has not been reviewed by customers
                  on Tarun Astro.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {pandit.reviews.map((review) => (
                    <li key={review.id}>
                      <Card className="p-5">
                        <div className="flex items-center gap-2">
                          <span aria-label={`${review.rating} out of 5`} className="inline-flex text-premium">
                            {Array.from({ length: 5 }, (_, index) => (
                              <Star
                                aria-hidden="true"
                                className={index < review.rating ? "fill-current" : "opacity-30"}
                                key={index}
                                size={13}
                              />
                            ))}
                          </span>
                          <span className="caption text-foreground-muted">
                            {review.authorName} ·{" "}
                            {review.createdAt.toLocaleDateString("en-IN", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        {review.title ? (
                          <p className="mt-2 body-sm font-semibold text-foreground">{review.title}</p>
                        ) : null}
                        {review.body ? (
                          <p className="mt-1.5 body-sm text-foreground-secondary">{review.body}</p>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <BookingPanel
              pandit={pandit}
              viewer={user ? { signedIn: true, name: user.name, email: user.email } : null}
            />
          </aside>
        </div>
      </PageContainer>
    </Section>
  );
}
