# Instal·lar la MiniApp amb els teus comptes

Cada instal·lació té les seves claus Brevo i la seva contrasenya. No
utilitza els comptes de l'autor ni envia les teves claus a la seva app.
Les claus inicials es poden preparar en un fitxer privat. Després d'entrar,
Configuració també permet connectar o substituir claus amb un formulari
privat. Només el backend les utilitza per parlar amb Brevo; el formulari
no les desa al navegador ni les torna a mostrar.

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
La consulta de dades utilitza GET. Si actives avisos per correu, el backend
també envia aquests correus amb POST des del compte que triïs. Això no
converteix la credencial en una clau limitada a lectura: protegeix-la com una
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

Alternativa: pots deixar les claus buides o no crear `accounts.env` en
desenvolupament. Després de configurar l'accés, entra a Configuració i
edita els comptes inicials per connectar-los, o afegeix-ne un de nou.
El Compose d'exemple sí que exigeix el fitxer muntat, encara que sigui buit.

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

### Canviar-la des de l'app

Entra i prem **Canvia la contrasenya**, sota les targetes. Introdueix
l'actual, la nova (12–256 caràcters) i la confirmació. Després de desar-la,
totes les sessions es tanquen i cal entrar amb la nova.

El backend desa només un hash scrypt en `access/password.json`, al costat
del fitxer privat `auth.env`: directori `0700` i fitxer `0600`, fora del
checkout. Aquest hash té prioritat sobre l'inicial d'`auth.env` o de
`APP_PASSWORD_HASH`, també després de reiniciar. No es modifiquen les claus
Brevo ni el secret de sessió. El directori ha de ser escrivible pel backend.
`AUTH_PASSWORD_FILE` permet una altra ruta absoluta privada; no col·loquis
el fitxer en una carpeta compartida o dins del repositori.

Si el fitxer existent és invàlid o té permisos insegurs, l'arrencada falla:
no torna silenciosament a la contrasenya inicial. No es desa contrasenya
en text pla ni dades d'accés en la cache PWA o localStorage/sessionStorage.

No hi ha «He oblidat la contrasenya» públic. Si no recordes l'actual,
necessites una recuperació administrativa privada al servidor. Cal
tractar també el hash d'`access/password.json`, que té prioritat:
canviar només `auth.env` no restableix una contrasenya canviada des de l'app.
No s'inclou un reset automatitzat. Conserva còpies privades i revisa el
procediment abans de substituir configuració o eliminar fitxers.

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

## Configurar comptes, pla i aparença

Després d'entrar, prem **Configuració**, al costat de **Canvia la
contrasenya** sota les targetes. A **Comptes** pots editar el nom
(1–100 caràcters), triar una de sis icones pròpies i sis colors, ordenar,
connectar o desconnectar comptes (màxim 25). No es modifica el compte
a Brevo. «Desconnecta» només el retira d'aquesta MiniApp; si era l'emissor
dels correus d'avís, aquests es desactiven.

Connectar o substituir una clau exigeix la contrasenya actual de la
MiniApp i valida la clau amb un GET de Brevo abans de desar-la. Desconnectar
també exigeix contrasenya i confirmació. Una clau desada mai es recupera
amb GET. Cancel·lar descarta l'edició; les dades es comparteixen amb altres
dispositius en la pròxima lectura. Un conflicte de revisió demana recarregar.

El **pla contractat**, el **volum** i el **dia de renovació** manuals són
referències teves, no una compra ni una modificació del pla real. Defineix
llindars de saldo absolut o percentatge del volum configurat; el percentatge
requereix un volum positiu. El saldo sempre prové de Brevo: mai `300 - enviats`.
El saldo del pla i el prepagament es presenten separadament, no sumats.
Si tens Free amb crèdits comprats, selecciona **Free** com a referència:
targeta i avisos utilitzaran els crèdits prepagament, no els 300 emails/dia
com a saldo actiu simultani. El percentatge del volum Free no genera
avisos del prepagament; configura el llindar absolut en crèdits.
Això no altera els imports retornats
ni activa la quota Free quan el prepagament arriba a zero; cal que Brevo
confirmi el règim. No triïs «Subscripció mensual» només perquè l'API
retorni una entrada anomenada `subscription`.

Opcionalment, configura **previsió d'esgotament en ≤ dies** (1–365).
Per defecte queda buida i no genera avisos nous. Necessita prepagament
actiu i una estimació fresca amb almenys set dies d'historial de saldo;
el llindar de crèdits té prioritat. No garanteix una data: noves compres
i canvis de ritme poden alterar-la. No s'infereix a partir dels informes SMTP.
Sense avisos actius només s'acumulen mostres quan es consulten comptes;
si passa més de 36 hores entre lectures es comença una sèrie nova.

La configuració, les claus i les subscripcions push es desen xifrades amb
AES-256-GCM a `access/workspace.sealed.json` (`0600`, directori `0700`),
fora del checkout. `WORKSPACE_SETTINGS_FILE` permet una ruta alternativa.
El primer desament importa els dos comptes i els noms anteriors; no
sobreescriu `accounts.env`, `auth.env` ni `account-names.json`. A partir
d'aleshores preval el fitxer nou: rota les claus des de Configuració,
no modificant només el fitxer inicial.

Conserva còpies privades del fitxer xifrat **i del `SESSION_SECRET` original**:
la clau de xifrat se'n deriva. Canviar la contrasenya de la MiniApp no afecta
el xifrat; rotar el secret de sessió exigeix una migració administrativa
abans de reiniciar, o no es podrà llegir la configuració. No hi ha una
comanda de migració distribuïda. No eliminis el fitxer per «arreglar» un
error: un fitxer invàlid impedeix arrencar i no restaura el bootstrap.

L'històric de crèdits és un segon fitxer privat xifrat,
`access/prepaid-history.sealed.json`, al costat del workspace. Inclou-lo
als backups amb el secret original. Si l'històric falla, no es bloqueja
l'accés: la previsió queda no disponible i no se sobreescriu el fitxer.

El comptador d'Actualitza indica el temps des de la consulta correcta,
no l'edat de cada dada de Brevo. Les dates i avisos de cada secció
continuen sent la referència per a dades antigues o en cache.

## Avisos per correu i notificacions push

Per defecte **no s'envia res**. Configura primer els llindars de cada
compte i la pestanya **Avisos**. Quan vulguis activar el servei, estableix
`ENABLE_NOTIFICATIONS=true` a l'entorn privat del backend i recrea'l.
Aquest interruptor permet els canals que hagis configurat i activat;
posar-lo a `false` i recrear el backend els atura. No és una automatització del navegador: necessita
el servidor en funcionament, encara que tanquis l'app.

Per rebre només push, deixa el correu desactivat i registra el dispositiu.
El resum d'estat diferencia servei habilitat, correu desactivat i push
actives. Amb el servei pausat només es prepara el registre: no s'envia res.
Les opcions de connexió i repetició són comunes als dos canals i es desen
amb «Desa els avisos», independentment de l'activació del correu.

- **Correu:** tria destinatari, compte Brevo que paga l'enviament i un
  remitent actiu obtingut d'aquell compte. Confirma la contrasenya per
  desar. Cada correu acceptat es comptabilitza a Brevo en aquell compte;
  la MiniApp no el descompta de nou. Sense saldo o remitent vàlid pot fallar.
- **Push:** a cada dispositiu prem «Activa en aquest dispositiu» i dona
  permís. A l'iPhone requereix iOS 16.4 o posterior i obrir la MiniApp
  afegida a la pantalla d'inici, no només una pestanya de Safari.
  Les push no consumeixen crèdits Brevo i només mostren un missatge genèric,
  sense noms ni saldos a la pantalla bloquejada. Pots desactivar aquell
  dispositiu amb el mateix control. [Requisits oficials de WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- **Prova:** «Envia una prova als canals actius» requereix contrasenya i
  confirmació, i utilitza la configuració ja desada. Si el correu és actiu,
  la prova també el carrega al compte emissor. Revisa l'historial per canal.

El backend comprova el saldo cada 5 minuts. El llindar només s'avalua amb
dades fresques conegudes; una dada absent no és zero. L'avís de connexió
requereix almenys 15 minuts sense dades fresques observats pel monitor.
Els incidents es dedupliquen i agrupen en un correu; la repetició és
configurable (1 hora–7 dies). Màxim 20 intents de correu per dia UTC,
incloses proves i errors, amb comptador persistent independent de l'historial.
Esgotar aquest límit o fallar el correu no atura les push.

L'historial conserva 100 intents (en mostra 20). «Acceptat» és acceptació
pel servei, no entrega confirmada. Un timeout o una aturada pot deixar
un estat incert/pendent: no es reenvia immediatament, però no es garanteix
exactament una entrega. Un enviament ja en curs no es pot cancel·lar.
El sistema operatiu pot retardar o silenciar push. La verificació real
en iPhone i l'entrega real de correu continuen pendents; les proves del
projecte utilitzen emissors i serveis simulats, sense càrrecs.

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
  no el canvi d'hora europeu. Verifica el fus dels teus comptes.
  L'app utilitza un únic fus configurat per a tots.
- **Noms inicials dels comptes:** opcionalment, inicia amb
  `BREVO_ACCOUNT_1_NAME="Personal" BREVO_ACCOUNT_2_NAME="Altres" npm run dev`.
  Són noms, no secrets. El backend no llegeix els noms d'`accounts.env`.
  Si s'han desat des de l'app, tenen prioritat sobre aquests noms inicials.
- **Altres ubicacions:** `BREVO_SECRETS_FILE`, `AUTH_SECRETS_FILE`, `AUTH_PASSWORD_FILE`, `ACCOUNT_NAMES_FILE` i `WORKSPACE_SETTINGS_FILE`
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
