package com.carlosivars.financias.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.carlosivars.financias.model.Category

/**
 * Icono vectorial oficial para Ropa (Camiseta / Shirt), idéntico al icono de la web
 * para garantizar consistencia visual absoluta entre Web y Móvil.
 */
val ShirtIcon: ImageVector by lazy {
    ImageVector.Builder(
        name = "Shirt",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).addPath(
        pathData = PathParser().parsePathString(
            "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"
        ).toNodes(),
        fill = SolidColor(Color.White)
    ).build()
}

/**
 * Retorna el ImageVector correspondiente a una categoría de gasto/ingreso,
 * garantizando la máxima consistencia visual fintech en toda la aplicación.
 */
fun getCategoryVectorIcon(categoryIdOrName: String?, iconName: String? = null): ImageVector {
    when (iconName?.lowercase()?.trim()) {
        "directions_car", "car" -> return Icons.Default.DirectionsCar
        "local_gas_station", "gas", "fuel" -> return Icons.Default.LocalGasStation
        "local_parking", "parking" -> return Icons.Default.LocalParking
        "shopping_cart", "cart" -> return Icons.Default.ShoppingCart
        "shopping_bag", "tienda" -> return Icons.Default.ShoppingBag
        "checkroom", "shirt", "clothing", "ropa" -> return ShirtIcon
        "home", "house" -> return Icons.Default.Home
        "restaurant", "food", "utensils" -> return Icons.Default.Restaurant
        "local_hospital", "health", "salud", "cross" -> return Icons.Default.LocalHospital
        "medication", "pill" -> return Icons.Default.Medication
        "subscriptions", "tv" -> return Icons.Default.Tv
        "work", "payments" -> return Icons.Default.Work
        "savings" -> return Icons.Default.Savings
        "school" -> return Icons.Default.School
        "sports_esports", "leisure", "sports_bar" -> return Icons.Default.SportsEsports
        "flight", "travel" -> return Icons.Default.Flight
        "coffee", "cafe" -> return Icons.Default.LocalCafe
        "receipt" -> return Icons.Default.Receipt
        "pets" -> return Icons.Default.Pets
        "build", "wrench" -> return Icons.Default.Build
        "wifi" -> return Icons.Default.Wifi
        "gift", "card_giftcard" -> return Icons.Default.CardGiftcard
        "smartphone" -> return Icons.Default.Smartphone
        "category" -> return Icons.Default.Category
        "credit_card" -> return Icons.Default.CreditCard
    }

    val id = categoryIdOrName?.lowercase()?.trim() ?: ""
    return when {
        id.contains("gasolin") || id.contains("combustible") -> Icons.Default.LocalGasStation
        id.contains("parking") || id.contains("aparcamiento") -> Icons.Default.LocalParking
        id.contains("transport") || id.contains("coche") || id.contains("peaje") -> Icons.Default.DirectionsCar
        id.contains("super") || id.contains("compra") -> Icons.Default.ShoppingCart
        id.contains("restaur") || id.contains("comida") || id.contains("cena") || id.contains("bar") || id.contains("alimenta") -> Icons.Default.Restaurant
        id.contains("ropa") || id.contains("moda") -> ShirtIcon
        id.contains("tienda") -> Icons.Default.ShoppingBag
        id.contains("leisure") || id.contains("ocio") || id.contains("entreten") || id.contains("cine") || id.contains("juego") -> Icons.Default.SportsEsports
        id.contains("housing") || id.contains("vivienda") || id.contains("hogar") || id.contains("alquiler") || id.contains("hipoteca") -> Icons.Default.Home
        id.contains("health") || id.contains("salud") || id.contains("farmacia") || id.contains("medic") -> Icons.Default.LocalHospital
        id.contains("subscription") || id.contains("suscrip") || id.contains("streaming") || id.contains("netflix") || id.contains("spotify") -> Icons.Default.Tv
        id.contains("salary") || id.contains("nomina") || id.contains("sueldo") -> Icons.Default.Work
        id.contains("saving") || id.contains("ahorro") || id.contains("inversion") || id.contains("ingreso") -> Icons.Default.Savings
        id.contains("viaje") || id.contains("vuelo") || id.contains("hotel") -> Icons.Default.Flight
        id.contains("cafe") || id.contains("desayuno") -> Icons.Default.LocalCafe
        id.contains("factura") || id.contains("recibo") || id.contains("impuesto") || id.contains("luz") || id.contains("agua") -> Icons.Default.Receipt
        id.contains("mascota") || id.contains("veterinari") || id.contains("perro") || id.contains("gato") -> Icons.Default.Pets
        id.contains("transfer") || id.contains("bizum") || id.contains("envio") -> Icons.Default.SwapHoriz
        id.contains("bank") || id.contains("banco") || id.contains("cuenta") -> Icons.Default.AccountBalance
        else -> Icons.Default.CreditCard
    }
}

/**
 * Componente visual reutilizable para mostrar el icono de categoría en un contenedor redondeado
 * translúcido con el color temático oficial de la categoría.
 */
@Composable
fun CategoryIcon(
    categoryIdOrName: String?,
    iconName: String? = null,
    colorHex: String? = null,
    categories: List<Category>? = null,
    size: Dp = 36.dp,
    iconSize: Dp = 18.dp,
    shapeRadius: Dp = 10.dp,
    modifier: Modifier = Modifier
) {
    val cat = Category.findByName(categoryIdOrName ?: "", categories)
    val resolvedIconName = if (!iconName.isNullOrBlank()) iconName else cat.icon
    val catColor = if (!colorHex.isNullOrBlank()) {
        try {
            Color(android.graphics.Color.parseColor(colorHex))
        } catch (_: Exception) {
            MaterialTheme.colorScheme.primary
        }
    } else {
        try {
            Color(android.graphics.Color.parseColor(cat.colorHex))
        } catch (_: Exception) {
            MaterialTheme.colorScheme.primary
        }
    }

    val iconVector = getCategoryVectorIcon(categoryIdOrName, resolvedIconName)

    Box(
        modifier = modifier
            .size(size)
            .background(
                color = catColor.copy(alpha = 0.15f),
                shape = RoundedCornerShape(shapeRadius)
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = iconVector,
            contentDescription = categoryIdOrName,
            tint = catColor,
            modifier = Modifier.size(iconSize)
        )
    }
}
