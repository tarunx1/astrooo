"use client";

import { PageContainer, Section } from "@/components/layout/primitives";
import { useStarFieldSource } from "@/components/visuals/star-field-source";
import { cn } from "@/lib/utils";

/**
 * Open sky, deliberately.
 *
 * The star field is a fixed background, so on a page of full-height cards a
 * formed sign spends most of the scroll hidden behind content. This band exists
 * to give it somewhere to actually be seen: no cards, no imagery, nothing but
 * height and the name of whichever sign the field is holding.
 *
 * That name is the only thing here. Anything else - a standing caption, a line
 * telling the reader to keep scrolling - competes with the constellation for a
 * space that exists to show the constellation, and says nothing the sky is not
 * already saying.
 *
 * The name sits on the side the shape is not on, and swaps sides as the
 * alignment alternates down the page. It moves the instant the shape does,
 * because a sign only holds while this band crosses the middle of the viewport:
 * a slide would still be travelling while the shape it belongs to was already
 * formed, and would arrive about when the shape began to disperse.
 */
export function ZodiacBand() {
  const { label, align } = useStarFieldSource();

  // The shape takes one half, so the name takes the other. A centred shape has
  // no free side, so it falls back to the left where every other section header
  // on this page begins.
  const copyOnRight = align === "left";

  return (
    <Section className="relative">
      <PageContainer className="px-0">
        {/* On a narrow screen the shape moves up rather than sideways, so the
            name sits under it. From md the two share the width instead.
            The band is taller than a viewport because a shape only gathers
            while the band fully clears it. The name is centred within it rather
            than pinned to the top, which on a band this tall would leave it
            scrolled off while the shape is on screen. */}
        <div
          className="flex min-h-[92vh] flex-col justify-end md:min-h-[124vh] md:justify-center"
          data-zodiac-band=""
        >
          <p
            aria-live="polite"
            className={cn(
              "max-w-sm heading-lg text-premium",
              "transition-[margin] duration-200 ease-out motion-reduce:transition-none",
              copyOnRight ? "md:ml-auto md:text-right" : "md:mr-auto",
            )}
          >
            {label ?? "Open sky"}
          </p>
        </div>
      </PageContainer>
    </Section>
  );
}
