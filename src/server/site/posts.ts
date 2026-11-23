import { cache } from "react";
import { withDatabase } from "./database";
type Summary = {slug:string; title:string; excerpt:string; publishedAt:string};
export const listPosts = cache(async (): Promise<Summary[] | null> => {
  try {
    return await withDatabase(sql => sql<Summary[]>`SELECT slug,title,excerpt,published_at::text AS "publishedAt"
      FROM site_posts WHERE published_at<=now() ORDER BY published_at DESC,slug`);
  } catch { return null; }
});
export const readPost = cache(async (slug:string) => {
  try {
    const posts = await withDatabase(sql => sql<(Summary & {content:string})[]>`SELECT slug,title,excerpt,content,
      published_at::text AS "publishedAt" FROM site_posts WHERE slug=${slug} AND published_at<=now()`);
    return {available:true, post:posts[0]};
  } catch { return {available:false,post:undefined}; }
});
