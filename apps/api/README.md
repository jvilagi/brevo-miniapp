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

## Dades Brevo

Només GET cap a quatre endpoints fixos de `api.brevo.com`, timeout de
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
de peticions simultànies. En error es pot servir l'última dada fins a
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
