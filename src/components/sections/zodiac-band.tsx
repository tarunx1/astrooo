"use client";

import { PageContainer, Section } from "@/components/layout/primitives";
import { useStarFieldSource } from "@/components/visuals/star-field-source";
import { cn } from "@/lib/utils";

/**
 * Open sky, deliberately.
 *
 * The star field is a fixed background, so on a page of full-height cards a
 * formed sign spends most of the scroll hidden behind content. This band exists
 * to give it somewhere to actually be seen: no cards, no imagery, just height
 * and a caption naming whichever sign the field is currently holding.
 *
 * The copy sits on the side the shape is *not* on, and follows it as the
 * alignment alternates down the page. That is the whole point of the band -
 * content and constellation share the width rather than fighting for the
 * middle of it.
 */
export function ZodiacBand() {
  const { label, align } = useStarFieldSource();

  // The shape takes one half, so the copy takes the other. A centred shape has
  // no free side, so the copy falls back to the left where every other section
  // header on this page begins.
  const copyOnRight = align === "left";

  return (
    <Section className="relative">
      <PageContainer className="px-0">
        {/* Tall enough that the copy clears the glyph vertically as well, since
            the shape forms at the centre of the viewport rather than of this
            band. */}
        {/* On a narrow screen the shape moves up rather than sideways, so the
            copy sits under it. From md the two share the width instead.
            The band is taller than a viewport because a shape only gathers
            while the band fully clears it, and that window has to last long
            enough for the morph to actually finish. The copy is centred within
            it rather than pinned to the top, which on a band this tall would
            leave it scrolled off while the shape is on screen. */}
        <div
          className="flex min-h-[92vh] flex-col justify-end md:justify-center md:min-h-[124vh]"
          data-zodiac-band=""
        >
          <div
            className={cn(
              "max-w-sm transition-[margin] duration-700 ease-out",
              copyOnRight ? "md:ml-auto md:text-right" : "md:mr-auto",
            )}
          >
            <p className="caption text-foreground-muted">The sky above, drawn as you scroll</p>
            <p aria-live="polite" className="mt-4 heading-lg text-premium">
              {label ?? "Open sky"}
            </p>
            <p className="mt-3 body-sm text-foreground-secondary">
              {label
                ? `The stars are holding ${label}. Keep scrolling to move through the zodiac.`
                : "Scroll on and the stars will gather into each sign in turn."}
            </p>
          </div>
        </div>
      </PageContainer>
    </Section>
  );
}
