import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "restty",
      url: "/",
    },
    links: [
      { type: "main", text: "Playground", url: "/" },
      { type: "main", text: "GitHub", url: "https://github.com/wiedymi/restty" },
    ],
    searchToggle: { enabled: false },
    themeSwitch: { enabled: false },
  };
}
