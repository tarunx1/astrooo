"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Product gallery.
 *
 * Thumbnails are real buttons in a tablist so the gallery is keyboard operable
 * and announced correctly, rather than a set of clickable images.
 */
export function ProductGallery({ images, title }: { images: Array<{ url: string; alt: string }>; title: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div
        aria-label={`No photograph available for ${title}`}
        className="grid aspect-square w-full place-items-center rounded-lg border border-border bg-surface-raised text-foreground-muted"
        role="img"
      >
        <Sparkles aria-hidden="true" size={40} />
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
        <Image
          alt={current.alt || title}
          className="aspect-square w-full object-cover"
          height={900}
          priority
          src={current.url}
          width={900}
        />
      </div>

      {images.length > 1 ? (
        <div aria-label={`${title} photographs`} className="flex gap-2 overflow-x-auto pb-1" role="tablist">
          {images.map((image, index) => (
            <button
              aria-controls="product-gallery-main"
              aria-label={`Photograph ${index + 1} of ${images.length}`}
              aria-selected={index === active}
              className={cn(
                "shrink-0 overflow-hidden rounded-md border transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                index === active ? "border-primary" : "border-border hover:border-border-strong",
              )}
              key={image.url}
              onClick={() => setActive(index)}
              role="tab"
              type="button"
            >
              <Image alt="" className="size-16 object-cover" height={64} src={image.url} width={64} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
