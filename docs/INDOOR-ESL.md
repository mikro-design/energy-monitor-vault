# Indoor electronic shelf label

Requirements extracted from the user-supplied application discussion on 2026-10-06. These are design inputs, not manufacturer specifications or measured system results. The source correspondence is not redistributed.

The target system combines indoor PV, a supercapacitor or rechargeable cell, ONiO.zero and an EINK/e-paper display. Compare harvested energy, display refreshes and radio listening/transmission over realistic store opening, night and weekend lighting. Radio synchronization/listening can occur independently of display updates.

## Latest application targets

The final request in the supplied thread, dated **2026-09-24** (PDF page 20), supersedes the earlier illustrative 2–4 display updates/day assumption. These remain tentative application targets:

| Input | Starting case |
| --- | --- |
| Indoor PV area | Approximately 5 cm² |
| Normal low-light level | Approximately 200 lux; daily illuminated hours remain unspecified |
| Display size | 2–4 inch diagonal; the three selected 2.13-inch presets are comparison alternatives |
| Radio activity | 1,000–5,000 BLE PAwR RX/TX events per tag per day; event definition, airtime and timing remain unspecified |
| Display updates | One per day as the initial maximum case; one per week as the lower-activity case |
| Initial storage alternative | 10–20 F hybrid lithium supercapacitor, restricted to 2.5–4.0 V |
| Second storage alternative | Supercapacitor plus rechargeable lithium cell; hardware topology and cell characteristics remain unspecified |
| No-light tolerance | At least 48 hours; also explore several-day outages |
| Recovery requirement | One complete display update after light returns; permitted recharge delay remains unspecified |

Daily radio counts do not define a radio energy cost: RX windows, TX airtime, synchronization, retries and any image-transfer burst must be accounted for separately. For an initial uniformly spaced schedule only, 1,000 and 5,000 events/day correspond to 86.4 s and 17.28 s intervals; these are scenario assumptions, not a PAwR implementation.

The earlier discussion suggests approximately 20–30 µW/cm² at 500 lux, approximately linear over 50–1000 lux. With 5 cm², this implies a provisional **40–60 µW at 200 lux**, before conversion/storage losses. This scaling is an initial estimate from the correspondence, not an Exeger part characterization. For Exeger, the reviewed public tables now give **62 µW (Indoor)** and **27 µW (Hybrid)** at 5 cm² and 200 lux under their 25 °C YUJI D50 conditions. Use these source-qualified models when selecting Exeger, rather than the generic correspondence estimate. See [Exeger records](../vendor/exeger/README.md). Spectrum, orientation, geometry and the actual installation light profile still need confirmation. Do not assume continuous illumination.

BLE PAwR is requested. Support and qualification statements in the correspondence are historical, not current certification evidence. Explicit ONiO TX/RX states do not implement PAwR packet scheduling or predict network capacity.

[Custom display intake](../vendor/example/eink-display/characterization.json) retains unknown values as null. It is a template rather than a runnable part.

The user selected all three [researched display presets](EINK-DATASHEETS.md): Good Display GDEY0213B74 and GDEY0213F51, plus tentative Pervasive E2213KS0E1. Keep exact model/revision and conditions attached to each alternative.

## Display accounting

Add a separate display load beside the ONiO load. Choose one of the three vendor presets or enter custom full-refresh energy, duration and standby power one at a time. Use nJ/µJ/mJ for energy, seconds for duration and µW for idle power; JSON retains J, s and W. The app creates a full-refresh event. Pervasive requires an explicit idle-power value; zero is never silently assumed.

For one refresh, average power is energy / scheduled duration. Across a horizon T with N complete, non-overlapping refreshes of duration t, display energy is `N × E_refresh + P_idle × (T − N × t)`. Refresh energy already includes baseline consumption during the refresh. Partial refresh needs its own characterized energy and duration; do not scale full-refresh energy by pixel fraction without evidence.

ONiO image preparation and SPI transfer use explicit CPU events. Display refresh can overlap ONiO sleep or radio events because it is a separate load. CPU/radio combined states on ONiO still need characterization. Power-off leakage, cold start, temperature, waveform/color dependence and supply limits need separate data. The selected presets expose a logical tied supply input with vendor supply names; exact FPC mapping stays in characterization. SPI/control wiring is not yet supported by the power engine.

## Remaining system model

The existing ONiO profile exercises consumption from an ideal supply. It does not yet solve photovoltaic harvesting, MPPT, supercapacitor charge/discharge, storage leakage, nighttime reserve, cold start or brownout recovery. Integrated hardware power management should not create invented CPU maintenance events; hardware losses still need characterization. External display/radio rail losses must be counted once at their actual power path.

A complete comparison needs a daily/weekend lux schedule, PV performance data, chosen storage capacity/voltage/leakage, conversion efficiency, display refresh data and update cadence, and radio receive/synchronization/response schedules. Compare minimum stored energy, unserved operations, brownouts and recovery in addition to daily average power. The current solar/load approximation has no charging or storage dynamics and cannot establish batteryless feasibility.

## Scenario setup order

1. Set the daily lighting schedule: illuminated hours at 200 lux, then the off-hours light level. Add a separate continuous 48-hour zero-light test and a longer-outage comparison.
2. Choose the cell: at 5 cm² and 200 lux, Exeger Indoor provides 62 µW and Hybrid 27 µW of raw MPP power under the published conditions. The earlier 40–60 µW estimate remains a generic alternative, not an Exeger specification.
3. Define storage at 10 and 20 F with the 2.5–4.0 V window, starting charge, leakage, losses and charge/discharge behavior. A real hybrid device needs part-specific characterization; any constant-capacitance approximation must be labeled. Keep its storage voltage separate from the ONiO/device supply rails. Add the rechargeable-cell alternative once its power path and cell data are known.
4. Define what one radio event contains, then compare 1,000 and 5,000 events/day using the existing ONiO power/transition data. Specify whether radio activity continues, slows or stops during darkness.
5. Compare all three display presets with daily and weekly updates. Include CPU/image transfer work, then schedule one recovery refresh after illumination returns. Set the allowed recovery delay explicitly.
6. Inspect harvested/consumed energy, storage voltage, minimum reserve, unmet operations and recovery time. A full refresh succeeds only when the supply can sustain the whole operation; average energy alone does not establish this.

The current app can configure ONiO/display loads, Exeger area/illumination and timed lighting, and report available/supplied/unused/unserved solar energy. Harvesting dynamics, storage and energy-aware scheduling still require implementation; these requirements are not an executable project profile.
