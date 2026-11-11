import { test, expect } from "./fixture.mjs";
import { open, settle } from "./timeline.mjs";
import {
  chooseColorMode,
  closeSettings,
  openSettings,
  selectSettingsSection,
} from "./navigation.mjs";

test.use({ historyCounts: { alpha: 1, beta: 0 }, launchAnimation: true });

// Real document/title, shell wiring, theme CSS and responsive geometry need a
// browser; semantic welcome/search behavior stays in the colocated Vitest tests.
test("Zion names the current shell without changing navigation or theme behavior", async ({
  page,
  app,
}, testInfo) => {
  await open(page, app);
  await expect(page).toHaveTitle("Zion");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "iris");
  await expect(
    page.getByRole("region", { name: "Channel message history" }),
  ).toContainText("primary alpha message 0");
  await settle(page);
  await page.screenshot({
    path: `/private/tmp/zion-clean-preview-20261106/zion-app-shell-light-${testInfo.project.name}.png`,
  });
  await page.getByRole("button", { name: "Search Zion", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search Zion" });
  await expect(
    search.getByRole("combobox", { name: "Search Zion" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).not.toBeVisible();
  await openSettings(page);
  await selectSettingsSection(page, "Appearance");
  await chooseColorMode(page, "Dark");
  await closeSettings(page);
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await settle(page);
  await page.screenshot({
    path: `/private/tmp/zion-clean-preview-20261106/zion-app-shell-dark-${testInfo.project.name}.png`,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Search Zion", exact: true }),
  ).toBeVisible();
  await settle(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/private/tmp/zion-clean-preview-20261106/zion-app-shell-narrow-${testInfo.project.name}.png`,
  });
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--buzz-text-scale", "1.5"),
  );
  await expect(
    page.getByRole("button", { name: "Search Zion", exact: true }),
  ).toBeVisible();
  await settle(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/private/tmp/zion-clean-preview-20261106/zion-app-shell-enlarged-${testInfo.project.name}.png`,
  });
});
