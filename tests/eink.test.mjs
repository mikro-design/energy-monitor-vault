import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePart, validatePreset } from "../tools/validate.mjs";
const read = (path) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
for (const [id, energy, duration, idle] of [
  ["good-display/gdey0213b74", 0.0315, 3, 3e-6],
  ["good-display/gdey0213f51", 0.2475, 25, 3e-6],
  ["pervasive-displays/e2213ks0e1", 0.01656, 2.4, null],
])
  test(`${id} preserves source-qualified refresh and unknown idle values`, () => {
    const preset = read(`vendor/${id}/preset.json`);
    const source = read(`vendor/${id}/characterization.json`);
    const part = idle === null ? null : read(`vendor/${id}/part.json`);
    assert.deepEqual(preset.operation, {
      energy_j: energy,
      duration_s: duration,
    });
    assert.equal(preset.idle_power_w, idle);
    assert.deepEqual(validatePreset(preset, source, part), []);
    if (part) assert.deepEqual(validatePart(part), []);
    const altered = structuredClone(preset);
    altered.idle_power_w = 0;
    assert.ok(validatePreset(altered, source, part).length);
    altered.idle_power_w = idle;
    altered.operation.energy_j *= 2;
    assert.ok(validatePreset(altered, source, part).length);
    if (idle === null) {
      altered.operation.energy_j = energy;
      altered.specification_status = "typical";
      assert.ok(
        validatePreset(altered, source).some((e) => e.includes("tentative")),
      );
    }
  });
test("energy operations reject ambiguous, invalid and current-based models", () => {
  const original = read("vendor/good-display/gdey0213b74/part.json");
  for (const mutate of [
    (p) => (p.model.state_unit = "A"),
    (p) => (p.model.states.full_refresh = 0.01),
    (p) => (p.model.default_state = "full_refresh"),
    (p) => (p.model.operations.full_refresh.energy_j = 0),
    (p) => (p.model.operations.full_refresh.duration_s = 0),
    (p) => delete p.provenance["operations.full_refresh.energy_j"],
  ]) {
    const part = structuredClone(original);
    mutate(part);
    assert.ok(validatePart(part).length);
  }
});
