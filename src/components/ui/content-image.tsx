/* eslint-disable @next/next/no-img-element */
import Image from "next/image";

/**
 * An image whose URL came from a person rather than from this repository.
 *
 * Practitioner photographs, article covers, puja and course images are all
 * entered as URLs by an operator or a practitioner. That creates a problem
 * `next/image` handles badly in both directions:
 *
 *  * An un-allowlisted host makes `next/image` throw, which takes down the
 *    whole page. A practitioner pasting a link to their own photograph should
 *    not be able to 500 the directory - and before this component, one could.
 *
 *  * Allowlisting every host to avoid that turns the image optimizer into an
 *    open fetch proxy: anyone who can set a URL can make the server request
 *    arbitrary addresses and serve the bytes from our domain.
 *
 * So the rule is by origin, not by configuration. Assets that ship with the
 * application - relative paths - go through `next/image` and get optimised.
 * Anything remote is rendered as a plain `<img>`, which the browser fetches
 * directly: no server-side fetch, no allowlist to maintain, and a broken link
 * degrades to a broken image rather than a broken page.
 *
 * Hosts that are genuinely ours - a configured CDN or storage bucket - can be
 * added to `images.remotePatterns` in `next.config.ts` and will then be matched
 * by `isLocalAsset` only if they are served from a relative path. Moving these
 * images to uploads on our own storage is the real fix; this component is what
 * makes the current URL-entry model safe in the meantime.
 */
function isLocalAsset(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//");
}

export function ContentImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  if (isLocalAsset(src)) {
    return (
      <Image alt={alt} className={className} height={height} priority={priority} src={src} width={width} />
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={height}
      // Remote images are fetched by the browser, never by this server.
      loading={priority ? "eager" : "lazy"}
      // A referrer is not needed to fetch somebody's public image, and not
      // sending one avoids leaking which page a visitor is on to a third party.
      referrerPolicy="no-referrer"
      src={src}
      width={width}
    />
  );
}
