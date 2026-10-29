---
id: T133
title: Support Guatemalan quetzales for group trips
epic: E6-currency
status: done
depends_on: [T020, T051, T053, T061]
size: S
---

## Context

Trips to Guatemala need GTQ alongside COP, USD and EUR in the existing ledger and selectors.
Follow [currency.md](../../docs/context/currency.md),
[splitting.md](../../docs/context/splitting.md), [data-model.md](../../docs/context/data-model.md),
[testing.md](../../docs/context/testing.md) and
[design-system.md](../../docs/frontend/design-system.md) § Money display.

## Acceptance criteria

- [x] Add GTQ reference data with an additive migration: exponent 2, display decimals 2.
- [x] Format with the distinct `Q` symbol; input and parsing preserve centavos and bigint precision.
- [x] Existing shared selectors offer GTQ; example configuration enables it and COP stays default.
- [x] Confirm provider coverage and test exact rate extraction and a missing GTQ response offline.
- [x] Include GTQ in randomized ledger invariants and test creation, splitting, settlement,
      conversion in both directions and reversal against PostgreSQL.
- [x] Document activation for existing installations without changing historical expenses or pins.
- [x] Pass lint, typecheck, coverage tests and production build (1,130 tests; PostgreSQL 17).

## Out of scope

Changing providers, arithmetic, locale, historical ledger data or existing pins. Production deployment.

## Files likely touched

Shared money metadata/tests, currency migration, `.env.example`, FX provider fixtures/tests,
group creation test, service integration tests and currency/deployment documentation.
