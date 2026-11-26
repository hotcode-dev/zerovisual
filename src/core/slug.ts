/**
 * Convert an arbitrary string into a filesystem-safe, lowercase slug:
 * consecutive non-alphanumeric runs collapse to a single `-` and
 * leading/trailing dashes are trimmed.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
