/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#2563eb",
                secondary: "#64748b",
                success: "#22c55e",
                danger: "#ef4444",
                warning: "#f59e0b",
                background: "#0f172a", // Dark theme background
                surface: "#1e293b", // Card background
            }
        },
    },
    plugins: [],
}
