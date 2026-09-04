"use client";

import { PageContainer, Section } from "@/components/layout/primitives";
import { useStarFieldSource } from "@/components/visuals/star-field-source";

/**
 * Open sky, deliberately.
 *
 * The star field is a fixed background, so on a page of full-height cards a
 * formed sign spends most of the scroll hidden behind content. This band exists
 * to give it somewhere to actually be seen: no cards, no imagery, just height
 * and a caption naming whichever sign the field is currently holding.
 *
 * The caption is the only content, so it stays out of the middle of the frame
 * where the glyph forms.
 */
export function ZodiacBand() {
  const { label } = useStarFieldSource();

  return (
    <Section className="relative">
      <PageContainer className="px-0">
        {/* Tall enough that the caption and the name clear the glyph, which
            forms at the centre of the viewport rather than the centre of this
            band. Text is kept to the left column for the same reason: the
            glyph occupies the middle of the frame at every scroll position, so
            anything centred here would end up sitting on top of it. Left
            alignment also matches every other section header on this page. */}
        <div className="flex min-h-[80vh] flex-col sm:min-h-[86vh]">
          {/* Kept narrow and to the left so it clears the glyph, which always
              forms in the middle of the frame. Anything centred here would end
              up sitting on top of it at some scroll position. Left alignment
              also matches every other section header on this page. */}
          <div className="max-w-sm">
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
