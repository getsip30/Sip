import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the URL only if it is a plain http(s) link, otherwise null.
 * Guards every sink that renders a user-supplied link: blocks javascript:/data:
 * schemes and anything with quotes or whitespace that could break out of an
 * HTML attribute. Use on BOTH write (API validation) and read (rendering).
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (/["'<>\s]/.test(trimmed)) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Serialise a value for embedding inside a <script type="application/ld+json">.
 *
 * JSON.stringify escapes quotes and backslashes but leaves `<` and `>` alone, so
 * a value containing `</script>` closes the block early and everything after it
 * is parsed as HTML rather than data. Mentor names, roles, companies and bios
 * are user-supplied and reach this, which made a profile page a stored XSS.
 *
 * The characters that can terminate a script element are emitted as unicode
 * escapes. JSON parses those back to exactly the same string, so consumers see
 * unchanged content while the HTML parser sees nothing it can act on.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}