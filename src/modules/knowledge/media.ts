/** Pull a public image URL from Wix catalog JSON, JSON-LD, or page HTML. Site-agnostic. */

export function firstImageUrl(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const url = asImageUrl(candidate);
    if (url) return url;
  }
  return null;
}

export function productImageFromRecord(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const media = asRecord(row.media);
  const main = asRecord(media?.mainMedia) || asRecord(row.mainMedia);
  const image = asRecord(main?.image) || asRecord(row.image) || asRecord(row.coverImage) || asRecord(row.featuredImage);
  const rawImages = Array.isArray(media?.items)
    ? media.items
    : Array.isArray(row.mediaItems)
      ? row.mediaItems
      : Array.isArray(row.images)
        ? row.images
        : Array.isArray(asRecord(row.images)?.edges)
          ? (asRecord(row.images)?.edges as unknown[])
          : [];
  const firstItem = asRecord(rawImages[0]);
  const firstEdgeNode = asRecord(firstItem?.node) || firstItem;
  const firstItemImage = asRecord(firstEdgeNode?.image) || firstEdgeNode;

  return firstImageUrl(
    image?.url,
    image?.src,
    main?.url,
    firstItemImage?.url,
    firstItemImage?.src,
    firstItem?.url,
    firstItem?.src,
    row.thumbnail,
    row.imageUrl,
    row.image,
  );
}

export function imageFromJsonLd(nodes: Record<string, unknown>[] | undefined): string | null {
  for (const node of nodes ?? []) {
    const found = firstImageUrl(node.image, node.thumbnailUrl, node.photo);
    if (found) return found;
  }
  return null;
}

export function imageFromHtml(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  return asImageUrl(og);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asImageUrl(value: unknown): string | null {
  if (typeof value === "string") return sanitizeImageUrl(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = asImageUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return asImageUrl(row.url || row.src || row.href || row.contentUrl);
  }
  return null;
}

function sanitizeImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  return trimmed;
}
