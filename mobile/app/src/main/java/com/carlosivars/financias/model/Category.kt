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
            Category("food", "Alimentación", "restaurant", "#10B981"),
            Category("food_supermarket", "Supermercado", "shopping_cart", "#10B981", parentId = "food", parentName = "Alimentación"),
            Category("food_restaurant", "Restaurantes", "restaurant", "#10B981", parentId = "food", parentName = "Alimentación"),
            Category("transport", "Transporte", "directions_car", "#3B82F6"),
            Category("transport_fuel", "Gasolina", "local_gas_station", "#3B82F6", parentId = "transport", parentName = "Transporte"),
            Category("transport_parking", "Parking & Peajes", "local_parking", "#3B82F6", parentId = "transport", parentName = "Transporte"),
            Category("housing", "Hogar & Servicios", "home", "#8B5CF6"),
            Category("housing_utilities", "Luz, Gas y Agua", "bolt", "#8B5CF6", parentId = "housing", parentName = "Hogar & Servicios"),
            Category("housing_internet", "Internet & Telefonía", "wifi", "#8B5CF6", parentId = "housing", parentName = "Hogar & Servicios"),
            Category("leisure", "Ocio & Restauración", "sports_bar", "#F59E0B"),
            Category("leisure_drinks", "Bares & Copas", "local_bar", "#F59E0B", parentId = "leisure", parentName = "Ocio & Restauración"),
            Category("health", "Salud & Bienestar", "favorite", "#EC4899"),
            Category("health_pharmacy", "Farmacia", "local_pharmacy", "#EC4899", parentId = "health", parentName = "Salud & Bienestar"),
            Category("subscriptions", "Suscripciones", "subscriptions", "#6366F1"),
            Category("subscriptions_streaming", "Streaming & Software", "tv", "#6366F1", parentId = "subscriptions", parentName = "Suscripciones"),
            Category("transfers", "Transferencias / Bizum", "swap_horiz", "#14B8A6"),
            Category("salary", "Nómina / Ingresos", "payments", "#22C55E", isIncome = true),
            Category("other", "Otros", "category", "#94A3B8")
        )

        fun findByName(name: String): Category {
            return ALL.find { 
                it.name.equals(name, ignoreCase = true) || 
                it.id.equals(name, ignoreCase = true) 
            } ?: ALL.last()
        }

        fun getRootCategories(): List<Category> {
            return ALL.filter { it.parentId == null }
        }

        fun getSubcategories(parentId: String): List<Category> {
            return ALL.filter { it.parentId == parentId }
        }
    }
}
