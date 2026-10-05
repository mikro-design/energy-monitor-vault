# Energy Monitor Vault

Device profiles, declarative component models, and workspace settings for [Energy Monitor](https://github.com/mikro-design/energy-monitor). This repository is usable independently of the application. Git commits identify registry revisions; component content is pinned with SHA-256 over RFC 8785 canonical JSON.

The environmental-sensor and dual-output-sensor designs are illustrative. Every electrical value is marked `estimated`, and none is a verified manufacturer specification.

## Manufacturer starter set

20 product records are organized under the singular `vendor/` directory:

| Manufacturer                                        | Products                                       |
| --------------------------------------------------- | ---------------------------------------------- |
| [ONiO](vendor/onio)                                 | ONiO.zero                                      |
| [Exeger](vendor/exeger)                             | Powerfoyle Indoor, Hybrid                      |
| [Nordic Semiconductor](vendor/nordic-semiconductor) | nRF52832, nRF52840, nRF54L15, nPM1300          |
| [Texas Instruments](vendor/texas-instruments)       | TPS62740, TPS62840, TPS63900, BQ25570, CC2652R |
| [Analog Devices](vendor/analog-devices)             | ADP5300, ADP5091, LTC3108, LTC3331             |
| [Microchip](vendor/microchip)                       | MCP1700, MCP1640, MCP73831, PIC16LF18313       |

**Four runnable approximations:** nRF52840, TPS62740, ADP5300 and PIC16LF18313. The other 16 records are catalog-only, with missing characterization or engine capabilities stated explicitly. No product is presented as a complete manufacturer-validated simulation. See [catalog scope and evidence](docs/CATALOG.md).

Open [the nRF52840 radio-state profile](profiles/nrf52840-radio-states.json) in the app to exercise explicit BLE/802.15.4 states. Packet timing is illustrative; [automatic radio traffic generation is a proposed extension](https://github.com/mikro-design/energy-monitor/blob/main/docs/RADIO.md).

## Layout

- `vendor/<vendor>/vendor.json`: manufacturer identity, aliases and official source domains.
- `vendor/<vendor>/<part>/catalog.json`: sourced product metadata, reviewed pin subsets, radio capabilities and modeling status.
- `vendor/<vendor>/<part>/part.json`: reusable electrical models, logical power port names/directions and reviewed package mappings where applicable, and field-level provenance.
- `profiles/*.json`: project instances, wiring, activity, embedded model snapshots, and their content locks.
- `settings/*.json`: device workspace display preferences. Storage is ready; automatic application of these preferences in the web app is planned.
- `schemas/`: JSON Schema 2020-12 documents. Part/project/activity schemas are generated from the application's Rust types.
- `index/generated-index.json`: runnable model metadata; `index/catalog-index.json`: all catalog products and vendor aliases. Regenerate after changes.
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

See [CONTRIBUTING.md](CONTRIBUTING.md) for the model contribution workflow. Example data explicitly declares CC0-1.0; authored runnable manufacturer model records also declare CC0-1.0. Linked datasheets retain their own rights. No repository-wide software license is assigned by this scaffold.

## Power ports (schema 0.2)

Part definitions contain `ports`: stable `id`, exact vendor `name`, `type` (`power_in`/`power_out`), and `package_pins` (strings; empty when unspecified). Profiles connect `{node, port}` endpoints. Converter models use `outputs[port_id]` for each rail's voltage, efficiency, current limit, and enable state; input IQ is shared. Names are displayed verbatim and do not serve as wiring IDs.

Keep vendor labels faithful to the applicable datasheet and package variant. The sample labels are illustrative; they do not claim manufacturer verification. Ground/return is currently implicit. Control/signal pins and multiple power inputs are not supported by the engine; catalog records can describe these pin roles independently.

See the application's [port contract and migration instructions](https://github.com/mikro-design/energy-monitor/blob/main/docs/PORTS.md). JSON remains canonical; XML interchange is not implemented.
