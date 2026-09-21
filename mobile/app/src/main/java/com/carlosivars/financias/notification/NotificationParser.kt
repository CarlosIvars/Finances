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

    // 8. BBVA España: "Has realizado un pago de 15,20 € en ZARA" o "Compra de 32,50 EUR en MERCADONA"
    private val BBVA_PAYMENT_REGEX = Pattern.compile(
        "(?i)(?:Has realizado un pago de|Pago con tarjeta de|Compra de|Pago de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+en\\s+(.+?)(?:\\s+con\\s+tu\\s+tarjeta.*|\\.)?$"
    )

    // 9. Banco Santander: "Compra con tarjeta de 23,50 EUR en Decathlon" o "Pago con tarjeta Santander de 18,90 EUR en DIA"
    private val SANTANDER_PAYMENT_REGEX = Pattern.compile(
        "(?i)(?:Compra con tarjeta(?: Santander)? de|Pago con(?: tu)? tarjeta(?: Santander)? de|Pago de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+en\\s+(.+?)(?:\\.|\\s*$)"
    )

    // 10. CaixaBank & Imagin: "Has pagado 12,30 € con tu tarjeta en CARREFOUR" o "imagin: Compra por 14,99 € en Amazon"
    private val CAIXABANK_PAYMENT_REGEX = Pattern.compile(
        "(?i)(?:Has pagado|imagin:\\s*Compra por|Pago de|Compra de)\\s+([\\d.,]+)\\s*(EUR|€)(?:\\s+con\\s+(?:tu\\s+)?tarjeta.*?)?\\s+en\\s+(.+?)(?:\\.|\\s*$)"
    )

    // 11. Revolut: "Has gastado 8,50 € en Starbucks" o "Has pagado 12,00 € a Uber"
    private val REVOLUT_PAYMENT_REGEX = Pattern.compile(
        "(?i)(?:Has gastado|Has pagado|Pago de|Gasto de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+(?:en|a)\\s+(.+?)(?:\\.|\\s*$)"
    )

    // 12. N26: "Has pagado 19,90 € en FNAC" o "Pago aprobado: 19,90 € en FNAC"
    private val N26_PAYMENT_REGEX = Pattern.compile(
        "(?i)(?:Has pagado|Pago aprobado:?|Pago de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+en\\s+(.+?)(?:\\.|\\s*$)"
    )

    // 13. ING: "Compra con tu tarjeta ING de 35,00 € en Repsol" o "Has realizado una compra de 35,00 € en Repsol"
    private val ING_PAYMENT_REGEX = Pattern.compile(
        "(?i)(?:Compra con(?: tu)? tarjeta(?: ING)? de|Has realizado una compra de|Pago de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+en\\s+(.+?)(?:\\.|\\s*$)"
    )

    // 14. Openbank: "Pago con tarjeta de 16,40 EUR en VIPS"
    private val OPENBANK_PAYMENT_REGEX = Pattern.compile(
        "(?i)(?:Pago con tarjeta(?: Openbank)? de|Compra con tarjeta de)\\s+([\\d.,]+)\\s*(EUR|€)\\s+en\\s+(.+?)(?:\\.|\\s*$)"
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

        // 6. BBVA España
        val bbvaMatcher = BBVA_PAYMENT_REGEX.matcher(cleanText)
        if (bbvaMatcher.find()) {
            val amount = cleanAmount(bbvaMatcher.group(1))
            val currency = normalizeCurrency(bbvaMatcher.group(2))
            val merchant = bbvaMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio BBVA"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "BBVA España"

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

        // 7. Banco Santander
        val santanderMatcher = SANTANDER_PAYMENT_REGEX.matcher(cleanText)
        if (santanderMatcher.find()) {
            val amount = cleanAmount(santanderMatcher.group(1))
            val currency = normalizeCurrency(santanderMatcher.group(2))
            val merchant = santanderMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio Santander"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "Banco Santander"

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

        // 8. CaixaBank & Imagin
        val caixabankMatcher = CAIXABANK_PAYMENT_REGEX.matcher(cleanText)
        if (caixabankMatcher.find()) {
            val amount = cleanAmount(caixabankMatcher.group(1))
            val currency = normalizeCurrency(caixabankMatcher.group(2))
            val merchant = caixabankMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio CaixaBank"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "CaixaBank & Imagin"

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

        // 9. Revolut
        val revolutMatcher = REVOLUT_PAYMENT_REGEX.matcher(cleanText)
        if (revolutMatcher.find()) {
            val amount = cleanAmount(revolutMatcher.group(1))
            val currency = normalizeCurrency(revolutMatcher.group(2))
            val merchant = revolutMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio Revolut"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "Revolut"

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

        // 10. N26
        val n26Matcher = N26_PAYMENT_REGEX.matcher(cleanText)
        if (n26Matcher.find()) {
            val amount = cleanAmount(n26Matcher.group(1))
            val currency = normalizeCurrency(n26Matcher.group(2))
            val merchant = n26Matcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio N26"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "N26"

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

        // 11. ING España
        val ingMatcher = ING_PAYMENT_REGEX.matcher(cleanText)
        if (ingMatcher.find()) {
            val amount = cleanAmount(ingMatcher.group(1))
            val currency = normalizeCurrency(ingMatcher.group(2))
            val merchant = ingMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio ING"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "ING España"

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

        // 12. Openbank
        val openbankMatcher = OPENBANK_PAYMENT_REGEX.matcher(cleanText)
        if (openbankMatcher.find()) {
            val amount = cleanAmount(openbankMatcher.group(1))
            val currency = normalizeCurrency(openbankMatcher.group(2))
            val merchant = openbankMatcher.group(3)?.trim()?.removeSuffix(".") ?: "Comercio Openbank"

            if (amount != null) {
                metadata["merchant"] = merchant
                metadata["source"] = "Openbank"

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

        // 13. Genérico de compra con tarjeta (fallback para cualquier banco español)
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

        // 14. Wallet formatos alternativos ("24,90 € en Mercadona")
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

        // 15. Wallet formato ("Mercadona 24,90 €")
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

        // 16. Motor Heurístico Universal para cualquier app instalada y monitorizada
        val universalResult = parseUniversalFinancialNotification(cleanTitle, cleanText, packageName, id, isoDate, postTime, metadata)
        if (universalResult != null) {
            return universalResult
        }

        return null
    }

    private val UNIVERSAL_AMOUNT_CURRENCY_REGEX = Pattern.compile(
        """(?i)(?:^|[^\w])([+-]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(€|EUR|\$|USD|GBP|£)"""
    )
    private val UNIVERSAL_CURRENCY_AMOUNT_REGEX = Pattern.compile(
        """(?i)(?:^|[^\w])(€|EUR|\$|USD|GBP|£)\s*([+-]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)"""
    )

    private val MERCHANT_IN_TEXT_REGEX = Pattern.compile(
        """(?i)(?:en|a|de)\s+([A-Z0-9\s._\-&'’]{2,30}?)(?:\s+(?:con|el|la|por|ref|tarjeta|\.|\,)|$)"""
    )

    private fun parseUniversalFinancialNotification(
        cleanTitle: String,
        cleanText: String,
        packageName: String,
        id: String,
        isoDate: String,
        postTime: Long,
        metadata: MutableMap<String, String>
    ): Transaction? {
        val fullContent = "$cleanTitle $cleanText"

        // 1. Extraer importe y moneda
        var rawAmount: String? = null
        var rawCurrency: String? = null

        val matcher1 = UNIVERSAL_AMOUNT_CURRENCY_REGEX.matcher(cleanText)
        if (matcher1.find()) {
            rawAmount = matcher1.group(1)
            rawCurrency = matcher1.group(2)
        } else {
            val matcher2 = UNIVERSAL_CURRENCY_AMOUNT_REGEX.matcher(cleanText)
            if (matcher2.find()) {
                rawCurrency = matcher2.group(1)
                rawAmount = matcher2.group(2)
            } else {
                // Probar en el título
                val matcherTitle = UNIVERSAL_AMOUNT_CURRENCY_REGEX.matcher(cleanTitle)
                if (matcherTitle.find()) {
                    rawAmount = matcherTitle.group(1)
                    rawCurrency = matcherTitle.group(2)
                }
            }
        }

        val amount = cleanAmount(rawAmount) ?: return null
        val currency = normalizeCurrency(rawCurrency)

        // 2. Determinar si es Ingreso o Gasto
        val lowerContent = fullContent.lowercase()
        val isIncome = lowerContent.contains("recibido") ||
                lowerContent.contains("recibida") ||
                lowerContent.contains("ingreso") ||
                lowerContent.contains("abono") ||
                lowerContent.contains("nómina") ||
                lowerContent.contains("devolución") ||
                lowerContent.contains("reembolso") ||
                lowerContent.contains("transferencia a tu favor") ||
                lowerContent.contains("bizum de") ||
                lowerContent.contains("received")

        val txType = if (isIncome) TransactionType.INCOME else TransactionType.EXPENSE

        // 3. Extraer comercio o concepto
        var merchant: String? = null
        val merchantMatcher = MERCHANT_IN_TEXT_REGEX.matcher(cleanText)
        if (merchantMatcher.find()) {
            val candidate = merchantMatcher.group(1)?.trim()
            if (!candidate.isNullOrBlank() && candidate.length > 1) {
                merchant = candidate
            }
        }

        if (merchant.isNullOrBlank()) {
            val bankName = detectBankName(packageName)
            merchant = if (cleanTitle.isNotBlank() && !cleanTitle.equals(bankName, ignoreCase = true)) {
                cleanTitle
            } else {
                if (isIncome) "Ingreso detectado" else "Gasto en comercio"
            }
        }

        val bankSource = detectBankName(packageName)
        metadata["merchant"] = merchant
        metadata["source"] = bankSource
        metadata["universal_detected"] = "true"

        return Transaction(
            id = id,
            description = merchant,
            amount = amount,
            currency = currency,
            type = txType,
            category = CategoryClassifier.classify(merchant, isIncome = isIncome),
            date = isoDate,
            timestamp = postTime,
            source = TransactionSource.NOTIFICATION,
            rawNotificationText = cleanText,
            metadata = metadata
        )
    }

    fun detectBankName(pkg: String): String {
        val supported = com.carlosivars.financias.model.SupportedBankApp.findByPackage(pkg)
        if (supported != null) return supported.name

        return when {
            pkg.contains("wallet", ignoreCase = true) -> "Google Wallet"
            pkg.contains("sabadell", ignoreCase = true) || pkg.contains("inverline", ignoreCase = true) -> "Banco Sabadell"
            pkg.contains("bbva", ignoreCase = true) -> "BBVA España"
            pkg.contains("santander", ignoreCase = true) -> "Banco Santander"
            pkg.contains("caixabank", ignoreCase = true) || pkg.contains("imagin", ignoreCase = true) -> "CaixaBank & Imagin"
            pkg.contains("revolut", ignoreCase = true) -> "Revolut"
            pkg.contains("n26", ignoreCase = true) || pkg.contains("number26", ignoreCase = true) -> "N26"
            pkg.contains("openbank", ignoreCase = true) -> "Openbank"
            pkg.contains("ing", ignoreCase = true) -> "ING España"
            pkg.contains("bankinter", ignoreCase = true) -> "Bankinter"
            pkg.contains("unicaja", ignoreCase = true) -> "Unicaja Banco"
            pkg.contains("kutxa", ignoreCase = true) || pkg.contains("cajasur", ignoreCase = true) -> "Kutxabank"
            pkg.contains("abanca", ignoreCase = true) -> "Abanca"
            pkg.contains("ibercaja", ignoreCase = true) -> "Ibercaja"
            pkg.contains("paypal", ignoreCase = true) -> "PayPal"
            pkg.contains("wise", ignoreCase = true) || pkg.contains("transferwise", ignoreCase = true) -> "Wise"
            pkg.contains("traderepublic", ignoreCase = true) -> "Trade Republic"
            pkg.contains("myinvestor", ignoreCase = true) -> "MyInvestor"
            pkg.contains("cajamar", ignoreCase = true) -> "Cajamar"
            pkg.contains("financias", ignoreCase = true) -> "FinancIAs Test Suite"
            else -> "App Monitoreada"
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
