package com.carlosivars.financias.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.carlosivars.financias.model.Transaction
import com.carlosivars.financias.model.TransactionSource
import com.carlosivars.financias.model.TransactionType
import org.json.JSONObject

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
    val categoryServerId: Int? = null,
    val subCategory: String? = null,
    val parentCategory: String? = null,
    val date: String,
    val timestamp: Long,
    val source: String,
    val notificationHash: String,
    val rawText: String?,
    val metadataJson: String = "{}",
    val pendingSync: Boolean = true,
    val serverId: Int? = null,
    val isDeleted: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
) {
    fun toDomain(): Transaction {
        val metaMap = mutableMapOf<String, String>()
        if (!metadataJson.isNullOrBlank() && metadataJson != "{}") {
            try {
                val json = JSONObject(metadataJson)
                val keys = json.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    metaMap[k] = json.optString(k, "")
                }
            } catch (_: Exception) {}
        }

        return Transaction(
            id = id,
            description = description,
            amount = amount,
            currency = currency,
            type = if (type == "INCOME") TransactionType.INCOME else TransactionType.EXPENSE,
            category = category,
            categoryServerId = categoryServerId,
            subCategory = subCategory,
            parentCategory = parentCategory,
            date = date,
            timestamp = timestamp,
            source = TransactionSource.valueOf(source),
            rawNotificationText = rawText,
            metadata = metaMap,
            pendingSync = pendingSync,
            serverId = serverId
        )
    }

    companion object {
        fun fromDomain(domain: Transaction, notificationHash: String): TransactionEntity {
            val metaJson = if (domain.metadata.isNotEmpty()) {
                val json = JSONObject()
                domain.metadata.forEach { (k, v) -> json.put(k, v) }
                json.toString()
            } else {
                "{}"
            }

            return TransactionEntity(
                id = domain.id,
                description = domain.description,
                amount = domain.amount,
                currency = domain.currency,
                type = domain.type.name,
                category = domain.category,
                categoryServerId = domain.categoryServerId,
                subCategory = domain.subCategory,
                parentCategory = domain.parentCategory,
                date = domain.date,
                timestamp = domain.timestamp,
                source = domain.source.name,
                notificationHash = notificationHash,
                rawText = domain.rawNotificationText,
                metadataJson = metaJson,
                pendingSync = domain.pendingSync,
                serverId = domain.serverId
            )
        }
    }
}
