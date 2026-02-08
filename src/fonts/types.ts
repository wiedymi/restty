/**
 * A loaded font with its associated caches and rendering metadata.
 */
export type FontEntry = {
  /** text-shaper Font instance. */
  font: any; // text-shaper Font instance
  /** Human-readable font name. */
  label: string;
  /** Cache of shaped glyph clusters keyed by input string. */
  glyphCache: Map<string, ShapedCluster>;
  /** Cache of glyph advance bounds keyed by glyph ID. */
  boundsCache: Map<number, number>;
  /** Map of glyph IDs to their original text for color emoji fallback. */
  colorGlyphTexts: Map<number, string>;
  /** Set of all glyph IDs available in this font. */
  glyphIds: Set<number>;
  /** GPU texture atlas for this font, or null if not yet built. */
  atlas: any | null;
  /** Font size in CSS pixels. */
  fontSizePx: number;
  /** Scale factor applied when rasterizing to the atlas. */
  atlasScale: number;
  /** Horizontal advance width in font design units. */
  advanceUnits: number;
  /** Signature string used to detect constraint changes for atlas invalidation. */
  constraintSignature?: string;
};

/**
 * Result of shaping a text cluster into positioned glyphs.
 */
export type ShapedCluster = {
  /** Ordered list of glyphs produced by the shaper. */
  glyphs: ShapedGlyph[];
  /** Total horizontal advance of the cluster in font units. */
  advance: number;
};

/**
 * A single positioned glyph within a shaped cluster.
 */
export type ShapedGlyph = {
  /** Font-internal glyph identifier. */
  glyphId: number;
  /** Horizontal advance after this glyph in font units. */
  xAdvance: number;
  /** Vertical advance after this glyph in font units. */
  yAdvance: number;
  /** Horizontal offset from the current pen position. */
  xOffset: number;
  /** Vertical offset from the current pen position. */
  yOffset: number;
};

/**
 * Internal state of the font manager.
 */
export type FontManagerState = {
  /** Primary text-shaper Font instance, or null before initialization. */
  font: any | null;
  /** Loaded font entries in priority order (primary + fallbacks). */
  fonts: FontEntry[];
  /** Current font size in CSS pixels. */
  fontSizePx: number;
  /**
   * How font size maps to design units.
   * - height: size equals cell height
   * - width: size equals cell width
   * - upem: size equals units-per-em
   */
  sizeMode: "height" | "width" | "upem";
  /** Cache mapping text strings to the index of the font chosen to render them. */
  fontPickCache: Map<string, number>;
};

/**
 * Descriptor for a fallback font to load on demand.
 */
export type FallbackFontSource = {
  /** Display name of the fallback font. */
  name: string;
  /** URL to fetch the font file from. */
  url: string;
  /** Unicode range or script patterns this font covers. */
  matchers: string[];
};

/**
 * Per-font scale override applied when a font's label matches the pattern.
 */
export type FontScaleOverride = {
  /** Regex tested against the font label. */
  match: RegExp;
  /** Multiplier applied to the font's atlas scale. */
  scale: number;
};
