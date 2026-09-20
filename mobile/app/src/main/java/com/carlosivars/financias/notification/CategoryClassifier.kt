package com.carlosivars.financias.notification

import com.carlosivars.financias.model.Category
import java.util.Locale

object CategoryClassifier {

    private val foodKeywords = listOf(
        "mercadona", "carrefour", "lidl", "dia", "alcampo", "eroski", "consum", "aldi",
        "supermercado", "supermarket", "fruteria", "panaderia", "carniceria", "pescaderia"
    )

    private val transportKeywords = listOf(
        "repsol", "cepsa", "bp", "shell", "gasolinera", "gasoil", "gasolina",
        "uber", "cabify", "bolt", "taxi", "renfe", "metro", "emt", "alsa", "parking", "peaje", "ap-7", "estacion"
    )

    private val leisureKeywords = listOf(
        "restaurante", "bar", "cafe", "cafeteria", "burger", "pizza", "mcdonald", "kfc",
        "starbucks", "cerveceria", "taberna", "cine", "yelmo", "cinesa", "entradas", "pub", "discoteca"
    )

    private val subscriptionsKeywords = listOf(
        "netflix", "spotify", "amazon", "prime", "hbo", "max", "disney", "apple", "google",
        "dazn", "youtube", "patreon", "playstation", "xbox", "nintendo"
    )

    private val housingKeywords = listOf(
        "endesa", "iberdrola", "naturgy", "agua", "gas", "luz", "vodafone", "movistar",
        "orange", "masmovil", "digi", "comunidad", "leroy", "ikea", "bricomart", "ferreteria"
    )

    private val healthKeywords = listOf(
        "farmacia", "clinica", "dentista", "hospital", "optica", "gym", "gimnasio", "crossfit",
        "fisioterapia", "podologia", "medicamento"
    )

    private val transferKeywords = listOf(
        "bizum", "transferencia", "envio", "traspaso"
    )

    private val salaryKeywords = listOf(
        "nomina", "sueldo", "honorarios", "ingreso nomina", "abono nomina"
    )

    fun classify(merchantOrText: String, isIncome: Boolean = false): String {
        val lower = merchantOrText.lowercase(Locale.ROOT)

        if (isIncome) {
            for (keyword in salaryKeywords) {
                if (lower.contains(keyword)) return "Nómina / Ingresos"
            }
            if (lower.contains("bizum")) return "Transferencias / Bizum"
            return "Nómina / Ingresos"
        }

        if (matchesAny(lower, foodKeywords)) return "Alimentación"
        if (matchesAny(lower, transportKeywords)) return "Transporte"
        if (matchesAny(lower, leisureKeywords)) return "Ocio & Restauración"
        if (matchesAny(lower, subscriptionsKeywords)) return "Suscripciones"
        if (matchesAny(lower, housingKeywords)) return "Hogar & Servicios"
        if (matchesAny(lower, healthKeywords)) return "Salud & Bienestar"
        if (matchesAny(lower, transferKeywords)) return "Transferencias / Bizum"

        return "Otros"
    }

    private fun matchesAny(text: String, keywords: List<String>): Boolean {
        return keywords.any { text.contains(it) }
    }
}

