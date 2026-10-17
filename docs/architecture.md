# Arquitectura de Brevo MiniApp

Proposta presentada i acceptada el 2026-10-01. La primera validació amb
les respostes reals dels dos comptes es va fer el mateix dia; vegeu
[`brevo-api-validation.md`](brevo-api-validation.md).

## Producte i interfície

Una pantalla principal amb una targeta per compte (dos inicials, fins a
25 configurables des de l'app). Cada targeta
mostra nom, enviaments d'avui, règim de quota, saldo disponible i barra
de consum quan se'n conegui una referència vàlida.

El desplegable mostra estadístiques amb selector Avui / Últims 7 dies
i un gràfic dels sis dies anteriors més avui, marcat com a dia en curs.
El gràfic és SVG amb selecció de mètrica, lectura tàctil i alternativa
accessible en text.

El responsable de la instal·lació ha aprovat la tasca de disseny (GPT-6.1 Sol / High) i ha indicat
utilitzar la paleta de Brevo. La primera interfície és clara, mobile-first
i està implementada; criteris i verificació a [`design.md`](design.md).

## Stack i límits

- Frontend: React, TypeScript, Vite i CSS propi.
- Backend: Node.js 24 LTS, Fastify i TypeScript.
- Contractes públics compartits; el paquet compartit no conté secrets.
- Un origen HTTPS per a frontend i API.
- Memòria cau inicial de 60 segons al backend, separada per compte i
  consulta, amb data d'actualització i tractament d'errors parcials.
- Actualització en reprendre l'app; evita consultes periòdiques quan
  està oculta. Les consultes simultànies es reutilitzaran al servidor.
- Sense base de dades relacional: Brevo proporciona l'històric SMTP;
  fitxers privats xifrats per a configuració i mostres de saldo prepagament.
- Accés privat amb hash de contrasenya, sessió segura i límit d'intents.
- PWA amb manifest standalone, icones 192/512, apple-touch-icon,
  espais segurs i service worker només per a recursos estàtics.
- Respostes autenticades excloses de memòria cau persistent al navegador.

## Base executable implementada

S'ha inicialitzat un monorepo npm amb els tres paquets, dependències
fixades i `package-lock.json`. React consulta sessió i comptes del backend.
En desenvolupament Vite usa el port 5174 i
redirigeix `/api` al backend local del port 3000; el servidor compilat
serveix conjuntament HTML, recursos i API.

Hi ha 72 proves de backend: accés privat, sessions, canvi persistent de contrasenya,
límit d'intents, errors públics,
fitxers privats, memòria cau HTTP i de dades, configuració, quotes,
mètriques desconegudes, períodes i errors parcials. Les sessions i
consultes Brevo ja estan connectades; el recorregut autenticat s'ha
verificat amb els dos comptes reals. Hi ha 16 proves de peticions/presentació/worker i la
interfície s'ha comprovat en Chrome mòbil/escriptori amb dades sintètiques.
Manifest, icones i worker només estàtic implementats. Offline, represa,
logout i actualització acceptada verificats amb Chrome, sense cache de
dades privades. Safari/iPhone real continua pendent.

Arrencada amb comprovació de sessió limitada a 10 segons, validació de
dos booleans, reintent manual i represa després de segon pla. Les altres
peticions tenen 30 segons, inclòs el JSON; els POST no es repeteixen
automàticament. Cancel·lació i respostes obsoletes controlades. Controls
PWA visibles durant l'espera i en error; l'actualització continua exigint
consentiment. `/?recovery=1` aprofita l'exclusió de paràmetres del worker
per obtenir HTML de xarxa sense eliminar dades locals ni sessions.

El carregador llegeix `accounts.env` i `auth.env` fora del checkout,
amb permisos restringits. `npm run setup:auth` prepara hash scrypt i
secret de sessió sense exposar la contrasenya. El responsable de la instal·lació ja ha configurat
una contrasenya privada i la interfície d'accés ja està implementada.
Les sessions viuen en memòria i es revoquen en reiniciar, amb caducitat
de set dies; la cookie és HttpOnly, SameSite Strict i Secure a producció.
Els POST d'accés validen origen i capçalera pròpia. El backend no confia
en capçaleres proxy fins que es defineixi la topologia de desplegament.

Canvi des de l'app autenticada: exigeix contrasenya actual i confirmació
de la nova, desa només un hash scrypt persistent en un directori privat
separat i revoca totes les sessions després de desar-lo. El hash nou té
prioritat sobre el bootstrap d'`auth.env`, també en reiniciar. El muntatge
d'escriptura de Docker només cobreix aquest directori; claus Brevo i
configuració inicial continuen readonly. No hi ha recuperació pública.

Noms editables des de «Configuració», després d'entrar. GET/POST propis
autenticats amb protecció d'origen, validació i límit de canvis. Dos noms
persistents al servidor en `access/account-names.json`, separats del hash
i de les claus. Prevalen sobre els noms inicials de l'entorn, es conserven
en reiniciar i s'apliquen als snapshots encara que Brevo estigui en cache.
No s'envien canvis de nom a Brevo ni es desa configuració al navegador.
La nova configuració dinàmica importa aquests noms; el fitxer anterior
només es conserva com a bootstrap i no es torna a escriure.

## Configuració dinàmica i avisos

Tasca aprovada el 2026-10-17: formulari privat de claus, comptes afegibles,
referències de pla/volum, icones/colors i avisos per correu i push amb
l'app tancada. Disseny Comptes/Avisos aprovat, estil existent preservat.
Publicat i desplegat el mateix dia a partir del commit `e201b6c`;
avisos reals desactivats fins a configurar i validar els canals.

Ajust del 2026-10-17 publicat i desplegat des de `d38533d`: dues xifres
destacades per a emails restants de subscripció i crèdits prepagament,
sense sumar-les. Una subscripció zero amb reserva només es conserva com
a tal amb context explícit de pagament actiu i període vàlid; el patró
prepagament anterior es manté sense aquest context. Vegeu la validació API.

Correcció posterior del mateix dia: ordre visual prepagament/pla,
text neutral i etiqueta «Emails del pla». La prioritat de facturació no
es dedueix de `plan.type`, del pla manual ni d'una vertical `paid`: el
prepagament també pot donar accés a funcions de pagament. No es modifica
la normalització dels imports ni s'implementa cap descompte local.
Publicada i desplegada des del commit `8510a86`.
En la versió `8510a86`, la referència manual Free adaptava només el text i la font del saldo del
pla quan hi ha prepagament: no són saldos simultàniament utilitzables.
No canvia la quota normalitzada ni activa Free en esgotar crèdits.

Ajust local posterior: `activeBalance` compartit selecciona el saldo per
a targeta i avisos. Amb referència explícita Free i prepagament retornat,
usa els crèdits (també zero), mai el saldo del pla com a substitut si la
reserva és absent. Percentatge del volum Free ignorat en aquest règim;
llindar absolut en crèdits. Imports normalitzats intactes i disponibles
als detalls. Cap detecció Free a partir de 300 ni d'una vertical `paid`.
Les targetes plegades comparteixen blocs i mida, també en una columna;
obrir-ne una no estira artificialment les altres.

`PrepaidHistory` desa mostres numèriques xifrades al costat del workspace,
amb HKDF/AAD separats, permisos privats i cua d'escriptura, sense canviar
la revisió de Configuració. Mostres de lectures de quota existents, no
polling addicional ni dades SMTP. Màxim 60 mostres/compte i finestra de
29 dies en registrar; nova sèrie amb recàrrega, absència de saldo o buit
superior a 36 hores. Empremtes de credencial privades separen substitucions.

Previsió amb almenys 7 dies transcorreguts i 8 dates observades, consum
net positiu i horitzó ≤ 365 dies. Data orientativa, no caducitat ni
garantia; els crèdits comprats no caduquen. Sense dades suficients no hi
ha data. Error del fitxer només inhabilita previsió i no bloqueja l'app.
`lowDays` opcional (1–365, per defecte nul) afegeix avís anticipat amb
prepagament actiu i estimació fresca; el llindar de crèdits té prioritat.
Incidents conserven la base del saldo i reconeixen canvis de règim.
Ajust implementat i provat localment, encara no publicat ni desplegat.

`Workspace` és un magatzem privat versionat, xifrat AES-256-GCM, escrit
atòmicament fora del checkout. Clau derivada amb HKDF de `SESSION_SECRET`:
backup conjunt i migració abans de rotar-lo. El primer desament importa
els dos comptes existents sense tocar bootstrap, hash o noms anteriors.
Les API keys noves entren per HTTPS amb sessió i contrasenya actual,
es validen amb GET de Brevo i mai es retornen. Projecció pública de
metadades i canvis amb revisió optimista. Un procés únic; sense rèpliques.
La cache separa cada credencial per empremta privada i té concurrència GET
limitada a quatre. Cap pla manual sobreescriu el saldo real.

Monitor al backend cada 5 minuts, només amb `ENABLE_NOTIFICATIONS=true`.
Lectura de quotes amb cache compartida, llindars de saldo fresc i avisos
després d'almenys 15 minuts sense dades fresques. Incidents persistents,
repetició explícita i reserva de registre abans d'enviar. Correus agrupats,
màxim 20 intents/dia UTC, a destinatari i compte/remitent seleccionats.
Només l'avís per correu autoritza POST a Brevo; no hi ha enviaments de
campanyes. Brevo ja en comptabilitza el cost, no es resta al normalitzador.

Push estàndard amb VAPID, subscripcions xifrades al servidor, permís del
dispositiu i worker amb text genèric. No necessita crèdits Brevo; el correu
pot fallar o esgotar el pressupost sense bloquejar aquest canal. A l'iPhone
requereix iOS 16.4+ i instal·lació a la pantalla d'inici. Les subscripcions
no caduquen amb el logout; revocació per dispositiu o gate global de servidor.
Historial de 100 intents, no una prova d'entrega ni garantia exactly-once.
Canals provats amb dobles, sense correus o push reals. iPhone real pendent.
La imatge candidata ha comprovat a Linux la lectura de la configuració
existent i la persistència xifrada amb dades sintètiques, sense xarxa i
sense alterar fitxers privats reals. HTTPS, protecció dels endpoints i
PWA verificats després del desplegament; no s'ha fet login públic real.

Comptador d'«Actualitza» des de l'última resposta vàlida amb alguna secció
fresca, no des de la data de cada font. No es reinicia amb errors de xarxa
ni quan tota la resposta és antiga/indisponible. Timestamps i avisos de
secció continuen distingint cache i antiguitat. Interval visual només en
primer pla, recalculat amb el rellotge real en reprendre; no és polling.

La cache dura 60 segons. En error, cada secció independent pot conservar
dades antigues fins a 15 minuts, amb estat i timestamp original; després
retorna `null`. No es desen respostes Brevo completes. Vegeu els límits
concrets i els endpoints a [`../apps/api/README.md`](../apps/api/README.md).

## Fonts Brevo verificades en documentació

Base: `https://api.brevo.com`.

| Endpoint | Ús previst | Documentació |
| --- | --- | --- |
| `GET /v3/account` | Plans i crèdits | https://developers.brevo.com/reference/get-account |
| `GET /v3/smtp/statistics/reports` | Estadístiques transaccionals diàries | https://developers.brevo.com/reference/get-smtp-report |
| `GET /v3/smtp/statistics/aggregatedReport` | Totals d'un període | https://developers.brevo.com/reference/get-aggregated-smtp-report |
| `GET /v3/emailCampaigns` | Nombre de campanyes filtrades per data d'enviament; font separada | https://developers.brevo.com/reference/get-email-campaigns |
| `GET /v3/senders` | Remitents actius del compte emissor d'avisos | https://developers.brevo.com/reference/get-senders |
| `POST /v3/smtp/email` | Només avisos per correu configurats i proves explícites | https://developers.brevo.com/reference/send-transac-email |

Els informes SMTP són transaccionals. No permeten assumir que s'ha
comptabilitzat tot el consum d'un compte que també envia campanyes.
La documentació dels complements indica que els crèdits prepagament
substitueixen els 300 enviaments gratuïts diaris en Free. Cal comprovar
el règim efectiu de cada compte; no assumir una suma de saldos.

Font: https://help.brevo.com/hc/en-us/articles/4409354969746-Customize-your-plan-with-add-ons

## Validació dels càlculs

Fet el 2026-10-01:

1. Els dos comptes s'han consultat només amb peticions `GET`.
2. `plan`, `credits`, `creditsType` i `planVerticals` s'han inspeccionat
   sense desar ni exposar les respostes completes.
3. S'han distingit dos règims: saldo prepagament al Compte 1 i quota
   diària Free al Compte 2.
4. No hi ha campanyes enviades al període observat; les dades trobades
   als informes SMTP són transaccionals.
5. `requests` es presentarà com a sol·licituds d'enviament transaccionals,
   no com a entregues ni com a persones.
6. Els saldos i el consum s'han contrastat amb la interfície dels dos
   comptes. El Compte 1 consumeix un crèdit prepagament per enviament; al
   Compte 2, el saldo retornat encaixa amb la quota Free restant.
7. La interfície dels dos comptes mostra GMT+2. La indicació inicial
   de reinici a mitjanit era una observació comunicada, no una verificació
   del límit de dia de l'API. Revisió del 2026-10-03: l'hora exacta de
   reinici no està acreditada; la interfície no la promet. Saldo i
   estadístiques es presenten com a dades independents, segons Brevo.

La discrepància del Compte 1 ha quedat resolta amb el responsable de la instal·lació: ara els
enviaments consumeixen crèdits prepagament, que substitueixen els 300
gratuïts. Es mantindrà el règim actual fins a esgotar el saldo. Després,
el règim esperat és Free amb 300 enviaments diaris; aquesta transició
encara no s'ha observat. El backend haurà de detectar el pla i el saldo
retornats per Brevo en cada actualització, sense activar la quota Free
només perquè el saldo prepagament arribi a zero.

Cada dada pública indicarà període, origen i actualització. Una mètrica
absent o amb significat no verificat és desconeguda, no zero.

## Mètriques i límits semàntics

Els informes documentats inclouen `requests`, `delivered`, `opens`,
`uniqueOpens`, `clicks`, `uniqueClicks`, `hardBounces`, `softBounces`,
`blocked`, `spamReports`, `invalid` i `unsubscribed`.

Es podrà mostrar la suma de hard i soft bounces com a rebots reportats,
sense afirmar que representa persones úniques. Els percentatges
requereixen denominadors validats; si el denominador és zero, el
percentatge serà no aplicable.

Els totals únics de set dies s'obtindran de l'informe agregat del període,
no sumant valors únics diaris. Un dia absent no es convertirà en zero
abans de comprovar el comportament real de l'API.

La validació real confirma que l'API omet dies sense activitat. Per a les
mètriques additives (`requests`, `delivered`, obertures totals, clics
totals, rebots i bloquejos), el backend podrà completar els dies absents
amb zero després de reconciliar-los amb l'informe agregat del mateix
interval. Aquesta regla no s'aplica als valors únics.

Cal consultar amb `startDate` i `endDate` explícits. En la prova real,
`days=1` va incloure ahir i avui i `days=7` va incloure vuit dates, en
conflicte amb la descripció documental.

No s'ha acreditat que els informes agregats exposin els destinataris
rastrejables o l'estimació exacta d'obertures de la interfície Brevo.
`uniqueOpens` no és suficient per reproduir aquesta estimació. Si no es
pot obtenir, la interfície ho indicarà i mostrarà les mètriques disponibles
amb el nom correcte.

Font: https://help.brevo.com/hc/en-us/articles/208858829-Review-your-transactional-email-reports

## Desplegament implementat

Un servei Node en Docker Compose connectat a la xarxa externa `web`.
Serveix els arxius compilats de Vite i l'API. Caddy fa de proxy; l'entrada
pública reutilitza el Cloudflare Tunnel existent. No cal instal·lar Node
directament al sistema host.

Carpeta: `/opt/docker/projects/brevo-miniapp/`, versions identificades
sota `releases/`, enllaç `src` a la versió activa i secrets a `private/`,
fora del codi i de la imatge. Docker multi-stage amb Node 24 fixat per
digest; runtime verificat 24.21.0, usuari 1000, sistema de fitxers de
només lectura, sense ports publicats, límits de memòria/CPU i healthcheck.
Caddy carrega el fitxer propi `caddy/site.conf` mitjançant l'import
existent; no s'han reiniciat els altres serveis ni modificat DNS.
Cloudflare termina HTTPS i el túnel arriba a Caddy per la xarxa `web`.
Interfície i API al mateix origen HTTPS, verificat el 2026-10-01 en una
instància privada. `miniapp.example.com` és només el domini fictici dels
exemples. Producció exigeix `PUBLIC_ORIGIN` explícit. Caddy i API serveixen
capçaleres de seguretat, inclosa CSP.
Cap API ni sessió s'ha de cachejar a Cloudflare o al service worker.
Operació i versions: [`../deploy/README.md`](../deploy/README.md).

No es confia en `X-Forwarded-For`: els usuaris darrere Caddy comparteixen
el límit d'intents del proxy. És adequat per a aquest accés personal;
canviar-ho exigeix definir explícitament proxies de confiança.

## Verificació

88 proves de càlculs, accés, configuració, avisos, previsió, peticions, presentació i worker; comprovació de tipus, aïllament
de secrets, errors parcials i compilació. Proves Chrome de UI i PWA
amb dades sintètiques, inclosa l'arrencada amb sessió bloquejada. HTTPS públic comprovat amb worker, offline i
represa; lectura real dels dos comptes des del contenidor de producció.
Pendent: Safari/WebKit, instal·lació standalone a l'iPhone real i accés
personal amb la contrasenya del responsable de cada instal·lació.
