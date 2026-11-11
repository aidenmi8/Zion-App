import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = JSON.parse(
  readFileSync(
    new URL("../../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
);
const macosConfig = JSON.parse(
  readFileSync(
    new URL("../../src-tauri/tauri.macos.conf.json", import.meta.url),
    "utf8",
  ),
);

test("Zion shipping metadata keeps the approved installed-app identity", () => {
  assert.equal(config.productName, "Zion");
  assert.equal(config.identifier, "xyz.block.buzz.app");
  assert.equal(config.version, "0.7.0-zion.1");
  for (const window of config.app.windows) assert.equal(window.title, "Zion");
  assert.deepEqual(config.plugins["deep-link"].desktop.schemes, ["buzz"]);
  assert.equal(
    config.plugins.updater,
    undefined,
    "do not enable an upstream updater feed",
  );
});

test("the macOS platform override keeps the visible Zion window title", () => {
  for (const window of macosConfig.app.windows)
    assert.equal(window.title, "Zion");
});

test("the installer selects the Zion candidate background and approved drag layout", () => {
  const dmg = config.bundle.macOS.dmg;
  assert.ok(dmg, "the shipping configuration must select the Zion DMG layout");
  assert.equal(dmg.background, "icons/dmg-background.png");
  assert.deepEqual(dmg.windowSize, { width: 660, height: 532 });
  assert.deepEqual(dmg.appPosition, { x: 191, y: 330 });
  assert.deepEqual(dmg.applicationFolderPosition, { x: 469, y: 330 });
  // The approved compact arrow is centered at x=330pt, between the actual icons.
  const arrowCenterX = 330;
  const arrowHalfWidth = 24;
  assert.ok(dmg.appPosition.x < arrowCenterX - arrowHalfWidth);
  assert.ok(arrowCenterX + arrowHalfWidth < dmg.applicationFolderPosition.x);
  assert.equal(
    arrowCenterX,
    (dmg.appPosition.x + dmg.applicationFolderPosition.x) / 2,
  );
  const background = readFileSync(
    new URL(`../../src-tauri/${dmg.background}`, import.meta.url),
  );
  assert.equal(background.readUInt32BE(16), 1320);
  assert.equal(background.readUInt32BE(20), 1000);
  assert.equal(
    createHash("sha256").update(background).digest("hex"),
    "545b6ac2e8d75d297a0dd30aad9f041081ac3a0706843aaaf8935c3fad0af8ba",
  );
});

test("every packaged icon uses the approved Zion artwork", () => {
  const approved = {
    "icons/32x32.png":
      "0793aeac87727e59e7025e41779cacab098fdd5af936377c32bd29bae6f3da8f",
    "icons/128x128.png":
      "729b69c9dcc416287680e2f243c2c8c44b32b88c87fbc718c9c9ceb902556b47",
    "icons/128x128@2x.png":
      "17acca21c46d4da2d591384e5a1777cbc05419943a40b17184c15762de2027bf",
    "icons/icon.icns":
      "2b7b82c4ac3ca63c8b782190f37328ec80beca74a3fa005ad940db1d00de6a70",
    "icons/icon.ico":
      "a2072992205e2fff83a792b00a23bbeb544ea46f6e3417aff9e19ec8c40aa44d",
  };
  assert.deepEqual(config.bundle.icon, Object.keys(approved));
  for (const [path, digest] of Object.entries(approved)) {
    const bytes = readFileSync(
      new URL(`../../src-tauri/${path}`, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      digest,
      path,
    );
  }
});

test("the local Michroma wordmark font ships with its matching open-font license", () => {
  for (const [filename, digest] of Object.entries({
    "Michroma-Regular.ttf":
      "b62301163788bc5b7f8fcac0b74b184e34e1827e577b499ecb724da065098f87",
    "Michroma-OFL.txt":
      "e349ddd05b7028171de95f5dbacf58043e2511c6d2a80ba59c6f211bf3056e10",
  })) {
    const bytes = readFileSync(
      new URL(`../../public/fonts/${filename}`, import.meta.url),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
  }
});
