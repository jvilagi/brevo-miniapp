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
    accounts.env  0600, dues API keys pròpies
    auth.env      0600, hash i secret de sessió
    runtime.env   0600, origen/fus/noms
    compose.env   0600, directori privat i identificador de versió
  caddy/site.conf
```

Prepara claus i contrasenya segons [la guia](../docs/installation.md).
Transfereix els fitxers privats per un canal segur amb permisos restringits;
mai dins d'un release, commit, arxiu de distribució o imatge.
El contenidor utilitza uid 1000; ajusta la propietat dels fitxers al teu
servidor. El carregador rebutja permisos accessibles a altres usuaris.

Copia `runtime.env.example` fora del checkout com a `private/runtime.env`:
defineix **el teu** `PUBLIC_ORIGIN=https://el-teu-domini` sense barra final,
verifica `BREVO_TIMEZONE` i posa noms propis als comptes. Producció no
té un domini per defecte. Les claus van a `accounts.env`, no a runtime.

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

Per rotar claus, guarda una còpia privada, substitueix la credencial al
fitxer privat i recrea el servei amb `--force-recreate --wait` (els mounts
poden conservar l'inode anterior); comprova les dades abans de revocar
la clau anterior. No comparteixis la clau o hash en una incidència.

El healthcheck no comprova Brevo; `unhealthy` no reinicia per si sol el
contenidor. `unless-stopped` actua quan el procés acaba o reinicia Docker.
No hi ha monitorització externa ni còpia de seguretat programada. Els
clients darrere Caddy comparteixen límits d'IP perquè `trustProxy` està
desactivat; canviar-ho exigeix una topologia de confiança explícita.
