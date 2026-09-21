package com.carlosivars.financias.sync

import com.carlosivars.financias.data.TransactionEntity

data class MobileSyncConflict(
    val localTransaction: TransactionEntity,
    val serverDescription: String,
    val serverAmount: Double,
    val serverDate: String,
    val serverCategoryName: String,
    val serverCategoryServerId: Int?,
    val serverType: String,
    val serverId: Int
)

