# Contributing a model

1. Create a branch and add `vendors/<vendor>/<part>/part.json` with a unique stable ID and model revision.
2. Use an engine-supported declarative model. Store electrical values in SI base units; keep project wiring and activity in a profile.
3. Give every simulation-affecting field a provenance entry. Record the actual source, page or measurement method, operating conditions, and applicable rights. Do not label an estimate as a manufacturer value.
4. Use a license you have the right to grant. Do not copy proprietary datasheet artwork or executable code into models.
5. Run `npm ci`, `npm run validate`, `npm test`, and `npm run index`.
6. For profile changes, run `energy validate` and `energy run` with the application CLI. Check numerical diagnostics and compare the previous result.
7. Open a pull request describing changed values, their evidence, and intended operating range. Maintainers should review the evidence and model behavior before merging.

The current schema supports battery/supply, constant-efficiency converter, switch, and constant-current load states. Curves, capacitors, harvesting, composites, and advanced battery behavior require future engine/schema versions. Model files never execute contributed algorithms.
