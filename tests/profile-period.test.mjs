import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateProfile } from "../tools/validate.mjs";

test("defined profile periods retain multiple activities and reject inconsistent cycles", () => {
  const p = JSON.parse(
    readFileSync(
      new URL("../profiles/onio-radio-states.json", import.meta.url),
      "utf8",
    ),
  );
  const node = p.nodes.find((n) => n.id === "onio");
  node.profile_period_s = 1;
  for (const event of p.events) event.period_s = 1;
  assert.deepEqual(validateProfile(p), []);
  for (const bad of [0, -1]) {
    node.profile_period_s = bad;
    assert.ok(
      validateProfile(p).some((e) => e.includes("Invalid profile period")),
    );
  }
  node.profile_period_s = 1;
  p.events[0].period_s = null;
  assert.ok(
    validateProfile(p).some((e) => e.includes("fit inside and repeat")),
  );
  p.events[0].period_s = 1;
  p.events[0].start_s = 1;
  assert.ok(
    validateProfile(p).some((e) => e.includes("fit inside and repeat")),
  );
});
