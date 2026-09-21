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
            Category("transport", "Transporte", "directions_car", "#f97316"),
            Category("housing", "Hogar", "home", "#eab308"),
            Category("leisure", "Ocio", "sports_bar", "#22c55e"),
            Category("health", "Salud", "favorite", "#06b6d4"),
            Category("education", "Educación", "school", "#8b5cf6"),
            Category("clothing", "Ropa", "checkroom", "#ec4899"),
            Category("subscriptions", "Suscripciones", "subscriptions", "#6366f1"),
            Category("other_expenses", "Otros gastos", "category", "#64748b"),
            Category("salary", "Nómina", "payments", "#10b981", isIncome = true),
            Category("other_income", "Otros ingresos", "payments", "#34d399", isIncome = true)
        )

        fun findByName(name: String): Category {
            return ALL.find { 
                it.name.equals(name, ignoreCase = true) || 
                it.id.equals(name, ignoreCase = true) 
            } ?: ALL.first { it.id == "other_expenses" }
        }

        fun getRootCategories(): List<Category> {
            return ALL.filter { it.parentId == null }
        }

        fun getSubcategories(parentId: String): List<Category> {
            return ALL.filter { it.parentId == parentId }
        }
    }
}
