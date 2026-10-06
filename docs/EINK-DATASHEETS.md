# EINK datasheet research

Reviewed 2026-10-06. Energy figures below are calculations from typical electrical and timing values, not directly specified or guaranteed energy per update. Each record retains the publisher, PDF revision/date, reviewed-copy URL, SHA-256, conditions, and a subset of vendor pin names. Manufacturer-authored PDFs hosted by distributors are identified as mirrors. PDFs are not redistributed.

| Vendor / exact model | Reviewed document | Full refresh | Derived refresh energy | Inactive state |
| --- | --- | --- | --- | --- |
| Good Display GDEY0213B74, 2.13-inch monochrome | [Rev. 1.0, 2021-03-17, pp. 8–10](https://files.seeedstudio.com/wiki/Other_Display/213-epaper/GDEY0213B74.pdf) | 10.5 mW × 3 s, 3.0 V / 25 °C | **31.5 mJ** | Deep sleep 3 µW typical; retained-RAM sleep 60 µW derived |
| Good Display GDEY0213F51, 2.13-inch four-colour | [Rev. 1.0, 2023-03-21, pp. 7–9](https://files.seeedstudio.com/wiki/Other_Display/213-quadruple/GDEY0213F51.pdf) | 9.9 mW × 25 s, 3.3 V / 25 °C | **247.5 mJ** | Deep sleep 3 µW typical |
| Pervasive Displays E2213KS0E1, 2.13-inch monochrome | [Tentative, 2023-04-17, pp. 13–14, 17–20](https://static.chipdip.ru/lib/642/DOC050642272.pdf) | 3.0 V × 2.3 mA × 2.4 s, 25 ± 2 °C | **16.56 mJ**, provisional | Not characterized in this intake |
| Waveshare 2.13inch e-Paper (D), archival panel | [Preliminary Rev. 1.0, 2018-01-05, PDF pp. 6, 28, 33](https://files.waveshare.com/upload/5/5b/2.13inch_e-Paper_%28D%29_Datasheet.pdf) | 26.4 mW typical at 3.3 V / 25 °C; duration is TBD | **Unknown** | Deep sleep 6.6 µW derived; retained-RAM sleep 115.5 µW derived |

The Pervasive figure comes from a tentative document and is not a proven efficiency ranking. Its typical peak is 21 mA at 3 V, or 63 mW: storage and supply checks need peak demand as well as total energy. The current manufacturer's [product page](https://www.pervasivedisplays.com/products/2-13-e-ink-displays/) links a flyer rather than a full electrical specification.

The reviewed B74 PDF gives 1.5 s fast refresh and 0.42 s partial refresh, while the [current product page](https://www.good-display.com/product/391.html) advertises 0.3 s partial refresh. It does not supply separate mode power figures; fast/partial energies remain null. The PDF recommends a full refresh after five fast/partial operations. These timings and housekeeping requirements must stay attached to the selected waveform/revision.

Keep F51 and F52 separate: the [older F51 document landing page](https://www.good-display.com/companyfile/1000.html) still names F51, while [product/463.html](https://www.good-display.com/product/463.html) now names F52. This research does not apply F52 timing to F51 power. The old Waveshare D panel document likewise cannot inherit timing or standby figures from another panel or a current adapter-board page.

For the simulator, use `energy_j` per named refresh operation and retain `duration_s`, refresh mode, test voltage/temperature, and measurement scope. Derive average `power_w = energy_j / duration_s` only when both are known. Keep sleep, retained-RAM idle and powered-off leakage as distinct power states. Host CPU/SPI work, upstream conversion and optional adapter-board losses need their own accounting.

Pin metadata is model-specific too: B74 uses `VCI`, `VDDIO`, `BUSY`, `RES#`, `D/C#`, `CS#`; F51 uses `VDD`, `VDDIO`, `BUSY_N`, `RST_N`, `DC`, `CSB`. These are not interchangeable labels. The records preserve supply directions and FPC positions; booster/capacitor nodes are not modeled as ordinary supply outputs.

## Structured records

- [GDEY0213B74](../vendor/good-display/gdey0213b74/characterization.json)
- [GDEY0213F51](../vendor/good-display/gdey0213f51/characterization.json)
- [E2213KS0E1](../vendor/pervasive-displays/e2213ks0e1/characterization.json)
- [Waveshare 2018 D panel](../vendor/waveshare/epaper-213-d-2018/characterization.json)

The user selected **all three** B74, F51 and E2213KS0E1 models for support. Each has a validated sibling `preset.json` with full-refresh energy, nominal duration, source conditions, supply names and nullable idle power. B74 and F51 also publish `part.json` with `deep_sleep` at 3 µW and `operations.full_refresh`. They assume the controller enters deep sleep between updates. Pervasive remains catalog-only until an explicit idle-power value is supplied in the app; its tentative energy is available in the configurable preset. Waveshare remains research-only.

The app bundles these exact presets through its vault lock. Choose **Add component → EINK display**. Custom setup accepts energy in nJ/µJ/mJ, duration in seconds and standby in µW, one at a time. Engine 0.2.3 spreads operation energy over the scheduled duration, replacing idle power during the operation. Changing duration preserves energy but does not establish a characterized faster mode. If clipped or unpowered, only realized energy is integrated; successful image completion is not predicted. Upper voltage limits and peak waveforms are metadata, not engine constraints.

B74's logical input is `VCI + VDDIO (tied)`; F51/Pervasive use `VDD + VDDIO (tied)`. Physical pin names/numbers remain in characterization; one logical rail represents both supplies, with an empty package mapping. These models do not independently solve the two rails or expose internal booster pins as ordinary outputs.
