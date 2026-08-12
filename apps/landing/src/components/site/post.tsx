import type { ReactNode } from 'react';
import { BlogPostingJsonLd, BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { AUTHOR, type BlogPost, postPath } from '@/lib/blog';
import { ArticleShell } from './article';
import { Cta } from './cta';
import { Footer } from './footer';
import { Header } from './header';

/*
 * Everything a blog post page shares, so each post's page.tsx is only its
 * sections. The chrome matches the explainer pages on purpose: a post is the
 * same kind of reading surface, it just carries a byline instead of a
 * "last updated" line.
 */
export function PostShell({ post, children }: { post: BlogPost; children: ReactNode }) {
  return (
    <>
      <BlogPostingJsonLd post={post} />
      <BreadcrumbJsonLd
        name={post.title}
        path={postPath(post.slug)}
        parents={[{ name: 'Blog', path: '/blog/' }]}
      />
      <Header />
      <main>
        <ArticleShell
          eyebrow={post.eyebrow}
          title={post.title}
          lede={post.lede}
          meta={
            <>
              {AUTHOR.name}
              {' · '}
              <time dateTime={post.published}>
                {new Date(`${post.published}T00:00:00Z`).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </time>
              {' · '}
              {post.readMinutes} min read
            </>
          }
        >
          {children}
        </ArticleShell>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
