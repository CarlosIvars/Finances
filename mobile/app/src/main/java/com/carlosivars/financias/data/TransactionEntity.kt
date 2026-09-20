package com.carlosivars.financias.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionSource
import com.carlosivars.financias.model.TransactionType

@Entity(
    tableName = "transactions",
    indices = [
        Index(value = ["notificationHash"], unique = true)
    ]
)
data class TransactionEntity(
    @PrimaryKey val id: String,
    val description: String,
    val amount: Double,
    val currency: String,
    val type: String, // "INCOME" o "EXPENSE"
    val category: String,
    val date: String,
    val timestamp: Long,
    val source: String,
    val notificationHash: String,
    val rawText: String?
) {
    fun toDomain(): Transaction {
        return Transaction(
            id = id,
            description = description,
            amount = amount,
            currency = currency,
            type = if (type == "INCOME") TransactionType.INCOME else TransactionType.EXPENSE,
            category = category,
            date = date,
            timestamp = timestamp,
            source = TransactionSource.valueOf(source),
            rawNotificationText = rawText
        )
    }

    companion object {
        fun fromDomain(domain: Transaction, notificationHash: String): TransactionEntity {
            return TransactionEntity(
                id = domain.id,
                description = domain.description,
                amount = domain.amount,
                currency = domain.currency,
                type = domain.type.name,
                category = domain.category,
                date = domain.date,
                timestamp = domain.timestamp,
                source = domain.source.name,
                notificationHash = notificationHash,
                rawText = domain.rawNotificationText
            )
        }
    }
}

