import { brand } from "@/config/brand";

export function createOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: brand.url,
    email: brand.contact.email,
    sameAs: Object.values(brand.social),
  };
}

export function createWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: brand.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${brand.url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function createBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Serialises structured data for embedding in a `<script>` block.
 *
 * `JSON.stringify` alone is unsafe here. It escapes quotes and backslashes but
 * leaves `<` untouched, so any string reaching this from the database -- a
 * product title, a category name -- that contains a closing script tag ends the
 * block early. The browser then parses whatever follows as ordinary markup.
 * That is a stored cross-site-scripting hole, and it also corrupts the
 * structured data, because the JSON is left unterminated.
 *
 * Escaping `<` to its unicode form keeps the value identical to a JSON parser
 * while making it impossible to terminate the element. `>` and `&` go the same
 * way, and U+2028/U+2029 because they are literal line terminators to a
 * JavaScript parser even though JSON permits them raw.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
