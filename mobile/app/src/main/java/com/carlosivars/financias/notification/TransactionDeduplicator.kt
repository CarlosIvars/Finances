package com.carlosivars.financias.notification

import com.carlosivars.financias.model.Transaction
import kotlin.math.abs
import kotlin.math.max

sealed class DeduplicationResult {
    object Unique : DeduplicationResult()
    data class DuplicateOf(val existingTransactionId: String, val reason: String) : DeduplicationResult()
}

object TransactionDeduplicator {

    /**
     * Ventana de tiempo máxima en milisegundos para considerar dos notificaciones
     * como potenciales duplicados de la misma compra (60 segundos).
     */
    const val DEDUP_WINDOW_MS = 60_000L

    /**
     * Evalúa si una nueva transacción candidata es duplicada de alguna transacción
     * recientemente registrada (ventana de 60s, mismo importe y comercio coincidente o similar).
     */
    fun checkDuplicate(
        candidate: Transaction,
        recentTransactions: List<Transaction>
    ): DeduplicationResult {
        val now = candidate.timestamp

        for (existing in recentTransactions) {
            // 1. Debe estar dentro de la ventana de tiempo de deduplicación
            val timeDiff = abs(now - existing.timestamp)
            if (timeDiff > DEDUP_WINDOW_MS) continue

            // 2. Mismo tipo (ingreso con ingreso, gasto con gasto)
            if (candidate.type != existing.type) continue

            // 3. Mismo importe (con tolerancia de 0.01 por posibles redondeos de divisa)
            if (abs(candidate.amount - existing.amount) > 0.01) continue

            // 4. Misma divisa
            if (!candidate.currency.equals(existing.currency, ignoreCase = true)) continue

            // 5. Comparar comercio / descripción
            val isSameMerchant = isMerchantMatch(candidate.description, existing.description)
            if (isSameMerchant) {
                return DeduplicationResult.DuplicateOf(
                    existingTransactionId = existing.id,
                    reason = "Mismo importe (${candidate.amount} €) y comercio coincidente en ventana de ${timeDiff / 1000}s ('${candidate.description}' vs '${existing.description}')"
                )
            }
        }

        return DeduplicationResult.Unique
    }

    /**
     * Compara dos descripciones de comercio para determinar si representan el mismo establecimiento.
     * Soporta substrings y distancia de Levenshtein normalizada.
     */
    fun isMerchantMatch(desc1: String, desc2: String): Boolean {
        val clean1 = normalizeMerchant(desc1)
        val clean2 = normalizeMerchant(desc2)

        if (clean1.isEmpty() || clean2.isEmpty()) return false

        // Coincidencia exacta
        if (clean1 == clean2) return true

        // Contención mutua (ej: "MERCADONA" dentro de "COMPRA EN MERCADONA S.A.")
        if (clean1.contains(clean2) || clean2.contains(clean1)) return true

        // Similitud Levenshtein para variaciones menores
        val distance = levenshteinDistance(clean1, clean2)
        val maxLen = max(clean1.length, clean2.length)
        val similarity = 1.0 - (distance.toDouble() / maxLen.toDouble())

        return similarity >= 0.65
    }

    private fun normalizeMerchant(raw: String): String {
        return raw.lowercase()
            .replace(Regex("""\b(pago|compra|tarjeta|tpv|en|de|s\.?a\.?|s\.?l\.?)\b"""), " ")
            .replace(Regex("""[^a-z0-9]"""), "")
            .trim()
    }

    private fun levenshteinDistance(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }

        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j

        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = minOf(
                    dp[i - 1][j] + 1,      // eliminación
                    dp[i][j - 1] + 1,      // inserción
                    dp[i - 1][j - 1] + cost // sustitución
                )
            }
        }

        return dp[s1.length][s2.length]
    }
}

