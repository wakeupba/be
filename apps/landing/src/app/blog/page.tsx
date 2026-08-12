import { BlogJsonLd, BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { Cta } from '@/components/site/cta';
import { Footer } from '@/components/site/footer';
import { Header } from '@/components/site/header';
import { POSTS, postPath } from '@/lib/blog';
import { OG_CARDS, pageMetadata } from '@/lib/seo';

const PATH = '/blog/';
const TITLE = 'Blog';
const DESCRIPTION =
  'Notes on calendars, telephony and the design of a product whose job is to interrupt you. Short on purpose, written by a human.';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  card: OG_CARDS.blog,
  imageAlt: 'we wrote it down. calendar problems. telephony. product notes.',
});

function PostDate({ iso }: { iso: string }) {
  return (
    <time dateTime={iso}>
      {new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })}
    </time>
  );
}

export default function Page() {
  return (
    <>
      <BlogJsonLd description={DESCRIPTION} />
      <BreadcrumbJsonLd name={TITLE} path={PATH} />
      <Header />
      <main>
        {/* same header grammar as ArticleShell; this page is a list, not an article */}
        <header className="border-b border-line-soft">
          <div className="mx-auto max-w-3xl px-6 pb-12 pt-16 sm:pb-16 sm:pt-24">
            <p className="rise rise-1 font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">Blog</p>
            <h1 className="rise rise-2 mt-4 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
              The blog
            </h1>
            <p className="rise rise-3 mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">{DESCRIPTION}</p>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-6 pb-24 sm:pb-32">
          {/* ledger rows, same idea as the article sections: hairline above,
           * mono metadata in the margin, no cards */}
          {POSTS.map((post) => (
            <a
              key={post.slug}
              href={postPath(post.slug)}
              className="group flex gap-4 border-b border-line-soft py-8 last:border-b-0 sm:gap-6"
            >
              <p className="hidden w-28 shrink-0 pt-1 font-mono text-[12px] tabular-nums text-muted-2 sm:block">
                <PostDate iso={post.published} />
              </p>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold tracking-tight text-foreground transition-colors duration-150 group-hover:text-accent">
                  {post.title}
                </h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{post.description}</p>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-2">
                  <span className="sm:hidden">
                    <PostDate iso={post.published} />
                    {' · '}
                  </span>
                  {post.eyebrow}
                  {' · '}
                  {post.readMinutes} min
                </p>
              </div>
            </a>
          ))}
        </div>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
