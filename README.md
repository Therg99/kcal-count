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
- **Resumen**: anillo de kcal restantes y barras de proteína, carbohidratos y grasa frente a tus objetivos.
- **Base de alimentos** (valores por 100 g) con ~20 básicos precargados; crea los tuyos, con raciones opcionales
  (p. ej. «1 huevo = 60 g»).
- **Búsqueda en [Open Food Facts](https://openfoodfacts.org)** y **escáner de código de barras** (escáner de Google).
  Los productos que añades se guardan para usarlos sin conexión.
- **Recientes primero** al buscar, y botón para **copiar las comidas del día anterior**.
- **Historial** con totales diarios y media de los últimos 7 días.
- **Calculadora de objetivos** (Mifflin-St Jeor + actividad + objetivo de perder/mantener/ganar).
- **Recordatorio diario** (notificación a la hora que elijas).
- **Copia de seguridad**: exportar (menú compartir de Android: Drive, correo…) e importar en JSON.

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
