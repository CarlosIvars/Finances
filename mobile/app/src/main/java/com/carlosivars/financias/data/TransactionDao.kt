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

    @Query("SELECT * FROM transactions WHERE timestamp > :since ORDER BY timestamp DESC")
    suspend fun getTransactionsSince(since: Long): List<TransactionEntity>

    @Query("UPDATE transactions SET category = :category, pendingSync = 1 WHERE id = :id")
    suspend fun updateCategory(id: String, category: String): Int

    @Query("UPDATE transactions SET category = :category, subCategory = :subCategory, parentCategory = :parentCategory, pendingSync = 1 WHERE id = :id")
    suspend fun updateCategoryAndHierarchy(id: String, category: String, subCategory: String?, parentCategory: String?): Int

    @Query("SELECT * FROM transactions WHERE pendingSync = 1")
    suspend fun getPendingSyncTransactions(): List<TransactionEntity>

    @Query("SELECT COUNT(*) FROM transactions WHERE pendingSync = 1")
    suspend fun countPendingSync(): Int

    @Query("UPDATE transactions SET pendingSync = 0, serverId = :serverId WHERE id = :localId")
    suspend fun markAsSynced(localId: String, serverId: Int): Int

    @Query("SELECT * FROM transactions WHERE serverId = :serverId LIMIT 1")
    suspend fun getByServerId(serverId: Int): TransactionEntity?

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun deleteTransaction(id: String)

    @Query("DELETE FROM transactions")
    suspend fun clearAll()
}

