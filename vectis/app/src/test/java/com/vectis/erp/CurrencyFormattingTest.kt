package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.core.currency.CurrencyFormatter
import com.vectis.erp.data.model.CurrenciesResponse
import com.vectis.erp.data.model.CurrencyDto
import org.junit.Assert.*
import org.junit.Test

class CurrencyFormattingTest {

    private val gson = Gson()

    @Test
    fun testCurrenciesResponseParsing() {
        val json = """
            {
                "currencies": [
                    {
                        "code": "USD",
                        "symbol": "$",
                        "name": "US Dollar",
                        "exchange_rate": 1.0,
                        "decimal_precision": 2,
                        "is_base": true,
                        "updated_at": "2026-01-01T00:00:00Z"
                    },
                    {
                        "code": "MAD",
                        "symbol": "MAD",
                        "name": "Moroccan Dirham",
                        "exchange_rate": 10.0,
                        "decimal_precision": 2,
                        "is_base": false,
                        "updated_at": "2026-01-01T00:00:00Z"
                    },
                    {
                        "code": "EUR",
                        "symbol": "€",
                        "name": "Euro",
                        "exchange_rate": 0.92,
                        "decimal_precision": 2,
                        "is_base": false,
                        "updated_at": "2026-01-01T00:00:00Z"
                    }
                ]
            }
        """.trimIndent()

        val response = gson.fromJson(json, CurrenciesResponse::class.java)
        assertEquals(3, response.currencies.size)

        val usd = response.currencies[0]
        assertEquals("USD", usd.code)
        assertEquals("$", usd.symbol)
        assertEquals("US Dollar", usd.name)
        assertEquals(1.0, usd.exchangeRate, 0.0001)
        assertTrue(usd.isBase)

        val mad = response.currencies[1]
        assertEquals("MAD", mad.code)
        assertEquals("MAD", mad.symbol)
        assertEquals(10.0, mad.exchangeRate, 0.0001)
        assertFalse(mad.isBase)
    }

    @Test
    fun testIsPrefixSymbol() {
        assertTrue(CurrencyFormatter.isPrefixSymbol("$"))
        assertTrue(CurrencyFormatter.isPrefixSymbol("€"))
        assertTrue(CurrencyFormatter.isPrefixSymbol("£"))
        assertTrue(CurrencyFormatter.isPrefixSymbol("CA$"))
        assertTrue(CurrencyFormatter.isPrefixSymbol("US$"))

        assertFalse(CurrencyFormatter.isPrefixSymbol("MAD"))
        assertFalse(CurrencyFormatter.isPrefixSymbol("AED"))
        assertFalse(CurrencyFormatter.isPrefixSymbol("SAR"))
    }

    @Test
    fun testCurrencyConversion() {
        val testCurrencies = listOf(
            CurrencyDto("USD", "$", "US Dollar", 1.0, 2, true),
            CurrencyDto("EUR", "€", "Euro", 0.92, 2, false),
            CurrencyDto("MAD", "MAD", "Moroccan Dirham", 10.0, 2, false)
        )

        // 1. Same currency returns identical amount
        val same = CurrencyFormatter.convert(100.0, "USD", "USD", testCurrencies)
        assertEquals(100.0, same, 0.001)

        // 2. Base (USD) to EUR: 100 USD * 0.92 = 92 EUR
        val eur = CurrencyFormatter.convert(100.0, "USD", "EUR", testCurrencies)
        assertEquals(92.0, eur, 0.001)

        // 3. Base (USD) to MAD: 100 USD * 10.0 = 1000 MAD
        val mad = CurrencyFormatter.convert(100.0, "USD", "MAD", testCurrencies)
        assertEquals(1000.0, mad, 0.001)

        // 4. Non-base to Non-base (EUR to MAD): 92 EUR -> 100 USD base -> 1000 MAD
        val eurToMad = CurrencyFormatter.convert(92.0, "EUR", "MAD", testCurrencies)
        assertEquals(1000.0, eurToMad, 0.001)
    }

    @Test
    fun testCurrencyFormatting() {
        val testCurrencies = listOf(
            CurrencyDto("USD", "$", "US Dollar", 1.0, 2, true),
            CurrencyDto("EUR", "€", "Euro", 0.92, 2, false),
            CurrencyDto("MAD", "MAD", "Moroccan Dirham", 10.0, 2, false),
            CurrencyDto("JPY", "¥", "Japanese Yen", 150.0, 0, false)
        )

        // Prefix formatting
        assertEquals("$150.00", CurrencyFormatter.format(150.0, "USD", testCurrencies))
        assertEquals("€92.50", CurrencyFormatter.format(92.5, "EUR", testCurrencies))

        // Suffix formatting
        assertEquals("250.00 MAD", CurrencyFormatter.format(250.0, "MAD", testCurrencies))

        // Custom precision (e.g. Yen with 0 precision)
        assertEquals("¥1500", CurrencyFormatter.format(1500.0, "JPY", testCurrencies))

        // Null amount fallback
        assertEquals("0.00 MAD", CurrencyFormatter.format(null, "MAD", testCurrencies))
    }
}
