import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { useParams } from "react-router";
import { docsPageTree, getDocPage } from "~/lib/docs-source";

export default function DocsRoute() {
  const params = useParams();
  const page = getDocPage(params["*"]);
  if (!page) throw new Response("Not found", { status: 404, statusText: "Not Found" });

  const Mdx = page.body;
  return (
    <div className="docs-shell">
      <DocsLayout
        tree={docsPageTree}
        nav={{ title: "restty", url: "/" }}
        links={[
          { type: "main", text: "Playground", url: "/" },
          { type: "main", text: "GitHub", url: "https://github.com/wiedymi/restty" },
        ]}
        searchToggle={{ enabled: false }}
      >
        <DocsPage toc={page.toc}>
          <DocsTitle>{page.title}</DocsTitle>
          {page.description ? (
            <DocsDescription>{page.description}</DocsDescription>
          ) : null}
          <DocsBody>
            <Mdx components={defaultMdxComponents} />
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </div>
  );
}
