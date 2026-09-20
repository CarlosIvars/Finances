package com.carlosivars.financias.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecurePreferencesManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "financias_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var isCloudSyncEnabled: Boolean
        get() = sharedPreferences.getBoolean(KEY_CLOUD_SYNC_ENABLED, false)
        set(value) = sharedPreferences.edit().putBoolean(KEY_CLOUD_SYNC_ENABLED, value).apply()

    var cloudServerUrl: String
        get() = sharedPreferences.getString(KEY_CLOUD_SERVER_URL, "") ?: ""
        set(value) = sharedPreferences.edit().putString(KEY_CLOUD_SERVER_URL, value).apply()

    var cloudAuthToken: String
        get() = sharedPreferences.getString(KEY_CLOUD_AUTH_TOKEN, "") ?: ""
        set(value) = sharedPreferences.edit().putString(KEY_CLOUD_AUTH_TOKEN, value).apply()

    var lastSyncTimestamp: Long
        get() = sharedPreferences.getLong(KEY_LAST_SYNC, 0L)
        set(value) = sharedPreferences.edit().putLong(KEY_LAST_SYNC, value).apply()

    var isSabadellTrackerEnabled: Boolean
        get() = sharedPreferences.getBoolean(KEY_SABADELL_ENABLED, true)
        set(value) = sharedPreferences.edit().putBoolean(KEY_SABADELL_ENABLED, value).apply()

    var isBizumTrackerEnabled: Boolean
        get() = sharedPreferences.getBoolean(KEY_BIZUM_ENABLED, true)
        set(value) = sharedPreferences.edit().putBoolean(KEY_BIZUM_ENABLED, value).apply()

    var isWalletTrackerEnabled: Boolean
        get() = sharedPreferences.getBoolean(KEY_WALLET_ENABLED, true)
        set(value) = sharedPreferences.edit().putBoolean(KEY_WALLET_ENABLED, value).apply()

    companion object {
        private const val KEY_CLOUD_SYNC_ENABLED = "cloud_sync_enabled"
        private const val KEY_CLOUD_SERVER_URL = "cloud_server_url"
        private const val KEY_CLOUD_AUTH_TOKEN = "cloud_auth_token"
        private const val KEY_LAST_SYNC = "last_sync_timestamp"
        private const val KEY_SABADELL_ENABLED = "tracker_sabadell_enabled"
        private const val KEY_BIZUM_ENABLED = "tracker_bizum_enabled"
        private const val KEY_WALLET_ENABLED = "tracker_wallet_enabled"
    }
}

