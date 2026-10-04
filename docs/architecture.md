# Arquitectura de Brevo MiniApp

Proposta presentada i acceptada el 2026-10-01. La primera validació amb
les respostes reals dels dos comptes es va fer el mateix dia; vegeu
[`brevo-api-validation.md`](brevo-api-validation.md).

## Producte i interfície

Una pantalla principal amb dues targetes, una per compte. Cada targeta
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
- Inicialment sense base de dades: Brevo proporciona l'històric consultat.
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

Hi ha 39 proves d'accés privat, sessions, canvi persistent de contrasenya,
límit d'intents, errors públics,
fitxers privats, memòria cau HTTP i de dades, configuració, quotes,
mètriques desconegudes, períodes i errors parcials. Les sessions i
consultes Brevo ja estan connectades; el recorregut autenticat s'ha
verificat amb els dos comptes reals. Hi ha 6 proves de presentació i la
interfície s'ha comprovat en Chrome mòbil/escriptori amb dades sintètiques.
Manifest, icones i worker només estàtic implementats. Offline, represa,
logout i actualització acceptada verificats amb Chrome, sense cache de
dades privades. Safari/iPhone real continua pendent.

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
No s'envien canvis a Brevo ni es desa configuració al navegador.

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

45 proves de càlculs, accés i presentació, comprovació de tipus, aïllament
de secrets, errors parcials i compilació. Proves Chrome de UI i PWA
amb dades sintètiques. HTTPS públic comprovat amb worker, offline i
represa; lectura real dels dos comptes des del contenidor de producció.
Pendent: Safari/WebKit, instal·lació standalone a l'iPhone real i accés
personal amb la contrasenya del responsable de cada instal·lació.
