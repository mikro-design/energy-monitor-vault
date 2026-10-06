import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePart, validateProfile } from "../tools/validate.mjs";
const read = (p) =>
  JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
test("VMAIN model and profile retain user thresholds and harvesting efficiency", () => {
  const p = read("profiles/onio-vmain-storage.json");
  assert.deepEqual(validateProfile(p), []);
  const part = p.parts.find((p) => p.id === "onio/onio-zero");
  const h = part.model.harvester;
  assert.deepEqual(h, {
    storage_port: "vmain",
    efficiency: 0.85,
    min_storage_v: 0.25,
    max_storage_v: 3.3,
    charge_stop_v: 2.7,
    restart_v: 2.2,
    off_power_w: 0,
  });
  assert.equal(
    read("vendor/onio/onio-zero/characterization.json").vmain_storage
      .harvesting_efficiency,
    h.efficiency,
  );
  assert.deepEqual(part, read("vendor/onio/onio-zero/part.json"));
  h.efficiency = 1.1;
  assert.ok(validatePart(part).some((e) => e.includes("harvester")));
});
test("storage ports, capacitor ratings and battery ranges reject incompatible models", () => {
  const p = read("profiles/onio-vmain-storage.json");
  const cap = p.parts.find((p) => p.model.kind === "storage");
  cap.model.store.rated_voltage_v = 2.5;
  assert.ok(validatePart(cap).some((e) => e.includes("capacitor")));
  p.edges[1].from.port = p.parts.find(
    (p) => p.id === "onio/onio-zero",
  ).ports[0].id;
  assert.ok(validateProfile(p).some((e) => e.includes("storage connection")));
});
