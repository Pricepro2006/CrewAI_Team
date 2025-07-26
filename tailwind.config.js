/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#ffffff',
          dark: '#0a0a0a',
          secondary: '#f8f9fa',
          'secondary-dark': '#141414',
          tertiary: '#e9ecef',
          'tertiary-dark': '#1f1f1f',
        },
        foreground: {
          DEFAULT: '#212529',
          dark: '#ffffff',
          secondary: '#6c757d',
          'secondary-dark': '#a0a0a0',
          muted: '#adb5bd',
          'muted-dark': '#6b6b6b',
        },
        primary: {
          DEFAULT: '#4f46e5',
          hover: '#6366f1',
          dark: '#7c3aed',
        },
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}