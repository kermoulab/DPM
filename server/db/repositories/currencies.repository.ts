import { query } from '../connection/pool.js';

export interface CurrencyRow {
  code: string;
  symbol: string;
  name: string;
  exchange_rate: number;
  decimal_precision: number;
  is_base: boolean;
  updated_at: string;
}

export class CurrenciesRepository {
  async findAll(): Promise<CurrencyRow[]> {
    const res = await query<CurrencyRow>(
      'SELECT * FROM currencies ORDER BY is_base DESC, code ASC'
    );
    if (res.rows.length > 0 && !res.rows.some((c) => c.code === 'MAD')) {
      try {
        await this.upsert({
          code: 'MAD',
          symbol: 'MAD',
          name: 'Moroccan Dirham',
          exchange_rate: 10.0,
          decimal_precision: 2,
          is_base: false
        });
        const refreshed = await query<CurrencyRow>(
          'SELECT * FROM currencies ORDER BY is_base DESC, code ASC'
        );
        return refreshed.rows;
      } catch {
        // Fall back to original results if transparent insertion is prevented
      }
    }
    return res.rows;
  }

  async findByCode(code: string): Promise<CurrencyRow | null> {
    const res = await query<CurrencyRow>(
      'SELECT * FROM currencies WHERE code = $1',
      [code.toUpperCase()]
    );
    return res.rows[0] || null;
  }

  async upsert(currency: {
    code: string;
    symbol: string;
    name: string;
    exchange_rate: number;
    decimal_precision?: number;
    is_base?: boolean;
  }): Promise<CurrencyRow> {
    const res = await query<CurrencyRow>(
      `INSERT INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (code) DO UPDATE SET
         symbol = EXCLUDED.symbol,
         name = EXCLUDED.name,
         exchange_rate = EXCLUDED.exchange_rate,
         decimal_precision = EXCLUDED.decimal_precision,
         is_base = EXCLUDED.is_base,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        currency.code.toUpperCase(),
        currency.symbol,
        currency.name,
        currency.exchange_rate,
        currency.decimal_precision || 2,
        Boolean(currency.is_base)
      ]
    );
    return res.rows[0];
  }
}

export const currenciesRepo = new CurrenciesRepository();
