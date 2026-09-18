# Design System — Llum i Taula

Extraído de https://llumitaula.com/ (Astro + Tailwind v4). Se usa como referencia de marca para este admin.

## Tokens (Tailwind v4)

Definidos en `src/index.css` dentro del bloque `@theme`:

| Token | Valor | Uso |
|---|---|---|
| `primary` (+ escala 50–700) | `#7b8e6f` | **Verde salvia, color de marca dominante**: botones, sidebar, acentos, estados activos |
| `secondary` | `#8fa189` |Verde salvia claro: secciones de fondo con texto blanco |
| `text-heading` | `#7b8e6f` | Títulos (verde hierba) en fondos claros |
| `sage` | `#9aa98f` | Sage claro: subtítulos, texto enfatizado |
| `body` | `#7a8a7a` | Texto corporal en color |
| `cta` | `#e57f3b` | Botones CTA (pill naranja) de la landing |
| `peach` | `#e5b89f` | Inicio del degradado de testimonios |
| `cream` | `#fcfcfb` | Fondo de página |

Fuente: `Inter` (pesos 300–700). Radio extra: `rounded-4xl = 2rem`.

### Escala `primary` (verde salvia)

| Paso | Valor |
|---|---|
| 50 | `#f2f5ef` |
| 100 | `#e3e9dc` |
| 200 | `#c7d3be` |
| 300 | `#a9bc9f` |
| 400 | `#93a887` |
| 500 | `#859b78` |
| 600 | `#7b8e6f` |
| 700 | `#667a58` |

## Tipografía

- Familia: **Inter**, pesos usados en la web: 300 (light), 400, 500 (medium), 600 (semibold), 700 (bold)
- Headings: `font-light` + `leading-tight`, casi siempre en `primary`/`secondary`/`text-heading`
- Cuerpo largo: `text-gray-500` o `text-[#7a8a7a]`, `leading-relaxed`
- Logotipo topbar: `tracking-wide`

## Colores con estado (semánticos del branding)

Realmente en la web los "estados" se expresan con estos pares:

- Card verde: `bg-primary text-white`
- Sección verde: `bg-secondary text-white`
- Botón CTA: `bg-[#e57f3b] text-white`
- Testimonio: gradiente `from-[#e5b89f] to-[#e57f3b]`, avatar `bg-white rounded-full`
- Selección de texto: `selection:bg-primary selection:text-white`

## Radio y formas

| Valor | Clase | Uso |
|---|---|---|
| pill | `rounded-full` | Botones CTA |
| 24px | `rounded-2xl` | Secciones pandeadas, imágenes |
| 32px | `rounded-3xl` | Cards, testimonios, CTA final |
| 64px | `rounded-b-3xl` | Hero y topbar |

## Sombras

- `shadow-md` → botones CTA
- `shadow-lg` → imágenes grandes y testimonios
- `drop-shadow-md` → texto del hero sobre imagen

## Espaciado y contenedores

- Escala Tailwind estándar (`--spacing: 0.25rem`, factor 4px)
- Secciones: `py-16 md:py-24`; contenedor máximo `max-w-7xl` (80rem)
- Grids: 4 columnas de cards `gap-6 lg:gap-8`; splits 2 col `gap-8 md:gap-20`
- Order: cards `p-8`; CTA `px-8 py-3`

## Componentes clave

1. **Hero**: imagen de fondo `object-cover`, título blanco `font-light text-5xl/6xl` con `drop-shadow-md`, altura `h-150` (600px)
2. **Topbar**: bocadillo `bg-primary rounded-b-3xl px-8 py-3`, logo + "¿Hablamos?"
3. **Card de valor**: `bg-primary rounded-3xl p-8`, título blanco + ilustración SVG `mt-auto` arriba
4. **Testimonio**: gradiente peach→naranja, avatar circular blanco `w-12 h-12`, autor `font-semibold`
5. **CTA final**: `bg-secondary rounded-2xl text-white`, botones pill `cta`

## Uso en este admin

Los tokens se consumen con utilidades Tailwind estándar: `bg-primary`, `text-secondary`, `from-sage`, etc.
El admin usa la escala `primary` (verde salvia, `#7b8e6f`) como color de acción/sistema en lugar del naranja original de la landing.