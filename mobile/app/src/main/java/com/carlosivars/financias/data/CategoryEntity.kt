package com.carlosivars.financias.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.carlosivars.financias.model.Category

/** Cached copy of the category catalogue owned by the Django API. */
@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val serverId: Int,
    val name: String,
    val parentServerId: Int? = null,
    val parentName: String? = null,
    val colorHex: String,
    val icon: String,
    val isIncome: Boolean
) {
    fun toDomain() = Category(
        id = serverId.toString(),
        name = name,
        icon = icon,
        colorHex = colorHex,
        isIncome = isIncome,
        parentId = parentServerId?.toString(),
        parentName = parentName
    )
}
