export function normalizeFetchedScript(text: string): string | null {
  const noBom = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!noBom) return null;

  const firstNonEmpty =
    noBom
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trimStart() ?? "";
  const lower = firstNonEmpty.toLowerCase();
  if (
    lower.startsWith("<!doctype") ||
    lower.startsWith("<html") ||
    lower.startsWith("<head") ||
    lower.startsWith("<body") ||
    lower.startsWith("<")
  ) {
    return null;
  }

  if (firstNonEmpty.startsWith("#!")) {
    if (!/\b(bash|dash|sh|zsh)\b/i.test(firstNonEmpty)) return null;
    return `${noBom}\n`;
  }
  return null;
}

async function fetchScriptText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) return null;
    return normalizeFetchedScript(await res.text());
  } catch {
    return null;
  }
}

export async function fetchFirstScript(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    const text = await fetchScriptText(url);
    if (text) return text;
  }
  return null;
}
