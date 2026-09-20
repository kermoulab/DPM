import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Currency, User } from '../types.js';
import { api } from '../api.js';

interface CurrencyContextType {
  selectedCurrency: string;
  currencies: Currency[];
  activeCurrency: Currency | undefined;
  symbol: string;
  isSaving: boolean;
  setCurrency: (code: string) => Promise<void>;
  convert: (amount: number, fromCode?: string) => number;
  format: (
    amount: number | undefined | null,
    fromCode?: string,
    options?: { showOriginal?: boolean; compact?: boolean; precision?: number }
  ) => string;
  refreshCurrencies: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const FALLBACK_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', exchange_rate: 1.0, decimal_precision: 2, is_base: 1, updated_at: '' },
  { code: 'EUR', symbol: '€', name: 'Euro', exchange_rate: 0.92, decimal_precision: 2, is_base: 0, updated_at: '' },
  { code: 'GBP', symbol: '£', name: 'British Pound', exchange_rate: 0.78, decimal_precision: 2, is_base: 0, updated_at: '' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', exchange_rate: 10.0, decimal_precision: 2, is_base: 0, updated_at: '' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', exchange_rate: 3.67, decimal_precision: 2, is_base: 0, updated_at: '' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', exchange_rate: 3.75, decimal_precision: 2, is_base: 0, updated_at: '' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', exchange_rate: 1.35, decimal_precision: 2, is_base: 0, updated_at: '' },
];

function isPrefixSymbol(symbol: string): boolean {
  return ['$', '€', '£', '¥', '₹', 'CA$', 'US$'].includes(symbol);
}

interface CurrencyProviderProps {
  children: React.ReactNode;
  currentUser?: User | null;
  onUserCurrencyUpdated?: (newCurrency: string) => void;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({
  children,
  currentUser,
  onUserCurrencyUpdated
}) => {
  const [currencies, setCurrencies] = useState<Currency[]>(FALLBACK_CURRENCIES);
  const [selectedCurrency, setSelectedCurrencyState] = useState<string>(() => {
    return currentUser?.preferred_currency || localStorage.getItem('preferred_currency') || 'USD';
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load currencies from API
  const refreshCurrencies = useCallback(async () => {
    if (!api.hasSession()) {
      return;
    }
    try {
      const res = await api.getCurrencies();
      if (res.currencies && res.currencies.length > 0) {
        setCurrencies(res.currencies);
      }
    } catch (err: any) {
      if (err?.message?.includes('Authentication required') || err?.message?.includes('401')) {
        return;
      }
      console.error('Failed fetching currencies:', err);
    }
  }, []);

  useEffect(() => {
    refreshCurrencies();
  }, [refreshCurrencies]);

  // Synchronize when currentUser's preferred_currency changes or user logs in
  useEffect(() => {
    if (currentUser?.preferred_currency) {
      const userCurr = currentUser.preferred_currency.toUpperCase();
      setSelectedCurrencyState(userCurr);
      localStorage.setItem('preferred_currency', userCurr);
    }
  }, [currentUser?.id, currentUser?.preferred_currency]);

  // Set currency, update state, localStorage, and DB
  const setCurrency = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      setSelectedCurrencyState(code);
      localStorage.setItem('preferred_currency', code);

      if (currentUser) {
        setIsSaving(true);
        try {
          await api.updatePreferredCurrency(code);
          if (onUserCurrencyUpdated) {
            onUserCurrencyUpdated(code);
          }
        } catch (err) {
          console.error('Failed to save preferred currency to DB:', err);
        } finally {
          setIsSaving(false);
        }
      }
    },
    [currentUser, onUserCurrencyUpdated]
  );

  const activeCurrency = currencies.find(
    (c) => c.code.toUpperCase() === selectedCurrency.toUpperCase()
  ) || FALLBACK_CURRENCIES.find((c) => c.code.toUpperCase() === selectedCurrency.toUpperCase());

  const symbol = activeCurrency?.symbol || selectedCurrency;

  // Conversion math relative to base currency
  const convert = useCallback(
    (amount: number, fromCode: string = 'USD'): number => {
      if (!Number.isFinite(amount) || amount === 0) return 0;
      const cleanFrom = (fromCode || 'USD').toUpperCase();
      const cleanTo = selectedCurrency.toUpperCase();

      if (cleanFrom === cleanTo) return amount;

      const fromCurr = currencies.find((c) => c.code.toUpperCase() === cleanFrom);
      const toCurr = currencies.find((c) => c.code.toUpperCase() === cleanTo);

      const fromRate = fromCurr ? Number(fromCurr.exchange_rate) || 1.0 : 1.0;
      const toRate = toCurr ? Number(toCurr.exchange_rate) || 1.0 : 1.0;

      // Base conversion: amount / fromRate gives base currency (USD) value
      const inBase = amount / fromRate;
      return inBase * toRate;
    },
    [currencies, selectedCurrency]
  );

  // Format monetary value in active selected currency
  const format = useCallback(
    (
      amount: number | undefined | null,
      fromCode: string = 'USD',
      options: { showOriginal?: boolean; compact?: boolean; precision?: number } = {}
    ): string => {
      if (amount === undefined || amount === null || !Number.isFinite(Number(amount))) {
        return '-';
      }
      const num = Number(amount);
      const converted = convert(num, fromCode);
      const targetCurr = activeCurrency;
      const currSymbol = targetCurr?.symbol || selectedCurrency;
      const precision = options.precision ?? targetCurr?.decimal_precision ?? 2;

      if (options.compact) {
        if (Math.abs(converted) >= 1000000) {
          const formatted = (converted / 1000000).toFixed(1) + 'M';
          return isPrefixSymbol(currSymbol) ? `${currSymbol}${formatted}` : `${formatted} ${currSymbol}`;
        }
        if (Math.abs(converted) >= 1000) {
          const formatted = (converted / 1000).toFixed(1) + 'k';
          return isPrefixSymbol(currSymbol) ? `${currSymbol}${formatted}` : `${formatted} ${currSymbol}`;
        }
      }

      const formattedNumber = converted.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      });

      return isPrefixSymbol(currSymbol)
        ? `${currSymbol}${formattedNumber}`
        : `${formattedNumber} ${currSymbol}`;
    },
    [convert, activeCurrency, selectedCurrency]
  );

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        currencies,
        activeCurrency,
        symbol,
        isSaving,
        setCurrency,
        convert,
        format,
        refreshCurrencies
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

const DEFAULT_FALLBACK_CONTEXT: CurrencyContextType = {
  selectedCurrency: 'USD',
  currencies: FALLBACK_CURRENCIES,
  activeCurrency: FALLBACK_CURRENCIES[0],
  symbol: '$',
  isSaving: false,
  setCurrency: async () => {},
  convert: (amount: number) => (Number.isFinite(amount) ? amount : 0),
  format: (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || !Number.isFinite(Number(amount))) return '$0.00';
    return `$${Number(amount).toFixed(2)}`;
  },
  refreshCurrencies: async () => {}
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    return DEFAULT_FALLBACK_CONTEXT;
  }
  return context;
};
