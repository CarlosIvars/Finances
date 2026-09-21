package com.carlosivars.financias.ui.theme

import androidx.compose.ui.graphics.Color

// Shared Brand & Semantic Colors
val PrimaryBlue = Color(0xFF3B82F6)
val PrimaryBlueHover = Color(0xFF2563EB)
val IncomeGreen = Color(0xFF10B981)
val IncomeGreenBg = Color(0x1A10B981)
val ExpenseRed = Color(0xFFEF4444)
val ExpenseRedBg = Color(0x1AEF4444)

// Dark Palette (matching web dark mode: bg #0b1120, surface #1e293b)
val DarkBackground = Color(0xFF0B1120)
val DarkSurface = Color(0xFF1E293B)
val DarkSurfaceVariant = Color(0xFF334155)
val DarkBorder = Color(0xFF334155)
val DarkBorderSubtle = Color(0x1AFFFFFF)
val TextPrimaryDark = Color(0xFFF8FAFC)
val TextSecondaryDark = Color(0xFF94A3B8)
val TextMutedDark = Color(0xFF64748B)

// Light Palette (matching web light mode: bg #f8fafc, surface #ffffff)
val LightBackground = Color(0xFFF8FAFC)
val LightSurface = Color(0xFFFFFFFF)
val LightSurfaceVariant = Color(0xFFF1F5F9)
val LightBorder = Color(0xFFE2E8F0)
val LightBorderSubtle = Color(0x0F000000)
val TextPrimaryLight = Color(0xFF0F172A)
val TextSecondaryLight = Color(0xFF64748B)
val TextMutedLight = Color(0xFF94A3B8)

// Shared Chart Palette
val ChartPalette = listOf(
    Color(0xFF3B82F6), // blue
    Color(0xFF10B981), // emerald
    Color(0xFF8B5CF6), // purple
    Color(0xFFF59E0B), // amber
    Color(0xFFEC4899), // pink
    Color(0xFF06B6D4), // cyan
    Color(0xFFF97316), // orange
    Color(0xFF6366F1)  // indigo
)

// Backward-compatibility aliases
val CardBackground = DarkSurface
val CardBorder = DarkBorder
val AccentBlue = PrimaryBlue
val PrimaryAccent = PrimaryBlue
val TextPrimary = TextPrimaryDark
val TextSecondary = TextSecondaryDark
val TextMuted = TextMutedDark
