package com.carlosivars.financias.model

data class Category(
    val id: String,
    val name: String,
    val icon: String,
    val colorHex: String,
    val isIncome: Boolean = false
) {
    companion object {
        val ALL = listOf(
            Category("food", "Alimentación", "restaurant", "#10B981"),
            Category("transport", "Transporte", "directions_car", "#3B82F6"),
            Category("housing", "Hogar & Servicios", "home", "#8B5CF6"),
            Category("leisure", "Ocio & Restauración", "sports_bar", "#F59E0B"),
            Category("health", "Salud & Bienestar", "favorite", "#EC4899"),
            Category("subscriptions", "Suscripciones", "subscriptions", "#6366F1"),
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
    }
}

