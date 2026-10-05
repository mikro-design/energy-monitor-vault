import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validatePart,
  validateProfile,
  validateVault,
} from "../tools/validate.mjs";
const profile = JSON.parse(
  readFileSync(
    new URL("../profiles/environmental-sensor.json", import.meta.url),
    "utf8",
  ),
);
test("example vault is valid", () =>
  assert.deepEqual(validateVault().errors, []));
test("missing evidence and impossible efficiency are rejected", () => {
  const part = structuredClone(profile.parts[1]);
  delete part.provenance.iq_a;
  part.model.outputs.vout.efficiency = 1.1;
  assert.ok(validatePart(part).some((e) => e.includes("provenance")));
  assert.ok(validatePart(part).some((e) => e.includes("Efficiency")));
});
test("changed pinned models are rejected", () => {
  const p = structuredClone(profile);
  p.parts[0].model.capacity_ah = 1.2;
  assert.ok(
    validateProfile(p).some((e) => e.includes("Pinned model mismatch")),
  );
});
test("pin declarations, model outputs and edge endpoints agree", () => {
  const part = structuredClone(profile.parts[1]);
  part.ports.push({ ...part.ports[1] });
  assert.ok(validatePart(part).some((e) => e.includes("duplicate port")));
  const missing = structuredClone(profile.parts[1]);
  delete missing.model.outputs.vout;
  assert.ok(
    validatePart(missing).some((e) => e.includes("matching electrical models")),
  );
  const p = structuredClone(profile);
  p.edges[1].from.port = "vin";
  assert.ok(validateProfile(p).some((e) => e.includes("direction")));
  p.edges[1].from.port = "no-such-pin";
  assert.ok(validateProfile(p).some((e) => e.includes("Unknown port")));
});
