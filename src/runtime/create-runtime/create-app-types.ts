export type LocalFontsPermissionDescriptor = PermissionDescriptor & { name: "local-fonts" };

export type LocalFontFaceData = {
  family?: string;
  fullName?: string;
  postscriptName?: string;
  blob: () => Promise<Blob>;
};

export type NavigatorWithLocalFontAccess = Navigator & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  permissions?: {
    query?: (permissionDesc: LocalFontsPermissionDescriptor) => Promise<PermissionStatus>;
  };
};

export type GlobalWithLocalFontAccess = typeof globalThis & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  navigator?: NavigatorWithLocalFontAccess;
};

export type ResttyDebugWindow = Window &
  typeof globalThis & {
    diagnoseCodepoint?: (cp: number) => void;
    dumpGlyphMetrics?: (cp: number) => { fontIndex: number; glyphId: number } | null;
    dumpAtlasRegion?: (
      fontIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => Promise<ImageData | null>;
    dumpGlyphRender?: (cp: number, constraintWidth?: number) => Promise<unknown>;
  };
