package com.carlosivars.financias.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface BudgetDao {

    @Query("SELECT * FROM budgets ORDER BY monthlyLimit DESC")
    fun getAllBudgets(): Flow<List<BudgetEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setBudget(budget: BudgetEntity)

    @Query("DELETE FROM budgets WHERE categoryId = :categoryId")
    suspend fun deleteBudget(categoryId: String)

    @Query("DELETE FROM budgets WHERE categoryName = :categoryName OR categoryId = :categoryId")
    suspend fun deleteByCategory(categoryId: String, categoryName: String)

    @Query("DELETE FROM budgets")
    suspend fun clear()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(budgets: List<BudgetEntity>)

    @Transaction
    suspend fun replaceAll(budgets: List<BudgetEntity>) {
        clear()
        insertAll(budgets)
    }
}

