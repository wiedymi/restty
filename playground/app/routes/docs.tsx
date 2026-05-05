import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { useParams } from "react-router";
import { createClientLoader } from "fumadocs-mdx/runtime/browser";
import { useMDXComponents } from "~/components/mdx";
import { baseOptions } from "~/lib/layout.shared";
import { source } from "~/lib/source";

const clientLoader = createClientLoader(
  import.meta.glob("../../content/docs/*.{mdx,md}"),
  {
    id: "docs",
    component({ toc, frontmatter, default: Mdx }) {
      return (
        <DocsPage toc={toc}>
          <DocsTitle>{frontmatter.title}</DocsTitle>
          <DocsDescription>{frontmatter.description}</DocsDescription>
          <DocsBody>
            <Mdx components={useMDXComponents()} />
          </DocsBody>
        </DocsPage>
      );
    },
  },
);

export default function DocsRoute() {
  const params = useParams();
  const slugs = params["*"]?.split("/").filter(Boolean) ?? [];
  const page = source.getPage(slugs);
  if (!page) throw new Response("Not found", { status: 404, statusText: "Not Found" });

  return (
    <div className="docs-shell">
      <DocsLayout {...baseOptions()} tree={source.getPageTree()}>
        {clientLoader.useContent(page.path)}
      </DocsLayout>
    </div>
  );
}
