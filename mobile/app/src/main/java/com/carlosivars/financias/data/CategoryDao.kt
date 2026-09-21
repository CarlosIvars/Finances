package com.carlosivars.financias.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY isIncome, name COLLATE NOCASE")
    fun observeAll(): Flow<List<CategoryEntity>>

    @Query("SELECT serverId FROM categories WHERE name = :name COLLATE NOCASE LIMIT 1")
    suspend fun findServerIdByName(name: String): Int?

    @Query("DELETE FROM categories")
    suspend fun clear()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(categories: List<CategoryEntity>)

    @Transaction
    suspend fun replaceAll(categories: List<CategoryEntity>) {
        clear()
        insertAll(categories)
    }
}
