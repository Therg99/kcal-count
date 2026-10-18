# kcal-count

App móvil propia para contar calorías y macros. Es una **PWA**: se instala en la pantalla de inicio del móvil
(Android o iPhone), funciona sin conexión y guarda todos los datos **solo en tu dispositivo**.
Sin cuentas, sin anuncios, sin compilar nada.

## Funciones

- **Diario por día** dividido en desayuno, comida, cena y snacks, con navegación entre días.
- **Resumen**: anillo de kcal restantes y barras de proteína, carbohidratos y grasa frente a tus objetivos.
- **Base de alimentos** (valores por 100 g) con ~20 alimentos básicos precargados; crea, edita y borra los tuyos,
  con raciones opcionales (p. ej. «1 huevo = 60 g»).
- **Búsqueda en [Open Food Facts](https://openfoodfacts.org)** y **escáner de código de barras**
  (cámara en Chrome/Android; en Safari/iPhone se puede escribir el código a mano).
  Los productos que añades se guardan en tu base para reutilizarlos offline.
- **Recientes primero** al buscar, y botón para **copiar las comidas del día anterior**.
- **Historial** con totales diarios y media de los últimos 7 días.
- **Calculadora de objetivos** (Mifflin-St Jeor + nivel de actividad + objetivo de perder/mantener/ganar).
- **Copia de seguridad**: exportar/importar todo en JSON.

## Probarla en local

```sh
python3 -m http.server 8000
# abre http://localhost:8000
```

## Publicarla e instalarla en el móvil

1. Fusiona a `main`. En GitHub: **Settings → Pages → Source: GitHub Actions**.
   El workflow `.github/workflows/pages.yml` la publica en `https://<usuario>.github.io/kcal-count/`.
2. Abre esa URL en el móvil:
   - **Android (Chrome)**: menú ⋮ → *Instalar aplicación* / *Añadir a pantalla de inicio*.
   - **iPhone (Safari)**: botón compartir → *Añadir a pantalla de inicio*.

> El escáner necesita HTTPS (GitHub Pages ya lo da).

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Esqueleto y barra de pestañas |
| `app.js` | Toda la lógica: datos, vistas, Open Food Facts, escáner |
| `styles.css` | Estilos (modo claro/oscuro automático) |
| `sw.js` | Service worker para funcionar offline |
| `manifest.webmanifest`, `icon.svg` | Datos para instalarla como app |

Los datos viven en `localStorage` bajo la clave `kcal-count:v1`. Si borras los datos del navegador
se pierden: exporta una copia de vez en cuando.
