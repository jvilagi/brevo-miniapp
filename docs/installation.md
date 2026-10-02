# Instal·lar la MiniApp amb els teus comptes

Cada instal·lació té les seves claus Brevo i la seva contrasenya. No
utilitza els comptes de l'autor ni envia les teves claus a la seva app.
La interfície no té un formulari per introduir claus: només les llegeix
el backend des de fitxers privats o variables del seu entorn.

Aquesta guia cobreix desenvolupament local a macOS/Linux. Requereix
Git, Node.js 24 LTS i npm. Windows natiu no està verificat; els permisos
Unix dels fitxers són necessaris. Producció i iPhone requereixen un
desplegament propi HTTPS; no exposis el servidor de desenvolupament.

## 1. Obtenir el projecte i instal·lar dependències

Clona el repositori:

```bash
git clone https://github.com/jvilagi/brevo-miniapp.git
cd brevo-miniapp
node --version
npm ci --include=optional
```

`node --version` ha d'indicar `v24.x`. No cal Codex ni el mateix nom
d'usuari o carpeta que l'autor. Si ja tens el codi, entra a la seva
carpeta i executa només les dues últimes comandes.

## 2. Obtenir una clau pròpia de cada compte Brevo

Entra al primer compte Brevo, obre **SMTP & API → API keys** i genera
una clau amb un nom identificable, com ara «MiniApp personal». Repeteix
el procés al segon compte. Desa cada clau directament al teu fitxer
privat del pas següent: Brevo només mostra el valor complet en crear-la.
Consulta les [instruccions oficials de Brevo](https://developers.brevo.com/docs/api-key-authentication).

Utilitza claus API REST, no claus SMTP ni tokens del servidor MCP.
No les comparteixis en xats, incidències de GitHub, captures o logs.
La MiniApp només consulta dades amb GET, però això no converteix la
credencial Brevo en una clau limitada a lectura: protegeix-la com una
contrasenya i revisa els permisos disponibles al teu compte.

## 3. Preparar el fitxer privat fora del repositori

Des de l'arrel del projecte, en un terminal teu:

```bash
umask 077
mkdir -p "$HOME/.config/brevo-miniapp"
chmod 700 "$HOME/.config/brevo-miniapp"
if [ -e "$HOME/.config/brevo-miniapp/accounts.env" ] || [ -L "$HOME/.config/brevo-miniapp/accounts.env" ]; then
  printf '%s\n' 'accounts.env ja existeix; no es copia ni se sobreescriu.'
else
  cp -n deploy/accounts.env.example "$HOME/.config/brevo-miniapp/accounts.env"
fi
chmod 600 "$HOME/.config/brevo-miniapp/accounts.env"
```

La comprovació evita copiar si el fitxer ja hi era; `cp -n` afegeix una
protecció contra sobreescriptura. Conserva el fitxer existent i revisa'l
al teu editor. No l'eliminis per repetir la instal·lació.
Utilitza un directori i un fitxer regulars, teus,
no enllaços simbòlics ni carpetes compartides o sincronitzades al núvol.

Obre `~/.config/brevo-miniapp/accounts.env` amb un editor local de
confiança. Emplena les dues línies amb els valors reals, sense espais al
voltant de `=`. Exemple **només il·lustratiu**, no són claus vàlides:

```dotenv
BREVO_ACCOUNT_1_API_KEY=SUBSTITUEIX_PER_LA_CLAU_DEL_PRIMER_COMPTE
BREVO_ACCOUNT_2_API_KEY=SUBSTITUEIX_PER_LA_CLAU_DEL_SEGON_COMPTE
```

Desa el fitxer i torna a executar `chmod 600` si l'editor ha canviat els
permisos. No introdueixis les claus en comandes `export`, perquè podrien
quedar a l'historial del terminal. No executis `cat` per compartir-les.

No copiïs aquesta plantilla a `.env` dins del projecte: el backend no
carrega automàticament aquest fitxer i rebutja fitxers privats dins del
checkout. No editis la plantilla versionada amb claus reals. Tampoc
les posis a `apps/web`, `public`, el manifest o variables `VITE_*`.

## 4. Crear la contrasenya de la teva MiniApp

```bash
npm run setup:auth
```

En un terminal interactiu, introdueix dues vegades una contrasenya de
12–256 caràcters. L'entrada és oculta. Es desa un hash scrypt i un secret
aleatori de sessió a `~/.config/brevo-miniapp/auth.env`, amb permisos
`0600`; no s'hi desa la contrasenya en text pla. Aquest fitxer també és
privat i no es comparteix amb GitHub.

Si `auth.env` ja existeix, la comanda no el sobreescriu: continua amb la
contrasenya existent. No cal executar-la a cada arrencada.

## 5. Iniciar i comprovar l'app

```bash
npm run dev
```

Obre exactament [http://127.0.0.1:5174/](http://127.0.0.1:5174/) i entra
amb la contrasenya que acabes de definir, no amb la de Brevo. L'API
local funciona al port 3000; tots dos serveis escolten només a localhost.
Atura'ls amb `Ctrl+C`. Reinicia'ls després de modificar fitxers privats.

Per comprovar només la salut i la protecció, en un altre terminal:

```bash
curl --fail http://127.0.0.1:5174/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5174/api/accounts
```

La primera resposta ha de tenir `status: "ok"`; la segona ha de mostrar
`401` sense una sessió. Després d'entrar a la interfície, comprova que
cada targeta mostra el saldo i l'activitat del compte que esperes.
No és necessari imprimir cap clau ni la resposta completa de Brevo.

## Opcions i errors habituals

- **Fitxer privat invàlid:** comprova ubicació fora del repositori,
  propietari, fitxer regular i permisos `0600`; directori privat `0700`.
- **Accés no configurat:** falta `auth.env`; executa `npm run setup:auth`.
- **Compte no disponible:** revisa que la clau correspon al compte,
  no està revocada i és una API key REST. Si Brevo restringeix les IP,
  revisa la IP de sortida del backend. Sense clau no s'inventen zeros.
- **Port ocupat:** allibera els ports 5174/3000 de forma segura; la
  comanda no es desplaça automàticament a un altre port.
- **Fus horari:** el valor inicial `Etc/GMT-2` representa GMT+2 fix,
  no el canvi d'hora europeu. Verifica el fus dels teus dos comptes.
  L'app utilitza un únic fus configurat per a tots dos.
- **Noms dels comptes:** opcionalment, inicia amb
  `BREVO_ACCOUNT_1_NAME="Personal" BREVO_ACCOUNT_2_NAME="Altres" npm run dev`.
  Són noms, no secrets. El backend no llegeix els noms d'`accounts.env`.
- **Altres ubicacions:** `BREVO_SECRETS_FILE` i `AUTH_SECRETS_FILE`
  permeten camins absoluts privats fora del checkout. `setup:auth` sempre
  crea el seu fitxer a la ubicació per defecte; no segueix aquestes opcions.

En producció, defineix explícitament `PUBLIC_ORIGIN` amb **el teu origen
HTTPS**, no amb el domini de l'autor; munta les claus i `auth.env` fora
de la imatge. Els exemples utilitzen un domini fictici i s'han d'adaptar;
no és un desplegament universal automatitzat.
Revisa [`../deploy/README.md`](../deploy/README.md) i adapta-la al teu
servidor. Reiniciar el backend revoca les sessions en memòria.

Comprovacions de codi sense contactar amb Brevo: `npm run check`.
Per instal·lar a l'iPhone, publica primer la teva instància amb HTTPS i
afegeix-la a la pantalla d'inici des de Safari. La prova en Safari/iPhone
real continua pendent al projecte; no es garanteix paritat amb Chrome.
