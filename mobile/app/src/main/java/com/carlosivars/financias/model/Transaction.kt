package com.carlosivars.financias.model

enum class TransactionType {
    INCOME,
    EXPENSE
}

enum class TransactionSource {
    NOTIFICATION,
    STATEMENT,
    MANUAL
}

data class Transaction(
    val id: String,
    val description: String,
    val amount: Double,
    val currency: String,
    val type: TransactionType,
    val category: String,
    val categoryServerId: Int? = null,
    val subCategory: String? = null,
    val parentCategory: String? = null,
    val date: String,
    val timestamp: Long,
    val source: TransactionSource,
    val rawNotificationText: String? = null,
    val metadata: Map<String, String> = emptyMap(),
    val pendingSync: Boolean = true,
    val serverId: Int? = null
)
