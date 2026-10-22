# Frontend

Interfície React + TypeScript + Vite mobile-first, amb la paleta de Brevo
demanada per en Jordi: entrada privada, targetes desplegables per compte,
estadístiques Avui / Últims 7 dies i gràfic SVG accessible. PWA amb manifest
standalone, icones 192/512 i apple-touch-icon 180. Detalls a
[`../../docs/design.md`](../../docs/design.md).

En desenvolupament s'obre a `http://127.0.0.1:5174/`, amb proxy `/api` al
backend del port 3000. En compilació genera `dist/`, que servirà Fastify.

No importa cap mòdul backend ni consulta directament Brevo. Vite no
carrega fitxers `.env`. Qualsevol futura variable `PUBLIC_WEB_*` ha de
contenir només configuració pública; mai claus o contrasenyes.

Les peticions són del mateix origen, amb cookies i `cache: no-store`.
Límit de 10 segons per comprovar la sessió i 30 segons per a la resta,
inclosa la lectura del cos JSON. Una cancel·lació externa es propaga i
els POST no es reintenten automàticament: un timeout no confirma si el
servidor ha completat el canvi.
L'arrencada ofereix reintent i controls PWA també durant l'espera. En
ocultar-se cancel·la la comprovació; en reprendre comprova el termini
amb el rellotge real i inicia una nova lectura si cal. Respostes obsoletes
no poden canviar la sessió. Sense polling.
«Carrega l'última versió» navega a `/?recovery=1`: el worker existent
exclou paràmetres i deixa obtenir l'HTML de xarxa. No esborra cookies,
emmagatzematge, configuració ni subscripcions push. Necessita connexió.
Les dades queden només en memòria React. No hi ha polling, es cancel·len
peticions en ocultar la pàgina i es refresca en reprendre-la quan han
passat 60 segons, o amb el botó Actualitza. En error es mantenen dades
antigues identificades; una sessió `401` elimina les dades de pantalla.

Targetes plegades de la mateixa mida, també apilades, amb els mateixos
blocs: sol·licituds d'avui, saldo actiu i esgotament estimat. Els desplegables
són independents i no s'estiren artificialment en obrir-ne un. Altres
imports retornats, referències i explicacions llargues queden als detalls.
En Free amb prepagament es destaquen els crèdits; la quota diària no és
un segon saldo usable. Cal seleccionar Free a Configuració si aquest és
el pla real: el nom `subscription` retornat no el distingeix sempre.
La previsió ve del backend i només es mostra amb dades fresques coherents;
mentre no hi ha historial suficient s'indica, sense inventar dates.

«Canvia la contrasenya», sota les targetes autenticades, obre un formulari
amb actual/nova/confirmació. Cancel·lar el desmunta; els camps s'esborren
abans d'enviar-los. Èxit esborra el tauler i torna a login, perquè totes
les sessions s'han revocat. No és una recuperació de contrasenya oblidada.

«Configuració» té pestanyes Comptes i Avisos: comptes dinàmics (màxim 25),
nom, icona/color propis, referència de pla i llindars, ordre i desconnexió.
Claus i contrasenya són entrades transitòries i s'esborren abans d'enviar;
mai es reomplen des del servidor. Errors conserven metadades editades,
no secrets; `401` torna a login i `409` demana recarregar configuració.
No es desa configuració en localStorage/sessionStorage.

Avisos: destinatari, compte pagador i remitent actiu, repetició, push per
dispositiu i historial per canal. El backend és qui monitoritza; no hi ha
polling de quotes al navegador. La petició de permís push comença dins del
gest de clic. PushManager desa la subscripció estàndard gestionada pel
navegador, sense claus Brevo ni dades dels comptes. A l'iPhone cal la PWA
de pantalla d'inici iOS 16.4+. Prova real en iPhone encara pendent.

El comptador al costat d'«Actualitza» mesura temps des de l'última resposta
vàlida amb almenys una secció fresca. Error de xarxa o resposta amb totes
les seccions antigues/indisponibles no el reinicia. Una resposta parcial
pot reiniciar-lo: els avisos i timestamps de cada secció són independents.
Tampoc identifica una nova lectura de Brevo si la resposta prové de cache.
El rellotge usa timestamps, no ticks acumulats: es reprèn amb el temps
real després del segon pla i atura l'interval quan la pàgina és oculta.
No consulta l'API per segon ni anuncia cada tick als lectors de pantalla.

`pwa-plugin.ts` genera una versió de cache a partir dels recursos compilats.
El worker només precacheja la llista explícita d'estàtics, amb credencials
omeses. No desa peticions ni respostes `/api/`, POST, altres orígens,
consultes amb paràmetres o Authorization. Sense xarxa la interfície
s'obre però no retorna dades privades. L'activació d'un worker nou
requereix acceptar «Actualitza l'app»; no es recarrega automàticament
mentre es consulta el tauler.
El worker també gestiona push i clics: missatge genèric sense saldos o noms,
enfoca l'app oberta o obre l'arrel del mateix origen. No consulta l'API ni
desa notificacions en cache. Els permisos del sistema poden silenciar-les.

`scripts/generate-icons.mjs` rasteritza l'SVG local en PNG amb Chrome.
La versió pública utilitza el símbol propi de sobre amb distintiu violeta.
La capçalera també utilitza la marca pròpia, sense logotips oficials.
Autoria i llicència:
[`public/brand/README.md`](public/brand/README.md) i `../../NOTICE`.
Els recursos de marca estan inclosos a la cache estàtica de la PWA.

21 proves de peticions, presentació i worker incloses a `npm test`, inclosos límits de temps,
cancel·lació, validació de sessió, absència de reintents POST, el comptador i el saldo Free
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
Les proves UI cobreixen alta, ordre, desconnexió, aparença, referències i
avisos amb enviaments desactivats. No comproven cap entrega push real.

Amb les mateixes variables de navegador, `npm run test:pwa` comprova
manifest, dimensions de les icones, precache, absència de dades privades,
offline, represa, logout i canvi de versió acceptat; dades només sintètiques.
`npm run test:startup` simula sessió pendent, reintent durant/després del
timeout, cancel·lació i resposta tardana, represa coalescent, rellotge
després de suspensió, offline/online, JSON invàlid i actualització PWA
durant l'espera. Verifica `/?recovery=1` contra el worker actiu i absència
de cache d'API o paràmetres. Captura a `test-results/startup/`, fora de Git.
`DEPLOY_CHECK_ORIGIN=https://el-teu-domini node scripts/check-deployed.mjs`
comprova el domini HTTPS propi sense
contrasenya ni lectures autenticades: pantalla d'accés, manifest, icones,
worker, cache, API protegida, offline i represa. Captura pública a
`test-results/deploy/https-login-mobile.png`, exclosa de Git.
