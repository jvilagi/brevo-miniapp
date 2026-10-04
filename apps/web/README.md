# Frontend

Interfície React + TypeScript + Vite mobile-first, amb la paleta de Brevo
demanada per en Jordi: entrada privada, dues targetes desplegables,
estadístiques Avui / Últims 7 dies i gràfic SVG accessible. PWA amb manifest
standalone, icones 192/512 i apple-touch-icon 180. Detalls a
[`../../docs/design.md`](../../docs/design.md).

En desenvolupament s'obre a `http://127.0.0.1:5174/`, amb proxy `/api` al
backend del port 3000. En compilació genera `dist/`, que servirà Fastify.

No importa cap mòdul backend ni consulta directament Brevo. Vite no
carrega fitxers `.env`. Qualsevol futura variable `PUBLIC_WEB_*` ha de
contenir només configuració pública; mai claus o contrasenyes.

Les peticions són del mateix origen, amb cookies i `cache: no-store`.
Les dades queden només en memòria React. No hi ha polling, es cancel·len
peticions en ocultar la pàgina i es refresca en reprendre-la quan han
passat 60 segons, o amb el botó Actualitza. En error es mantenen dades
antigues identificades; una sessió `401` elimina les dades de pantalla.

«Canvia la contrasenya», sota les targetes autenticades, obre un formulari
amb actual/nova/confirmació. Cancel·lar el desmunta; els camps s'esborren
abans d'enviar-los. Èxit esborra el tauler i torna a login, perquè totes
les sessions s'han revocat. No és una recuperació de contrasenya oblidada.

`pwa-plugin.ts` genera una versió de cache a partir dels recursos compilats.
El worker només precacheja la llista explícita d'estàtics, amb credencials
omeses. No desa peticions ni respostes `/api/`, POST, altres orígens,
consultes amb paràmetres o Authorization. Sense xarxa la interfície
s'obre però no retorna dades privades. L'activació d'un worker nou
requereix acceptar «Actualitza l'app»; no es recarrega automàticament
mentre es consulta el tauler.

`scripts/generate-icons.mjs` rasteritza l'SVG local en PNG amb Chrome.
La versió pública utilitza el símbol propi de sobre amb distintiu violeta.
La capçalera també utilitza la marca pròpia, sense logotips oficials.
Autoria i llicència:
[`public/brand/README.md`](public/brand/README.md) i `../../NOTICE`.
Els recursos de marca estan inclosos a la cache estàtica de la PWA.

5 proves de presentació incloses a `npm test`, inclòs el saldo Free
independent de les sol·licituds SMTP i sense hora de reinici inventada.
La comprovació de navegador
és separada: `npm run test:ui` compila i executa `scripts/check-ui.mjs`
amb dades sintètiques i un servidor temporal local; no carrega secrets.
Necessita Playwright (local o mòdul del runtime indicat amb
`PLAYWRIGHT_MODULE_PATH`), Chromium instal·lat o `CHROME_EXECUTABLE`
apuntant a Chrome. No forma part de `npm run check`.

Exemple amb Playwright en un entorn extern. Substitueix la ruta pel mòdul
real; a Linux adapta també el camí del navegador:

```bash
PLAYWRIGHT_MODULE_PATH=/ruta/absoluta/node_modules/playwright/index.mjs \
CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
npm run test:ui
```

`UI_BROWSERS=webkit` o `UI_BROWSERS=chromium,webkit` activa WebKit si està
instal·lat i compatible. En aquest Mac (macOS 13), el runtime actual no
permet instal·lar WebKit. Captures a `test-results/ui/`, excloses de Git.
S'ha verificat Chrome entre 320 i 1280 px; Safari i iPhone real pendents.

Amb les mateixes variables de navegador, `npm run test:pwa` comprova
manifest, dimensions de les icones, precache, absència de dades privades,
offline, represa, logout i canvi de versió acceptat; dades només sintètiques.
`DEPLOY_CHECK_ORIGIN=https://el-teu-domini node scripts/check-deployed.mjs`
comprova el domini HTTPS propi sense
contrasenya ni lectures autenticades: pantalla d'accés, manifest, icones,
worker, cache, API protegida, offline i represa. Captura pública a
`test-results/deploy/https-login-mobile.png`, exclosa de Git.
