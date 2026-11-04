import Link from "next/link";
import { classifyHref, parseMarkdown, pathOf, type Block, type Inline } from "@/lib/articles";

/**
 * An article's Markdown as React elements — never as an HTML string, so
 * anything typed as HTML is shown as text. Links that aren't a site page or
 * an https address render as plain words, and so do links to articles that
 * aren't public (pass `publicArticles`; the admin preview leaves it out).
 */
export default function ArticleBody({
  body,
  publicArticles,
}: {
  body: string;
  /** Slugs of published articles. */
  publicArticles?: ReadonlySet<string>;
}) {
  const blocks = parseMarkdown(body);
  return (
    <div className="article-body text-[1.075rem] leading-[1.75] text-plum">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} publicArticles={publicArticles} />
      ))}
    </div>
  );
}

function BlockView({ block, publicArticles }: { block: Block; publicArticles?: ReadonlySet<string> }) {
  const inline = (nodes: Inline[]) => <InlineView nodes={nodes} publicArticles={publicArticles} />;
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h2 id={block.id} className="mt-12 scroll-mt-28 font-display text-[clamp(1.55rem,2.6vw,1.95rem)] leading-tight text-plum first:mt-0">
          {inline(block.children)}
        </h2>
      ) : (
        <h3 id={block.id} className="mt-8 scroll-mt-28 text-[1.2rem] font-semibold leading-snug text-plum">
          {inline(block.children)}
        </h3>
      );
    case "paragraph":
      return <p className="mt-5 first:mt-0">{inline(block.children)}</p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`mt-5 space-y-2 pl-6 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-wine`}>
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              {inline(item)}
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote className="mt-6 rounded-r-xl border-l-4 border-wine bg-wine-soft/60 px-5 py-4 text-plum">
          {inline(block.children)}
        </blockquote>
      );
    case "rule":
      return <hr className="my-10 border-mist" />;
  }
}

function InlineView({ nodes, publicArticles }: { nodes: Inline[]; publicArticles?: ReadonlySet<string> }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case "text":
            return node.text;
          case "strong":
            return (
              <strong key={index} className="font-semibold">
                <InlineView nodes={node.children} publicArticles={publicArticles} />
              </strong>
            );
          case "em":
            return (
              <em key={index}>
                <InlineView nodes={node.children} publicArticles={publicArticles} />
              </em>
            );
          case "link":
            return (
              <LinkView key={index} href={node.href} publicArticles={publicArticles}>
                <InlineView nodes={node.children} publicArticles={publicArticles} />
              </LinkView>
            );
        }
      })}
    </>
  );
}

function LinkView({
  href,
  publicArticles,
  children,
}: {
  href: string;
  publicArticles?: ReadonlySet<string>;
  children: React.ReactNode;
}) {
  const kind = classifyHref(href);
  const style = "font-medium text-wine underline decoration-wine/40 underline-offset-[3px] transition hover:decoration-wine";
  if (kind === "external") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={style}>
        {children}
      </a>
    );
  }
  if (kind === "internal") {
    const article = pathOf(href).match(/^\/blog\/([a-z0-9-]+)\/?$/);
    if (article && publicArticles && !publicArticles.has(article[1])) return <>{children}</>;
    return (
      <Link href={href} className={style}>
        {children}
      </Link>
    );
  }
  return <>{children}</>;
}
