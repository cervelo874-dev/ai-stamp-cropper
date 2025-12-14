/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'neo-black': '#000000',
                'neo-white': '#FFFEF0',
                'neo-green': '#00FF00',
                'neo-pink': '#FF00FF',
                'neo-yellow': '#FFFF00',
            },
            boxShadow: {
                'neo': '4px 4px 0px 0px #000000',
                'neo-sm': '2px 2px 0px 0px #000000',
                'neo-lg': '8px 8px 0px 0px #000000',
            },
            borderWidth: {
                '3': '3px',
            },
        },
    },
    plugins: [],
}
