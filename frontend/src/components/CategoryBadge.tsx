import React from 'react';
import {
    Car,
    ShoppingCart,
    ShoppingBag,
    House,
    Utensils,
    Cross,
    CreditCard,
    BriefcaseBusiness,
    GraduationCap,
    Gamepad2,
    Tv,
    PiggyBank,
    Plane,
    Coffee,
    Receipt,
    PawPrint,
    Fuel,
    CircleParking,
    Shirt,
    Wrench,
    Wifi,
    Gift,
    Smartphone,
    HelpCircle
} from 'lucide-react';
import type { Category } from '../services/api';

export const CATEGORY_ICONS_LIST: Array<{ value: string; icon: React.ElementType; label: string }> = [
    { value: 'restaurant', icon: Utensils, label: 'Comida / Restaurantes' },
    { value: 'shopping_cart', icon: ShoppingCart, label: 'Supermercado' },
    { value: 'directions_car', icon: Car, label: 'Transporte / Vehículo' },
    { value: 'local_gas_station', icon: Fuel, label: 'Gasolina / Combustible' },
    { value: 'local_parking', icon: CircleParking, label: 'Parking / Estacionamiento' },
    { value: 'home', icon: House, label: 'Hogar / Vivienda' },
    { value: 'sports_esports', icon: Gamepad2, label: 'Ocio / Videojuegos' },
    { value: 'local_hospital', icon: Cross, label: 'Salud / Farmacia' },
    { value: 'school', icon: GraduationCap, label: 'Educación / Cursos' },
    { value: 'checkroom', icon: Shirt, label: 'Ropa / Moda' },
    { value: 'shopping_bag', icon: ShoppingBag, label: 'Tiendas / Compras' },
    { value: 'subscriptions', icon: Tv, label: 'Suscripciones / Streaming' },
    { value: 'receipt', icon: Receipt, label: 'Facturas / Recibos' },
    { value: 'work', icon: BriefcaseBusiness, label: 'Trabajo / Nómina' },
    { value: 'savings', icon: PiggyBank, label: 'Ahorro / Inversión' },
    { value: 'flight', icon: Plane, label: 'Viajes / Vuelos' },
    { value: 'coffee', icon: Coffee, label: 'Cafeterías / Bares' },
    { value: 'pets', icon: PawPrint, label: 'Mascotas' },
    { value: 'smartphone', icon: Smartphone, label: 'Telefonía / Móvil' },
    { value: 'wifi', icon: Wifi, label: 'Internet / Conectividad' },
    { value: 'build', icon: Wrench, label: 'Mantenimiento / Taller' },
    { value: 'gift', icon: Gift, label: 'Regalos / Donaciones' },
    { value: 'credit_card', icon: CreditCard, label: 'Tarjeta / General' },
];

export const getCategoryIconComponent = (iconName?: string | null, fallbackName?: string | null): React.ElementType => {
    const raw = (iconName || '').trim().toLowerCase();
    
    // Direct matches
    if (raw === 'restaurant' || raw === 'food' || raw === 'utensils') return Utensils;
    if (raw === 'shopping_cart' || raw === 'cart' || raw === 'super') return ShoppingCart;
    if (raw === 'directions_car' || raw === 'car' || raw === 'transport') return Car;
    if (raw === 'local_gas_station' || raw === 'fuel' || raw === 'gas') return Fuel;
    if (raw === 'local_parking' || raw === 'parking') return CircleParking;
    if (raw === 'home' || raw === 'house' || raw === 'vivienda') return House;
    if (raw === 'sports_esports' || raw === 'game' || raw === 'ocio' || raw === 'leisure') return Gamepad2;
    if (raw === 'local_hospital' || raw === 'health' || raw === 'salud' || raw === 'cross') return Cross;
    if (raw === 'school' || raw === 'education' || raw === 'educacion') return GraduationCap;
    if (raw === 'checkroom' || raw === 'shirt' || raw === 'clothing' || raw === 'ropa') return Shirt;
    if (raw === 'shopping_bag' || raw === 'tienda') return ShoppingBag;
    if (raw === 'subscriptions' || raw === 'tv' || raw === 'streaming') return Tv;
    if (raw === 'receipt' || raw === 'factura' || raw === 'recibo') return Receipt;
    if (raw === 'work' || raw === 'salary' || raw === 'nomina') return BriefcaseBusiness;
    if (raw === 'savings' || raw === 'ahorro') return PiggyBank;
    if (raw === 'flight' || raw === 'viaje') return Plane;
    if (raw === 'coffee' || raw === 'cafe') return Coffee;
    if (raw === 'pets' || raw === 'mascota') return PawPrint;
    if (raw === 'smartphone' || raw === 'movil') return Smartphone;
    if (raw === 'wifi' || raw === 'internet') return Wifi;
    if (raw === 'build' || raw === 'wrench') return Wrench;
    if (raw === 'gift' || raw === 'regalo') return Gift;
    if (raw === 'credit_card') return CreditCard;

    // Fallback matching by name
    const name = (fallbackName || '').toLowerCase();
    if (name.includes('gasolin') || name.includes('combustible')) return Fuel;
    if (name.includes('parking') || name.includes('aparcamiento')) return CircleParking;
    if (name.includes('coche') || name.includes('transport') || name.includes('peaje') || name.includes('taxi')) return Car;
    if (name.includes('super') || name.includes('compra') || name.includes('mercadona') || name.includes('carrefour') || name.includes('lidl') || name.includes('dia')) return ShoppingCart;
    if (name.includes('restauran') || name.includes('comida') || name.includes('cena') || name.includes('bar') || name.includes('alimenta')) return Utensils;
    if (name.includes('ropa') || name.includes('moda') || name.includes('zara') || name.includes('tienda')) return Shirt;
    if (name.includes('ocio') || name.includes('juego') || name.includes('cine') || name.includes('steam')) return Gamepad2;
    if (name.includes('salud') || name.includes('farmacia') || name.includes('medic') || name.includes('dentist') || name.includes('hospital')) return Cross;
    if (name.includes('hogar') || name.includes('vivienda') || name.includes('casa') || name.includes('alquiler') || name.includes('hipoteca')) return House;
    if (name.includes('educaci') || name.includes('curso') || name.includes('colegio') || name.includes('universidad')) return GraduationCap;
    if (name.includes('suscrip') || name.includes('netflix') || name.includes('spotify') || name.includes('hbo') || name.includes('prime')) return Tv;
    if (name.includes('nomina') || name.includes('sueldo') || name.includes('trabajo')) return BriefcaseBusiness;
    if (name.includes('ahorro') || name.includes('inversion') || name.includes('ingreso')) return PiggyBank;
    if (name.includes('recibo') || name.includes('factura') || name.includes('luz') || name.includes('agua') || name.includes('gas')) return Receipt;

    return CreditCard;
};

interface CategoryBadgeProps {
    categoryName?: string | null;
    parentCategoryName?: string | null;
    categoryColor?: string | null;
    categoryIcon?: string | null;
    categories?: Category[];
    categoryId?: number | null;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'pill' | 'icon-only' | 'row';
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
    categoryName,
    parentCategoryName,
    categoryColor,
    categoryIcon,
    categories,
    categoryId,
    size = 'sm',
    variant = 'pill',
    className = '',
    onClick
}) => {
    // Look up category in categories list if available
    let resolvedName = categoryName;
    let resolvedParent = parentCategoryName;
    let resolvedColor = categoryColor;
    let resolvedIcon = categoryIcon;

    if (categories && (categoryId || categoryName)) {
        const found = categories.find(c => 
            (categoryId && c.id === categoryId) || 
            (categoryName && c.name.toLowerCase() === categoryName.toLowerCase())
        );
        if (found) {
            resolvedName = resolvedName || found.name;
            resolvedParent = resolvedParent || found.parent_name;
            resolvedColor = resolvedColor || found.color;
            resolvedIcon = resolvedIcon || found.icon;
        }
    }

    const defaultColor = '#64748b';
    const finalColor = resolvedColor || defaultColor;
    const IconComponent = getCategoryIconComponent(resolvedIcon, resolvedName);

    const displayName = resolvedParent 
        ? `${resolvedParent} › ${resolvedName || 'General'}`
        : (resolvedName || 'Sin categoría');

    // Sizing maps
    const sizeConfig = {
        xs: {
            box: 'w-5 h-5 rounded-md',
            icon: 'w-3 h-3',
            text: 'text-[10px] px-1.5 py-0.5',
            gap: 'gap-1',
        },
        sm: {
            box: 'w-6 h-6 rounded-lg',
            icon: 'w-3.5 h-3.5',
            text: 'text-xs px-2.5 py-1',
            gap: 'gap-1.5',
        },
        md: {
            box: 'w-8 h-8 rounded-xl',
            icon: 'w-4 h-4',
            text: 'text-sm px-3 py-1.5',
            gap: 'gap-2',
        },
        lg: {
            box: 'w-10 h-10 rounded-xl',
            icon: 'w-5 h-5',
            text: 'text-base px-3.5 py-2',
            gap: 'gap-2.5',
        }
    }[size];

    if (variant === 'icon-only') {
        return (
            <div 
                className={`${sizeConfig.box} flex items-center justify-center flex-shrink-0 transition-transform ${className}`}
                style={{
                    backgroundColor: `${finalColor}22`,
                    color: finalColor,
                    border: `1.5px solid ${finalColor}50`
                }}
                title={displayName}
                onClick={onClick}
            >
                <IconComponent className={sizeConfig.icon} />
            </div>
        );
    }

    if (variant === 'row') {
        return (
            <div 
                className={`flex items-center ${sizeConfig.gap} ${className}`}
                onClick={onClick}
            >
                <div 
                    className={`${sizeConfig.box} flex items-center justify-center flex-shrink-0 shadow-sm`}
                    style={{
                        backgroundColor: `${finalColor}22`,
                        color: finalColor,
                        border: `1.5px solid ${finalColor}50`
                    }}
                >
                    <IconComponent className={sizeConfig.icon} />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">
                        {resolvedName || 'Sin categoría'}
                    </span>
                    {resolvedParent && (
                        <span className="text-[11px] text-muted-foreground truncate font-medium">
                            {resolvedParent}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Default: 'pill'
    return (
        <span
            className={`inline-flex items-center ${sizeConfig.gap} ${sizeConfig.text} rounded-full font-semibold shadow-sm transition-all border ${
                onClick ? 'cursor-pointer hover:ring-2 hover:ring-primary/20' : ''
            } ${className}`}
            style={{
                backgroundColor: `${finalColor}15`,
                borderColor: `${finalColor}40`,
            }}
            onClick={onClick}
            title={displayName}
        >
            <span 
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                    backgroundColor: `${finalColor}25`,
                    color: finalColor,
                }}
            >
                <IconComponent className="w-2.5 h-2.5" />
            </span>
            <span className="truncate max-w-[200px]" style={{ color: finalColor }}>
                {displayName}
            </span>
        </span>
    );
};

