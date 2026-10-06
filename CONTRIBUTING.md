# Contributing a model

1. Register the manufacturer in `vendor/<vendor>/vendor.json` and create a sourced `catalog.json` with explicit pin/radio characterization status (see [catalog contract](docs/CATALOG.md)). Keep unsupported products `catalog_only`. For a runnable model, add `vendor/<vendor>/<part>/part.json` with a unique stable ID and model revision.
2. Declare schema 0.2 and each power port with a stable ID, exact datasheet pin name/direction, and known package pins. Logical circuit rails without a physical output pin use an empty package-pin list; document external components and the abstraction. Supply one output model per converter output port. Use an engine-supported declarative model. Store electrical values in SI base units; keep project wiring and activity in a profile.
3. Give every simulation-affecting field a provenance entry. Record the actual source, page or measurement method, operating conditions, and applicable rights. Do not label an estimate as a manufacturer value.
4. Use a license you have the right to grant. Do not copy proprietary datasheet artwork or executable code into models.
5. Run `npm ci`, `npm run validate`, `npm test`, and `npm run index`.
6. For profile changes, run `energy validate` and `energy run` with the application CLI. Check numerical diagnostics and compare the previous result.
7. Open a pull request describing changed values, their evidence, and intended operating range. Maintainers should review the evidence and model behavior before merging.

The current schema supports battery/supply, solar MPP tables and named lighting states, multi-output constant-efficiency converter (one input, up to 16 outputs, shared IQ), switch, and constant-power load states (`state_unit: "W"`) and legacy constant-current states. General I–V/efficiency curves, capacitors, MPPT/charging dynamics, composites, and advanced battery behavior require future engine/schema versions. Model files never execute contributed algorithms.

Solar vendor models require matching `characterization.json` MPP samples, source revision/URL/SHA-256 and measurement spectrum/temperature. Each `curve.<index>.<field>` needs provenance. Samples must be strictly ordered by lux; only table-range states or zero darkness are executable. Absorber area is in m², power density in W/m²; 1 µW/cm² = 0.01 W/m². Converter-reference efficiencies belong in separate metadata until their operating behaviour is modeled.
