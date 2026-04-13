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
