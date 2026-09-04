export interface GoogleFontAxis {
  tag: string;
  min: number;
  max: number;
  defaultValue: number;
}

export interface GoogleFontFamily {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
  axes: GoogleFontAxis[];
  popularity: number;
}

interface GoogleFontsMetadataFamily {
  family?: unknown;
  category?: unknown;
  fonts?: unknown;
  subsets?: unknown;
  axes?: unknown;
  popularity?: unknown;
}

const metadataUrl = 'https://fonts.google.com/metadata/fonts';
const cacheDurationMs = 6 * 60 * 60 * 1_000;

export const fallbackGoogleFonts: GoogleFontFamily[] = [
  ['DM Sans', 'Sans Serif', ['400', '500', '600', '700']],
  ['IBM Plex Sans', 'Sans Serif', ['400', '500', '600', '700']],
  ['Instrument Sans', 'Sans Serif', ['400', '500', '600', '700']],
  ['Inter', 'Sans Serif', ['400', '500', '600', '700']],
  ['JetBrains Mono', 'Monospace', ['400', '500', '600', '700']],
  ['Manrope', 'Sans Serif', ['400', '500', '600', '700']],
  ['Newsreader', 'Serif', ['400', '500', '600', '700']],
  ['Noto Sans', 'Sans Serif', ['400', '500', '600', '700']],
  ['Roboto Flex', 'Sans Serif', ['400', '500', '600', '700']],
  ['Space Grotesk', 'Sans Serif', ['400', '500', '600', '700']],
].map(([family, category, variants], popularity) => ({
  family: family as string,
  category: category as string,
  variants: variants as string[],
  subsets: ['latin'],
  axes: [],
  popularity,
}));

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function parseGoogleFontsMetadata(value: unknown): GoogleFontFamily[] {
  if (!value || typeof value !== 'object') return [];
  const list = (value as { familyMetadataList?: unknown }).familyMetadataList;
  if (!Array.isArray(list)) return [];
  return list
    .map((entry): GoogleFontFamily | undefined => {
      const font = entry as GoogleFontsMetadataFamily;
      if (typeof font.family !== 'string' || !font.family.trim()) return undefined;
      const variants =
        font.fonts && typeof font.fonts === 'object' ? Object.keys(font.fonts as object) : [];
      const axes = Array.isArray(font.axes)
        ? font.axes.flatMap((axis) => {
            if (!axis || typeof axis !== 'object') return [];
            const candidate = axis as Record<string, unknown>;
            if (typeof candidate.tag !== 'string') return [];
            return [
              {
                tag: candidate.tag,
                min: finiteNumber(candidate.min),
                max: finiteNumber(candidate.max),
                defaultValue: finiteNumber(candidate.defaultValue),
              },
            ];
          })
        : [];
      return {
        family: font.family.trim(),
        category: typeof font.category === 'string' ? font.category : 'Unknown',
        variants,
        subsets: Array.isArray(font.subsets)
          ? font.subsets.filter((subset): subset is string => typeof subset === 'string')
          : [],
        axes,
        popularity: finiteNumber(font.popularity, Number.MAX_SAFE_INTEGER),
      };
    })
    .filter((font): font is GoogleFontFamily => Boolean(font));
}

export class GoogleFontsCatalog {
  private fonts: GoogleFontFamily[] = [];
  private loadedAt = 0;

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async search(
    query = '',
    limit = 60,
  ): Promise<{
    fonts: GoogleFontFamily[];
    source: 'google' | 'fallback';
  }> {
    let source: 'google' | 'fallback' = 'google';
    if (!this.fonts.length || Date.now() - this.loadedAt > cacheDurationMs) {
      try {
        const response = await this.fetcher(metadataUrl, {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Google Fonts metadata returned ${response.status}`);
        const parsed = parseGoogleFontsMetadata(await response.json());
        if (!parsed.length) throw new Error('Google Fonts metadata was empty');
        this.fonts = parsed;
        this.loadedAt = Date.now();
      } catch {
        this.fonts = fallbackGoogleFonts;
        this.loadedAt = Date.now();
        source = 'fallback';
      }
    } else if (this.fonts === fallbackGoogleFonts) {
      source = 'fallback';
    }
    const normalized = query.trim().toLocaleLowerCase();
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.round(limit), 1), 100) : 60;
    return {
      fonts: this.fonts
        .filter((font) => !normalized || font.family.toLocaleLowerCase().includes(normalized))
        .sort((a, b) => a.popularity - b.popularity || a.family.localeCompare(b.family))
        .slice(0, safeLimit),
      source,
    };
  }
}
