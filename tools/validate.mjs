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
  const fields = Object.entries(part.model)
    .filter(([k]) => k !== "kind")
    .flatMap(([k, v]) =>
      typeof v === "object"
        ? Object.entries(v).map(([s, n]) => [`${k}.${s}`, n])
        : [[k, v]],
    );
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
  if ("efficiency" in m && !(m.efficiency > 0 && m.efficiency <= 1))
    errors.push("Efficiency must be in (0, 1]");
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
  if (profile.schema_version !== "0.1") errors.push("Unsupported schema");
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
