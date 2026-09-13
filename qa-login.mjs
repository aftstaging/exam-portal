export default async function run(page, ui) {
  await page.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const open = await page.getByRole("button", { name: "Sign in securely" }).isVisible().catch(() => false);
  if (open) {
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await page.waitForTimeout(800);
    await page.getByLabel("Email").fill("demo.admin@accountantsfortomorrow.co.za");
    await page.getByLabel("Password").fill("AdminDemo!2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(3500);
  }
  return { url: page.url(), full: await ui.snapshot({ full: true }) };
}