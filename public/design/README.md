# RK Inversiones — Design System

Sistema de diseño visual para la plataforma web de RK Inversiones.

## Estructura

```
design/
├── tokens/
│   ├── colors.css          # Variables CSS
│   └── design-tokens.json  # Tokens en JSON
├── backgrounds/
│   ├── hero-gradient.svg   # Fondo hero principal (verde)
│   ├── hero-dark.svg       # Fondo hero oscuro (estilo flyer vehículos)
│   ├── form-page-bg.svg    # Fondo del formulario interactivo
│   ├── pattern-concrete.svg # Textura gris (estilo flyer)
│   └── geometric-accents.svg # Acentos geométricos verdes
├── icons/
│   ├── apartamentos.svg    # Icono producto
│   ├── casas.svg
│   ├── vehiculos.svg
│   ├── solares.svg
│   ├── check.svg / check-circle.svg
│   ├── clock.svg
│   ├── whatsapp.svg
│   ├── shield.svg
│   ├── user.svg / phone.svg / email.svg
│   ├── money.svg / calendar.svg
│   └── arrow-left.svg / arrow-right.svg
├── logo/
│   ├── logo-rk-shield.svg      # Escudo con RK
│   ├── logo-rk-horizontal.svg  # Logo horizontal completo
│   └── favicon.svg
├── ui/
│   ├── card-apartamentos.svg   # Cards de producto
│   ├── card-casas.svg
│   ├── card-vehiculos.svg
│   ├── card-solares.svg
│   ├── badge-respuesta-rapida.svg
│   ├── badge-confidencial.svg
│   ├── badge-sin-compromiso.svg
│   ├── progress-bar-step1.svg  # 33%
│   ├── progress-bar-step2.svg  # 66%
│   ├── progress-bar-step3.svg  # 100%
│   ├── cta-button.svg
│   └── cta-whatsapp.svg
├── images/
│   ├── hero-main.png
│   ├── hero-vehiculos.png
│   ├── hero-inmobiliario.png
│   └── hero-solares.png
├── reference/
│   ├── flyer-financiamiento.jpeg
│   └── flyer-vehiculos.jpeg
└── preview.html            # Catálogo visual interactivo
```

## Paleta de colores

| Token | Hex | Uso |
|-------|-----|-----|
| `--rk-green-500` | `#39B54A` | Color primario ★ |
| `--rk-green-600` | `#2E9A3D` | Hover, CTA oscuro |
| `--rk-green-800` | `#1A6427` | Textos sobre fondo claro |
| `--rk-green-900` | `#104A1C` | Fondos oscuros |
| `--rk-gray-900` | `#121212` | Fondo oscuro (flyers) |
| `--rk-orange` | `#FF8C00` | Acento solares |
| `--rk-yellow` | `#F5C518` | Acento casas |

## Tipografía

- **Display:** Montserrat (títulos, CTAs, logo)
- **Body:** Inter (texto, formularios, labels)

## Cómo ver el preview

Abrir `design/preview.html` en el navegador para ver todos los elementos juntos.

## Uso en el proyecto

```css
@import './design/tokens/colors.css';

.hero {
  background: var(--rk-gradient-form-bg);
}

.cta-button {
  background: var(--rk-gradient-cta);
  border-radius: var(--rk-radius-full);
  box-shadow: var(--rk-shadow-glow);
}
```

```html
<img src="/design/logo/logo-rk-horizontal.svg" alt="RK Inversiones">
<img src="/design/icons/vehiculos.svg" alt="Vehículos">
```
