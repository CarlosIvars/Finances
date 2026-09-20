package com.carlosivars.financias.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "budgets")
data class BudgetEntity(
    @PrimaryKey val categoryId: String,
    val categoryName: String,
    val monthlyLimit: Double,
    val colorHex: String
)

