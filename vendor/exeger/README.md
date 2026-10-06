# Exeger

Powerfoyle Indoor and Hybrid are runnable MPP source approximations in engine 0.2.4. Each directory contains `catalog.json`, `part.json` and `characterization.json`. The authored records preserve source revision, PDF SHA-256, reviewed pages, test conditions, numerical tables and limits; the PDFs are linked, not redistributed.

| Model | Reviewed source | Executable lux range | 5 cm² at 200 lux | Vmpp |
| --- | --- | --- | --- | --- |
| [Indoor](powerfoyle-indoor/part.json) | [v3.0](https://www.exeger.com/uploads/2023/12/Product-Brief-Powerfoyle-Indoor-v3.0.pdf) | 100–1000 | 62 µW | 0.59 V |
| [Hybrid](powerfoyle-hybrid/part.json) | [v1.4.1](https://www.exeger.com/uploads/2025/03/Product-Brief-Powerfoyle-Hybrid-1v4.pdf) | 200–50000 | 27 µW | 0.39 V |

These are raw cell maximum-power-point figures before converter losses, at 25 °C under YUJI D50 light calibrated with DIG LUX 9500. Indoor data is preliminary and based on PF110; its on-delivery floor is 90% of typical. Hybrid lists design-dependent ±10% variation. Custom absorber-area scaling is indicative and excludes borders; a 5 cm² scenario is not a characterized orderable cell geometry. Device-specific contact names are unknown, so the executable output is explicitly logical with no fabricated package pins.

Both models interpolate power density and voltage within the complete table. Zero lux is a separate darkness condition. Positive values outside the range are rejected. Hybrid's 100000-lux power-only indication is preserved separately because its voltage is not tabulated. The newer Hybrid 50000-lux value is 1710.3 µW/cm²; v1.3 data is not mixed into this model.

Boost101/Boost102 conversion/tracking/overall-efficiency tables remain separate metadata for their specified 3.7 V LiPo reference designs. They are not automatically applied to cell output or to ONiO. Temperature coefficients and full I–V behaviour are not modeled. Review field evidence before changing spectrum, temperature or physical design.

The [lighting example](../../../profiles/exeger-indoor-lighting.json) demonstrates ONiO sleep through light/dark intervals. An overloaded source branch is unpowered; unused energy is not stored. No charging, capacitor, MPPT transient or restart behaviour is implied. See [application solar semantics](https://github.com/mikro-design/energy-monitor/blob/main/docs/SOLAR.md) and [catalog scope](../../../docs/CATALOG.md).
