const [, , version, outputPath = "RELEASE_NOTES.md"] = Bun.argv;

if (!version) {
  console.error("Usage: bun run scripts/extract-changelog-release-notes.ts <version> [output]");
  process.exit(1);
}

const changelogPath = "CHANGELOG.md";
const changelog = await Bun.file(changelogPath).text().catch(() => "");

if (!changelog.trim()) {
  console.error(`${changelogPath} is missing or empty`);
  process.exit(1);
}

const lines = changelog.split(/\r?\n/);
const versionHeading = /^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+(?:[-+][^\]\s]+)?)\]?(?:\s+-\s+.*)?\s*$/;
const startIndex = lines.findIndex((line) => versionHeading.exec(line)?.[1] === version);

if (startIndex === -1) {
  console.error(`CHANGELOG.md is missing a release section for ${version}`);
  process.exit(1);
}

let endIndex = lines.length;
for (let i = startIndex + 1; i < lines.length; i += 1) {
  if (/^##\s+/.test(lines[i])) {
    endIndex = i;
    break;
  }
}

const notes = lines.slice(startIndex + 1, endIndex).join("\n").trim();

if (!notes) {
  console.error(`CHANGELOG.md section for ${version} is empty`);
  process.exit(1);
}

await Bun.write(outputPath, `${notes}\n`);
