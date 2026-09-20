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
    val date: String,
    val timestamp: Long,
    val source: TransactionSource,
    val rawNotificationText: String? = null,
    val pendingSync: Boolean = false,
    val serverId: Int? = null
)

