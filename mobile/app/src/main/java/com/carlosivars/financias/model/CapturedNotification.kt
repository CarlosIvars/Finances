package com.carlosivars.financias.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class CapturedNotification(
    val id: String,
    val packageName: String,
    val notificationId: Int,
    val tag: String?,
    val postTime: Long,
    val title: String,
    val text: String,
    val subText: String?,
    val category: String?,
    val extras: Map<String, String>
) {
    val formattedTime: String
        get() {
            val sdf = SimpleDateFormat("HH:mm:ss dd/MM/yyyy", Locale.getDefault())
            return sdf.format(Date(postTime))
        }

    fun toReadableString(): String {
        return buildString {
            appendLine("Package: $packageName")
            appendLine("Time: $formattedTime ($postTime)")
            appendLine("Title: $title")
            appendLine("Text: $text")
            if (!subText.isNullOrBlank()) {
                appendLine("SubText: $subText")
            }
            appendLine("ID: $notificationId | Tag: ${tag ?: "null"}")
            appendLine("Extras:")
            extras.forEach { (k, v) ->
                appendLine("  $k: $v")
            }
        }
    }
}

