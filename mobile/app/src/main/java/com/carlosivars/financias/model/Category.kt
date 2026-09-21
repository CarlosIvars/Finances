package com.carlosivars.financias.model

data class Category(
    val id: String,
    val name: String,
    val icon: String,
    val colorHex: String,
    val isIncome: Boolean = false,
    val parentId: String? = null,
    val parentName: String? = null
) {
    companion object {
        val ALL = listOf(
            Category("food", "Alimentación", "restaurant", "#ef4444"),
            Category("supermarket", "Supermercado", "shopping_cart", "#ef4444", parentId = "food", parentName = "Alimentación"),
            Category("restaurants", "Restaurantes", "restaurant", "#ef4444", parentId = "food", parentName = "Alimentación"),
            Category("transport", "Transporte", "directions_car", "#f97316"),
            Category("gasoline", "Gasolina", "local_gas_station", "#f97316", parentId = "transport", parentName = "Transporte"),
            Category("parking", "Parking", "local_parking", "#f97316", parentId = "transport", parentName = "Transporte"),
            Category("housing", "Hogar", "home", "#eab308"),
            Category("leisure", "Ocio", "sports_esports", "#22c55e"),
            Category("health", "Salud", "local_hospital", "#06b6d4"),
            Category("education", "Educación", "school", "#8b5cf6"),
            Category("clothing", "Ropa", "checkroom", "#ec4899"),
            Category("subscriptions", "Suscripciones", "subscriptions", "#6366f1"),
            Category("other_expenses", "Otros gastos", "receipt", "#64748b"),
            Category("salary", "Nómina", "work", "#10b981", isIncome = true),
            Category("other_income", "Otros ingresos", "savings", "#34d399", isIncome = true)
        )

        fun findByName(name: String, customCategories: List<Category>? = null): Category {
            val cleanName = name.trim()
            if (!customCategories.isNullOrEmpty()) {
                val foundCustom = customCategories.find {
                    it.name.equals(cleanName, ignoreCase = true) ||
                    it.id.equals(cleanName, ignoreCase = true)
                }
                if (foundCustom != null) return foundCustom
            }
            val foundDefault = ALL.find { 
                it.name.equals(cleanName, ignoreCase = true) || 
                it.id.equals(cleanName, ignoreCase = true) 
            }
            if (foundDefault != null) return foundDefault

            val leafName = if (cleanName.contains("›")) cleanName.substringAfter("›").trim() else cleanName
            if (!customCategories.isNullOrEmpty()) {
                val foundLeaf = customCategories.find { it.name.equals(leafName, ignoreCase = true) }
                if (foundLeaf != null) return foundLeaf
            }
            val foundLeafDefault = ALL.find { it.name.equals(leafName, ignoreCase = true) }
            if (foundLeafDefault != null) return foundLeafDefault

            return ALL.first { it.id == "other_expenses" }
        }

        fun getRootCategories(): List<Category> {
            return ALL.filter { it.parentId == null }
        }

        fun getSubcategories(parentId: String): List<Category> {
            return ALL.filter { it.parentId == parentId }
        }
    }
}
