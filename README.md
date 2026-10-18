# kcal-count

App Android propia para llevar un registro diario de calorías y macros.
Sin cuentas ni anuncios: todos los datos se guardan en el móvil.

## Instalar en el móvil

1. Desde el móvil, descarga el APK más reciente:
   **https://github.com/Therg99/kcal-count/releases/latest/download/kcal-count.apk**
2. Ábrelo. La primera vez Android pedirá permitir instalar apps desde el navegador o el gestor de archivos: acepta.
3. Si Play Protect avisa de una app desconocida, pulsa *Instalar de todas formas* (es tu propia app, no está en Play Store).

Para actualizar, descarga e instala el APK nuevo encima: **se conservan tus datos** porque todos los APK se firman con la misma clave.

## Funciones

- **Diario por día** dividido en desayuno, comida, cena y snacks, con navegación entre días.
- **Kcal y macros** frente a tus objetivos (por defecto 2900 kcal · 125 g P · 420 g C · 80 g G; modificables en Ajustes).
- **Micronutrientes con objetivo diario fijo**: fibra, azúcares libres, sal, grasas (saturada, trans, omega-6, ALA,
  EPA + DHA), 14 vitaminas (A, D, E, K, B1–B12, C, colina), 13 minerales y agua. Cada uno con su % del día.
- **Todos los alimentos llevan siempre todos los valores** (por 100 g): no se puede guardar ni registrar un alimento
  con datos vacíos. Si falta algo se pide completarlo (pon 0 si no lo contiene).
- **Base de alimentos** con 22 básicos precargados (incluida el agua), con valores aproximados de tablas USDA/BEDCA;
  biotina, yodo, molibdeno, cloro y flúor son estimaciones. Puedes corregirlos desde *Alimentos*.
- **Búsqueda en [Open Food Facts](https://openfoodfacts.org)** y **escáner de código de barras**. Los productos de
  Open Food Facts casi nunca traen todos los micronutrientes: al elegirlos se abre el editor para completarlos.
- **Historial** con totales diarios y media de los últimos 7 días (macros y micros).
- **Recordatorio diario** a la hora que elijas.
- **Copia de seguridad**: exportar (menú compartir de Android) e importar en JSON.

## Cómo está hecha

App web (`www/`: HTML, CSS y JS sin dependencias) empaquetada como app nativa con
[Capacitor](https://capacitorjs.com) (`android/`). Plugins nativos: escáner ML Kit, notificaciones locales,
compartir archivos y botón atrás.

El workflow `.github/workflows/android.yml` compila el APK en cada push y lo publica en *Releases*
(versión `1.0.<nº de ejecución>`).

### Desarrollo

```sh
npm install
npm run serve        # probar la interfaz en el navegador: http://localhost:8000
npm run sync         # copiar www/ al proyecto Android tras cambiar algo
```

Para compilar en local hace falta Android Studio o el SDK de Android: `cd android && ./gradlew assembleRelease`.

### Firma

Los APK se firman con una clave propia que GitHub Actions lee de dos *secrets* del repositorio
(**Settings → Secrets and variables → Actions**):

| Secret | Contenido |
|---|---|
| `KEYSTORE_BASE64` | El archivo `.jks` de la clave, en base64 |
| `KEYSTORE_PASSWORD` | Su contraseña (alias de la clave: `kcal`) |

Guarda una copia de la clave fuera de GitHub: si se pierde, las versiones nuevas no podrán instalarse encima de la actual.
