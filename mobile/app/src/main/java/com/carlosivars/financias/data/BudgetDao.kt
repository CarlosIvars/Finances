package com.carlosivars.financias.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface BudgetDao {

    @Query("SELECT * FROM budgets ORDER BY monthlyLimit DESC")
    fun getAllBudgets(): Flow<List<BudgetEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setBudget(budget: BudgetEntity)

    @Query("DELETE FROM budgets WHERE categoryId = :categoryId")
    suspend fun deleteBudget(categoryId: String)
}

