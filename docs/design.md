# Disseny de la MiniApp

Tasques de disseny i implementació de la interfície aprovades amb
GPT-6.1 Sol / High. Indicació d'en Jordi: utilitzar la paleta de Brevo.
Primera versió implementada el 2026-10-01. S'ha escollit una base clara;
no s'ha implementat tema fosc ni selector de temes.

## Paleta i criteri visual

Actualització local aprovada amb GPT-6.1 Sol / High a partir de les tres
captures de l'aplicació Brevo facilitades per en Jordi. Colors contrastats
amb els tokens públics que carrega [app.brevo.com](https://app.brevo.com/):

| Ús a la MiniApp | Color |
| --- | --- |
| Marca i saldo, verd de l'aplicació | `#0b996f` |
| Verd per a text petit | `#006a43` |
| Selecció i icones, menta | `#d7fec8` |
| Menta molt clar | `#f9fff6` |
| Fons principal i targetes | `#ffffff` |
| Bloc de màrqueting, crema | `#fffdf6` |
| Text principal | `#1b1b1b` |
| Botó principal, carbó | `#1b1b1b` — `#2c2c2c` |
| Accions secundàries i enviaments, violeta | `#6358de` |
| Entregues, blau | `#2675c0` |
| Obertures totals, turquesa | `#159f9f` |
| Clics totals, verd | `#0b996f` |

Font: [tokens del sistema de disseny de Brevo](https://designsystem.brevo.com/designsystem/component/design-tokens/33805d0d83d3a4480e85.css),
consultats el 2026-10-01. La ruta amb hash pot canviar. És un recurs públic
de l'aplicació, no una concessió de drets sobre la marca. El blau del
gràfic és una variant més fosca del mateix token de Brevo per millorar
el contrast sobre blanc. El gràfic canvia de color amb la mètrica sense
canviar-ne les dades, etiquetes, període o tractament dels buits.

Tipografia del sistema, sense fonts externes ni dependències noves.
Marca pròpia de MiniApp aprovada el 2026-10-02 per a la publicació:
sobre blanc sobre quadrat verd arrodonit i distintiu violeta. La
capçalera mostra «MiniApp / per a Brevo» sense el wordmark oficial.
Les icones PWA utilitzen el mateix símbol i es regeneren des de l'SVG.
No es distribueixen logotips oficials ni la B de Brevo. Autoria a
[`../apps/web/public/brand/README.md`](../apps/web/public/brand/README.md)
i `NOTICE`.

Icones de controls i mètriques SVG pròpies de traç fi, inspirades en les
captures, no extretes de la biblioteca interna de Brevo. Targetes amb
vores fines, sense les ombres anteriors; fons principal blanc, menta per
a seleccions i violeta per a accions secundàries. La MiniApp manté l'avís
de projecte independent, no oficial. Els logotips es serveixen localment
i s'inclouen a la cache només estàtica; no es carreguen recursos remots.
Marca pròpia comprovada amb Chrome i desplegada en la instància privada
el 2026-10-02, amb login genèric. Les captures de proves només contenen
dades sintètiques. La versió anterior es conserva per a un possible retorn.

## Flux implementat

- Comprovació de sessió, pantalla de contrasenya i errors d'accés.
- Login simplificat a petició d'en Jordi: retirats l'eslògan, el titular
  de presentació, la descripció i les etiquetes «2 comptes», «7 dies
  d'activitat» i «Només consulta». Formulari centrat en una sola columna,
  amb amplada màxima de 440 px; marca, accés privat, avisos de seguretat
  i controls PWA preservats. Canvi desplegat el 2026-10-01.
- Resum amb dues targetes, plegades inicialment. Un compte no obliga
  a plegar l'altre. A l'escriptori van de costat; al mòbil, apilades.
- Quota Free: saldo diari llegit de l'API i barra del disponible sobre
  300. Prepagament: saldo llegit de l'API, sense afegir quota Free ni
  inventar una referència per a una barra de consum.
  La targeta Free indica «Saldo disponible» segons Brevo i no promet
  una hora de reinici ni sincronització amb el dia de les mètriques SMTP.
- Desplegable amb Avui / Últims 7 dies, mètriques de l'agregat i totes
  les mètriques opcionals. Les úniques no se sumen ni s'etiqueten com
  a persones úniques o obertures estimades.
- Gràfic SVG dels set dies amb selector de mètrica, selecció directa
  tocant el gràfic i botons tàctils per
  triar dia i taula accessible. Els buits no s'interpolen com a zero.
- Campanyes de màrqueting identificades com a font separada.
- Botó d'actualització, represa en tornar a l'app (60 segons mínim entre
  lectures automàtiques), sense polling. Peticions de dades en curs
  cancel·lades quan la pàgina s'oculta.
- Errors parcials i dades antigues amb timestamps de cada font.
  Un error de xarxa marca com a antigues les dades conservades en memòria.
- Caducitat de sessió: s'esborren les dades de pantalla i es demana
  entrar de nou. Logout: revocació al servidor abans de mostrar l'accés.

Les dades i la contrasenya no es desen en localStorage, sessionStorage
ni caches persistents. El service worker desa només recursos estàtics
compilats, manifest i icones; mai dades, API o sessions.

## PWA

Manifest standalone, icones pròpies 192/512, icona maskable i
apple-touch-icon 180. Botó d'instal·lació amb indicacions per a Safari
i prompt quan el navegador l'ofereix. Avís d'actualització controlada
per l'usuari; neteja de les caches estàtiques anteriors en activar-se.
Sense connexió la interfície s'obre amb un avís de xarxa i opció de
reintent; les dades dels comptes no es conserven entre recàrregues.

## Comprovacions

- 5 proves de presentació: format català, desconeguts, Free/prepagament,
  saldo sense hora de reinici no verificada, escala i buits del gràfic,
  dades antigues i fus horari.
- `scripts/check-ui.mjs`: Chrome real en mode headless, context mòbil
  tàctil, amplades de 320, 375, 390, 430 i 1280 px, sense desbordament.
  Cas de regressió sintètic: zero sol·licituds avui amb saldo Free
  inferior a 300, valor conservat i absència d'una hora de reinici.
- Login simplificat comprovat també a 760 i 761 px: absència de tots
  els textos retirats, un únic títol principal i formulari centrat.
  Captures mòbil i escriptori revisades després del canvi local.
- Actualització de marca: logotip SVG carregat localment, fons blanc,
  menta i colors del gràfic per mètrica comprovats en Chrome. Contrastos
  seleccionats de text (4,5:1) i traços de gràfic (3:1) verificats; això
  no constitueix una auditoria completa d'accessibilitat. Captures del
  login, desplegable mòbil, escriptori i icona PWA revisades.
- Entrada incorrecta i correcta, esborrament del camp de contrasenya,
  desplegables, selector de període, lectura de valors únics de l'agregat,
  selecció del gràfic, valors desconeguts, error de xarxa, error parcial,
  sessió caducada simulada, logout i absència d'emmagatzematge persistent.
- Captures de login, resum, desplegable, escriptori i error parcial,
  revisades visualment. Només dades sintètiques; a `test-results/ui/`,
  excloses de Git. No representen els saldos actuals dels comptes.
- `scripts/check-pwa.mjs`: manifest, icones, cache limitada a estàtics,
  dades autenticades mai cachejades, offline, represa, logout i nova
  versió activada únicament després d'acceptar l'avís.
  També comprova els colors del manifest i l'SVG de marca pròpia
  dins de la cache estàtica, amb els PNG regenerats a les mides previstes.
- `scripts/check-deployed.mjs`: Chrome mòbil sobre HTTPS públic, accés
  privat configurat, API sense sessió `401`, worker actiu, icones,
  pantalla sense desbordament, offline i represa. Captura revisada.

Pendent: Safari/WebKit i prova en iPhone real. El WebKit inclòs en el
runtime de proves no suporta macOS 13 en aquest ordinador; no s'ha
pogut instal·lar. La PWA s'ha desplegat en una instància privada; queda
pendent afegir-la físicament a l'iPhone i comprovar-hi accés i standalone.
