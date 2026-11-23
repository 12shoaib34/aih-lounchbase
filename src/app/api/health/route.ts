import { Hono } from "hono";
const api = new Hono().get("/api/health", c => c.json({ status: "ok" }, 200, { "Cache-Control": "no-store" }));
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api.fetch(request); }
