package com.carlosivars.financias.notification

import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionSource
import com.carlosivars.financias.model.TransactionType
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

object NotificationParser {

    private val BIZUM_RECEIVED_REGEX = Pattern.compile(
        "(?i)Has recibido un Bizum de\\s+([\\d.,]+)\\s*([A-Za-z]{3}|€)\\s+de\\s+(.+?)\\.?$"
    )

    private val BIZUM_SENT_REGEX = Pattern.compile(
        "(?i)(?:Has enviado|Envío de) un Bizum de\\s+([\\d.,]+)\\s*([A-Za-z]{3}|€)\\s+a\\s+(.+?)\\.?$"
    )

    private val SABADELL_CARD_REGEX = Pattern.compile(
        "(?i)(?:Has pagado|Pago con tarjeta de?|Pago de)\\s+([\\d.,]+)\\s*([A-Za-z]{3}|€)\\s+en\\s+(.+?)(?:\\s+con\\s+tu\\s+tarjeta.*|\\.)?$"
    )

    private val WALLET_PAYMENT_REGEX_1 = Pattern.compile(
        "(?i)(.+?)\\s+([\\d.,]+)\\s*(€|EUR)"
    )

    private val WALLET_PAYMENT_REGEX_2 = Pattern.compile(
        "(?i)([\\d.,]+)\\s*(€|EUR)\\s+en\\s+(.+)"
    )

    fun parse(
        packageName: String,
        title: String,
        text: String,
        postTime: Long
    ): Transaction? {
        val cleanText = text.trim()
        val isoDate = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(Date(postTime))
        val id = "tx_${postTime}_${Math.abs(cleanText.hashCode())}"

        // 1. Bizum recibido (Banco Sabadell)
        val bizumRecMatcher = BIZUM_RECEIVED_REGEX.matcher(cleanText)
        if (bizumRecMatcher.find()) {
            val amount = cleanAmount(bizumRecMatcher.group(1)) ?: return null
            val currency = normalizeCurrency(bizumRecMatcher.group(2))
            val sender = bizumRecMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Desconocido"

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
                rawNotificationText = cleanText
            )
        }

        // 2. Bizum enviado (Banco Sabadell)
        val bizumSentMatcher = BIZUM_SENT_REGEX.matcher(cleanText)
        if (bizumSentMatcher.find()) {
            val amount = cleanAmount(bizumSentMatcher.group(1)) ?: return null
            val currency = normalizeCurrency(bizumSentMatcher.group(2))
            val recipient = bizumSentMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Desconocido"

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
                rawNotificationText = cleanText
            )
        }

        // 3. Sabadell compra con tarjeta / TPV
        val sabadellCardMatcher = SABADELL_CARD_REGEX.matcher(cleanText)
        if (sabadellCardMatcher.find()) {
            val amount = cleanAmount(sabadellCardMatcher.group(1)) ?: return null
            val currency = normalizeCurrency(sabadellCardMatcher.group(2))
            val merchant = sabadellCardMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio"

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
                rawNotificationText = cleanText
            )
        }

        // 4. Google Wallet (ej. "Mercadona 24,90 €" o "24,90 € en Mercadona")
        val walletMatcher2 = WALLET_PAYMENT_REGEX_2.matcher(cleanText)
        if (walletMatcher2.find()) {
            val amount = cleanAmount(walletMatcher2.group(1)) ?: return null
            val currency = normalizeCurrency(walletMatcher2.group(2))
            val merchant = walletMatcher2.group(3)?.trim() ?: "Compra con Wallet"

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
                rawNotificationText = cleanText
            )
        }

        val walletMatcher1 = WALLET_PAYMENT_REGEX_1.matcher(cleanText)
        if (walletMatcher1.find()) {
            var merchant = walletMatcher1.group(1)?.trim() ?: "Compra"
            merchant = merchant.replace("(?i)Pago realizado:?".toRegex(), "").trim()
            val amount = cleanAmount(walletMatcher1.group(2)) ?: return null
            val currency = normalizeCurrency(walletMatcher1.group(3))

            return Transaction(
                id = id,
                description = if (merchant.isBlank()) "Pago Google Wallet" else merchant,
                amount = amount,
                currency = currency,
                type = TransactionType.EXPENSE,
                category = CategoryClassifier.classify(merchant, isIncome = false),
                date = isoDate,
                timestamp = postTime,
                source = TransactionSource.NOTIFICATION,
                rawNotificationText = cleanText
            )
        }

        return null
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

