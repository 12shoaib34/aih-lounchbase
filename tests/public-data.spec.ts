import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { handleEnquiry } from "../src/server/site/enquiry";
import { deliverNotifications } from "../src/server/site/notifications";

test("paid and venture receipts survive retries and notification provider failure", async () => {
  const url=process.env.SITE_FIXTURE_DATABASE;
  test.skip(!url,"Run with npm run test:public-data for an isolated database");
  expect(new URL(url!).host).toMatch(/^(localhost|127\.0\.0\.1):54439$/);
  const origin="https://fixture.invalid";
  const env={DATABASE_URL:url!,PUBLIC_ORIGIN:origin,TURNSTILE_SITE_KEY:"fixture",TURNSTILE_SECRET:"fixture",
    ENQUIRY_FROM:"from@example.invalid",ENQUIRY_TO:"to@example.invalid",RESEND_API_KEY:"fixture"};
  const sql=postgres(url!,{max:1});
  const brief={submissionId:crypto.randomUUID(),service:"Build a product",message:"A fixture-only product enquiry.",name:"Fixture",email:"test@example.invalid",token:"fixture"};
  const post=(body:object, allowed=true)=>handleEnquiry(new Request(origin,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json","CF-Connecting-IP":"192.0.2.1"},body:JSON.stringify(body)}),env,
    async()=>Response.json({success:allowed,hostname:"fixture.invalid",action:"enquiry"}));
  try {
    expect((await post({...brief,email:"invalid"})).status).toBe(400);
    expect((await post(brief,false)).status).toBe(400);
    const first=await post(brief);
    expect(await first.json()).toMatchObject({ok:true,reference:brief.submissionId});
    expect((await post(brief)).status).toBe(200);
    expect((await post({...brief,message:"A different enquiry."})).status).toBe(409);
    const venture={...brief,submissionId:crypto.randomUUID(),service:"Venture partnership — development for equity"};
    expect((await post(venture)).status).toBe(400);
    expect((await post({...venture,validation:"test",founderPlan:"test",companyStage:"Idea",mvpJourney:"test",commitment:"test",equityAck:"on"})).status).toBe(200);
    expect(await sql`SELECT id FROM site_enquiries`).toHaveLength(2);
    const keys:string[]=[];
    const provider=(success:boolean)=>async (_input:unknown, init?:RequestInit)=>{
      keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
      return new Response(null,{status:success?202:503});
    };
    await deliverNotifications(env,provider(false));
    expect(await sql`SELECT * FROM site_notifications WHERE attempts=1 AND delivered_at IS NULL`).toHaveLength(2);
    await sql`UPDATE site_notifications SET next_attempt=now()`;
    await deliverNotifications(env,provider(true));
    await deliverNotifications(env,provider(true));
    expect(keys).toHaveLength(4);
    expect(keys.slice(0,2).sort()).toEqual(keys.slice(2).sort());
    expect(await sql`SELECT * FROM site_notifications WHERE attempts=2 AND delivered_at IS NOT NULL`).toHaveLength(2);
    await sql`UPDATE site_submission_windows SET count=20`;
    expect((await post(brief)).status).toBe(429);
  } finally {await sql.end();}
});

test("contact preserves the original enquiry across ambiguous failure and retry",async({page})=>{
  const bodies:Record<string,unknown>[]=[];
  await page.route("https://challenges.cloudflare.com/**",route=>route.fulfill({contentType:"application/javascript",body:
    'let callbacks;window.turnstile={render:(el,c)=>{callbacks=c;c.callback("fixture");return 1},reset:()=>callbacks.callback("retry"),remove:()=>{}};'}));
  await page.route("**/api/enquiry",async route=>{
    if(route.request().method()==="GET") return route.fulfill({json:{enabled:true,siteKey:"fixture"}});
    bodies.push(route.request().postDataJSON());
    return route.fulfill(bodies.length===1?{status:502,json:{error:"Receipt uncertain."}}:{json:{ok:true,message:"Receipt confirmed."}});
  });
  await page.goto("/contact#brief");
  await page.locator("[name=service]").selectOption("Build a product");
  await page.locator("[name=name]").fill("Fixture");
  await page.locator("[name=email]").fill("fixture@example.invalid");
  await page.locator("[name=message]").fill("Build a fixture booking flow.");
  await page.locator("#send-enquiry").click();
  await expect(page.locator("[name=name]")).toBeDisabled();
  await page.locator("#send-enquiry").click();
  await expect(page.locator("#send-status")).toHaveText("Receipt confirmed.");
  expect(bodies[0].submissionId).toBeTruthy();
  expect(bodies[1]).toEqual({...bodies[0],token:"retry"});
});

test("unavailable blog and enquiry keep working links and index controls",async({page,request})=>{
  await page.goto("/blog");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Our articles are temporarily unavailable.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content",/noindex/);
  await page.goto("/contact.html?engagement=venture#brief");
  await expect(page).toHaveURL(/\/contact\?engagement=venture#brief$/);
  await expect(page.locator("#send-status a")).toHaveAttribute("href","mailto:inquiry@appsinhours.com");
  expect(await (await request.get("/robots.txt")).text()).toContain("/app/");
  const sitemap=await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("appsinhours.com/work"); expect(sitemap).not.toContain("/blog");
});
