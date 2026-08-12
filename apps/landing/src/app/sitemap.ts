import type { MetadataRoute } from 'next';
import { POSTS, postPath } from '@/lib/blog';
import { absoluteUrl, ROUTES } from '@/lib/site';

/* required by `output: export`: metadata routes must declare themselves static */
export const dynamic = 'force-static';

/* Static export renders this to /sitemap.xml at build time. Route inventory and
 * lastmod dates live in lib/site.ts so adding a page is one edit, not two; blog
 * posts derive from the registry in lib/blog.ts for the same reason. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: route.lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...POSTS.map((post) => ({
      url: absoluteUrl(postPath(post.slug)),
      lastModified: post.updated ?? post.published,
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    })),
  ];
}
