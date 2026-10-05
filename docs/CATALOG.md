# Manufacturer catalog and runnable models

`vendor/<manufacturer>/vendor.json` identifies a manufacturer, aliases, website and allowed source domains. Products live in `vendor/<manufacturer>/<product>/catalog.json`. The first curated set covers 20 products across six manufacturers; it is a representative low-power starter set, not a market-share ranking or a complete product family catalog.

A catalog entry records identity, category, original source links, review dates, physical pin metadata, optional radio capabilities, and simulation status. `catalog_only` means it cannot be loaded into the electrical engine. `runnable_approximation` requires a sibling `part.json` using the engine's schema 0.2, with the same ID and per-field provenance. Catalog schema 0.1 is independent of part schema 0.2.

The generated [catalog index](../index/catalog-index.json) includes aliases, protocol filters, modeling status and optional model paths/hashes. [The part index](../index/generated-index.json) contains only runnable models, including the illustrative examples. Neither index automatically updates an existing profile or the application's bundled catalog.

## Evidence and pins

Sources point to manufacturers, rather than reseller estimates. `access: search_excerpt` records limited access explicitly; it cannot support numeric operating points or physical pin mappings. ONiO currently has identity-level evidence only. A successful domain check verifies the URL's host, not the accuracy of the source's contents; changes still require human source review.

Pin entries preserve the vendor's name, direction, role and package numbers. `partial` means a reviewed subset for a named package, not a complete schematic symbol. `not_characterized` means no pin mapping has been imported. Missing data is not inferred. Different packages need separate reviewed mappings before substitution.

Catalog pins can describe control, return, sense and switching nodes. Engine ports support only logical power inputs/outputs. For example, TPS62740 `VOUT` pin 5 senses the regulated rail and feeds its load switch; `SW` is the switching node. Neither should be mislabeled as a regulated output pin. Its runnable circuit approximation exposes a logical `VOUT` rail after the external inductor, with an empty package-pin list. ADP5300 similarly has `PVIN`, `SW` and `FB` package pins, but no physical `VOUT` pin. Ground and external passive components are implicit in these approximations.

## Runnable scope

| Model        | Qualified baseline                                                                                          | Principal omissions                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| nRF52840     | 3 V, 25 °C, normal-voltage supply; PMU whole-device BLE 1M and 802.15.4 radio states, CPU asleep; RTC sleep | Wake/turnaround, application CPU work, automatic packet timing, other PHY current tables |
| TPS62740     | 1.8 V output, LOAD disabled; 360 nA no-switching baseline IQ; intended input 3.6 V                          | Efficiency curve, switching IQ changes, controlled LOAD path, transients                 |
| ADP5300      | 2.5 V output, hysteresis mode; 180 nA typical IQ; intended input 3.6 V                                      | Efficiency curve, PWM/STOP and transition behavior                                       |
| PIC16LF18313 | 3 V, 25 °C; LF-variant base sleep, XT 4 MHz, HFINTOSC 16 MHz run/idle                                       | Peripheral currents, startup, code-dependent and voltage/temperature effects             |

Both buck models use **estimated 90% constant conversion efficiency**, excluding the separately modeled IQ. This is not a vendor efficiency specification. All limitations and source sections are recorded next to the values. The engine checks minimum voltage and current limits but does not enforce upper input voltage, temperature or all operating conditions. Use the stated baseline until richer operating-region models exist.

Harvesters, photovoltaic cells, chargers and the remaining products stay catalog-only. A Powerfoyle model needs cell geometry, illumination/spectrum and I–V curves. Charging and harvesting PMICs need storage, source selection, cold-start and charging behavior. MCP1640's cited PFM IQ is measured at VOUT, while the present converter model applies IQ at VIN; importing that number unchanged would assign its losses to the wrong rail.

These records contain original structured metadata and numerical facts with links. CC0-1.0 in a runnable part applies to the authored model record, not the linked datasheet, manufacturer trademarks or vendor artwork. Datasheets are not redistributed here.
