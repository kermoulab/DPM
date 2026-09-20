-- Migration 002: Add Moroccan Dirham (MAD)
INSERT INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
VALUES ('MAD', 'MAD', 'Moroccan Dirham', 10.0, 2, false, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;
