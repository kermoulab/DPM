package com.vectis.erp.core.currency

import com.vectis.erp.data.model.CurrencyDto
import java.util.Locale

object CurrencyFormatter {

    val FALLBACK_CURRENCIES = listOf(
        CurrencyDto(code = "USD", symbol = "$", name = "US Dollar", exchangeRate = 1.0, decimalPrecision = 2, isBase = true),
        CurrencyDto(code = "EUR", symbol = "€", name = "Euro", exchangeRate = 0.92, decimalPrecision = 2, isBase = false),
        CurrencyDto(code = "GBP", symbol = "£", name = "British Pound", exchangeRate = 0.78, decimalPrecision = 2, isBase = false),
        CurrencyDto(code = "MAD", symbol = "MAD", name = "Moroccan Dirham", exchangeRate = 10.0, decimalPrecision = 2, isBase = false),
        CurrencyDto(code = "AED", symbol = "AED", name = "UAE Dirham", exchangeRate = 3.67, decimalPrecision = 2, isBase = false),
        CurrencyDto(code = "SAR", symbol = "SAR", name = "Saudi Riyal", exchangeRate = 3.75, decimalPrecision = 2, isBase = false),
        CurrencyDto(code = "CAD", symbol = "CA$", name = "Canadian Dollar", exchangeRate = 1.35, decimalPrecision = 2, isBase = false)
    )

    private val PREFIX_SYMBOLS = setOf("$", "€", "£", "¥", "₹", "CA$", "US$")

    fun isPrefixSymbol(symbol: String): Boolean = PREFIX_SYMBOLS.contains(symbol)

    fun convert(
        amount: Double,
        fromCode: String,
        toCode: String,
        currencies: List<CurrencyDto> = FALLBACK_CURRENCIES
    ): Double {
        if (fromCode.equals(toCode, ignoreCase = true)) return amount
        val list = if (currencies.isNotEmpty()) currencies else FALLBACK_CURRENCIES
        val from = list.find { it.code.equals(fromCode, ignoreCase = true) } ?: return amount
        val to = list.find { it.code.equals(toCode, ignoreCase = true) } ?: return amount

        if (from.exchangeRate <= 0.0) return amount
        val amountInBase = amount / from.exchangeRate
        return amountInBase * to.exchangeRate
    }

    fun format(
        amount: Double?,
        currencyCode: String = "MAD",
        currencies: List<CurrencyDto> = FALLBACK_CURRENCIES
    ): String {
        if (amount == null) return "0.00 $currencyCode"
        val list = if (currencies.isNotEmpty()) currencies else FALLBACK_CURRENCIES
        val currency = list.find { it.code.equals(currencyCode, ignoreCase = true) }
        val symbol = currency?.symbol ?: currencyCode
        val precision = currency?.decimalPrecision ?: 2
        val formattedNumber = String.format(Locale.US, "%.${precision}f", amount)

        return if (isPrefixSymbol(symbol)) {
            "$symbol$formattedNumber"
        } else {
            "$formattedNumber $symbol"
        }
    }
}
