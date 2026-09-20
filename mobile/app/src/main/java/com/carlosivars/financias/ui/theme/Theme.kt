package com.carlosivars.financias.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = AccentBlue,
    onPrimary = TextPrimary,
    primaryContainer = DarkSurfaceVariant,
    onPrimaryContainer = TextPrimary,
    background = DarkBackground,
    surface = DarkSurface,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = TextSecondary
)

@Composable
fun FinancIAsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}

