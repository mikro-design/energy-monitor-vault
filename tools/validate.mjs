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
  validateSettingsShape = schema("settings");
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
    switch: [1, 1],
    load: [1, 0],
  };
  const count = counts[part.model.kind];
  if (
    count
      ? inputs.length !== count[0] || outputs.length !== count[1]
      : inputs.length !== 1 || outputs.length < 1 || outputs.length > 16
  )
    errors.push("Ports do not match the model family");
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
  for (const node of profile.nodes)
    if (!ids.has(node.part_id))
      errors.push(`Unresolved model: ${node.part_id}`);
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  if (nodes.size !== profile.nodes.length) errors.push("Duplicate node ID");
  const incoming = new Set();
  for (const edge of profile.edges) {
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
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
export function validateVault() {
  const errors = [],
    index = [],
    ids = new Set();
  for (const path of files(resolve(root, "vendors")).filter((p) =>
    p.endsWith("/part.json"),
  )) {
    if (statSync(path).size > 256 * 1024) {
      errors.push(`${path}: exceeds 256 KB`);
      continue;
    }
    const part = JSON.parse(readFileSync(path, "utf8"));
    const problems = validatePart(part);
    if (ids.has(part.id)) problems.push(`Duplicate part ID ${part.id}`);
    ids.add(part.id);
    if (
      relative(root, path).replaceAll("\\", "/") !==
      `vendors/${part.id}/part.json`
    )
      problems.push("Path must match vendor/part ID");
    errors.push(...problems.map((e) => `${relative(root, path)}: ${e}`));
    index.push({
      id: part.id,
      name: part.name,
      kind: part.model.kind,
      revision: part.revision,
      sha256: hash(part),
      path: relative(root, path),
    });
  }
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
  return { errors, index: index.sort((a, b) => a.id.localeCompare(b.id)) };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { errors, index } = validateVault();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else if (process.argv.includes("--index")) {
    mkdirSync(resolve(root, "index"), { recursive: true });
    writeFileSync(
      resolve(root, "index/generated-index.json"),
      JSON.stringify({ schema_version: "0.1", parts: index }, null, 2) + "\n",
    );
    console.log(`Indexed ${index.length} valid parts.`);
  } else
    console.log(
      `Valid vault: ${index.length} parts; schemas, provenance, locks, profiles, and settings checked.`,
    );
}
