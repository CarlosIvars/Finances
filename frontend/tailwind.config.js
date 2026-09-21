/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Inter', 'sans-serif'],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                income: {
                    DEFAULT: "#10b981",
                    foreground: "#ffffff",
                },
                expense: {
                    DEFAULT: "#ef4444",
                    foreground: "#ffffff",
                },
            },
            borderRadius: {
                '3xl': "calc(var(--radius) + 8px)",
                '2xl': "var(--radius)", /* 16px */
                xl: "calc(var(--radius) - 2px)", /* 14px */
                lg: "calc(var(--radius) - 4px)", /* 12px */
                md: "calc(var(--radius) - 6px)", /* 10px */
                sm: "calc(var(--radius) - 8px)", /* 8px */
            },
        },
    },
    plugins: [],
}
