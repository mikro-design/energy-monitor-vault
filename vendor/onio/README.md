# ONiO

See [catalog scope and evidence](../../docs/CATALOG.md). Pin mappings are partial; read the package and operating conditions before use.

| Product                             | Category     | Simulation status |
| ----------------------------------- | ------------ | ----------------- |
| [ONiO.zero](onio-zero/catalog.json) | wireless_soc | catalog_only      |

ONiO.zero declares BLE 1M/2M/coded and 2.4 GHz IEEE 802.15.4 capabilities in its [official feature overview](https://www.onio.com/technology.html). Current tables, startup timing and package pins remain uncharacterized. A complete power model must include its integrated harvesting and storage paths.

[Characterization in progress](onio-zero/characterization.json) records user-supplied inputs separately from verified manufacturer information. The supplied input range is 250–3000 mV. Retained-RAM sleep power is awaiting a direct µW value; the earlier current observation has not been converted without its measurement voltage.
