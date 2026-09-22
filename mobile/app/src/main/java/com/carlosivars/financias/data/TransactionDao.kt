package com.carlosivars.financias.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {

    @Query("SELECT * FROM transactions WHERE isDeleted = 0 ORDER BY timestamp DESC")
    fun getAllTransactions(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions WHERE id = :id AND isDeleted = 0 LIMIT 1")
    suspend fun getTransactionById(id: String): TransactionEntity?

    @Query("SELECT * FROM transactions WHERE id = :id LIMIT 1")
    suspend fun getRawTransactionById(id: String): TransactionEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertTransaction(transaction: TransactionEntity): Long

    @androidx.room.Update
    suspend fun updateTransaction(transaction: TransactionEntity): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTransaction(transaction: TransactionEntity): Long

    @Query("SELECT * FROM transactions WHERE timestamp > :since AND isDeleted = 0 ORDER BY timestamp DESC")
    suspend fun getTransactionsSince(since: Long): List<TransactionEntity>

    @Query("UPDATE transactions SET category = :category, categoryServerId = :categoryServerId, pendingSync = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateCategory(id: String, category: String, categoryServerId: Int?, updatedAt: Long = System.currentTimeMillis()): Int

    @Query("UPDATE transactions SET category = :category, categoryServerId = :categoryServerId, subCategory = :subCategory, parentCategory = :parentCategory, pendingSync = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateCategoryAndHierarchy(id: String, category: String, categoryServerId: Int?, subCategory: String?, parentCategory: String?, updatedAt: Long = System.currentTimeMillis()): Int

    @Query("SELECT * FROM transactions WHERE pendingSync = 1 AND isDeleted = 0")
    suspend fun getPendingSyncTransactions(): List<TransactionEntity>

    @Query("SELECT * FROM transactions WHERE pendingSync = 1 AND isDeleted = 1")
    suspend fun getPendingDeletedTransactions(): List<TransactionEntity>

    @Query("SELECT COUNT(*) FROM transactions WHERE pendingSync = 1")
    suspend fun countPendingSync(): Int

    @Query("UPDATE transactions SET pendingSync = 0, serverId = :serverId WHERE id = :localId")
    suspend fun markAsSynced(localId: String, serverId: Int): Int

    @Query("DELETE FROM transactions WHERE id = :localId AND isDeleted = 1")
    suspend fun markDeletedAsSynced(localId: String): Int

    @Query("SELECT * FROM transactions WHERE serverId = :serverId LIMIT 1")
    suspend fun getByServerId(serverId: Int): TransactionEntity?

    @Query("UPDATE transactions SET isDeleted = 1, pendingSync = 1, updatedAt = :updatedAt WHERE id = :id")
    suspend fun softDeleteTransaction(id: String, updatedAt: Long = System.currentTimeMillis()): Int

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun purgeTransaction(id: String): Int

    @Query("DELETE FROM transactions WHERE serverId = :serverId")
    suspend fun purgeByServerId(serverId: Int): Int

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun deleteTransaction(id: String)

    @Query("UPDATE transactions SET pendingSync = 1 WHERE serverId IS NULL AND isDeleted = 0")
    suspend fun markAllUnsyncedAsPending(): Int

    @Query("DELETE FROM transactions")
    suspend fun clearAll()
}
