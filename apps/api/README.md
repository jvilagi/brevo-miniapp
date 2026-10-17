# Backend

Servei Fastify + TypeScript sobre Node.js 24. `src/app.ts` crea el servidor
i `src/server.ts` l'inicia. `GET /api/health` exposa només la salut tècnica;
`GET /api/accounts` requereix una sessió autenticada.

En mode `NODE_ENV=production` també serveix `apps/web/dist`, sota el mateix
origen. Per defecte escolta a `127.0.0.1:3000`; `HOST` i `PORT` permeten
configurar l'arrencada fora del mode conjunt de desenvolupament. El mode
no productiu només permet escoltar a localhost. Producció exigeix accés
privat configurat i `PUBLIC_ORIGIN` HTTPS; les cookies són Secure.

Els normalitzadors de `src/normalize.ts` tracten plans ambigus i mètriques
absents com a desconeguts. No calculen el saldo restant a partir del
consum ni activen Free quan s'esgota un saldo prepagament.

## Accés privat

- `GET /api/auth/session`: estat d'accés, sense dades del compte.
- `POST /api/auth/login`: cos JSON `{ "password": "…" }`; contrasenya
  comprovada amb scrypt (`N=32768`, `r=8`, `p=3`, sal aleatòria).
- `POST /api/auth/logout`: revoca la sessió i esborra la cookie.
- `POST /api/auth/password`: sessió activa i JSON amb `currentPassword`,
  `newPassword`, `confirmation`. Comprova l'actual i 12–256 caràcters per
  la nova, que ha de ser diferent i coincidir amb la confirmació. Desa el
  hash abans de canviar l'estat en memòria; èxit revoca totes les sessions.
  Error d'escriptura conserva contrasenya i sessions; mai exposa el camí.
- Els POST d'accés exigeixen `Origin` igual a `PUBLIC_ORIGIN` i
  `X-App-Request: 1`. No hi ha CORS ni confiança en l'Host del client.
- Cookie HttpOnly, SameSite Strict, caducitat absoluta de set dies,
  Secure i prefix `__Host-` en producció. Sessions aleatòries signades;
  el servidor desa només el digest del token en memòria. Login rota
  l'anterior sessió; reiniciar revoca totes les sessions (sense BD).
- Login: màxim 5 peticions per IP en 15 minuts, 30 comprovacions globals
  per 15 minuts i 2 comprovacions scrypt simultànies. Màxim 200 sessions.
- Canvi: màxim 5 peticions per IP en 15 minuts; comparteix el límit global
  i de concurrència amb login. Només un canvi alhora; el login en curs
  no pot crear una sessió basada en la contrasenya anterior després del canvi.
- Comptes: màxim 60 consultes per IP i minut. `trustProxy` desactivat:
  darrere Caddy, els clients comparteixen el límit del proxy fins a
  definir una topologia de confiança segura en el desplegament.
- Sense `auth.env` en desenvolupament, login retorna `503` i comptes
  `401`. La comanda `npm run setup:auth` configura l'accés localment.

`AUTH_PASSWORD_FILE` (per defecte `access/password.json` al costat
d'`auth.env`) té prioritat sobre el hash inicial. Escriptura temporal
exclusiva `0600`, sync i substitució per rename dins del directori privat
`0700`, fora del checkout. Es rebutgen enllaços, permisos oberts o hashes
invàlids; un fitxer existent invàlid impedeix l'arrencada. No es toca el
secret de sessió ni `auth.env`. El disseny és per a un sol procés backend,
no per a rèpliques múltiples ni edicions externes concurrents del hash.
Si no hi ha escriptura configurada, el canvi retorna `503`.

Referència de seguretat: [OWASP, canvi de contrasenya](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature).

## Noms dels comptes (compatibilitat)

`GET /api/settings/accounts` retorna `{ "names": { "1": "…", "2": "…" } }`
només amb sessió. `POST` al mateix endpoint desa aquests dos noms: sessió,
origen i capçalera pròpia obligatoris, 10 intents per minut, un desament
alhora. Noms d'1–100 caràcters, retall d'espais exteriors, sense caràcters
de control ni camps addicionals; s'admet Unicode i noms repetits.
No es modifiquen els comptes a Brevo ni les claus, hash o sessions.

`ACCOUNT_NAMES_FILE` és privat, per defecte `account-names.json` al mateix
directori de `AUTH_PASSWORD_FILE`. Utilitza el mateix desament atòmic
privat `0600`/`0700`, amb validació pròpia i fora del checkout. Si existeix,
preval sobre `BREVO_ACCOUNT_1_NAME` i `BREVO_ACCOUNT_2_NAME` en reiniciar.
Un fitxer invàlid impedeix l'arrencada; no es reinicialitza silenciosament.
El canvi només es reflecteix en memòria després de desar; en error es
conserven els noms anteriors. Sense writer retorna `503`. Els snapshots
apliquen els noms actuals també sobre dades Brevo en cache. Altres
dispositius els veuen en la pròxima lectura, no mitjançant notificacions push.
Amb Workspace actiu aquests endpoints llegeixen/editen els dos ids inicials
al magatzem xifrat. `account-names.json` només és la font d'importació inicial;
no es torna a escriure. El formulari nou utilitza `/api/workspace`.

## Configuració dinàmica

`Workspace` importa els comptes inicials només si encara no hi ha fitxer
xifrat, sense escriure en arrencar. El primer canvi persisteix la configuració
completa. `WORKSPACE_SETTINGS_FILE` per defecte és `workspace.sealed.json`
al directori privat del hash. AES-256-GCM amb HKDF-SHA256 del secret estable
de sessió, IV aleatori i AAD de versió. No rotar `SESSION_SECRET` sense
migració. Fitxer fora del checkout, `0600`, directori propi `0700`, límit
de 256 KiB i desament atòmic. Un únic procés; cap base de dades o rèplica.

Tots aquests endpoints requereixen sessió; els POST també origen i
`X-App-Request: 1`. Validació estricta, sense camps addicionals. Els canvis
de comptes i avisos exigeixen `revision`; conflicte `409`, edició conservada.

| Endpoint | Funció |
| --- | --- |
| `GET /api/workspace` | Metadades, configuració d'avisos i historial; mai claus |
| `POST /api/workspace/accounts` | Afegir amb contrasenya actual i GET de validació Brevo |
| `POST /api/workspace/accounts/:id` | Editar; reautenticació i validació si substitueix clau |
| `POST /api/workspace/accounts/:id/disconnect` | Retirar només de MiniApp, amb contrasenya |
| `POST /api/workspace/order` | Permutació exacta dels comptes actuals |
| `GET /api/workspace/accounts/:id/senders` | Nom, email i id dels remitents actius |
| `POST /api/workspace/alerts` | Desar avisos amb contrasenya i remitent comprovat |
| `POST /api/workspace/alerts/test` | Prova explícita als canals desats i actius |
| `POST /api/workspace/push/key` | Generar VAPID una vegada; retornar només clau pública |
| `POST /api/workspace/push/subscribe` | Registrar endpoint i claus estàndard del dispositiu |
| `POST /api/workspace/push/unsubscribe` | Retirar la subscripció d'aquell dispositiu |

Màxim 25 comptes i 20 dispositius push. POST de configuració: 10 intents
per ruta/IP/minut; prova: 2/15 minuts. Reautenticació comparteix límits globals
i concurrència scrypt del login. Desconnectar l'emissor desactiva el correu,
mai es tria un altre compte de pagament automàticament. Les referències de
pla són manuals i no alteren el saldo normalitzat segons API.
La referència **Free**, si Brevo també retorna prepagament, selecciona
els crèdits com a saldo actiu per a targeta i avisos. No suma la quota
Free ni la recupera amb saldo zero; només una resposta efectiva Free
de Brevo permet usar-la de nou. Reserva absent: desconegut, no zero.
El llindar absolut s'aplica al saldo actiu. El percentatge del volum
Free no s'aplica al prepagament; no es divideixen els crèdits per 300.
`lowDays` opcional (1–365, `null` per defecte) avisa de previsió propera
només amb prepagament actiu i estimació fresca; saldo baix té prioritat.
Els incidents distingeixen el canvi de saldo perquè un avís del pla no
suprimeixi indegudament un avís posterior de crèdits.

Monitor al backend cada 5 minuts amb `ENABLE_NOTIFICATIONS=true` (per defecte
false). Consulta només quotes, amb cache compartida. Llindars amb dada fresca,
incidents persistents i deduplicats, absència de dades durant 15 minuts,
repetició configurable, màxim 20 intents de correu/dia UTC independent dels
100 registres d'historial. Reserva pendent abans de la xarxa, errors incerts
sense reintent immediat. Acceptació no implica entrega. No hi ha cua externa
ni garantia exactly-once; una aturada pot deixar un registre pendent.
Fallada o pressupost de correu esgotat no impedeixen push.

El correu usa només `POST /v3/smtp/email`, al compte seleccionat i amb remitent
actiu. Les push utilitzen `web-push`, VAPID i endpoints HTTPS de Google,
Mozilla o Apple validats, sense contingut privat. TTL d'una hora; subscripcions
404/410 retirades. Canals reals pendents de verificació amb consentiment;
les proves injecten emissors falsos i no consumeixen crèdits.

## Historial privat i previsió del prepagament

`PrepaidHistory` recull el saldo prepagament de les consultes de quota
existents, incloses les del monitor actiu. No afegeix peticions Brevo,
polling del navegador ni un monitor independent amb els avisos apagats.
El fitxer `prepaid-history.sealed.json`, al costat de `workspace.sealed.json`,
utilitza AES-256-GCM, HKDF del secret estable amb context separat, IV
aleatori i AAD pròpia. Fora del checkout, `0600`/`0700`, escriptura atòmica,
cua de desament única i límit de 256 KiB. No incrementa la revisió de
Configuració. No conté claus Brevo, noms ni payloads originals.

Per compte/empremta de clau conserva primera i última lectura de cada
dia UTC, màxim 60 mostres i finestra de 29 dies en registrar. Una recàrrega,
una desaparició del saldo o un buit superior a 36 hores reinicia la sèrie;
substituir credencials separa l'històric i retira l'anterior en la pròxima
lectura. Cache repetida, dades antigues i rellotge enrere no creen mostres.

Requereix almenys 7 dies transcorreguts i 8 dates observades. Mitjana del
descens net del saldo per dia; projecció només amb consum positiu i
horitzó màxim de 365 dies. Cap ús de sol·licituds SMTP ni campanyes com
a substitut dels crèdits gastats. Compres entre lectures i canvis de ritme
poden alterar l'estimació. Un zero fresc indica esgotat, no retorn a Free.
`prepaidForecast` públic només conté estat, data orientativa, mitjana,
dies observats i actualització; no la sèrie privada ni empremtes.

Sense prou dades: `collecting`; sense consum: `no-consumption`; horitzó
excessiu: `out-of-range`. Dada antiga o error de persistència: `unavailable`.
Un històric corrupte no bloqueja login/comptes ni se sobreescriu; només
inhabilita la previsió. Cal conservar el secret original amb els backups.

## Dades Brevo

Lectures GET cap a cinc endpoints fixos de `api.brevo.com` (els quatre
de dades i `/v3/senders` per configurar avisos), timeout de
10 segons, redireccions prohibides i límit de resposta de 2 MiB.
La resposta pública és una llista blanca de quota, mètriques SMTP i
nombre de campanyes retornades pel filtre de data d'enviament. El nombre
de campanyes no és el nombre d'emails ni una estadística de persones.
No es desen respostes completes, HTML, contactes ni claus SMTP.

Avui i els set dies naturals es consulten amb dates explícites en el
fus configurat a Brevo. SMTP i màrqueting són fonts separades. Els
agregats del període es llegeixen de Brevo; no se sumen valors únics.
Dies absents: només s'omplen mètriques additives amb zero si els dies
observats es reconcilien amb l'agregat fresc; `zeroFilled` identifica
els zeros completats. Altres valors absents continuen sent `null`.

Cache en memòria de 60 segons per compte, font i període, amb reutilització
de peticions simultànies i màxim quatre lectures Brevo concurrents.
Les claus de cache inclouen una empremta de la credencial només al backend:
substituir una clau no reutilitza dades de l'anterior. Si la configuració
canvia durant un snapshot, es rebutja amb `409`. En error es pot servir l'última dada fins a
15 minuts d'antiguitat, marcada `stale` amb la data original; després
és `unavailable`, amb `data: null`. Els errors tenen una pausa de reintent
de 10 segons. La quota té cache per compte i dia: a mitjanit del fus
configurat es consulta de nou Brevo, sense reutilitzar la cache d'ahir.
Això no implica que Brevo hagi reiniciat el saldo en aquell moment;
l'hora exacta de reinici no està verificada i el saldo no es recalcula.
Un nou dia crea noves claus SMTP i no reutilitza dades d'ahir com a avui.
Cada secció conserva estat, timestamp i error, sense anul·lar altres
fonts o comptes. Les respostes HTTP autenticades sempre són `no-store`.

La interfície d'accés i de comptes ja està implementada. El backend
s'ha verificat de cap a cap amb les dues claus privades i sessions
sintètiques temporals en memòria (sense guardar contrasenyes reals).

Comandes conjuntes i proves: vegeu el README principal.

Instal·lació amb claus pròpies i fitxers privats:
[`../../docs/installation.md`](../../docs/installation.md).
