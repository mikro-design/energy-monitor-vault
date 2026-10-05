import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  cpSync,
  rmSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validatePart,
  validateProfile,
  validateVault,
  validateCatalog,
  validateVendor,
} from "../tools/validate.mjs";
const profile = JSON.parse(
  readFileSync(
    new URL("../profiles/environmental-sensor.json", import.meta.url),
    "utf8",
  ),
);
test("vault is valid", () => assert.deepEqual(validateVault().errors, []));
test("missing evidence and impossible efficiency are rejected", () => {
  const part = structuredClone(profile.parts[1]);
  delete part.provenance.iq_a;
  part.model.outputs.vout.efficiency = 1.1;
  assert.ok(validatePart(part).some((e) => e.includes("provenance")));
  assert.ok(validatePart(part).some((e) => e.includes("Efficiency")));
});

const read = (path) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const vendor = read("vendor/nordic-semiconductor/vendor.json");
const catalog = read("vendor/nordic-semiconductor/nrf52840/catalog.json");
const radioPart = read("vendor/nordic-semiconductor/nrf52840/part.json");
test("catalog requires official reviewed sources and real review dates", () => {
  assert.deepEqual(validateVendor(vendor), []);
  for (const url of [
    "https://nordicsemi.com.example.org/spec",
    "https://example.org/nordicsemi.com/",
  ]) {
    const c = structuredClone(catalog);
    c.sources[0].url = url;
    assert.ok(
      validateCatalog(c, vendor, radioPart).some((e) =>
        e.includes("manufacturer domain"),
      ),
    );
  }
  const c = structuredClone(catalog);
  c.sources[0].reviewed_on = "2026-02-30";
  c.sources.find((s) => s.id === "pins").access = "search_excerpt";
  const errors = validateCatalog(c, vendor, radioPart);
  assert.ok(errors.some((e) => e.includes("review date")));
  assert.ok(errors.some((e) => e.includes("reviewed source")));
});
test("radio PHY, protocol, source and operating-point references agree", () => {
  const c = structuredClone(catalog);
  c.radio.protocols = ["ble"];
  c.radio.operating_points[0].phy = "not-a-phy";
  c.radio.operating_points[0].source = "not-a-source";
  c.radio.operating_points[2].tx_power_dbm = 8;
  const errors = validateCatalog(c, vendor, radioPart);
  for (const message of [
    "Undeclared protocol",
    "Unknown PHY",
    "Unknown source",
    "TX power",
  ])
    assert.ok(
      errors.some((e) => e.includes(message)),
      message,
    );
});
test("physical pins cannot masquerade as different electrical ports", () => {
  const c = structuredClone(catalog);
  c.pins.entries[0].package_pins.push("12");
  assert.ok(
    validateCatalog(c, vendor, radioPart).some((e) =>
      e.includes("package pin"),
    ),
  );
  const part = structuredClone(radioPart);
  part.ports[0].name = "SW";
  assert.ok(
    validateCatalog(catalog, vendor, part).some((e) =>
      e.includes("catalog power pin"),
    ),
  );
});
test("catalog status cannot claim a missing model or conceal an executable one", () => {
  assert.ok(
    validateCatalog(catalog, vendor).some((e) =>
      e.includes("requires part.json"),
    ),
  );
  const c = structuredClone(catalog);
  c.simulation.status = "catalog_only";
  c.simulation.model_file = null;
  assert.ok(
    validateCatalog(c, vendor, radioPart).some((e) =>
      e.includes("Catalog-only"),
    ),
  );
  const part = structuredClone(radioPart);
  part.id = "nordic-semiconductor/another-device";
  assert.ok(
    validateCatalog(catalog, vendor, part).some((e) =>
      e.includes("IDs must match"),
    ),
  );
});
test("vault discovers catalogs, checks paths, and reports malformed records", () => {
  const dir = mkdtempSync(join(tmpdir(), "energy-vault-"));
  try {
    for (const name of ["vendor", "profiles", "settings"])
      cpSync(new URL(`../${name}`, import.meta.url), join(dir, name), {
        recursive: true,
      });
    const initial = validateVault(dir);
    assert.deepEqual(initial.errors, []);
    assert.equal(initial.catalog.length, 20);
    assert.equal(
      initial.catalog.filter((c) => c.status === "runnable_approximation")
        .length,
      4,
    );
    const nordic = join(dir, "vendor/nordic-semiconductor");
    renameSync(join(nordic, "nrf52840"), join(nordic, "wrong-path"));
    writeFileSync(join(nordic, "nrf52832/catalog.json"), "invalid json");
    const errors = validateVault(dir).errors;
    assert.ok(errors.some((e) => e.includes("Path must match catalog ID")));
    assert.ok(errors.some((e) => e.includes("nrf52832/catalog.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("radio profile embeds the current model and avoids overlapping radio modes", () => {
  const profile = read("profiles/nrf52840-radio-states.json");
  assert.deepEqual(validateProfile(profile), []);
  assert.deepEqual(
    profile.parts.find((p) => p.id === radioPart.id),
    radioPart,
  );
  const events = [...profile.events].sort((a, b) => a.start_s - b.start_s);
  for (let i = 1; i < events.length; i++)
    assert.ok(
      events[i - 1].start_s + events[i - 1].duration_s <= events[i].start_s,
    );
  assert.ok(
    events.at(-1).start_s + events.at(-1).duration_s <
      events[0].period_s + events[0].start_s,
  );
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
