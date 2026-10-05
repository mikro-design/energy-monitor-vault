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
  part.model.efficiency = 1.1;
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
