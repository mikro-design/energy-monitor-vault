# Indoor electronic shelf label

Requirements extracted from the user-supplied application discussion on 2026-10-06. These are design inputs, not manufacturer specifications or measured system results. The source correspondence is not redistributed.

The target system combines indoor PV, a supercapacitor or rechargeable cell, ONiO.zero and an EINK/e-paper display. Compare harvested energy, display refreshes and radio listening/transmission over realistic store opening, night and weekend lighting. Radio synchronization/listening can occur independently of display updates.

The discussion suggests approximately 20–30 µW/cm² at 500 lux, approximately linear over 50–1000 lux, with around 5 cm² of PV in a 2.1-inch label. That gives an illustrative 100–150 µW before conversion/storage losses at 500 lux. It is not an Exeger part characterization; PV material, spectrum, orientation, geometry and measured light profiles are still needed. Do not assume that illumination is continuous or extrapolate the stated approximation outside its range.

The discussion references 2–4 display updates per day. This is a comparison range, not a fixed traffic schedule or a measured energy-neutral result. BLE PAwR is a requested scenario; support and qualification statements in the correspondence are historical, not current certification evidence. Explicit ONiO TX/RX states do not implement PAwR packet scheduling or predict network capacity.

[Display intake](../vendor/example/eink-display/characterization.json) retains missing values as null until the user supplies them. It is not a runnable part or a manufacturer catalog record.

## Display accounting

Add a separate display load beside the ONiO load. Enter full-refresh average input power including the display controller/driver, refresh duration and whole-module standby power. Keep display power in µW in the editor and W in JSON. The app's **Add component → EINK display** flow asks for these values one at a time and creates a full-refresh event. No display manufacturer or electrical values have yet been supplied for this project.

For one refresh, energy is average refresh power × duration. Across a horizon T with N non-overlapping refreshes of duration t, display energy is `N × P_refresh × t + P_standby × (T − N × t)`. Refresh power already includes standby consumption during the refresh. Partial refresh needs its own characterized power and duration; do not scale full-refresh energy by pixel fraction without evidence.

ONiO image preparation and SPI transfer use explicit CPU events. Display refresh can overlap ONiO sleep or radio events because it is a separate load. CPU/radio combined states on ONiO still need characterization. Power-off leakage, cold start, temperature, waveform/color dependence and supply limits need separate data. Logical display input names are placeholders until a selected module provides exact vendor pin names/numbers; SPI/control wiring is not yet supported by the power engine.

## Remaining system model

The existing ONiO profile exercises consumption from an ideal supply. It does not yet solve photovoltaic harvesting, MPPT, supercapacitor charge/discharge, storage leakage, nighttime reserve, cold start or brownout recovery. Integrated hardware power management should not create invented CPU maintenance events; hardware losses still need characterization. External display/radio rail losses must be counted once at their actual power path.

A complete comparison needs a daily/weekend lux schedule, PV performance data, chosen storage capacity/voltage/leakage, conversion efficiency, display refresh data and update cadence, and radio receive/synchronization/response schedules. Compare minimum stored energy, unserved operations, brownouts and recovery in addition to daily average power. The current load-only approximation cannot establish batteryless feasibility.
