package com.carlosivars.financias.notification

import android.util.Log
import com.carlosivars.financias.model.Category
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

object AICategorizer {

    private const val TAG = "FinancIAsAICategorizer"
    private const val GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    /**
     * Clasifica un comercio o concepto bancario usando la API de Gemini.
     * Devuelve el nombre exacto de la categoría si tiene éxito, o null si falla o no hay clave.
     */
    suspend fun categorizeWithGemini(
        merchantOrConcept: String,
        amount: Double,
        isIncome: Boolean,
        apiKey: String,
        model: String = "gemini-3.8-flash"
    ): String? = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) return@withContext null

        try {
            val endpoint = "$GEMINI_BASE_URL/$model:generateContent?key=$apiKey"
            val url = URL(endpoint)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("x-goog-api-key", apiKey)
            connection.connectTimeout = 6000
            connection.readTimeout = 6000
            connection.doOutput = true

            val categoriesList = Category.ALL
                .filter { it.isIncome == isIncome }
                .joinToString(", ") { it.name }

            val prompt = """
                Actúa como clasificador financiero para una app bancaria.
                Clasifica la siguiente transacción en EXACTAMENTE UNA de estas categorías permitidas:
                [$categoriesList]

                Transacción:
                - Concepto/Comercio: "$merchantOrConcept"
                - Importe: $amount €
                - Tipo: ${if (isIncome) "Ingreso" else "Gasto"}

                Responde ÚNICAMENTE con el nombre exacto de la categoría elegida, sin explicaciones ni comillas.
            """.trimIndent()

            val requestBody = JSONObject().apply {
                val contents = JSONArray().apply {
                    val contentObj = JSONObject().apply {
                        val parts = JSONArray().apply {
                            val partObj = JSONObject().apply {
                                put("text", prompt)
                            }
                            put(partObj)
                        }
                        put("parts", parts)
                    }
                    put(contentObj)
                }
                put("contents", contents)

                val genConfig = JSONObject().apply {
                    put("temperature", 0.1)
                    put("maxOutputTokens", 20)
                }
                put("generationConfig", genConfig)
            }

            OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                writer.write(requestBody.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode
            if (responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(connection.inputStream, "UTF-8"))
                val responseText = reader.use { it.readText() }
                val responseJson = JSONObject(responseText)

                val candidates = responseJson.optJSONArray("candidates")
                if (candidates != null && candidates.length() > 0) {
                    val firstCandidate = candidates.getJSONObject(0)
                    val content = firstCandidate.optJSONObject("content")
                    val parts = content?.optJSONArray("parts")
                    if (parts != null && parts.length() > 0) {
                        val rawCategory = parts.getJSONObject(0).optString("text", "").trim()
                        val matched = Category.ALL.find {
                            it.name.equals(rawCategory, ignoreCase = true) ||
                                    it.id.equals(rawCategory, ignoreCase = true)
                        }
                        if (matched != null) {
                            Log.i(TAG, "Gemini clasificó '$merchantOrConcept' como '${matched.name}'")
                            return@withContext matched.name
                        }
                    }
                }
            } else {
                val errStream = connection.errorStream
                val errText = if (errStream != null) {
                    BufferedReader(InputStreamReader(errStream, "UTF-8")).use { it.readText() }
                } else {
                    "Sin contenido"
                }
                Log.e(TAG, "Gemini API HTTP $responseCode: $errText")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error invocando Gemini API: ${e.message}", e)
        }

        return@withContext null
    }

    /**
     * Prueba interactiva que devuelve éxito o el mensaje de error exacto devuelto por Google.
     */
    suspend fun testCategorization(
        merchantOrConcept: String,
        apiKey: String,
        model: String
    ): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) return@withContext Pair(false, "La clave de API está vacía.")

        try {
            val endpoint = "$GEMINI_BASE_URL/$model:generateContent?key=$apiKey"
            val url = URL(endpoint)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("x-goog-api-key", apiKey)
            connection.connectTimeout = 6000
            connection.readTimeout = 6000
            connection.doOutput = true

            val prompt = "Clasifica '$merchantOrConcept' en una sola palabra entre: Alimentación, Transporte, Ocio, Hogar, Salud, Suscripciones, Otros."
            val requestBody = JSONObject().apply {
                val contents = JSONArray().apply {
                    val contentObj = JSONObject().apply {
                        val parts = JSONArray().apply {
                            put(JSONObject().put("text", prompt))
                        }
                        put("parts", parts)
                    }
                    put(contentObj)
                }
                put("contents", contents)
            }

            OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                writer.write(requestBody.toString())
                writer.flush()
            }

            val responseCode = connection.responseCode
            if (responseCode in 200..299) {
                val responseText = BufferedReader(InputStreamReader(connection.inputStream, "UTF-8")).use { it.readText() }
                val responseJson = JSONObject(responseText)
                val candidates = responseJson.optJSONArray("candidates")
                val text = candidates?.getJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts")?.getJSONObject(0)?.optString("text")?.trim() ?: "OK"
                Pair(true, "Clasificación exitosa ($model): '$text'")
            } else {
                val errStream = connection.errorStream
                val errBody = if (errStream != null) {
                    try {
                        val raw = BufferedReader(InputStreamReader(errStream, "UTF-8")).use { it.readText() }
                        val json = JSONObject(raw)
                        json.optJSONObject("error")?.optString("message") ?: raw
                    } catch (_: Exception) {
                        "Error HTTP $responseCode"
                    }
                } else {
                    "HTTP $responseCode"
                }
                Pair(false, "Google respondió (HTTP $responseCode): $errBody")
            }
        } catch (e: Exception) {
            Pair(false, "Fallo de conexión: ${e.localizedMessage ?: e.message}")
        }
    }
}

