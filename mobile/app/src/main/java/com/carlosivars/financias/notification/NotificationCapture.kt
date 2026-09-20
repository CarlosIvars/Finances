package com.carlosivars.financias.notification

import com.carlosivars.financias.model.CapturedNotification
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

object NotificationCapture {

    private const val MAX_STORED = 150

    private val _notifications = MutableStateFlow<List<CapturedNotification>>(emptyList())
    val notifications: StateFlow<List<CapturedNotification>> = _notifications.asStateFlow()

    private val _isServiceConnected = MutableStateFlow(false)
    val isServiceConnected: StateFlow<Boolean> = _isServiceConnected.asStateFlow()

    fun onServiceConnected() {
        _isServiceConnected.value = true
    }

    fun onServiceDisconnected() {
        _isServiceConnected.value = false
    }

    fun addNotification(notification: CapturedNotification) {
        _notifications.update { current ->
            val updated = listOf(notification) + current
            if (updated.size > MAX_STORED) updated.take(MAX_STORED) else updated
        }
    }

    fun clear() {
        _notifications.value = emptyList()
    }
}

