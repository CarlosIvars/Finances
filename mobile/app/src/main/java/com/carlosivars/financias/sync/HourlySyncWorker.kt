package com.carlosivars.financias.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.carlosivars.financias.data.SecurePreferencesManager
import java.util.concurrent.TimeUnit

/** WorkManager is Android's persistent, battery-aware replacement for an in-process cron. */
class HourlySyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val prefs = SecurePreferencesManager(applicationContext)
        if (!prefs.isCloudSyncEnabled || prefs.cloudServerUrl.isBlank()) return Result.success()
        return if (SyncManager(applicationContext).performFullSync().success) Result.success() else Result.retry()
    }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HourlySyncWorker>(1, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "financias-hourly-sync", ExistingPeriodicWorkPolicy.UPDATE, request
            )
        }
    }
}
