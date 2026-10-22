# Desplegament propi amb Docker Compose

Exemple per a Linux, Docker Compose, xarxa externa `web`, Caddy i
Cloudflare Tunnel existents. Un servei Node serveix interfície i API al
mateix origen HTTPS. No és un instal·lador universal ni crea DNS o túnels.
El desplegament privat original s'ha verificat; adapta els exemples al
teu servidor. No hi ha desplegament automàtic en fer commit.

## Configuració privada

Exemple de disposició, fora del checkout de les versions:

```text
/opt/docker/projects/brevo-miniapp/
  releases/<id>/   Codi sense secrets
  src -> releases/<id>
  private/        0700, propietari uid 1000
    accounts.env  0600, claus pròpies inicials (pot ser buit)
    auth.env      0600, hash i secret de sessió
    runtime.env   0600, origen/fus/noms
    compose.env   0600, directori privat i identificador de versió
    access/       0700, propietari uid 1000, muntatge separat d'escriptura
      password.json  0600, hash actual després d'un canvi des de l'app
      account-names.json  0600, noms propis després de desar-los des de l'app
      workspace.sealed.json  0600, comptes i avisos xifrats de la configuració nova
      prepaid-history.sealed.json  0600, mostres privades xifrades per a la previsió
  caddy/site.conf
```

Prepara claus i contrasenya segons [la guia](../docs/installation.md).
Transfereix els fitxers privats per un canal segur amb permisos restringits;
mai dins d'un release, commit, arxiu de distribució o imatge.
El contenidor utilitza uid 1000; ajusta la propietat dels fitxers al teu
servidor. El carregador rebutja permisos accessibles a altres usuaris.

Crea també el directori buit `private/access/`, propietari uid 1000 i
permisos `0700`, abans de fer `up`. Compose no el crea automàticament.
Només aquest directori té muntatge d'escriptura a `/run/private-auth`;
`accounts.env` i `auth.env` continuen en només lectura i el sistema de
fitxers del contenidor segueix readonly. `AUTH_PASSWORD_FILE` apunta al
hash persistent d'aquest directori. No copiïs un hash canviat al release.
`ACCOUNT_NAMES_FILE` apunta també a aquest muntatge, en un fitxer separat.
`WORKSPACE_SETTINGS_FILE` apunta també al directori d'escriptura.
No cal crear els JSON abans d'arrencar: es creen en desar des de l'app.
Conserva tot el directori entre versions; els noms desats prevalen sobre
els de `runtime.env`. Una versió anterior als noms personalitzables els
ignoraria fins a tornar a una versió compatible.

La configuració nova importa els comptes i noms existents en el primer
desament; després preval `workspace.sealed.json`. No substitueix el hash
ni escriu als fitxers muntats readonly. Conserva una còpia privada del
fitxer xifrat i de l'`auth.env` amb el `SESSION_SECRET` original: el xifrat
en depèn. No rotis aquest secret sense una migració administrativa prèvia.
Canviar la contrasenya des de l'app no el modifica.

Copia `runtime.env.example` fora del checkout com a `private/runtime.env`:
defineix **el teu** `PUBLIC_ORIGIN=https://el-teu-domini` sense barra final,
verifica `BREVO_TIMEZONE` i posa noms propis als comptes. Producció no
té un domini per defecte. Les claus van a `accounts.env`, no a runtime.
Per als comptes afegits des del formulari, les claus van al magatzem xifrat.
`ENABLE_NOTIFICATIONS=false` és el valor inicial. Per permetre avisos,
configura canals i llindars a l'app, posa'l a `true` en aquest fitxer
privat i recrea el servei. Requereix sortida HTTPS a Brevo i serveis push
Google/Mozilla/Apple. El monitor funciona cada 5 minuts amb el backend
actiu; no depèn del navegador ni d'un cron extern. Aturar els canals no
cancel·la enviaments ja en curs.

El gate global no activa per si sol el correu ni registra dispositius.
Per habilitar només push, deixa «Activa els avisos per correu» desmarcat,
registra el dispositiu i habilita el gate. Configuració mostra cada estat
separadament. Registrar un dispositiu amb el gate pausat no inicia el monitor.

`compose.env` conté només `BREVO_PRIVATE_DIR` (camí absolut de `private`)
i `BREVO_RELEASE` (tag de la versió). No utilitzis un camí amb salts de
línia. Aquest fitxer tampoc ha de formar part del checkout públic.

## Construcció i arrencada

1. Executa `npm ci --include=optional`, `npm run check` i les proves
   UI/PWA amb el navegador configurat segons el README del frontend.
2. Executa `npm run package:release`. Els resultats són a
   `test-results/deploy/`: arxiu, metadades SHA-256 i exemple de Compose.
   El directori privat per defecte és el de l'exemple anterior; es pot
   canviar amb `BREVO_PRIVATE_DIR` en executar l'empaquetat.
3. Transfereix l'arxiu sense secrets al servidor, verifica'n SHA-256 i
   extreu-lo a un directori nou `releases/<id>`. No sobreescriguis versions.
4. Conserva els secrets i una còpia de `compose.env` i de l'enllaç actiu.
   Selecciona el tag nou a `compose.env`. Des de l'arrel al servidor:

```bash
docker compose --env-file private/compose.env -f releases/<id>/deploy/compose.yaml config --quiet
docker compose --env-file private/compose.env -f releases/<id>/deploy/compose.yaml build app
docker compose --env-file private/compose.env -f releases/<id>/deploy/compose.yaml up -d --wait --wait-timeout 90
```

Substitueix `<id>`; no és una comanda literal. La xarxa externa `web`
ha d'existir. Noms de projecte, contenidor i àlies són fixos en l'exemple:
adapta'ls si tens una altra instància al mateix host. No hi ha ports
publicats; Caddy ha de poder arribar a `brevo_miniapp:3000` per `web`.

5. Només després de `healthy`, apunta `src` al release nou. Mantén versions
   i imatges anteriors. El canvi pot tenir una breu interrupció.

Docker multi-stage amb Node 24 Bookworm Slim fixat per digest. Runtime
no root, readonly, capabilities eliminades, tmpfs, límits i healthcheck.
`LICENSE`, `NOTICE` i avisos de tercers inclosos. Dependències npm runtime
copiades amb els seus fitxers de llicència, sense claus al build.

## Caddy i HTTPS

`caddy/site.conf` utilitza `miniapp.example.com`, **un domini fictici**.
Copia i adapta el vhost fora del release. L'exemple `http://` és només
per a un túnel on Cloudflare ja termina HTTPS i arriba a Caddy per HTTP
intern. Amb Caddy directament exposat, configura TLS per al teu domini;
no publiquis aquesta app per HTTP sense un proxy HTTPS davant.

Integra només el vhost propi a la configuració existent de Caddy, valida
abans de recarregar i conserva el fitxer anterior. No sobreescriguis
Caddy principal ni modifiquis altres serveis. No apliquis «Cache
Everything» de Cloudflare a HTML, `/api/` o worker. Les cookies de
producció són Secure/HttpOnly/SameSite Strict; HTML i API són `no-store`.

## Verificació pública

```bash
curl --fail https://el-teu-domini/api/health
DEPLOY_CHECK_ORIGIN=https://el-teu-domini node scripts/check-deployed.mjs
```

La segona comanda requereix Playwright i un navegador configurats; vegeu
[`../apps/web/README.md`](../apps/web/README.md). Comprova login, recursos,
API protegida, cache estàtica, offline i represa sense contrasenya ni
consulta dels comptes. Verifica manualment el login i les dades pròpies.
Cada reinici revoca les sessions; la contrasenya no canvia.

Si una PWA conserva una versió antiga bloquejada a l'arrencada, obre
`https://el-teu-domini/?recovery=1` amb connexió. El paràmetre evita la
còpia HTML del worker, sense esborrar cookies ni dades. La versió nova
limita la comprovació de sessió a 10 segons, ofereix reintent i mostra
l'actualització PWA també durant l'espera. No cal rotar secrets ni
reinstal·lar com a primer pas. Verifica el resultat a l'iPhone real.

No executis `docker inspect` complet, `env`, `cat` dels fitxers privats
o `docker compose config` sense `--quiet` en logs compartits. Per salut:

```bash
docker inspect --format '{{.State.Health.Status}}' brevo_miniapp
```

## Retorn a la versió anterior i manteniment

Comprova l'id exacte, carpeta i imatge de la versió anterior. Recupera
el seu `compose.env`, executa `config --quiet` i `up -d --no-build --wait`
amb el Compose anterior. Un cop saludable, restaura l'enllaç i, si cal,
el vhost previ validat. Repetir HTTPS i login. No canviïs secrets per
fer rollback ni eliminis imatges o carpetes alienes. Procediment documentat,
no simulat com a fallada de producció.

Després d'un canvi de contrasenya des de l'app, no tornis directament a
una versió anterior a aquesta funcionalitat: ignoraria `password.json`
i recuperaria l'accés inicial. Conserva el directori d'accés entre
versions i usa només versions compatibles, o prepara una migració
administrativa privada revisada abans de fer el retorn.

Després d'editar comptes amb la configuració nova, una imatge anterior
ignoraria el fitxer xifrat, tornaria als dos comptes inicials i no tindria
els avisos. No despleguis un rollback d'aquest tipus sense revisar abans
quines credencials i metadades carregaria. Preserva el fitxer xifrat i el
secret original; no esborres configuració per intentar tornar enrere.

L'ajust de saldo actiu i previsió afegeix `lowDays` i la base de l'incident
al workspace en el pròxim desament. Les versions anteriors amb validació
estricta poden no llegir aquests camps. Abans de tornar-hi, prepara una
migració privada o restaura una còpia revisada, preservant canvis posteriors.
No sobreescriguis configuració recent amb un backup sense revisar-la.
Inclou `prepaid-history.sealed.json` al backup i conserva el secret estable;
el muntatge existent d'accés ja cobreix aquest fitxer, sense nous ports.

Per rotar claus després de crear el magatzem xifrat, utilitza **Configuració**
amb la contrasenya actual: el backend valida i desa la nova clau. Comprova
les dades abans de revocar l'anterior. Canviar només `accounts.env` ja no
substitueix les claus del magatzem xifrat. Abans de la primera migració,
guarda una còpia privada, substitueix la credencial al fitxer inicial i
recrea el servei amb `--force-recreate --wait` (els mounts
poden conservar l'inode anterior); comprova les dades abans de revocar
la clau anterior. No comparteixis la clau o hash en una incidència.

El healthcheck no comprova Brevo; `unhealthy` no reinicia per si sol el
contenidor. `unless-stopped` actua quan el procés acaba o reinicia Docker.
No hi ha monitorització externa ni còpia de seguretat programada. Els
clients darrere Caddy comparteixen límits d'IP perquè `trustProxy` està
desactivat; canviar-ho exigeix una topologia de confiança explícita.
