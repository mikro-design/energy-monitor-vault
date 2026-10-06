# Energy Monitor Vault

Device profiles, declarative component models, and workspace settings for [Energy Monitor](https://github.com/mikro-design/energy-monitor). This repository is usable independently of the application. Git commits identify registry revisions; component content is pinned with SHA-256 over RFC 8785 canonical JSON.

The environmental-sensor and dual-output-sensor designs are illustrative. Every electrical value is marked `estimated`, and none is a verified manufacturer specification.

## Manufacturer starter set

23 product records are organized under the singular `vendor/` directory:

| Manufacturer                                        | Products                                       |
| --------------------------------------------------- | ---------------------------------------------- |
| [ONiO](vendor/onio)                                 | ONiO.zero                                      |
| [Exeger](vendor/exeger)                             | Powerfoyle Indoor, Hybrid                      |
| [Nordic Semiconductor](vendor/nordic-semiconductor) | nRF52832, nRF52840, nRF54L15, nPM1300          |
| [Texas Instruments](vendor/texas-instruments)       | TPS62740, TPS62840, TPS63900, BQ25570, CC2652R |
| [Analog Devices](vendor/analog-devices)             | ADP5300, ADP5091, LTC3108, LTC3331             |
| [Microchip](vendor/microchip)                       | MCP1700, MCP1640, MCP73831, PIC16LF18313       |
| [Good Display](vendor/good-display) | GDEY0213B74, GDEY0213F51 |
| [Pervasive Displays](vendor/pervasive-displays) | E2213KS0E1 (configurable preset; idle power required) |

**Nine runnable approximations:** ONiO.zero (user-provided power characterization), nRF52840, TPS62740, ADP5300, PIC16LF18313, GDEY0213B74, GDEY0213F51, Exeger Powerfoyle Indoor and Hybrid. The other 14 records are catalog-only, with missing characterization or engine capabilities stated explicitly. No product is presented as a complete manufacturer-validated simulation. See [catalog scope and evidence](docs/CATALOG.md).

Open [the nRF52840 radio-state profile](profiles/nrf52840-radio-states.json) in the app to exercise explicit BLE/802.15.4 states. Packet timing is illustrative; [automatic radio traffic generation is a proposed extension](https://github.com/mikro-design/energy-monitor/blob/main/docs/RADIO.md).

The [ONiO radio-state profile](profiles/onio-radio-states.json) includes user-provided wake, startup, turnaround and sleep-entry costs. The current embedded ONiO model requires engine 0.3.0; adjoining-event accounting has been supported since 0.2.2. See [indoor ESL requirements](docs/INDOOR-ESL.md) for PV, storage, radio scheduling and EINK display intake.

The user-confirmed **VMAIN** storage connection for a capacitor, supercapacitor or battery is recorded in [ONiO characterization](vendor/onio/onio-zero/characterization.json). The user separately confirmed an operating range of **250 mV–3.3 V**, a **2.7 V charging stop voltage**, and a **2.2 V restart voltage**. The user confirmed **85% harvesting input-to-VMAIN efficiency**. Engine 0.3.0 implements capacitor/supercapacitor and approximate storage-battery energy models; harvesting power derives from the source profile and load demand. The minimum operating voltage serves as the modeled cutoff; a separate shutdown threshold and waiting consumption remain uncharacterized. See the [VMAIN example](profiles/onio-vmain-storage.json) and [application storage guide](https://github.com/mikro-design/energy-monitor/blob/main/docs/STORAGE.md).

Engine 0.2.5 supports a per-node `profile_period_s`: all activities on that component must fit within the period and carry the same `period_s`. This lets a daily lighting pattern and a CPU/radio activity pattern repeat independently. See [building profiles](https://github.com/mikro-design/energy-monitor/blob/main/docs/PROFILES.md).

The [Exeger lighting profile](profiles/exeger-indoor-lighting.json) runs a 5 cm² Indoor cell through 200 lux, 500 lux and darkness with ONiO asleep. The current embedded ONiO model requires engine 0.3.0 (solar support began in 0.2.4). [Exeger source records](vendor/exeger/README.md) describe both MPP tables, reference conditions and separate boost data; this example has no storage and is not an overnight-autonomy claim.

## Layout

Four [EINK datasheet research records](docs/EINK-DATASHEETS.md) now sit under `vendor/good-display/`, `vendor/pervasive-displays/` and `vendor/waveshare/`. They retain derived mJ/refresh, timing, conditions, revision-specific pins and unknown values. Three selected displays have `preset.json` records: B74 (31.5 mJ / 3 s), F51 (247.5 mJ / 25 s), and tentative Pervasive E2213KS0E1 (16.56 mJ / 2.4 s). The two Good Display models are runnable; Pervasive requires explicit idle power before a runnable instance can be created. Waveshare remains research-only. Display operations require engine 0.2.3 or later.

- `vendor/<vendor>/vendor.json`: manufacturer identity, aliases and official source domains.
- `vendor/<vendor>/<part>/catalog.json`: sourced product metadata, reviewed pin subsets, radio capabilities and modeling status.
- `vendor/<vendor>/<part>/part.json`: reusable electrical models, logical power port names/directions and reviewed package mappings where applicable, and field-level provenance.
- `vendor/<vendor>/<part>/preset.json`: configurable EINK full-refresh energy/duration, idle power (nullable), source conditions and logical supply names. Validation checks against characterization and any published part.
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

You can also open a profile JSON file through the web application's project menu. The current app bundles environmental-sensor, ONiO and Exeger examples and does not automatically synchronize this remote repository.

Changes to library models do not change an existing profile's embedded model snapshot. Updating a profile requires deliberately copying the new definition, updating its revision/content hash, and comparing before/after simulation results.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the model contribution workflow. Example data explicitly declares CC0-1.0; authored runnable manufacturer model records also declare CC0-1.0. Linked datasheets retain their own rights. No repository-wide software license is assigned by this scaffold.

## Power ports (schema 0.2)

Part definitions contain `ports`: stable `id`, exact vendor `name`, `type` (`power_in`/`power_out`), and `package_pins` (strings; empty when unspecified). Profiles connect `{node, port}` endpoints. Converter models use `outputs[port_id]` for each rail's voltage, efficiency, current limit, and enable state; input IQ is shared. Names are displayed verbatim and do not serve as wiring IDs.

Keep vendor labels faithful to the applicable datasheet and package variant. The sample labels are illustrative; they do not claim manufacturer verification. Ground/return is currently implicit. Control/signal pins and multiple power inputs are not supported by the engine; catalog records can describe these pin roles independently.

See the application's [port contract and migration instructions](https://github.com/mikro-design/energy-monitor/blob/main/docs/PORTS.md). JSON remains canonical; XML interchange is not implemented.

## Power values

The application edits and displays device power in µW. New load models specify `state_unit: "W"` and store state values in watts (10 µW = 0.000010 W). Omitted `state_unit`, or `"A"`, preserves constant-current models and their source data. Current-based models display derived power at the connected nominal input voltage. Selecting fixed-power behavior deliberately converts at that voltage; these two behaviors differ when voltage changes. See [the power contract](https://github.com/mikro-design/energy-monitor/blob/main/docs/POWER.md).

Energy-defined loads add `operations[name] = { energy_j, duration_s }` alongside steady `states`. Events select the operation by name; average power is energy divided by the scheduled duration. Operations replace idle consumption while active. The UI supports nJ/µJ/mJ for energy and µW for idle power. See [display presets and their limits](docs/EINK-DATASHEETS.md).
