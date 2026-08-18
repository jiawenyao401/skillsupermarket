import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, ExternalLink, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { GUIDES, getGuide } from "@/lib/guides";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return GUIDES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const path = `/guides/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: path,
      type: "article",
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const path = `/guides/${guide.slug}`;
  return (
    <div className="mx-auto max-w-5xl">
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          datePublished: guide.publishedAt,
          dateModified: guide.updatedAt,
          inLanguage: "zh-CN",
          mainEntityOfPage: absoluteUrl(path),
          author: { "@type": "Organization", "@id": absoluteUrl("/#organization") },
          publisher: { "@id": absoluteUrl("/#organization") },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "首页", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "实战指南", item: absoluteUrl("/guides") },
            { "@type": "ListItem", position: 3, name: guide.title, item: absoluteUrl(path) },
          ],
        },
      ]} />

      <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> 返回实战指南</Link>

      <article className="mt-7 overflow-hidden rounded-[2rem] border bg-card shadow-sm">
        <header className="relative overflow-hidden border-b px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
          <div className="hero-grid" aria-hidden="true" />
          <div className="relative z-10 max-w-4xl">
            <div className="section-eyebrow">{guide.eyebrow}</div>
            <h1 className="mt-4 text-balance text-3xl font-black leading-[1.08] tracking-[-0.05em] sm:text-5xl">{guide.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">{guide.description}</p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> 更新于 {guide.updatedAt}</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> 阅读约 {guide.readingMinutes} 分钟</span>
            </div>
            <p className="mt-7 rounded-2xl border bg-background/75 p-4 text-sm leading-6 text-muted-foreground backdrop-blur"><strong className="text-foreground">适用场景：</strong>{guide.intent}</p>
          </div>
        </header>

        <div className="px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
          <div className="space-y-12">
            {guide.sections.map((section, index) => (
              <section key={section.title} aria-labelledby={`section-${index}`}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h2 id={`section-${index}`} className="text-2xl font-extrabold tracking-[-0.035em]">{section.title}</h2>
                    {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-[15px] leading-7 text-foreground/80">{paragraph}</p>)}
                    {section.bullets && (
                      <ul className="mt-5 space-y-3">
                        {section.bullets.map((item) => (
                          <li key={item} className="flex gap-3 rounded-xl bg-muted/45 p-4 text-sm leading-6 text-foreground/80"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{item}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <section className="mt-14 border-t pt-9" aria-labelledby="guide-sources">
            <h2 id="guide-sources" className="text-lg font-extrabold">一手资料与可复核入口</h2>
            <ul className="mt-4 space-y-2">
              {guide.sources.map((source) => {
                const external = source.url.startsWith("http");
                return (
                  <li key={source.url}>
                    <a href={source.url} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
                      {source.label}{external && <ExternalLink className="h-3.5 w-3.5" />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </article>

      <section className="mt-8 rounded-[2rem] bg-foreground px-6 py-9 text-background sm:px-10">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><ShieldCheck className="h-4 w-4" /> Put it into practice</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em]">把清单应用到一个真实项目</h2>
            <p className="mt-2 text-sm leading-6 text-background/60">提交公开 GitHub、npm 或 PyPI 来源，生成包含证据、风险、置信度和改进建议的报告。</p>
          </div>
          <Link href="/evaluate" className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary/90">免费开始评测 <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
