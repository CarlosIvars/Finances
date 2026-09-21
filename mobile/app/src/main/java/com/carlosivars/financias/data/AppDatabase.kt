package com.carlosivars.financias.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [TransactionEntity::class, BudgetEntity::class, CategoryEntity::class],
    version = 6,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun transactionDao(): TransactionDao
    abstract fun budgetDao(): BudgetDao
    abstract fun categoryDao(): CategoryDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        /**
         * Migración 1 -> 2: Crear tabla budgets
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `budgets` (
                        `categoryId` TEXT NOT NULL PRIMARY KEY,
                        `categoryName` TEXT NOT NULL,
                        `monthlyLimit` REAL NOT NULL,
                        `colorHex` TEXT NOT NULL
                    )
                """.trimIndent())
            }
        }

        /**
         * Migración 2 -> 3: Soporte para sincronización (pendingSync, serverId)
         */
        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                try {
                    db.execSQL("ALTER TABLE `transactions` ADD COLUMN `pendingSync` INTEGER NOT NULL DEFAULT 1")
                } catch (_: Exception) {}
                try {
                    db.execSQL("ALTER TABLE `transactions` ADD COLUMN `serverId` INTEGER DEFAULT NULL")
                } catch (_: Exception) {}
            }
        }

        /**
         * Migración 3 -> 4: Soporte para metadatos ricos y categorías jerárquicas
         */
        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                try {
                    db.execSQL("ALTER TABLE `transactions` ADD COLUMN `subCategory` TEXT DEFAULT NULL")
                } catch (_: Exception) {}
                try {
                    db.execSQL("ALTER TABLE `transactions` ADD COLUMN `parentCategory` TEXT DEFAULT NULL")
                } catch (_: Exception) {}
                try {
                    db.execSQL("ALTER TABLE `transactions` ADD COLUMN `metadataJson` TEXT NOT NULL DEFAULT '{}'")
                } catch (_: Exception) {}
            }
        }

        /**
         * Migraciones directas para saltos de versión
         */
        val MIGRATION_1_4 = object : Migration(1, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                MIGRATION_1_2.migrate(db)
                MIGRATION_2_3.migrate(db)
                MIGRATION_3_4.migrate(db)
            }
        }

        val MIGRATION_2_4 = object : Migration(2, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                MIGRATION_2_3.migrate(db)
                MIGRATION_3_4.migrate(db)
            }
        }

        /** The mobile catalogue is a cache of the authenticated user's server categories. */
        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `transactions` ADD COLUMN `categoryServerId` INTEGER DEFAULT NULL")
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `categories` (
                        `serverId` INTEGER NOT NULL PRIMARY KEY,
                        `name` TEXT NOT NULL,
                        `parentServerId` INTEGER,
                        `parentName` TEXT,
                        `colorHex` TEXT NOT NULL,
                        `isIncome` INTEGER NOT NULL
                    )
                """.trimIndent())
            }
        }

        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `categories` ADD COLUMN `icon` TEXT NOT NULL DEFAULT 'credit_card'")
            }
        }

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "financias_local.db"
                )
                .addMigrations(
                    MIGRATION_1_2,
                    MIGRATION_2_3,
                    MIGRATION_3_4,
                    MIGRATION_1_4,
                    MIGRATION_2_4,
                    MIGRATION_4_5,
                    MIGRATION_5_6
                )
                .build()

                INSTANCE = instance
                instance
            }
        }
    }
}
