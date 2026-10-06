import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { canonical } from "./canonical.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  strictNumbers: true,
  validateFormats: false,
});
const schema = (name) =>
  ajv.compile(
    JSON.parse(
      readFileSync(resolve(root, `schemas/${name}.schema.json`), "utf8"),
    ),
  );
const validatePartShape = schema("part"),
  validateProjectShape = schema("project"),
  validateSettingsShape = schema("settings"),
  validateVendorShape = schema("vendor"),
  validateCatalogShape = schema("catalog"),
  validatePresetShape = schema("eink-preset");
const classes = new Set([
  "estimated",
  "derived",
  "measured_lab",
  "datasheet_typical",
  "datasheet_guaranteed",
  "manufacturer_appnote",
]);
export const hash = (part) =>
  createHash("sha256").update(canonical(part)).digest("hex");
export function validatePart(part) {
  const errors = [];
  if (!validatePartShape(part))
    return validatePartShape.errors.map(
      (e) => `${e.instancePath} ${e.message}`,
    );
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(part.id))
    errors.push("Invalid vendor/part ID");
  if (!part.revision.trim() || !part.license.trim())
    errors.push("Revision and license are required");
  if (part.schema_version !== "0.2") errors.push("Unsupported part schema");
  const flatten = (value, prefix = "") =>
    Object.entries(value).flatMap(([key, value]) =>
      key === "kind" && !prefix
        ? []
        : value && typeof value === "object"
          ? flatten(value, `${prefix}${key}.`)
          : [[`${prefix}${key}`, value]],
    );
  const fields = flatten(part.model);
  const inputs = part.ports.filter((p) => p.type === "power_in");
  const outputs = part.ports.filter((p) => p.type === "power_out");
  const counts = {
    battery: [0, 1],
    supply: [0, 1],
    solar: [0, 1],
    switch: [1, 1],
    load: [1, 0],
    storage: [0, 0],
  };
  const count = counts[part.model.kind];
  if (
    count
      ? inputs.length !== count[0] || outputs.length !== count[1]
      : inputs.length !== 1 || outputs.length < 1 || outputs.length > 16
  )
    errors.push("Ports do not match the model family");
  const storagePorts = part.ports.filter((p) => p.type === "power_storage");
  const expectedStorage =
    part.model.kind === "storage" ||
    (part.model.kind === "load" && part.model.harvester)
      ? 1
      : 0;
  if (storagePorts.length !== expectedStorage)
    errors.push("Storage ports do not match the model family");
  const portIds = new Set(),
    packagePins = new Set();
  for (const port of part.ports) {
    if (!/^[A-Za-z0-9_-]+$/.test(port.id) || portIds.has(port.id))
      errors.push("Invalid or duplicate port ID");
    portIds.add(port.id);
    if (!port.name.trim() || Buffer.byteLength(port.name) > 120)
      errors.push("Port name must contain 1–120 bytes");
    for (const pin of port.package_pins) {
      if (!pin.trim() || packagePins.has(pin))
        errors.push("Empty or repeated package pin");
      packagePins.add(pin);
    }
  }
  for (const [field, value] of fields) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0))
      errors.push(`Invalid SI value: ${field}`);
    const e = part.provenance[field];
    if (!e || !classes.has(e.class) || !e.note.trim())
      errors.push(`Missing provenance: ${field}`);
  }
  const m = part.model;
  for (const key of ["voltage_v", "capacity_ah", "max_current_a"])
    if (key in m && m[key] <= 0) errors.push(`${key} must be positive`);
  if (m.kind === "storage") {
    const t = m.store;
    if (t.type === "battery") {
      if (!(
        t.capacity_ah > 0 &&
        t.empty_voltage_v > 0 &&
        t.full_voltage_v > t.empty_voltage_v &&
        t.initial_soc <= 1
      ))
        errors.push("Invalid storage battery range");
    } else if (!(
      t.capacitance_f > 0 &&
      t.rated_voltage_v > 0 &&
      t.initial_voltage_v <= t.rated_voltage_v
    ))
      errors.push("Invalid capacitor range");
  }
  if (m.kind === "load" && m.harvester) {
    const h = m.harvester;
    if (!(
      m.state_unit === "W" &&
      h.efficiency > 0 &&
      h.efficiency <= 1 &&
      h.min_storage_v > 0 &&
      h.min_storage_v < h.restart_v &&
      h.restart_v <= h.charge_stop_v &&
      h.charge_stop_v <= h.max_storage_v &&
      storagePorts[0]?.id === h.storage_port
    ))
      errors.push(
        "Invalid harvester efficiency, voltage thresholds or storage port",
      );
  }
  if (m.kind === "solar") {
    const points = m.curve;
    const states = Object.values(m.states_lux);
    if (
      !(m.area_m2 > 0) ||
      !states.length ||
      states.length > 100 ||
      !Object.hasOwn(m.states_lux, m.default_state)
    )
      errors.push("Solar area and default lighting state must be valid");
    if (
      points.length < 2 ||
      points.length > 100 ||
      points.some(
        (p, i) =>
          !(
            p.illuminance_lux > 0 &&
            p.power_density_w_m2 > 0 &&
            p.voltage_v > 0
          ) ||
          (i && p.illuminance_lux <= points[i - 1].illuminance_lux),
      )
    )
      errors.push(
        "Solar MPP samples must be positive and strictly ordered by lux",
      );
    if (
      states.some(
        (lux) =>
          lux !== 0 &&
          !(
            lux >= points[0]?.illuminance_lux &&
            lux <= points.at(-1)?.illuminance_lux
          ),
      )
    )
      errors.push("Solar lighting must be zero or within the MPP table range");
  }
  if (m.kind === "converter") {
    if (
      canonical(Object.keys(m.outputs).sort()) !==
      canonical(outputs.map((p) => p.id).sort())
    )
      errors.push("Output ports need matching electrical models");
    for (const [id, output] of Object.entries(m.outputs)) {
      if (!(output.efficiency > 0 && output.efficiency <= 1))
        errors.push(`Efficiency of ${id} must be in (0, 1]`);
      if (!(output.voltage_v > 0 && output.max_current_a > 0))
        errors.push(`Output ${id} voltage and limit must be positive`);
    }
  }
  if ("initial_soc" in m && m.initial_soc > 1)
    errors.push("Initial SOC must be in [0, 1]");
  if (
    m.kind === "load" &&
    (!Object.keys(m.states).length || !Object.hasOwn(m.states, m.default_state))
  )
    errors.push("Load default state must exist");
  if (m.kind === "load") {
    const operations = Object.entries(m.operations ?? {});
    if (Object.keys(m.states).length > 100 || operations.length > 100)
      errors.push("Too many load states or operations");
    if (operations.length && m.state_unit !== "W")
      errors.push("Energy operations require W states");
    for (const [name, op] of operations) {
      if (!name.trim() || Object.hasOwn(m.states, name))
        errors.push(
          "Operation names must be nonempty and distinct from states",
        );
      if (!(op.energy_j > 0 && op.duration_s > 0))
        errors.push("Operation energy and duration must be positive");
    }
  }
  return errors;
}
export function validateProfile(profile) {
  if (!validateProjectShape(profile))
    return validateProjectShape.errors.map(
      (e) => `${e.instancePath} ${e.message}`,
    );
  const errors = [];
  if (profile.schema_version !== "0.2") errors.push("Unsupported schema");
  const ids = new Set();
  for (const part of profile.parts) {
    errors.push(...validatePart(part));
    if (ids.has(part.id)) errors.push(`Duplicate part ${part.id}`);
    ids.add(part.id);
    const pin = profile.lock[part.id];
    if (!pin || pin.revision !== part.revision || pin.sha256 !== hash(part))
      errors.push(`Pinned model mismatch: ${part.id}`);
  }
  for (const node of profile.nodes) {
    if (!ids.has(node.part_id))
      errors.push(`Unresolved model: ${node.part_id}`);
    if (
      node.profile_period_s != null &&
      !(Number.isFinite(node.profile_period_s) && node.profile_period_s > 0)
    )
      errors.push(`Invalid profile period: ${node.id}`);
  }
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  if (nodes.size !== profile.nodes.length) errors.push("Duplicate node ID");
  const incoming = new Set();
  for (const event of profile.events) {
    const node = nodes.get(event.node_id);
    if (
      node?.profile_period_s != null &&
      (event.period_s !== node.profile_period_s ||
        event.start_s + event.duration_s > node.profile_period_s + 1e-12)
    )
      errors.push(
        `Activity must fit inside and repeat with profile period: ${event.name}`,
      );
    const model = profile.parts.find((p) => p.id === node?.part_id)?.model;
    if (
      model?.kind === "solar" &&
      !Object.hasOwn(model.states_lux, event.state)
    )
      errors.push(`Unknown solar lighting state: ${event.state}`);
  }
  const storageOwners = new Set(),
    storageTargets = new Set();
  const modelFor = (id) =>
    profile.parts.find((p) => p.id === nodes.get(id)?.part_id);
  for (const edge of profile.edges) {
    const a = modelFor(edge.from.node),
      b = modelFor(edge.to.node);
    const ap = a?.ports.find((p) => p.id === edge.from.port),
      bp = b?.ports.find((p) => p.id === edge.to.port);
    if (ap?.type === "power_storage" || bp?.type === "power_storage") {
      if (
        ap?.type !== "power_storage" ||
        bp?.type !== "power_storage" ||
        a?.model.kind !== "load" ||
        !a.model.harvester ||
        b?.model.kind !== "storage"
      )
        errors.push("Invalid storage connection");
      else {
        if (
          storageOwners.has(edge.from.node) ||
          storageTargets.has(edge.to.node)
        )
          errors.push("Storage requires one owner and one store");
        storageOwners.add(edge.from.node);
        storageTargets.add(edge.to.node);
        const h = a.model.harvester,
          t = b.model.store;
        const battery = t.type === "battery",
          max = battery ? t.full_voltage_v : t.rated_voltage_v;
        const initial = battery
          ? t.empty_voltage_v +
            (t.full_voltage_v - t.empty_voltage_v) * t.initial_soc
          : t.initial_voltage_v;
        if (
          initial > h.max_storage_v ||
          ((!battery || t.rechargeable) && max < h.charge_stop_v) ||
          (battery &&
            (h.restart_v <= t.empty_voltage_v ||
              h.min_storage_v >= t.full_voltage_v))
        )
          errors.push("Incompatible storage voltage");
      }
      continue;
    }
    for (const [endpoint, direction] of [
      [edge.from, "power_out"],
      [edge.to, "power_in"],
    ]) {
      const node = nodes.get(endpoint.node);
      const part = profile.parts.find((p) => p.id === node?.part_id);
      const port = part?.ports.find((p) => p.id === endpoint.port);
      if (!port) errors.push(`Unknown port ${endpoint.node}.${endpoint.port}`);
      else if (port.type !== direction)
        errors.push(`Invalid port direction ${endpoint.node}.${endpoint.port}`);
    }
    if (incoming.has(edge.to.node))
      errors.push(`Multiple inputs to ${edge.to.node}`);
    incoming.add(edge.to.node);
  }
  return errors;
}
function officialUrl(url, domains) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      domains.some(
        (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
      )
    );
  } catch {
    return false;
  }
}
export function validateVendor(vendor) {
  if (!validateVendorShape(vendor))
    return validateVendorShape.errors.map(
      (e) => `${e.instancePath} ${e.message}`,
    );
  const errors = [];
  if (
    vendor.source_domains.some(
      (d) => !/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(d),
    )
  )
    errors.push("Invalid source domain");
  if (!officialUrl(vendor.website, vendor.source_domains))
    errors.push("Vendor website must match a declared source domain");
  return errors;
}
export function validateCatalog(catalog, vendor, part = null) {
  if (!validateCatalogShape(catalog))
    return validateCatalogShape.errors.map(
      (e) => `${e.instancePath} ${e.message}`,
    );
  const errors = [];
  if (
    !vendor ||
    catalog.vendor !== vendor.id ||
    catalog.id.split("/")[0] !== vendor.id
  )
    errors.push("Catalog vendor and ID must match a registered vendor");
  const sources = new Map();
  for (const source of catalog.sources) {
    if (sources.has(source.id))
      errors.push(`Duplicate source ID: ${source.id}`);
    sources.set(source.id, source);
    if (vendor && !officialUrl(source.url, vendor.source_domains))
      errors.push(
        `Source must use a declared manufacturer domain: ${source.id}`,
      );
    const day = new Date(`${source.reviewed_on}T00:00:00Z`);
    if (
      Number.isNaN(day.valueOf()) ||
      day.toISOString().slice(0, 10) !== source.reviewed_on
    )
      errors.push(`Invalid review date: ${source.id}`);
  }
  const checkSource = (entry) => {
    const source = sources.get(entry.source);
    if (!source) errors.push(`Unknown source: ${entry.source}`);
    else if (source.access !== "reviewed")
      errors.push(
        `Electrical and pin data require a reviewed source: ${entry.id}`,
      );
  };
  const uniqueIds = (entries, label) => {
    const ids = new Set();
    for (const entry of entries) {
      if (ids.has(entry.id)) errors.push(`Duplicate ${label} ID: ${entry.id}`);
      ids.add(entry.id);
    }
    return ids;
  };
  uniqueIds(catalog.pins.entries, "pin");
  const numbers = new Set();
  for (const pin of catalog.pins.entries) {
    checkSource(pin);
    for (const number of pin.package_pins) {
      if (!number.trim() || numbers.has(number))
        errors.push(`Duplicate or empty package pin: ${number}`);
      numbers.add(number);
    }
  }
  if (catalog.pins.status === "partial") {
    if (!catalog.pins.package?.trim() || !catalog.pins.entries.length)
      errors.push("Partial pin mappings require a package and pin entries");
  } else if (catalog.pins.entries.length || catalog.pins.package !== null)
    errors.push("Uncharacterized pins must not claim a package mapping");
  if (catalog.radio) {
    const radio = catalog.radio;
    const phys = uniqueIds(radio.phys, "PHY");
    uniqueIds(radio.operating_points, "operating point");
    for (const phy of radio.phys) {
      checkSource(phy);
      if (!radio.protocols.includes(phy.protocol))
        errors.push(`Undeclared protocol: ${phy.protocol}`);
    }
    for (const point of radio.operating_points) {
      checkSource(point);
      if (
        point.power_basis === "derived_vi" ||
        (point.power_w !== undefined && point.current_a !== undefined)
      ) {
        if (
          point.supply_voltage_v === undefined ||
          point.current_a === undefined
        )
          errors.push(
            `Power conversion requires voltage and current: ${point.id}`,
          );
        else if (
          Math.abs(point.power_w - point.supply_voltage_v * point.current_a) >
          Math.max(1e-15, Math.abs(point.power_w) * 1e-9)
        )
          errors.push(`Power must equal voltage times current: ${point.id}`);
      }
      if (point.phy !== null && !phys.has(point.phy))
        errors.push(`Unknown PHY: ${point.phy}`);
      if (point.mode !== "tx" && point.tx_power_dbm !== null)
        errors.push(`TX power is only valid for TX: ${point.id}`);
      if (["sleep", "cpu"].includes(point.mode) && point.phy !== null)
        errors.push(`Non-radio mode cannot specify a PHY: ${point.id}`);
    }
  }
  const runnable = catalog.simulation.status === "runnable_approximation";
  if (runnable) {
    if (catalog.simulation.model_file !== "part.json" || !part)
      errors.push("Runnable catalog entry requires part.json");
    else {
      if (part.id !== catalog.id)
        errors.push("Catalog and model IDs must match");
      errors.push(...validatePart(part));
      for (const port of part.ports) {
        for (const number of port.package_pins) {
          const pin = catalog.pins.entries.find((p) =>
            p.package_pins.includes(number),
          );
          const direction = port.type === "power_in" ? "input" : "output";
          if (
            !pin ||
            pin.name !== port.name ||
            pin.direction !== direction ||
            pin.role !== "power"
          )
            errors.push(
              `Model power port must match a catalog power pin: ${port.id}.${number}`,
            );
        }
      }
    }
  } else if (catalog.simulation.model_file !== null || part)
    errors.push("Catalog-only entry cannot publish a runnable model");
  return errors;
}
export function validatePreset(preset, characterization, part = null) {
  if (!validatePresetShape(preset))
    return validatePresetShape.errors.map(
      (e) => `${e.instancePath} ${e.message}`,
    );
  const errors = [];
  const c = characterization;
  const operation = c?.operations?.find((o) => o.id === "full_refresh");
  const idle = c?.states?.find((s) => s.id === preset.idle_state);
  if (!c || c.part_id !== preset.id || !operation || !idle)
    return ["Preset requires matching characterization"];
  if (
    preset.operation.energy_j !== operation.energy_j ||
    preset.operation.duration_s !== operation.duration_s ||
    preset.idle_power_w !== idle.power_w
  )
    errors.push(
      "Preset energy, duration and idle power must match characterization",
    );
  if (
    Math.abs(operation.power_w * operation.duration_s - operation.energy_j) >
    1e-12
  )
    errors.push("Derived refresh energy must equal power times duration");
  if (canonical(preset.input_voltage_v) !== canonical(c.input_voltage_v))
    errors.push("Preset voltage must match characterization");
  const v = preset.input_voltage_v;
  if (!(v.min <= v.typical && v.typical <= v.max))
    errors.push("Invalid preset voltage range");
  if (
    preset.source_url !== c.sources[0].url ||
    !preset.source_note.includes(c.sources[0].date)
  )
    errors.push("Preset must preserve the reviewed source and date");
  if (
    preset.specification_status !==
    (operation.classification.includes("tentative") ? "tentative" : "typical")
  )
    errors.push("Preset must preserve tentative status");
  if (preset.idle_power_w === null) {
    if (part) errors.push("Unknown idle power cannot publish a runnable part");
  } else if (
    !part ||
    part.model.states?.[preset.idle_state] !== preset.idle_power_w ||
    canonical(part.model.operations?.full_refresh) !==
      canonical(preset.operation)
  )
    errors.push("Runnable display model must match the preset");
  return errors;
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
export function validateSolarCharacterization(part, characterization) {
  const c = characterization,
    errors = [];
  if (!c || c.part_id !== part.id)
    return ["Solar model requires matching characterization"];
  if (canonical(c.mpp_samples ?? null) !== canonical(part.model.curve))
    errors.push("Solar MPP samples must match characterization");
  if (
    !c.source?.url?.startsWith("https://") ||
    !c.source?.revision ||
    !/^[a-f0-9]{64}$/.test(c.source?.sha256 ?? "")
  )
    errors.push("Solar source requires a revision, URL and SHA-256");
  if (
    !Number.isFinite(c.conditions?.temperature_c) ||
    !c.conditions?.illuminant
  )
    errors.push("Solar measurement conditions are required");
  for (let i = 0; i < part.model.curve.length; i++) {
    for (const field of [
      "illuminance_lux",
      "power_density_w_m2",
      "voltage_v",
    ]) {
      if (!part.provenance[`curve.${i}.${field}`]?.note.includes(c.source?.url))
        errors.push("Solar curve evidence must cite the characterized source");
    }
  }
  return errors;
}
export function validateVault(vaultRoot = root) {
  const root = vaultRoot;
  const errors = [],
    index = [],
    catalog = [],
    vendors = [],
    ids = new Set(),
    vendorMap = new Map(),
    partMap = new Map();
  const paths = files(resolve(root, "vendor"));
  const read = (path) => {
    try {
      if (statSync(path).size > 256 * 1024) throw new Error("exceeds 256 KB");
      return JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      errors.push(`${relative(root, path)}: ${e.message}`);
      return null;
    }
  };
  for (const path of paths.filter((p) => p.endsWith("/vendor.json"))) {
    const vendor = read(path);
    if (!vendor) continue;
    const problems = validateVendor(vendor);
    if (
      relative(root, path).replaceAll("\\", "/") !==
      `vendor/${vendor.id}/vendor.json`
    )
      problems.push("Path must match vendor ID");
    if (vendorMap.has(vendor.id))
      problems.push(`Duplicate vendor ID: ${vendor.id}`);
    errors.push(...problems.map((e) => `${relative(root, path)}: ${e}`));
    if (!problems.length) {
      vendorMap.set(vendor.id, vendor);
      vendors.push({
        id: vendor.id,
        name: vendor.name,
        aliases: vendor.aliases,
        path: relative(root, path),
      });
    }
  }
  for (const path of paths.filter((p) => p.endsWith("/part.json"))) {
    const part = read(path);
    if (!part) continue;
    const problems = validatePart(part);
    if (!problems.length && part.model.kind === "solar") {
      const characterization = read(resolve(path, "../characterization.json"));
      problems.push(...validateSolarCharacterization(part, characterization));
    }
    if (ids.has(part.id)) problems.push(`Duplicate part ID ${part.id}`);
    ids.add(part.id);
    if (typeof part.id !== "string" || !vendorMap.has(part.id.split("/")[0]))
      problems.push("Unregistered model vendor");
    if (
      relative(root, path).replaceAll("\\", "/") !==
      `vendor/${part.id}/part.json`
    )
      problems.push("Path must match vendor/part ID");
    errors.push(...problems.map((e) => `${relative(root, path)}: ${e}`));
    if (problems.length) continue;
    partMap.set(part.id, part);
    index.push({
      id: part.id,
      name: part.name,
      kind: part.model.kind,
      revision: part.revision,
      sha256: hash(part),
      path: relative(root, path),
    });
  }
  const catalogIds = new Set();
  for (const path of paths.filter((p) => p.endsWith("/catalog.json"))) {
    const entry = read(path);
    if (!entry) continue;
    const problems = validateCatalog(
      entry,
      vendorMap.get(entry.vendor),
      partMap.get(entry.id),
    );
    if (
      relative(root, path).replaceAll("\\", "/") !==
      `vendor/${entry.id}/catalog.json`
    )
      problems.push("Path must match catalog ID");
    if (catalogIds.has(entry.id))
      problems.push(`Duplicate catalog ID: ${entry.id}`);
    catalogIds.add(entry.id);
    errors.push(...problems.map((e) => `${relative(root, path)}: ${e}`));
    if (!problems.length)
      catalog.push({
        id: entry.id,
        vendor: entry.vendor,
        name: entry.name,
        category: entry.category,
        aliases: entry.aliases,
        protocols: entry.radio?.protocols ?? [],
        status: entry.simulation.status,
        path: relative(root, path),
        model: index.find((p) => p.id === entry.id) ?? null,
        ...(existsSync(resolve(root, `vendor/${entry.id}/preset.json`))
          ? { preset: `vendor/${entry.id}/preset.json` }
          : {}),
      });
  }
  for (const path of paths.filter((p) => p.endsWith("/preset.json"))) {
    const preset = read(path);
    if (!preset) continue;
    const characterization = read(resolve(path, "../characterization.json"));
    const problems = validatePreset(
      preset,
      characterization,
      partMap.get(preset.id),
    );
    if (
      relative(root, path).replaceAll("\\", "/") !==
      `vendor/${preset.id}/preset.json`
    )
      problems.push("Path must match preset ID");
    if (!catalogIds.has(preset.id))
      problems.push("Preset requires a catalog entry");
    errors.push(...problems.map((e) => `${relative(root, path)}: ${e}`));
  }
  for (const id of partMap.keys())
    if (!id.startsWith("example/") && !catalogIds.has(id))
      errors.push(`Manufacturer model requires catalog.json: ${id}`);
  for (const path of files(resolve(root, "profiles")).filter((p) =>
    p.endsWith(".json"),
  )) {
    if (statSync(path).size > 2 * 1024 * 1024) {
      errors.push(`${path}: exceeds 2 MB`);
      continue;
    }
    const p = JSON.parse(readFileSync(path, "utf8"));
    errors.push(
      ...validateProfile(p).map((e) => `${relative(root, path)}: ${e}`),
    );
  }
  for (const path of files(resolve(root, "settings")).filter((p) =>
    p.endsWith(".json"),
  )) {
    const settings = JSON.parse(readFileSync(path, "utf8"));
    if (!validateSettingsShape(settings)) {
      errors.push(
        `${relative(root, path)}: ${ajv.errorsText(validateSettingsShape.errors)}`,
      );
      continue;
    }
    if (!existsSync(resolve(root, settings.profile)))
      errors.push(`${path}: profile does not exist`);
  }
  const sort = (entries) => entries.sort((a, b) => a.id.localeCompare(b.id));
  return {
    errors,
    index: sort(index),
    catalog: sort(catalog),
    vendors: sort(vendors),
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { errors, index, catalog, vendors } = validateVault();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else if (process.argv.includes("--index")) {
    mkdirSync(resolve(root, "index"), { recursive: true });
    writeFileSync(
      resolve(root, "index/generated-index.json"),
      JSON.stringify({ schema_version: "0.1", parts: index }, null, 2) + "\n",
    );
    writeFileSync(
      resolve(root, "index/catalog-index.json"),
      JSON.stringify(
        { schema_version: "0.1", vendors, products: catalog },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Indexed ${index.length} valid parts and ${catalog.length} catalog products.`,
    );
  } else
    console.log(
      `Valid vault: ${index.length} parts, ${catalog.length} catalog products; schemas, sources, pins, provenance, locks, profiles, and settings checked.`,
    );
}
