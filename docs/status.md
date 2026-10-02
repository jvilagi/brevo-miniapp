# Estat del projecte

Actualització: 2026-10-02, Europe/Madrid.

## Implementat

React + TypeScript + Vite i Node.js 24 + Fastify en un monorepo npm.
Accés privat, consulta GET de dos comptes, saldo segons API, estadístiques
SMTP separades de campanyes, cache breu i errors parcials. PWA estàtica
amb manifest, icones pròpies, offline sense dades privades i actualització
controlada. Compose, Docker multi-stage i exemple de Caddy disponibles.

La integració real i el desplegament privat HTTPS s'han verificat el
2026-10-01. Els saldos, credencials i detalls personals d'aquella
instal·lació no formen part de la documentació pública.

## Preparació de la publicació

Publicació aprovada, amb PolyForm Noncommercial 1.0.0 i autoria Jordi Vilà.
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

31 proves, tipus, compilació i separació de secrets. Proves Chrome amb
dades sintètiques: amplades 320–1280, accés, errors, gràfic, logout,
offline, represa i canvi de versió. Passos de configuració privada
comprovats sense sobreescriure fitxers existents.

Pendent Safari/WebKit i instal·lació/standalone en iPhone real. El runtime
WebKit disponible al Mac de desenvolupament no és compatible amb macOS 13.
Pendent observar la transició real de prepagament esgotat a Free: no
s'infereix per un saldo zero. Rollback documentat, no simulat com a fallada
de producció. Sense CI/CD, monitorització externa ni backups programats.

El healthcheck valida el servei, no Brevo. La comprovació HTTPS pública
no fa login ni consulta dades dels comptes. Les revisions de secrets són
dirigides; no equivalen a una auditoria externa ni a una garantia absoluta.
