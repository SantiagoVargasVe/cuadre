-- Reference data only: existing databases gain GTQ without rewriting any
-- expense, settlement, rate, or pin. Mirrors src/lib/money/format.ts.
-- ISO-4217 exponent 2: one quetzal is 100 centavos, displayed with two decimals.
INSERT INTO "currencies" ("code", "exponent", "display_decimals", "name") VALUES
	('GTQ', 2, 2, 'Guatemalan Quetzal');
