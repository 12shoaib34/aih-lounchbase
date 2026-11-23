import { expect, test } from "@playwright/test";
import axe from "axe-core";
import { gzipSync } from "node:zlib";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

test("built public metadata, route boundaries and cold homepage assets", async ({
  page,
  request,
}) => {
  const titles = new Set<string>(),
    descriptions = new Set<string>();
  for (const route of [
    "/",
    "/work",
    "/services",
    "/studio",
    "/ventures",
    "/engagements",
    "/contact",
    "/privacy",
    "/blog",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    titles.add(await page.title());
    descriptions.add(
      (await page.locator('meta[name="description"]').getAttribute("content"))!,
    );
    const canonical = "https://appsinhours.com" + route;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonical,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https:/,
    );
    if (route === "/" || route === "/services") {
      const structured = JSON.parse(
        await page
          .locator('script[type="application/ld+json"]')
          .first()
          .innerText(),
      );
      expect(structured["@context"]).toBe("https://schema.org");
    }
    if (route === "/") {
      const scripts = await page
        .locator("script[src]")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLScriptElement).src),
        );
      let gzipBytes = 0;
      for (const script of new Set(scripts)) {
        const bytes = await (await request.get(script)).body();
        expect(bytes.includes(Buffer.from("class PDFDocument"))).toBe(false);
        gzipBytes += gzipSync(bytes).length;
      }
      console.log(
        "Homepage initial script tags:",
        scripts.length,
        "gzip bytes:",
        gzipBytes,
      );
    }
  }
  expect(titles.size).toBe(9);
  expect(descriptions.size).toBe(9);
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /app/",
  );
  for (const path of [
    "/app/account",
    "/app/account/bookings",
    "/app/admin/billing",
  ]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});

test("records automated accessibility findings on representative routes", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const findings: { route: string; violations: unknown[] }[] = [];
  for (const route of ["/", "/contact", "/work", "/app/account"]) {
    await page.goto(route);
    await page.waitForFunction(() => history.state?.__NA);
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const report = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      });
      return report.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map((node) => node.target),
      }));
    });
    findings.push({ route, violations });
  }
  console.log("Accessibility scan", JSON.stringify(findings));
  await info.attach("accessibility", {
    body: JSON.stringify(findings, null, 2),
    contentType: "application/json",
  });
  for (const finding of findings)
    expect(finding.violations, finding.route).toEqual([]);
});
