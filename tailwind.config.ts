import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        // Professional trading colors
        trading: {
          primary: '#2563EB',      // Professional blue
          'primary-dark': '#1D4ED8',
          'primary-light': '#3B82F6',
          secondary: '#64748B',    // Sophisticated slate
          accent: '#0EA5E9',       // Sky blue accent
          success: '#10B981',      // Emerald green
          warning: '#F59E0B',      // Amber
          danger: '#EF4444',       // Red
          gold: '#F59E0B',         // Gold for premium features
          silver: '#94A3B8'        // Silver for secondary elements
        },
        team: {
          arsenal: '#EF4444',
          chelsea: '#3B82F6',
          liverpool: '#DC2626',
          'man-city': '#06B6D4',
          'man-united': '#DC2626',
          tottenham: '#3B82F6',
          brighton: '#3B82F6',
          villa: '#8B5CF6',
          bournemouth: '#DC2626',
          brentford: '#F59E0B',
          palace: '#3B82F6',
          everton: '#1E40AF',
          leeds: '#F59E0B',
          newcastle: '#6B7280',
          forest: '#10B981',
          westham: '#EF4444',
          wolves: '#F59E0B',
          fulham: '#FFFFFF'
        },
        success: '#00FF87',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6'
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        lg: 'calc(var(--radius) + 2px)',
        md: 'var(--radius)',
        sm: 'calc(var(--radius) - 2px)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-primary': {
          '0%, 100%': { 
            backgroundColor: '#2563EB',
            transform: 'scale(1)'
          },
          '50%': { 
            backgroundColor: '#3B82F6',
            transform: 'scale(1.05)'
          },
        },
        'bounce-gentle': {
          '0%, 100%': { 
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0,0,0.2,1)'
          },
          '50%': { 
            transform: 'translateY(-5px)',
            animationTimingFunction: 'cubic-bezier(0.8,0,1,1)'
          },
        },
        'primary-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)'
          },
          '50%': { 
            boxShadow: '0 0 30px rgba(37, 99, 235, 0.5)'
          },
        },
        'price-up': {
          '0%': { 
            backgroundColor: '#10B981',
            transform: 'scale(1)'
          },
          '50%': { 
            backgroundColor: '#059669',
            transform: 'scale(1.02)'
          },
          '100%': { 
            backgroundColor: '#10B981',
            transform: 'scale(1)'
          },
        },
        'price-down': {
          '0%': { 
            backgroundColor: '#EF4444',
            transform: 'scale(1)'
          },
          '50%': { 
            backgroundColor: '#DC2626',
            transform: 'scale(1.02)'
          },
          '100%': { 
            backgroundColor: '#EF4444',
            transform: 'scale(1)'
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'pulse-primary': 'pulse-primary 2s ease-in-out infinite',
        'bounce-gentle': 'bounce-gentle 1s ease-in-out infinite',
        'primary-glow': 'primary-glow 3s ease-in-out infinite',
        'price-up': 'price-up 0.6s ease-out',
        'price-down': 'price-down 0.6s ease-out',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #3B82F6 100%)',
        'gradient-card': 'linear-gradient(145deg, rgba(37, 99, 235, 0.08) 0%, rgba(14, 165, 233, 0.04) 100%)',
        'gradient-success': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-warning': 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-danger': 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        'gradient-gold': 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-slate': 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
          },
        },
      },
    }
  },
  plugins: [
    animate,
    typography,
  ],
} satisfies Config;
