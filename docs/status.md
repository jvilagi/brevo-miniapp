# Estat del projecte

Actualització: 2026-10-17, Europe/Madrid.

## Implementat

React + TypeScript + Vite i Node.js 24 + Fastify en un monorepo npm.
Accés privat, consulta GET de comptes configurables, saldo segons API, estadístiques
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

68 proves, tipus, compilació i separació de secrets. Proves Chrome amb
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

Implementat el 2026-10-04: opció sota les targetes, només
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
Publicat i desplegat el 2026-10-04 a partir del commit públic `5e893a7`,
amb paquet sense canvis locals pendents, SHA-256 verificat i contenidor
saludable. Versió, imatge i configuració anteriors conservades. Creat
el directori privat buit del hash, amb permisos i propietari restringits;
només aquest muntatge és d'escriptura, claus i bootstrap readonly.
Desament atòmic i lectura persistent provats a Linux amb hash sintètic
en un directori temporal separat, eliminat després de la comprovació.
Bootstrap intacte i fitxer de contrasenya real encara absent.

HTTPS verificat amb Chrome mòbil: accés privat, manifest, icones, worker,
offline i represa. JavaScript i CSS públics idèntics byte a byte als
compilats verificats. Endpoint de canvi sense sessió rebutjat amb `401`
i `no-store`. La comprovació pública no ha fet login ni consultat dades
reals. Caddy, DNS i serveis aliens no modificats. El reinici revoca les
sessions, no la contrasenya. Després d'un canvi no s'ha de tornar a una
versió que ignori el hash persistent; vegeu `deploy/README.md`.
No hi ha recuperació de contrasenya oblidada des del navegador.

## Noms dels comptes i temps des de l'actualització

Implementats el 2026-10-04, amb ubicació i estil aprovats:
«Configuració» al costat de «Canvia la contrasenya», dos noms amb desament
privat al servidor i persistència entre sessions i reinicis. GET/POST
autenticats, protecció d'origen, validació, permisos restringits i rename
atòmic. Els noms s'apliquen sobre snapshots en cache, sense tocar Brevo,
les claus ni el hash. Fitxer separat al muntatge privat existent.

Comptador al costat d'«Actualitza»: temps des de l'última resposta vàlida
amb almenys una secció fresca. Errors de xarxa i respostes completament
antigues/indisponibles no el reinicien. Les respostes parcials mantenen
els seus avisos i cada secció conserva el seu timestamp. No és l'edat
de cada dada de Brevo. Interval visual suspès quan l'app és oculta i
temps recalculat en reprendre, sense afegir polling de dades.

45 proves (39 API + 6 presentació), tipus, compilació i separació de
secrets superats. Chrome UI/PWA verificats amb dades sintètiques: noms,
errors, cancel·lació, altra sessió, comptador i segon pla, sense regressions
en accés, gràfic o canvi de contrasenya. Formulari i resum mòbil/escriptori
revisats visualment, amplades 320–1280 px. Safari/iPhone real pendent.
Publicats i desplegats el 2026-10-04 a partir del commit públic `6118195`,
amb paquet sense canvis locals pendents, SHA-256 verificat i contenidor
saludable. Versió, imatge i configuració de retorn anteriors conservades.
La imatge candidata ha carregat la configuració existent a Linux i ha
provat escriptura/lectura de noms i hash sintètics en un directori temporal
separat del muntatge privat, sense xarxa. Directori de prova eliminat;
bootstrap, hash i noms reals intactes. Fitxer de noms encara absent en
la instància activa: es crearà quan l'usuari els desi des de l'app.

HTTPS verificat amb Chrome mòbil: accés privat, manifest, icones, worker,
offline i represa. JavaScript i CSS públics idèntics byte a byte als
compilats verificats. GET i POST de noms sense sessió rebutjats amb `401`
i `no-store`. La comprovació pública no ha fet login ni consultat dades
reals. Només el directori privat separat continua sent d'escriptura;
claus i bootstrap readonly, sistema de fitxers del contenidor readonly.
Caddy, DNS i serveis aliens no modificats. El reinici revoca les sessions,
no canvia la contrasenya. Cal una lectura als altres dispositius per veure
els noms nous; sense push ni sincronització entre múltiples processos.

## Recuperació administrativa de l'accés

2026-10-13: recuperació al servidor autoritzada pel responsable de la
instal·lació. Nova contrasenya introduïda dues vegades en diàlegs locals
amb entrada oculta; només el hash scrypt s'ha desat al fitxer persistent
privat, amb permisos `0600`. Còpia privada del hash anterior conservada.
Claus Brevo, bootstrap, secret de sessió i noms dels comptes intactes.
El hash recuperat preval sobre el bootstrap; no s'ha d'eliminar per
restablir l'accés ni retornar a una versió que l'ignori.

Reinici només de la MiniApp, mateixa versió i contenidor saludable.
Sessions anteriors revocades. Entrada amb la nova contrasenya verificada
per HTTPS (`200`), sessió de prova tancada i revocació confirmada. Cap
consulta de dades Brevo ni contrasenya en text pla desada o mostrada.
La comprovació inicial de logout es va corregir perquè enviava una
capçalera JSON sense cos; la verificació final completa ha passat.

Operació administrativa puntual amb eines locals excloses de Git,
no una funcionalitat de recuperació pública ni un reset distribuït.
L'operació no va requerir publicar ni desplegar canvis de codi.

## Configuració ampliada i avisos

2026-10-17, tasca aprovada amb GPT-6.1 Sol / Extra High. Decisions:
comptes dinàmics, pla/volum com a referència sense alterar saldo API,
formulari privat de claus, galeria d'icones/colors i seccions Comptes/Avisos.
Confirmats els dos canals amb l'app tancada: correu i push. El compte
Brevo que assumeix el correu és seleccionable, amb remitent actiu.

Implementats fins a 25 comptes: crear, editar, ordenar i desconnectar
només de MiniApp, sense eliminar comptes Brevo. Metadades, claus,
subscripcions push i historial en fitxer privat xifrat AES-256-GCM,
escriptura atòmica, revisions concurrents i reautenticació sensible.
Importació inicial dels comptes/noms existents, bootstrap i hash intactes.
La clau de xifrat depèn del secret de sessió original: backup conjunt,
no rotar-lo sense migració. No hi ha eina de migració distribuïda.

Monitor backend cada 5 minuts, saldo baix fresc o 15 minuts sense dades,
deduplicació durable, repetició configurable i màxim 20 intents de correu
per dia UTC. Registre pendent abans d'enviar, errors sense secrets i
historial per canal; acceptació no garanteix entrega. Correu atribuït
al compte triat, sense doble descompte. Push genèriques sense saldo o noms,
independents d'errors/pressupost de correu, VAPID i baixa de dispositiu.
`ENABLE_NOTIFICATIONS=false` per defecte: no s'envia res sense activació.

Documentació oficial de Brevo/WebKit i biblioteca web-push consultada.
GET real de plans dels dos comptes comprovat sense desar payloads complets,
identificadors ni saldos en documentació. Subscripció i reserva separades;
el patró existent amb subscripció zero i prepagament continua com prepagament.
No es dedueix Free amb saldo zero ni es calcula `300 - enviats`.

68 proves (58 API + 10 presentació/worker), tipus, compilació i separació
de secrets superats. Chrome UI/PWA amb dades sintètiques: comptes dinàmics,
aparença, pla i llindars, avisos sense enviament real, regressions d'accés,
contrasenya, comptador, offline i worker. Amplades 320–1280 verificades.
Correus i push provats amb emissors simulats: cap càrrec ni enviament real.
Registre i baixa del dispositiu i permís denegat comprovats amb PushManager
simulat al navegador. Avisos de llicència de web-push (MPL-2.0) preservats,
separats de la llicència del codi propi.
Pendent entrega real per canal i Safari/iPhone instal·lat. Documentació d'instal·lació,
seguretat i retorn de versió actualitzada.

### Publicació i desplegament verificats

Publicació i desplegament aprovats amb GPT-6.1 Sol / High el 2026-10-17.
Commit públic de funcionalitat `e201b6c`, només a `main`. Clonació neta
des de GitHub amb `npm ci --include=optional` i 68 proves, tipus, compilació
i límits de secrets superats. Historial públic verificat: arrel separada,
autoria noreply i 291 objectes sense coincidències amb els secrets coneguts.
La revisió és dirigida, no una auditoria externa ni garantia absoluta.

Paquet sense canvis locals pendents, SHA-256 comprovat abans d'extreure.
Imatge construïda a Linux, Node 24.21.0, usuari 1000, arrel readonly,
mateix muntatge privat separat d'escriptura i bootstrap/claus readonly.
Còpia privada de la configuració, hash recuperat, noms i referències de
retorn conservada abans del canvi; imatge i release anteriors preservats.
La candidata, sense xarxa, ha llegit la configuració real en només lectura
i provat xifrat/reinici amb claus sintètiques, VAPID i persistència de
hash/noms en un directori temporal separat, eliminat després de la prova.
Els fitxers privats reals han conservat exactament el contingut anterior.
Avisos de web-push i el seu codi font original presents a runtime.

Activada la versió `20261017t105816z-d2fa6c51`, contenidor saludable i
enllaç de versió actualitzat.
Només s'ha reiniciat la MiniApp: sessions revocades, mateixa contrasenya,
secret de sessió, claus i noms. Només el tag de `compose.env` ha canviat;
`runtime.env`, Caddy, DNS i serveis aliens intactes. No s'ha creat encara
el magatzem xifrat real: es crearà en el primer desament des de l'app.
`ENABLE_NOTIFICATIONS` continua desactivat; no s'han enviat correus ni push.

HTTPS públic verificat amb Chrome mòbil: login, manifest, icones, worker,
offline estàtic i represa. HTML, JavaScript, CSS, worker i recursos comparats
byte a byte amb la compilació verificada. Tretze endpoints examinats sense
sessió rebutjats amb `401` i `no-store`, inclosos comptes, configuració,
remitents i operacions push. No s'ha iniciat sessió ni consultat dades
reals per HTTPS en aquesta comprovació. Queden pendents el login de
l'usuari després del reinici i l'entrega real de cada canal amb aprovació.
