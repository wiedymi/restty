export type WebContainerSeedScriptSpec = {
  urls: string[];
  target: string;
  fallback: string;
};

const FALLBACK_DEMO_JS = `#!/usr/bin/env node
console.log("restty demo fallback");
console.log("Run: node ansi-art.js");
console.log("Run: node animation.js");
console.log("Run: node colors.js");
console.log("Run: node kitty.js");
console.log("Run: node test.js");
`;

const FALLBACK_TEST_JS = `#!/usr/bin/env node
console.log("restty test fallback");
console.log("Node is available.");
console.log("Run: node colors.js");
console.log("Run: node kitty.js");
`;

export const WEBCONTAINER_SEED_SCRIPTS: WebContainerSeedScriptSpec[] = [
  {
    urls: ["/demo.js"],
    target: "demo.js",
    fallback: FALLBACK_DEMO_JS,
  },
  {
    urls: ["/test.js"],
    target: "test.js",
    fallback: FALLBACK_TEST_JS,
  },
  {
    urls: ["/ansi-art.js"],
    target: "ansi-art.js",
    fallback: "#!/usr/bin/env node\nconsole.log('ansi-art fallback');\n",
  },
  {
    urls: ["/animation.js"],
    target: "animation.js",
    fallback: "#!/usr/bin/env node\nconsole.log('animation fallback');\n",
  },
  {
    urls: ["/colors.js"],
    target: "colors.js",
    fallback: "#!/usr/bin/env node\nconsole.log('colors fallback');\n",
  },
  {
    urls: ["/kitty.js"],
    target: "kitty.js",
    fallback: "#!/usr/bin/env node\nconsole.log('kitty fallback');\n",
  },
];
