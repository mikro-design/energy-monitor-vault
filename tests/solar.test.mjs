import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validatePart,
  validateProfile,
  validateSolarCharacterization,
} from "../tools/validate.mjs";
const read = (p) =>
  JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
for (const [kind, power, revision, count, maxLux] of [
  ["indoor", 0.124, "3.0", 4, 1000],
  ["hybrid", 0.054, "1.4.1", 9, 50000],
]) {
  test(`Exeger ${kind} matches reviewed source tables and units`, () => {
    const root = `vendor/exeger/powerfoyle-${kind}/`,
      part = read(root + "part.json"),
      c = read(root + "characterization.json");
    assert.deepEqual(validatePart(part), []);
    assert.deepEqual(validateSolarCharacterization(part, c), []);
    assert.equal(c.source.revision, revision);
    assert.equal(part.model.curve.length, count);
    assert.equal(part.model.curve.at(-1).illuminance_lux, maxLux);
    assert.equal(
      part.model.curve.find((p) => p.illuminance_lux === 200)
        .power_density_w_m2,
      power,
    );
    assert.equal(part.model.area_m2, 0.0005);
    assert.deepEqual(part.ports[0].package_pins, []);
    const wrong = structuredClone(c);
    wrong.mpp_samples[0].power_density_w_m2 *= 100;
    assert.ok(
      validateSolarCharacterization(part, wrong).some((e) =>
        e.includes("MPP samples"),
      ),
    );
  });
}
test("solar rejects extrapolation, duplicate curve points and missing evidence", () => {
  const original = read("vendor/exeger/powerfoyle-indoor/part.json");
  for (const lux of [-1, 50, 1001]) {
    const p = structuredClone(original);
    p.model.states_lux.indoor = lux;
    assert.ok(validatePart(p).some((e) => e.includes("range")));
  }
  const p = structuredClone(original);
  p.model.curve[1].illuminance_lux = 100;
  assert.ok(validatePart(p).some((e) => e.includes("strictly ordered")));
  delete p.provenance["curve.0.voltage_v"];
  assert.ok(validatePart(p).some((e) => e.includes("Missing provenance")));
});
test("solar example pins current models and schedules declared lighting states", () => {
  const p = read("profiles/exeger-indoor-lighting.json");
  assert.deepEqual(validateProfile(p), []);
  for (const part of p.parts)
    assert.deepEqual(part, read(`vendor/${part.id}/part.json`));
  assert.equal(p.duration_s, 60);
  assert.deepEqual(
    p.events.map((e) => e.state),
    ["bright", "dark"],
  );
  p.events[0].state = "missing";
  assert.ok(validateProfile(p).some((e) => e.includes("lighting state")));
});
