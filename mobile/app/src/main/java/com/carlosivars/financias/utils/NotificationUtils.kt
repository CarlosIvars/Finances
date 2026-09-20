package com.carlosivars.financias.utils

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat

object NotificationUtils {

    fun isNotificationListenerEnabled(context: Context): Boolean {
        val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(context)
        if (enabledPackages.contains(context.packageName)) {
            return true
        }

        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        if (!flat.isNullOrEmpty()) {
            val names = flat.split(":")
            for (name in names) {
                val cn = ComponentName.unflattenFromString(name)
                if (cn != null && cn.packageName == context.packageName) {
                    return true
                }
            }
        }

        return false
    }

    fun openNotificationListenerSettings(context: Context) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    }
}

