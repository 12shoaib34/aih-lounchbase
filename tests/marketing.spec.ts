import { expect, test } from "@playwright/test";

test("mobile menu, theme, venture and paid enquiry paths survive revisiting Home", async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:"reduce",colorScheme:"dark"});
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");
  const menu=page.getByRole("button",{name:"Menu +"});
  await menu.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
  await expect(page.locator("header a[href='#about']")).toBeFocused();
  await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
  await page.locator(".theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await page.locator("#home a[href='#ventures']").click();
  await expect(page).toHaveURL(/#ventures$/);
  await page.locator("#home a[data-inquiry-service]").click();
  await expect(page.locator("#brief [name=service]")).toHaveValue("Build a product");
  await page.locator('#work a[href="/work"]').click();
  await page.locator('[data-project="commerce"]').click();
  await expect(page.locator("#project-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("header .logo").click();
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator(".motion-toggle")).toHaveCount(1);
  await page.goto("/contact?engagement=venture#brief");
  await expect(page.locator("#venture-fields")).toBeVisible();
  expect(errors).toEqual([]);
});

test("desktop carousel selects every card and links to the featured project",async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/#work");
  await expect(page.locator(".op-work-track article")).toHaveCount(5);
  for(let i=0;i<5;i++){
    await page.locator("[data-work]").nth(i).click();
    await expect(page.locator(".op-work-counter")).toHaveText("0"+(i+1)+" / 05");
  }
  await page.getByRole("button",{name:"Show PakGo"}).click();
  await page.getByRole("link",{name:"View PakGo project"}).click();
  await expect(page).toHaveURL(/\/work#pakgo$/);
});

test("public routes expose content without JavaScript",async({browser,baseURL})=>{
  const p=await browser.newPage({javaScriptEnabled:false,baseURL,viewport:{width:320,height:700}});
  try {
    for(const path of ["/","/services","/work","/studio","/ventures","/engagements","/privacy","/contact"]){
      const r=await p.goto(path);expect(r?.status()).toBe(200);await expect(p.locator("h1")).toBeVisible();
      expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await expect(p.locator("#send-status a")).toBeVisible();
  } finally {await p.close()}
});
