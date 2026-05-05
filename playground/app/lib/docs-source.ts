import type { Root } from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";
import type { ComponentType } from "react";
import type { MDXProps } from "mdx/types";
import ConfigDoc, * as ConfigData from "../../content/docs/configuration.mdx";
import FontsDoc, * as FontsData from "../../content/docs/fonts.mdx";
import GettingStartedDoc, * as GettingStartedData from "../../content/docs/getting-started.mdx";
import IndexDoc, * as IndexData from "../../content/docs/index.mdx";
import PtyBackendsDoc, * as PtyBackendsData from "../../content/docs/pty-backends.mdx";
import ThemesDoc, * as ThemesData from "../../content/docs/themes.mdx";

type MdxModuleData = {
  frontmatter?: {
    title?: string;
    description?: string;
  };
  toc?: TOCItemType[];
};

export type PlaygroundDocPage = {
  slugs: string[];
  url: string;
  title: string;
  description?: string;
  toc: TOCItemType[];
  body: ComponentType<MDXProps>;
};

function createDocPage(
  slugs: string[],
  body: PlaygroundDocPage["body"],
  data: MdxModuleData,
  fallbackTitle: string,
): PlaygroundDocPage {
  const title = data.frontmatter?.title ?? fallbackTitle;
  const description = data.frontmatter?.description;
  return {
    slugs,
    url: slugs.length ? `/docs/${slugs.join("/")}` : "/docs",
    title,
    description,
    toc: data.toc ?? [],
    body,
  };
}

export const DOC_PAGES: PlaygroundDocPage[] = [
  createDocPage([], IndexDoc as PlaygroundDocPage["body"], IndexData, "restty docs"),
  createDocPage(
    ["getting-started"],
    GettingStartedDoc as PlaygroundDocPage["body"],
    GettingStartedData,
    "Getting started",
  ),
  createDocPage(
    ["configuration"],
    ConfigDoc as PlaygroundDocPage["body"],
    ConfigData,
    "Configuration",
  ),
  createDocPage(
    ["pty-backends"],
    PtyBackendsDoc as PlaygroundDocPage["body"],
    PtyBackendsData,
    "PTY backends",
  ),
  createDocPage(["fonts"], FontsDoc as PlaygroundDocPage["body"], FontsData, "Fonts"),
  createDocPage(["themes"], ThemesDoc as PlaygroundDocPage["body"], ThemesData, "Themes"),
];

export const docsPageTree: Root = {
  type: "root",
  name: "restty",
  children: DOC_PAGES.map((page) => ({
    type: "page",
    name: page.title,
    url: page.url,
    description: page.description,
  })),
};

export function getDocPage(splat: string | undefined): PlaygroundDocPage | undefined {
  const slugs = splat?.split("/").filter(Boolean) ?? [];
  return DOC_PAGES.find((page) => page.slugs.join("/") === slugs.join("/"));
}
