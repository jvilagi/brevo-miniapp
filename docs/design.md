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
- «Configuració» al costat de «Canvia la contrasenya», sota les targetes:
  ubicació i estil aprovats el 2026-10-04. Ampliació aprovada el
  2026-10-17: seccions Comptes/Avisos, llista ordenable i editor privat
  de comptes, icones/colors, pla de referència, llindars, correu i push.
  Galeria de sis icones pròpies i sis colors; només identitat del compte,
  sense canviar la semàntica de colors de les mètriques.
  Claus sempre emmascarades i no retornades, contrasenya per operacions
  sensibles, confirmació de desconnexió i prova de correu amb cost.
  Ampliació publicada i desplegada el 2026-10-17; avisos reals desactivats.
- Comptador discret al costat d'«Actualitza» (a sota al mòbil), amb segons,
  minuts, hores i dies; sense anuncis cada segon als lectors de pantalla.
  Mesura l'última consulta correcta, no l'edat de totes les dades Brevo.
- Opció «Canvia la contrasenya» sota les targetes, només després d'entrar,
  amb ubicació i disseny actual aprovats el 2026-10-04. Formulari d'actual,
  nova i confirmació; cancel·lació, errors i retorn a login en desar.
- Login simplificat a petició d'en Jordi: retirats l'eslògan, el titular
  de presentació, la descripció i les etiquetes «2 comptes», «7 dies
  d'activitat» i «Només consulta». Formulari centrat en una sola columna,
  amb amplada màxima de 440 px; marca, accés privat, avisos de seguretat
  i controls PWA preservats. Canvi desplegat el 2026-10-01.
- Resum amb targetes per compte, plegades inicialment. Un compte no obliga
  a plegar l'altre. A l'escriptori van de costat; al mòbil, apilades.
- Quota Free: saldo diari llegit de l'API i barra del disponible sobre
  300. Prepagament: saldo llegit de l'API, sense afegir quota Free ni
  inventar una referència per a una barra de consum.
  La targeta Free indica «Saldo disponible» segons Brevo i no promet
  una hora de reinici ni sincronització amb el dia de les mètriques SMTP.
- Ajust publicat i desplegat el 2026-10-17 (`d38533d`): per a subscripció,
  «Sol·licituds avui» en una fila i dos saldos destacats sota seu, «Emails
  de subscripció» i «Crèdits prepagament». Estil i paleta existents, sense
  sumar-los. Tots dos conserven l'estat i timestamp de la quota; absència
  de reserva és «—», no zero. El camp manual continua sent una referència.
- Correcció posterior del 2026-10-17, publicada i desplegada (`8510a86`):
  crèdits prepagament primer (també en l'ordre de lectura accessible),
  «Emails del pla» després i distintiu «Pla + prepagament». Eliminada
  l'afirmació general que el pla es consumeix primer. El text deixa clar
  que l'API proporciona els saldos i que l'ordre visual no decideix el
  consum. Mateixa paleta i distribució de dues columnes, sense càlculs.
  Si la referència del compte és Free, explicació específica que els
  crèdits substitueixen els 300 emails/dia; el saldo del pla retornat no
  s'afegeix al prepagament. Sense referència es formula en condicional.
  Ajuda afegida al selector existent, sense nous controls ni canvis de saldos.
- Desplegable amb Avui / Últims 7 dies, mètriques de l'agregat i totes
  les mètriques opcionals. Les úniques no se sumen ni s'etiqueten com
  a persones úniques o obertures estimades.
- Ajust posterior del 2026-10-17: targetes plegades uniformes,
  mateixes files i alçada en mòbil i escriptori. Només dos números al
  resum: sol·licituds avui i saldo actiu, amb font i actualització.
  Free amb prepagament: distintiu propi i crèdits com a saldo actiu;
  altres imports al desplegable, sense sumar-los ni activar Free per zero.
  Bloc comú «Esgotament estimat»: data orientativa quan hi ha historial,
  «Recollint historial» si no n'hi ha prou i «No aplicable» per quota
  diària. No s'inventa barra per als crèdits sense volum verificat.
  Configuració permet llindar opcional de dies; estil i paleta preservats.
  Ajust publicat i desplegat des de `4466941`, amb comprovació HTTPS.
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

Configuració → Avisos diferencia servei del servidor, correu i push, amb
estats explícits per a dispositiu registrat però servei pausat, push actives
amb correu desactivat i configuració incompleta. Regles de connexió i
repetició comunes, desament/prova separats i estat del permís del dispositiu.
Mateixa paleta i estructura de targetes, sense logotips oficials.

- 21 proves de peticions/presentació/worker: sessió vàlida, límits de temps,
  cancel·lació, POST sense reintent, temps transcorregut, format català, desconeguts, Free/prepagament/subscripció,
  saldo sense hora de reinici no verificada, escala i buits del gràfic,
  dades antigues i fus horari.
- Uniformitat i previsió: targetes plegades amb mateixa amplada/alçada
  a 320, 375, 390, 430, 760, 761 i 1280 px, Free i prepagament de costat
  o apilats. Saldo actiu correcte, reserva absent desconeguda, zero sense
  activar Free i previsió suprimida amb dades antigues. Captures mòbil i
  escriptori sintètiques revisades; no representen comptes reals.
- `scripts/check-startup.mjs`: espera limitada, reintent manual i represa,
  errors de sessió, controls d'actualització també durant l'arrencada i
  recuperació amb HTML de xarxa sense esborrar dades. Controls comprovats
  sense desbordament a 320, 390 i 1280 px amb dades sintètiques.
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
- Canvi de contrasenya amb dades sintètiques: confirmació incorrecta sense
  petició, cancel·lació i camps buits en reprendre, actual incorrecta,
  canvi correcte, revocació d'una altra sessió i login amb la nova.
- Noms amb dades sintètiques: càrrega inicial, cancel·lació, validació,
  error de desament, títols actualitzats, lectura des d'una altra sessió.
  Comptador després d'un error, resposta tota antiga, parada en segon pla
  i recuperació del temps en tornar. Sense polling ni dades persistents.
- Configuració ampliada: alta de tercer compte, ordre, desconnexió,
  nom/icona/color, referència mensual i llindars, error de desament i
  destinatari/compte/remitent d'avisos amb enviament desactivat.
  Amplades 320–1280 sense desbordament; captures mòbils revisades.
  Push, clic del worker i absència de dades privades provats amb dobles;
  no equival a una entrega real ni a una prova d'iPhone.
  Permís denegat, registre i baixa de dispositiu comprovats al navegador
  amb PushManager simulat, sense contacte amb serveis push reals.
- Doble saldo: subscripció i prepagament destacats i alineats a
  320–1280 px, zero real conservat, reserva absent «—», estat antic a
  tots dos blocs. Captures mòbil/escriptori sintètiques revisades; sense
  números personals. La presentació ampliada està publicada i desplegada;
  els recursos HTTPS coincideixen amb la compilació verificada.
- Captures de login, resum, desplegable, escriptori i error parcial,
  revisades visualment. Només dades sintètiques; a `test-results/ui/`,
  excloses de Git. No representen els saldos actuals dels comptes.
- Correcció de l'ordre: prepagament abans del pla en el DOM i a
  la vista, imports alineats a 320–1280 px i disminució del prepagament
  sense restar saldo del pla o relacionar-lo amb SMTP. Etiquetes neutrals
  comprovades; captures mòbil/escriptori revisades. UI/PWA superats;
  aquesta correcció està publicada i desplegada, amb recursos HTTPS
  idèntics als compilats verificats.
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
