import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const fontsDir = resolve(root, "playground/public/fonts");
const jbTarget = resolve(fontsDir, "JetBrainsMono-Regular.ttf");
const nerdTarget = resolve(fontsDir, "SymbolsNerdFont-Regular.ttf");
const nerdLicenseTarget = resolve(fontsDir, "NerdFontsSymbolsOnly.LICENSE");
const openmojiTarget = resolve(fontsDir, "OpenMoji-black-glyf.ttf");

const jbUrl =
  "https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Regular.ttf";
const nerdUrl = "https://deps.files.ghostty.org/NerdFontsSymbolsOnly-3.4.0.tar.gz";
const openmojiUrl =
  "https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/font/OpenMoji-black-glyf/OpenMoji-black-glyf.ttf";

await Bun.mkdir(fontsDir, { recursive: true });

const jbFile = Bun.file(jbTarget);
if (await jbFile.exists()) {
  console.log("Font already present:", jbTarget);
} else {
  const response = await fetch(jbUrl);
  if (!response.ok) {
    throw new Error(`Failed to download font: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  await Bun.write(jbTarget, buffer);
  console.log("Downloaded font to:", jbTarget);
}

const openmojiFile = Bun.file(openmojiTarget);
if (await openmojiFile.exists()) {
  console.log("Font already present:", openmojiTarget);
} else {
  const response = await fetch(openmojiUrl);
  if (!response.ok) {
    throw new Error(`Failed to download font: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  await Bun.write(openmojiTarget, buffer);
  console.log("Downloaded font to:", openmojiTarget);
}

const nerdFile = Bun.file(nerdTarget);
if (await nerdFile.exists()) {
  console.log("Nerd font already present:", nerdTarget);
  process.exit(0);
}

const nerdResp = await fetch(nerdUrl);
if (!nerdResp.ok) {
  throw new Error(`Failed to download nerd font: ${nerdResp.status} ${nerdResp.statusText}`);
}
const nerdBuffer = await nerdResp.arrayBuffer();
const tarPath = resolve(fontsDir, "NerdFontsSymbolsOnly-3.4.0.tar.gz");
await Bun.write(tarPath, nerdBuffer);

const proc = Bun.spawn([
  "tar",
  "-xf",
  tarPath,
  "-C",
  fontsDir,
  "./SymbolsNerdFont-Regular.ttf",
  "./LICENSE",
]);
const code = await proc.exited;
if (code !== 0) {
  throw new Error(`tar exited with code ${code}`);
}

const licenseFile = Bun.file(resolve(fontsDir, "LICENSE"));
if (await licenseFile.exists()) {
  await licenseFile.rename(nerdLicenseTarget);
}
await Bun.file(tarPath).delete();
console.log("Downloaded nerd font to:", nerdTarget);
