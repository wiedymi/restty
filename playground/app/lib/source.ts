import type { Root } from "fumadocs-core/page-tree";

type PlaygroundDocEntry = {
  slugs: string[];
  path: string;
  url: string;
  name: string;
  description?: string;
};

const pages: PlaygroundDocEntry[] = [
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
    slugs: ["configuration"],
    path: "../../content/docs/configuration.mdx",
    url: "/docs/configuration",
    name: "Configuration",
    description: "Public config boundaries for terminal behavior, services, and surface UI.",
  },
  {
    slugs: ["pty-backends"],
    path: "../../content/docs/pty-backends.mdx",
    url: "/docs/pty-backends",
    name: "PTY backends",
    description: "Use Just Bash, WebContainer, or an OS websocket PTY.",
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

const pageTree: Root = {
  type: "root",
  name: "restty",
  children: pages.map((page) => ({
    type: "page",
    name: page.name,
    url: page.url,
    description: page.description,
  })),
};

export const source = {
  getPage(slugs: string[] = []) {
    return pages.find((page) => page.slugs.join("/") === slugs.join("/"));
  },
  getPageTree() {
    return pageTree;
  },
};
