package com.carlosivars.financias.notification

import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionSource
import com.carlosivars.financias.model.TransactionType
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

object NotificationParser {

    // 1. Banco Sabadell: "💳 Nueva compra de 1,00 EUR EL SUPER DE LOS PASTOR, ES, realizada el 21/SEP a las 13:16 h."
    private val SABADELL_NUEVA_COMPRA_REGEX = Pattern.compile(
        "(?i)💳?\\s*(?:Nueva\\s+compra\\s+de|Compra\\s+de|Has\\s+pagado|Pago\\s+con\\s+tarjeta\\s+de?|Pago\\s+de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+(.+?),\\s*(?:ES,)?\\s*realizada\\s+el\\s+(.+?)\\s+a\\s+las\\s+([\\d:]+)\\s*h\\.?"
    )

    // 2. Sabadell tarjeta estándar: "Pago con tarjeta de 15,50 EUR en MERCADONA..."
    private val SABADELL_CARD_STANDARD_REGEX = Pattern.compile(
        "(?i)(?:Has pagado|Pago con tarjeta de?|Pago de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+en\\s+(.+?)(?:\\s+con\\s+tu\\s+tarjeta.*|\\.)?$"
    )

    // 3. Bizum recibido: "Has recibido un Bizum de 25,00 € de Juan Pérez."
    private val BIZUM_RECEIVED_REGEX = Pattern.compile(
        "(?i)Has recibido un Bizum de\\s+([\\d.,]+)\\s*([A-Za-z]{3}|€)\\s+de\\s+(.+?)\\.?$"
    )

    // 4. Bizum enviado: "Has enviado un Bizum de 12,00 € a María."
    private val BIZUM_SENT_REGEX = Pattern.compile(
        "(?i)(?:Has enviado|Envío de) un Bizum de\\s+([\\d.,]+)\\s*([A-Za-z]{3}|€)\\s+a\\s+(.+?)\\.?$"
    )

    // 5. Google Wallet: Text: "0,60 € con MASTERCARD BSCARD ••8016", Title: "ARTURO SORIA"
    private val WALLET_AMOUNT_CARD_REGEX = Pattern.compile(
        "(?i)^([\\d.,]+)\\s*(€|EUR)\\s+con\\s+(.+)$"
    )

    // 6. Google Wallet formato clásico en texto: "Mercadona 24,90 €" o "24,90 € en Mercadona"
    private val WALLET_PAYMENT_REGEX_EN = Pattern.compile(
        "(?i)^([\\d.,]+)\\s*(€|EUR)\\s+en\\s+(.+)$"
    )

    private val WALLET_PAYMENT_REGEX_COMMERCE = Pattern.compile(
        "(?i)^(.+?)\\s+([\\d.,]+)\\s*(€|EUR)$"
    )

    // 7. Genérico español para compras bancarias (BBVA, Santander, CaixaBank, Revolut, etc.)
    // Ej: "Compra de 14,20 EUR con tarjeta *1234 en ZARA" o "Pago de 9,99 € en Netflix"
    private val GENERIC_CARD_PURCHASE_REGEX = Pattern.compile(
        "(?i)(?:Compra|Pago)\\s+(?:de\\s+)?([\\d.,]+)\\s*(EUR|€)(?:\\s+con\\s+tarjeta\\s*([*•\\d]+)?)?\\s+en\\s+(.+?)(?:\\.|\\s*$)"
    )

    fun parse(
        packageName: String,
        title: String,
        text: String,
        postTime: Long
    ): Transaction? {
        val cleanText = text.trim()
        val cleanTitle = title.trim()
        val isoDate = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(Date(postTime))
        val id = "tx_${postTime}_${Math.abs((cleanTitle + cleanText).hashCode())}"

        val metadata = mutableMapOf<String, String>()
        metadata["package"] = packageName
        metadata["raw_title"] = cleanTitle
        metadata["raw_text"] = cleanText

        val isWalletPackage = packageName.contains("wallet", ignoreCase = true)
        val isSabadellPackage = packageName.contains("sabadell", ignoreCase = true) || packageName.contains("inverline", ignoreCase = true)

        // 1. Google Wallet con Title = Comercio y Text = "0,60 € con MASTERCARD BSCARD ••8016"
        val walletCardMatcher = WALLET_AMOUNT_CARD_REGEX.matcher(cleanText)
        if (walletCardMatcher.find()) {
            val amount = cleanAmount(walletCardMatcher.group(1))
            val currency = normalizeCurrency(walletCardMatcher.group(2))
            val card = walletCardMatcher.group(3)?.trim() ?: ""

            if (amount != null) {
                val merchant = if (cleanTitle.isNotBlank()) cleanTitle else "Compra Google Wallet"
                metadata["card"] = card
                metadata["merchant"] = merchant
                metadata["source"] = "Google Wallet"

                return Transaction(
                    id = id,
                    description = merchant,
                    amount = amount,
                    currency = currency,
                    type = TransactionType.EXPENSE,
                    category = CategoryClassifier.classify(merchant, isIncome = false),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        // 2. Banco Sabadell: "💳 Nueva compra de 1,00 EUR EL SUPER DE LOS PASTOR, ES, realizada el 21/SEP a las 13:16 h."
        val sabadellNuevaMatcher = SABADELL_NUEVA_COMPRA_REGEX.matcher(cleanText)
        if (sabadellNuevaMatcher.find()) {
            val amount = cleanAmount(sabadellNuevaMatcher.group(1))
            val currency = normalizeCurrency(sabadellNuevaMatcher.group(2))
            var merchant = sabadellNuevaMatcher.group(3)?.trim()?.removeSuffix(",") ?: "Comercio"
            val opDate = sabadellNuevaMatcher.group(4)?.trim() ?: ""
            val opTime = sabadellNuevaMatcher.group(5)?.trim() ?: ""

            if (amount != null) {
                // Limpiar posibles sufijos de país ", ES"
                merchant = merchant.replace(Regex(",\\s*ES$"), "").trim()
                metadata["merchant"] = merchant
                metadata["clean_merchant"] = merchant
                metadata["source"] = "Banco Sabadell"
                if (opDate.isNotEmpty() && opTime.isNotEmpty()) {
                    metadata["original_date"] = "$opDate a las $opTime h"
                    metadata["operation_time"] = "$opDate $opTime"
                }

                return Transaction(
                    id = id,
                    description = merchant,
                    amount = amount,
                    currency = currency,
                    type = TransactionType.EXPENSE,
                    category = CategoryClassifier.classify(merchant, isIncome = false),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        // 3. Bizum recibido (Banco Sabadell u otros)
        val bizumRecMatcher = BIZUM_RECEIVED_REGEX.matcher(cleanText)
        if (bizumRecMatcher.find()) {
            val amount = cleanAmount(bizumRecMatcher.group(1))
            val currency = normalizeCurrency(bizumRecMatcher.group(2))
            val sender = bizumRecMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Desconocido"

            if (amount != null) {
                metadata["source"] = if (isSabadellPackage) "Banco Sabadell" else "Bizum"
                metadata["bizum_sender"] = sender

                return Transaction(
                    id = id,
                    description = "Bizum: $sender",
                    amount = amount,
                    currency = currency,
                    type = TransactionType.INCOME,
                    category = CategoryClassifier.classify("Bizum $sender", isIncome = true),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        // 4. Bizum enviado
        val bizumSentMatcher = BIZUM_SENT_REGEX.matcher(cleanText)
        if (bizumSentMatcher.find()) {
            val amount = cleanAmount(bizumSentMatcher.group(1))
            val currency = normalizeCurrency(bizumSentMatcher.group(2))
            val recipient = bizumSentMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Desconocido"

            if (amount != null) {
                metadata["source"] = if (isSabadellPackage) "Banco Sabadell" else "Bizum"
                metadata["bizum_recipient"] = recipient

                return Transaction(
                    id = id,
                    description = "Bizum a: $recipient",
                    amount = amount,
                    currency = currency,
                    type = TransactionType.EXPENSE,
                    category = CategoryClassifier.classify("Bizum $recipient", isIncome = false),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        // 5. Sabadell compra con tarjeta / TPV estándar
        val sabadellCardMatcher = SABADELL_CARD_STANDARD_REGEX.matcher(cleanText)
        if (sabadellCardMatcher.find()) {
            val amount = cleanAmount(sabadellCardMatcher.group(1))
            val currency = normalizeCurrency(sabadellCardMatcher.group(2))
            val merchant = sabadellCardMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "Banco Sabadell"

                return Transaction(
                    id = id,
                    description = merchant,
                    amount = amount,
                    currency = currency,
                    type = TransactionType.EXPENSE,
                    category = CategoryClassifier.classify(merchant, isIncome = false),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        // 6. Genérico de compra con tarjeta (BBVA, Santander, etc.)
        val genericMatcher = GENERIC_CARD_PURCHASE_REGEX.matcher(cleanText)
        if (genericMatcher.find()) {
            val amount = cleanAmount(genericMatcher.group(1))
            val currency = normalizeCurrency(genericMatcher.group(2))
            val card = genericMatcher.group(3)?.trim()
            val merchant = genericMatcher.group(4)?.trim() ?: "Compra con tarjeta"

            if (amount != null) {
                if (!card.isNullOrBlank()) metadata["card"] = card
                metadata["merchant"] = merchant
                metadata["source"] = detectBankName(packageName)

                return Transaction(
                    id = id,
                    description = merchant,
                    amount = amount,
                    currency = currency,
                    type = TransactionType.EXPENSE,
                    category = CategoryClassifier.classify(merchant, isIncome = false),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        // 7. Wallet formatos alternativos ("24,90 € en Mercadona")
        val walletMatcherEn = WALLET_PAYMENT_REGEX_EN.matcher(cleanText)
        if (walletMatcherEn.find()) {
            val amount = cleanAmount(walletMatcherEn.group(1))
            val currency = normalizeCurrency(walletMatcherEn.group(2))
            val merchant = walletMatcherEn.group(3)?.trim() ?: "Compra"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "Google Wallet"

                return Transaction(
                    id = id,
                    description = merchant,
                    amount = amount,
                    currency = currency,
                    type = TransactionType.EXPENSE,
                    category = CategoryClassifier.classify(merchant, isIncome = false),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        // 8. Wallet formato ("Mercadona 24,90 €")
        val walletMatcherCommerce = WALLET_PAYMENT_REGEX_COMMERCE.matcher(cleanText)
        if (walletMatcherCommerce.find()) {
            var merchant = walletMatcherCommerce.group(1)?.trim() ?: "Compra"
            merchant = merchant.replace("(?i)Pago realizado:?".toRegex(), "").trim()
            val amount = cleanAmount(walletMatcherCommerce.group(2))
            val currency = normalizeCurrency(walletMatcherCommerce.group(3))

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = if (isWalletPackage) "Google Wallet" else detectBankName(packageName)

                return Transaction(
                    id = id,
                    description = if (merchant.isBlank()) "Pago" else merchant,
                    amount = amount,
                    currency = currency,
                    type = TransactionType.EXPENSE,
                    category = CategoryClassifier.classify(merchant, isIncome = false),
                    date = isoDate,
                    timestamp = postTime,
                    source = TransactionSource.NOTIFICATION,
                    rawNotificationText = cleanText,
                    metadata = metadata
                )
            }
        }

        return null
    }

    private fun detectBankName(pkg: String): String {
        return when {
            pkg.contains("wallet", ignoreCase = true) -> "Google Wallet"
            pkg.contains("sabadell", ignoreCase = true) || pkg.contains("inverline", ignoreCase = true) -> "Banco Sabadell"
            pkg.contains("bbva", ignoreCase = true) -> "BBVA"
            pkg.contains("santander", ignoreCase = true) -> "Banco Santander"
            pkg.contains("caixabank", ignoreCase = true) || pkg.contains("imagin", ignoreCase = true) -> "CaixaBank"
            pkg.contains("revolut", ignoreCase = true) -> "Revolut"
            pkg.contains("n26", ignoreCase = true) -> "N26"
            pkg.contains("openbank", ignoreCase = true) -> "Openbank"
            pkg.contains("ing", ignoreCase = true) -> "ING"
            else -> "Notificación Bancaria"
        }
    }

    private fun cleanAmount(raw: String?): Double? {
        if (raw.isNullOrBlank()) return null
        return try {
            var s = raw.trim().replace(" ", "")
            if (s.contains(".") && s.contains(",")) {
                s = s.replace(".", "").replace(",", ".")
            } else if (s.contains(",")) {
                s = s.replace(",", ".")
            }
            s.toDouble()
        } catch (e: Exception) {
            null
        }
    }

    private fun normalizeCurrency(raw: String?): String {
        return when (raw?.trim()) {
            "€" -> "EUR"
            "$" -> "USD"
            "£" -> "GBP"
            else -> raw?.trim()?.uppercase(Locale.ROOT) ?: "EUR"
        }
    }
}
