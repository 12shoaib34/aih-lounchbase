import type { MetadataRoute } from "next";
import { listPosts } from "../server/site/posts";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = ["","/services","/work","/studio","/engagements","/ventures","/contact","/privacy"];
  const posts = await listPosts();
  if (posts) paths.push("/blog", ...posts.map(post => "/blog/"+post.slug));
  return paths.map(path => ({url:"https://appsinhours.com"+path}));
}
