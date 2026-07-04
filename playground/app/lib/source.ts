import type { Root } from "fumadocs-core/page-tree";

type PlaygroundDocEntry = {
  slugs: string[];
  path: string;
  url: string;
  name: string;
  description?: string;
};

type PlaygroundDocSection = {
  name: string;
  pages: string[];
};

const pageEntries: PlaygroundDocEntry[] = [
  {
    slugs: [],
    path: "../../content/docs/index.mdx",
    url: "/docs",
    name: "restty docs",
    description: "Browser terminal rendering with WASM, WebGPU/WebGL2, and public APIs.",
  },
  {
    slugs: ["getting-started"],
    path: "../../content/docs/getting-started.mdx",
    url: "/docs/getting-started",
    name: "Getting started",
    description: "Create a restty surface, spawn a pane, and connect a PTY transport.",
  },
  {
    slugs: ["core-concepts"],
    path: "../../content/docs/core-concepts.mdx",
    url: "/docs/core-concepts",
    name: "Core concepts",
    description: "Understand surfaces, panes, runtimes, PTY transports, and rendering terms.",
  },
  {
    slugs: ["playground-examples"],
    path: "../../content/docs/playground-examples.mdx",
    url: "/docs/playground-examples",
    name: "Playground examples",
    description: "Run the hosted and local demos, choose backends, and compare rendering output.",
  },
  {
    slugs: ["configuration"],
    path: "../../content/docs/configuration.mdx",
    url: "/docs/configuration",
    name: "Configuration",
    description: "Public config boundaries for terminal behavior, services, and surface UI.",
  },
  {
    slugs: ["surface-and-panes"],
    path: "../../content/docs/surface-and-panes.mdx",
    url: "/docs/surface-and-panes",
    name: "Surface and panes",
    description: "Control pane layout, shortcuts, context menus, search UI, and shell events.",
  },
  {
    slugs: ["pty-backends"],
    path: "../../content/docs/pty-backends.mdx",
    url: "/docs/pty-backends",
    name: "PTY backends",
    description: "Use Just Bash, WebContainer, or an OS websocket PTY.",
  },
  {
    slugs: ["search"],
    path: "../../content/docs/search.mdx",
    url: "/docs/search",
    name: "Search",
    description: "Use programmatic search, the built-in search UI, and search state callbacks.",
  },
  {
    slugs: ["fonts"],
    path: "../../content/docs/fonts.mdx",
    url: "/docs/fonts",
    name: "Fonts",
    description: "Simple font presets, optional local families, ligatures, and hinting.",
  },
  {
    slugs: ["themes"],
    path: "../../content/docs/themes.mdx",
    url: "/docs/themes",
    name: "Themes and shaders",
    description: "Builtin Ghostty themes and shader-stage examples.",
  },
  {
    slugs: ["api-surface"],
    path: "../../content/docs/api-surface.mdx",
    url: "/docs/api-surface",
    name: "API surface",
    description:
      "Public entrypoints, Restty methods, pane handles, config types, and package exports.",
  },
  {
    slugs: ["troubleshooting"],
    path: "../../content/docs/troubleshooting.mdx",
    url: "/docs/troubleshooting",
    name: "Troubleshooting",
    description: "Diagnose blank canvases, PTY failures, font loading, browser APIs, and media limits.",
  },
  {
    slugs: ["plugins"],
    path: "../../content/docs/plugins.mdx",
    url: "/docs/plugins",
    name: "Plugins",
    description: "Extend restty with events, interceptors, lifecycle hooks, and shader stages.",
  },
  {
    slugs: ["xterm-compat"],
    path: "../../content/docs/xterm-compat.mdx",
    url: "/docs/xterm-compat",
    name: "xterm compatibility",
    description: "Use the focused restty/xterm wrapper for xterm.js-style migration flows.",
  },
  {
    slugs: ["architecture"],
    path: "../../content/docs/architecture.mdx",
    url: "/docs/architecture",
    name: "Architecture",
    description: "How Restty connects surface, runtime, WASM, PTY, fonts, themes, and renderers.",
  },
];

const sections: PlaygroundDocSection[] = [
  {
    name: "Start",
    pages: ["", "getting-started", "core-concepts", "playground-examples"],
  },
  {
    name: "Integrate",
    pages: ["configuration", "surface-and-panes", "pty-backends", "search"],
  },
  {
    name: "Customize",
    pages: ["fonts", "themes"],
  },
  {
    name: "Extend",
    pages: ["plugins", "xterm-compat"],
  },
  {
    name: "Reference",
    pages: ["api-surface", "troubleshooting", "architecture"],
  },
];

const pagesBySlug = new Map(pageEntries.map((page) => [page.slugs.join("/"), page]));

function pageTreeItem(page: PlaygroundDocEntry) {
  return {
    type: "page" as const,
    name: page.name,
    url: page.url,
    description: page.description,
  };
}

const pageTree: Root = {
  type: "root",
  name: "restty",
  children: sections.map((section) => ({
    type: "folder" as const,
    name: section.name,
    defaultOpen: true,
    children: section.pages.map((slug) => {
      const page = pagesBySlug.get(slug);
      if (!page) throw new Error(`Missing docs page entry for ${slug || "index"}`);
      return pageTreeItem(page);
    }),
  })),
};

export const source = {
  getPage(slugs: string[] = []) {
    return pagesBySlug.get(slugs.join("/"));
  },
  getPages() {
    return pageEntries;
  },
  getPageTree() {
    return pageTree;
  },
};
