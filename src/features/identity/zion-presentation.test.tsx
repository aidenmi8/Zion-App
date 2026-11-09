// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Button } from "../../shared/design-system/ui/Button";
import { OnboardingScreen } from "./OnboardingScreen";
import { OnboardingWordmark } from "./OnboardingWordmark";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders the approved square Zion mark in the current welcome composition", () => {
  render(
    <OnboardingScreen
      welcome
      labelledBy="zion-welcome"
      intro={
        <h1 id="zion-welcome">
          <OnboardingWordmark />
        </h1>
      }
    >
      <Button>Other options</Button>
    </OnboardingScreen>,
  );
  const mark = screen.getByRole("img", { name: "Zion" });
  expect(mark).toHaveAttribute("viewBox", "0 0 64 64");
  expect(
    Array.from(mark.querySelectorAll("path"), (path) => path.getAttribute("d")),
  ).toEqual(["M16 30 32 12h20L36 30H16Z", "M12 52 28 34h20L32 52H12Z"]);
  expect(screen.getByRole("main")).toHaveAttribute("data-color-mode", "dark");
});

it("keeps the upstream action usable with static reduced-motion artwork", async () => {
  const choose = vi.fn();
  render(
    <OnboardingScreen
      welcome
      labelledBy="zion-welcome"
      intro={
        <h1 id="zion-welcome">
          <OnboardingWordmark />
        </h1>
      }
    >
      <Button onClick={choose}>Other options</Button>
    </OnboardingScreen>,
  );
  expect(screen.getByRole("img", { name: "Zion" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Other options" }));
  expect(choose).toHaveBeenCalledOnce();
});

it("names the real document and launch artwork Zion without renaming compatibility IDs", () => {
  const html = readFileSync("index.html", "utf8");
  const document = new DOMParser().parseFromString(html, "text/html");
  expect(document.title).toBe("Zion");
  const launch = document.getElementById("buzz-launch");
  expect(launch?.getAttribute("aria-label")).toBe("Opening Zion");
  expect(launch?.querySelector("img")?.getAttribute("alt")).toBe("Zion");
  expect(launch?.querySelector("source")?.getAttribute("media")).toBe(
    "(prefers-reduced-motion: reduce)",
  );
  for (const name of ["buzz-mark.svg", "buzz-loading-mark.svg"]) {
    const mark = readFileSync(`public/${name}`, "utf8");
    expect(mark).toContain("#a6a6a8");
    expect(mark).not.toContain("#8f83ff");
  }
});
