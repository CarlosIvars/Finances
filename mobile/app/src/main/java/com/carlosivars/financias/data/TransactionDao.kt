package com.carlosivars.financias.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {

    @Query("SELECT * FROM transactions ORDER BY timestamp DESC")
    fun getAllTransactions(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions WHERE id = :id LIMIT 1")
    suspend fun getTransactionById(id: String): TransactionEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertTransaction(transaction: TransactionEntity): Long

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun deleteTransaction(id: String)

    @Query("DELETE FROM transactions")
    suspend fun clearAll()
}

