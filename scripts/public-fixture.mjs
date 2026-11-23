import { spawn } from "node:child_process";
import { once } from "node:events";
import postgres from "postgres";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
const db = new PGlite();
const socket = new PGLiteSocketServer({db,host:"127.0.0.1",port:54439,maxConnections:10});
await socket.start();
const url = new URL("postgres://postgres:postgres@127.0.0.1:54439/postgres");
const sql = postgres(url.href,{max:1});
const origin="http://127.0.0.1:8834";
let server;
try {
  await sql.unsafe(await readFile(new URL("../database/site/001-public.sql",import.meta.url),"utf8"));
  await sql`INSERT INTO site_posts(slug,title,content,published_at) VALUES
    ('fixture-note','Published fixture','## Fixture body',now()),('draft-note','Draft fixture','Draft',NULL)`;
  server=spawn(process.execPath,["node_modules/wrangler/bin/wrangler.js","dev","--local","--port","8834","--var","DATABASE_URL:"+url.href],{stdio:"inherit"});
  let html;
  for(let attempt=0;attempt<100;attempt++){
    try { html=await (await fetch(origin+"/blog")).text(); break; }
    catch { await new Promise(r=>setTimeout(r,250)); }
  }
  assert.ok(html?.includes("Published fixture") && !html.includes("Draft fixture"));
  assert.match(await (await fetch(origin+"/blog/fixture-note")).text(),/<h2>Fixture body<\/h2>/);
  for(const slug of ["draft-note","missing"]) assert.equal((await fetch(origin+"/blog/"+slug,{headers:{"User-Agent":"Googlebot"}})).status,404);
  const sitemap=await (await fetch(origin+"/sitemap.xml")).text();
  assert.ok(sitemap.includes("/blog/fixture-note") && !sitemap.includes("draft-note"));
  const { chromium }=await import("@playwright/test");
  const browser=await chromium.launch({channel:process.env.E2E_CHANNEL});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});
    const oldRequests=[];
    page.on("request",req=>{if (/\/api\/(portal|copy|admin)([/?]|$)/.test(new URL(req.url()).pathname)) oldRequests.push(req.url());});
    await page.goto(origin+"/blog");
    await page.getByRole("link",{name:/Published fixture/}).click();
    await page.getByRole("heading",{name:"Fixture body"}).waitFor();
    await page.screenshot({path:"/tmp/aih-step4-article.png"});
    assert.deepEqual(oldRequests,[]);
  } finally {await browser.close();}
  const runner=spawn(process.execPath,["node_modules/@playwright/test/cli.js","test"],{
    stdio:"inherit",env:{...process.env,DATABASE_URL:"",SITE_FIXTURE_DATABASE:url.href,E2E_PORT:"8835"}});
  const [code]=await once(runner,"exit");
  process.exitCode=code??1;
} finally {server?.kill(); await sql.end(); await socket.stop(); await db.close();}
