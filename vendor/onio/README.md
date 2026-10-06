# ONiO

See [catalog scope and evidence](../../docs/CATALOG.md). Pin mappings are partial; read the package and operating conditions before use.

| Product                             | Category     | Simulation status      |
| ----------------------------------- | ------------ | ---------------------- |
| [ONiO.zero](onio-zero/catalog.json) | wireless_soc | runnable_approximation |

ONiO.zero declares BLE 1M/2M/coded and 2.4 GHz IEEE 802.15.4 capabilities in its [official feature overview](https://www.onio.com/technology.html). Manufacturer-qualified operating points and package pins remain uncharacterized. User-provided powers and timings are recorded separately from official catalog evidence.

[Characterization](onio-zero/characterization.json) and the [runnable model](onio-zero/part.json) contain 19 constant-power states and 10 transition timings. Input range: 250–3000 mV; RAM-retention sleep: 1 µW; CPU: 22 µW/MHz at 4/16/32 MHz (88/352/704 µW). BLE 1M and IEEE 802.15.4 use 4000 µW TX at 0 dBm and 3000 µW RX, with the CPU asleep. Radio-ready power is 500 µW. These whole-device states must not have an extra CPU or sleep baseline added.

CPU wake is 60 µs at 100 µW. Radio startup after CPU wake is 90 µs at 1000 µW for either direction/protocol. Both turnaround directions take 90 µs at 500 µW. Sleep entry is 100 µs at 100 µW. Timings require explicit activity events; the load model does not automatically insert them.

Open the [radio-state profile](../../profiles/onio-radio-states.json) in the app. Its CPU/TX/RX windows are illustrative; transition times use the supplied values. The one-second example consumes 31.91994 µJ from an ideal source. Engine 0.2.2 fixes event-boundary rounding that could otherwise undercount this sequence. [Workspace settings](../../settings/onio-radio-states.json) select dark mode and the power graph; settings ingestion remains planned.

The harvesting input is logical. VMAIN uses the user-confirmed name, with no invented package pin numbers. Engine 0.3.0 models VMAIN storage with 85% harvesting efficiency, 0.25 V modeled cutoff, 2.2 V restart and 2.7 V charging stop within the confirmed 3.3 V maximum. Waiting consumption defaults to an uncharacterized zero estimate. External output rails and battery-chemistry charging remain outside this approximation. See the [indoor shelf-label use case](../../docs/INDOOR-ESL.md) for the display and energy-supply requirements.
