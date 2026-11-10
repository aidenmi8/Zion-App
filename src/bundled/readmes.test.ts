import { expect, it } from "vitest";
import { bundledPlugins } from ".";
import { bundledReadmes } from "./readmes";

it("opens every bundled plugin's README with the same short Getting started guide", () => {
  for (const { manifest } of bundledPlugins) {
    // Specs and other contributor material may follow the first rule.
    const [guide = ""] = (bundledReadmes.get(manifest.id) ?? "").split(
      "\n---\n",
    );
    expect(guide.split("\n")[0], manifest.id).toBe(`# ${manifest.name}`);
    expect(guide.match(/^## .*/gm), manifest.id).toEqual([
      "## Getting started",
    ]);
  }
});

it("names Zion in current-product plugin summaries while retaining legacy IDs", () => {
  for (const id of [
    "buzz.bestie",
    "buzz.channels",
    "buzz.codex",
    "buzz.feedback",
    "buzz.goose",
    "buzz.pairing",
    "buzz.pi",
  ]) {
    const guide = bundledReadmes.get(id);
    expect(guide, id).toBeDefined();
    const summary = guide?.split("\n\n", 2)[1];
    expect(summary, id).toContain("Zion");
    expect(summary, id).not.toContain("Buzz");
  }
});
