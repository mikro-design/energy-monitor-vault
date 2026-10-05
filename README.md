# Energy Monitor Vault

Device profiles, declarative component models, and workspace settings for [Energy Monitor](https://github.com/mikro-design/energy-monitor). This repository is usable independently of the application. Git commits identify registry revisions; component content is pinned with SHA-256 over RFC 8785 canonical JSON.

The initial environmental-sensor design is illustrative. Every electrical value is marked `estimated`, and none is a verified manufacturer specification.

## Layout

- `vendors/<vendor>/<part>/part.json`: reusable electrical models and field-level provenance.
- `profiles/*.json`: project instances, wiring, activity, embedded model snapshots, and their content locks.
- `settings/*.json`: device workspace display preferences. Storage is ready; automatic application of these preferences in the web app is planned.
- `schemas/`: JSON Schema 2020-12 documents. Part/project/activity schemas are generated from the application's Rust types.
- `index/generated-index.json`: derived searchable metadata; regenerate after changing models.
- `tools/validate.mjs`: shape, SI range, provenance, uniqueness, and content-lock checks. Numerical simulation remains in Rust.

## Validate

Requires Node 22 or later.

```sh
npm ci
npm run validate
npm test
npm run index
```

Validate the topology and run a profile with the application CLI:

```sh
cargo run --manifest-path ../energy-monitor/Cargo.toml -p energy-cli -- validate profiles/environmental-sensor.json
```

You can also open a profile JSON file through the web application's project menu. The current app bundles one example and does not automatically synchronize this remote repository.

Changes to library models do not change an existing profile's embedded model snapshot. Updating a profile requires deliberately copying the new definition, updating its revision/content hash, and comparing before/after simulation results.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the model contribution workflow. Example data explicitly declares CC0-1.0; no repository-wide software license is assigned by this scaffold.
