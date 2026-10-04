# Estat del projecte

Actualització: 2026-10-04, Europe/Madrid.

## Implementat

React + TypeScript + Vite i Node.js 24 + Fastify en un monorepo npm.
Accés privat, consulta GET de dos comptes, saldo segons API, estadístiques
SMTP separades de campanyes, cache breu i errors parcials. PWA estàtica
amb manifest, icones pròpies, offline sense dades privades i actualització
controlada. Compose, Docker multi-stage i exemple de Caddy disponibles.

La integració real i el desplegament privat HTTPS s'han verificat el
2026-10-01. Els saldos, credencials i detalls personals d'aquella
instal·lació no formen part de la documentació pública.

## Publicació

Publicació aprovada, amb PolyForm Noncommercial 1.0.0 i autoria Jordi Vilà.
Repositori públic creat el 2026-10-02:
[jvilagi/brevo-miniapp](https://github.com/jvilagi/brevo-miniapp).
Primer commit públic `e3cfc05`, sense pares; només s'ha pujat `main`.
Marca pròpia aprovada el 2026-10-02: símbol de sobre i distintiu violeta,
paleta inspirada en Brevo, sense logotips oficials. Login genèric.
Guia per a claus pròpies i plantilla buida disponibles; producció exigeix
`PUBLIC_ORIGIN` explícit i els exemples utilitzen un domini fictici.

Historial públic nou amb correu privat de GitHub. L'historial original
i l'estat anterior es conserven exclusivament al Mac en una branca local
que no s'ha de pujar. Mai fer `git push --all` ni `git push --mirror`.

Avisos de React, React DOM i Scheduler conservats. Dependències backend
amb llicències dins de `node_modules` a la imatge; no es relicencien.
Exclusions de secrets reforçades per a Git, Docker i empaquetat.

## Verificació i pendents

38 proves, tipus, compilació i separació de secrets. Proves Chrome amb
dades sintètiques: amplades 320–1280, accés, errors, gràfic, logout,
offline, represa i canvi de versió. Passos de configuració privada
comprovats sense sobreescriure fitxers existents.

Clonació nova des de GitHub amb `npm ci --include=optional` i
`npm run check` verificada. Historial descarregat amb un únic commit
inicial, correu `noreply` de GitHub i cap branca o tag privat. Revisió
prèvia dels 81 fitxers publicats: sense coincidències amb les claus,
hash o secret coneguts ni patrons de credencials examinats; enllaços
locals i avisos complets del bundle comprovats. Revisió posterior de
l'historial recuperat de GitHub (dos commits i 82 blobs en aquell punt):
historial privat absent, només correu `noreply` i cap coincidència amb
els secrets coneguts o els patrons examinats.

Marca pròpia desplegada en la instància privada el 2026-10-02, a partir
del commit públic `d584c48`. Contenidor saludable; versió anterior,
imatge i referències de retorn conservades. Credencials, configuració
privada, Caddy, DNS i serveis aliens no modificats. Sessions revocades
pel reinici; mateixa contrasenya. Avisos de llicència presents a runtime.
HTTPS verificat amb Chrome mòbil: marca i icones idèntiques al codi,
login genèric, API sense sessió `401`, `no-store`, worker estàtic, offline
i represa. Aquesta comprovació no ha fet login ni consultat dades reals.

Pendent Safari/WebKit i instal·lació/standalone en iPhone real. El runtime
WebKit disponible al Mac de desenvolupament no és compatible amb macOS 13.
Pendent observar la transició real de prepagament esgotat a Free: no
s'infereix per un saldo zero. Rollback documentat, no simulat com a fallada
de producció. Sense CI/CD, monitorització externa ni backups programats.

El healthcheck valida el servei, no Brevo. La comprovació HTTPS pública
no fa login ni consulta dades dels comptes. Les revisions de secrets són
dirigides; no equivalen a una auditoria externa ni a una garantia absoluta.

## Correcció de la presentació del saldo Free

2026-10-03: eliminada l'afirmació de reinici a les 00:00 GMT+2. La
documentació oficial confirma el reinici diari però no n'especifica
l'hora. El saldo disponible es presenta segons Brevo, independentment
del dia de les estadístiques SMTP; no es força a 300 ni es recalcula.
La causa exacta d'un desfasament puntual no s'ha acreditat.
Afegida una prova de presentació i un cas de navegador amb zero
sol·licituds SMTP i saldo Free inferior al límit, amb dades sintètiques.
32 proves, tipus, compilació, separació de secrets i comprovacions Chrome
UI/PWA superades; captura mòbil revisada. Correcció publicada i desplegada
el 2026-10-03 a partir del commit públic `daaeaa2`, amb paquet sense canvis
locals pendents, SHA-256 verificat i contenidor saludable. Versió anterior,
imatge i configuració de retorn conservades; claus, Caddy, DNS i serveis
aliens no modificats. El reinici revoca les sessions, no la contrasenya.
HTTPS comprovat amb Chrome mòbil, API sense sessió `401`, `no-store`,
worker, offline i represa. El JavaScript públic coincideix byte a byte
amb el compilat verificat i ja no inclou l'afirmació de reinici a mitjanit.
La comprovació pública no ha fet login ni consultat dades dels comptes.

## Canvi de contrasenya

Implementat localment el 2026-10-04: opció sota les targetes, només
després d'entrar, amb actual/nova/confirmació i cancel·lació. Sessió,
origen, límits d'intents i contrasenya actual comprovats al backend.
Hash scrypt persistent en un directori privat separat d'escriptura;
claus Brevo i bootstrap continuen readonly. Èxit revoca totes les
sessions; fallada de desament conserva l'accés anterior. L'hash nou
preval en reiniciar; un fitxer existent invàlid no activa el bootstrap.

38 proves (33 API + 5 presentació), tipus, compilació i separació de
secrets superats. Chrome UI/PWA verificats amb contrasenyes sintètiques,
inclòs el formulari 320–1280 px i tancament d'una altra sessió. Captura
del formulari revisada visualment. La contrasenya real no ha canviat.
Publicació i desplegament aprovats; pendents de les verificacions
d'operació. No hi ha recuperació de contrasenya oblidada des del navegador.
