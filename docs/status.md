# Estat del projecte

Actualització: 2026-10-22, Europe/Madrid.

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

94 proves, tipus, compilació i separació de secrets. Proves Chrome amb
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

## Doble saldo de subscripció i prepagament

2026-10-17: comprovació i ajust aprovats amb GPT-6.1 Sol / High. GET real
dels dos comptes, sense desar payloads complets ni exposar claus. Un compte
retorna ara subscripció amb saldo positiu i reserva prepagament simultània;
l'altre continua Free. La normalització ja obtenia tots dos saldos, però
la reserva quedava en una nota petita. Els valors reals i noms privats no
s'incorporen a la documentació pública ni a les dades sintètiques de prova.

Ajustada la targeta per mostrar dos números independents i grans,
separats de les sol·licituds SMTP d'avui. Sense sumar ni restar enviaments,
sense substituir saldos reals per la referència manual. Estat i timestamp
de la quota visibles a tots dos; dada absent no és zero.

Quan Brevo acredita un pla Marketing de pagament actiu i període de
subscripció vàlid, es conserva la subscripció esgotada com a zero al costat
de la reserva. El placeholder zero prepagament sense aquest context manté
el tractament anterior. Dates Unix documentades i calendari observat
validats, sense deduir renovacions o reinicis. Els correus d'avís també
distingeixen el saldo de subscripció i la reserva; no s'ha enviat cap prova real.

70 proves (60 API + 10 presentació/worker), tipus, compilació i límits de
secrets superats. Chrome UI/PWA verificats amb dades sintètiques: dos saldos
alineats a 320–1280 px, subscripció esgotada, reserva zero o absent, dades
antigues identificades a tots dos i regressions anteriors. Captures de
targeta mòbil i escriptori revisades visualment. iPhone real no verificat.

### Publicació i desplegament verificats

2026-10-17: publicació i desplegament aprovats amb GPT-6.1 Sol / High.
Commit públic `d38533d`, només a `main`. Clonació neta de GitHub amb
`npm ci --include=optional` i `npm run check` superats: 70 proves, tipus,
compilació i separació de secrets. Historial públic amb arrel separada,
autoria noreply i 323 objectes revisats sense coincidències amb secrets
coneguts. Revisió dirigida, no una auditoria externa ni garantia absoluta.

Paquet del commit net, SHA-256 comprovat abans d'extreure i imatge
construïda a Linux. La candidata sense xarxa ha comprovat la configuració
real en només lectura i persistència xifrada, hash i noms amb dades
sintètiques separades. Còpia privada de recuperació creada abans del canvi;
la imatge i el release anteriors continuen disponibles.

Activada la versió `20261017t120456z-c93b65b0`, contenidor saludable,
usuari 1000 i arrel readonly. Només el muntatge privat d'accés és
d'escriptura; claus i bootstrap continuen readonly. Hash de contrasenya,
secret de sessió, claus, noms i configuració carregada idèntics abans i
després; només el tag de `compose.env` ha canviat. No s'ha creat ni
modificat el magatzem xifrat real durant aquesta operació. Fitxers i
directori temporals de prova eliminats; backups privats conservats.
Només s'ha reiniciat la MiniApp, sense canvis a Caddy, DNS o serveis aliens.
Sessions revocades, mateixa contrasenya. Avisos encara desactivats:
cap correu ni push real enviat.

HTTPS i Chrome mòbil verificats: recursos públics idèntics byte a byte
als compilats, 13 endpoints privats sense sessió rebutjats amb `401` i
`no-store`, manifest, worker, offline estàtic i represa correctes. No s'ha
fet login públic ni consultat dades reals per HTTPS en aquesta comprovació.
L'usuari ha de tornar a entrar i acceptar «Actualitza l'app» si la PWA
conserva la versió anterior. Safari/iPhone real i entrega real dels canals
continuen pendents.

## Correcció de la prioritat mostrada

2026-10-17, tasca aprovada amb GPT-6.1 Sol / High. Nou GET dels dos
comptes, sense claus o payloads complets als logs ni dades privades a la
documentació. Entre lectures disminueix el prepagament i es manté el
saldo del pla al compte examinat. El text desplegat afirmava pla primer:
s'havia generalitzat una regla de subscripcions mensuals que no es pot
aplicar a tots els comptes amb crèdits comprats.

Documentació oficial revisada: pla mensual i Free amb prepagament tenen
regles diferents; una vertical `paid` no acredita tota sola pagament
mensual. Correcció: prepagament primer a la targeta i al text dels
avisos, «Emails del pla» i distintiu «Pla + prepagament», amb explicació
neutral. Imports de Brevo conservats; cap suma, descompte local, reinici
o retorn a Free inferit. Llindars dels avisos i normalització no canviats.

El responsable ha confirmat Free amb crèdits comprats, no quota mensual.
La referència «Free» existent a Configuració adapta el text: prepagament
en lloc de quota diària, mai dos saldos utilitzables alhora. Sense aquesta
referència, explicació condicional; cap id/nom privat codificat. No s'ha
desat configuració privada al servidor ni forçat Free o un import de 300.
Proves específiques de referència Free: imports retornats conservats,
saldo absent desconegut, zero prepagament sense activació Free i explicació
de substitució a la targeta. Ajuda del selector i captura mòbil amb dades
sintètiques comprovades, sense identificar el compte privat al codi.

Proves ampliades per comprovar ordre visual i de lectura accessible i que una
disminució sintètica del prepagament no canvia el saldo del pla ni les
sol·licituds SMTP. 70 proves, tipus, compilació i límits de secrets
superats. Chrome UI/PWA superats: ordre i alineació 320–1280 px, absència
de dades, saldos zero, dades antigues, regressions, offline i actualització
controlada. Captures sintètiques mòbil/escriptori revisades visualment.

### Publicació i desplegament verificats

2026-10-17: publicació i desplegament aprovats amb GPT-6.1 Sol / High.
Commit públic `8510a86`, només a `main`; paquet del commit net i SHA-256
verificat abans d'extreure. Clonació nova de GitHub amb arrel pública
separada, autoria noreply i 355 objectes sense coincidències amb secrets
coneguts. Revisió dirigida, no una auditoria externa ni garantia absoluta.

Repetides les 70 proves, tipus, compilació i límits de secrets a Linux,
amb dependències del build, uid 1000, treball temporal, sense xarxa externa
ni secrets. La candidata ha llegit la configuració real en només lectura
i verificat persistència sintètica de xifrat, contrasenya i noms en un
espai separat. La comprovació completa ha passat sense canvis addicionals
al codi del producte.

Activada la versió `20261017t145757z-069fdba3`, contenidor saludable,
arrel readonly i uid 1000. Bootstrap i claus readonly; només el muntatge
privat d'accés és d'escriptura. Hash, secret de sessió, claus, noms i
configuració idèntics abans i després; només el tag de `compose.env`
ha canviat. Còpia privada de recuperació, release i imatge anteriors
conservats. Temporals de comprovació retirats. Només reinici de MiniApp:
Caddy, DNS i altres serveis intactes. Sessions revocades, mateixa
contrasenya. Avisos continuen desactivats, sense correus ni push reals.

HTTPS i Chrome mòbil verificats: recursos idèntics byte a byte al build,
13 endpoints privats sense sessió `401` i `no-store`, manifest, worker,
offline estàtic i represa. Cap login públic o consulta real dels comptes
en aquesta verificació. Seleccionar «Free» al pla de referència des de
Configuració activa l'explicació específica; el desplegament no canvia
la referència privada de l'usuari. Cal tornar a entrar i acceptar
«Actualitza l'app» si la PWA manté la versió anterior. iPhone real i
entrega real dels canals continuen pendents.

## Recuperació de l'arrencada bloquejada

2026-10-17: diagnòstic i correcció aprovats amb GPT-6.1 Sol / High.
Incidència comunicada primer a la PWA de l'iPhone i després a tots els
navegadors. En la comprovació, salut i sessió públiques responien `200`
i una sessió nova de Chrome arribava al login. La causa exacta de la
petició pendent al dispositiu no s'ha pogut acreditar.

Reproducció sintètica: una sessió sense resposta deixava la versió anterior
a «Preparant» més de 17 segons, sense reintent ni controls d'actualització;
reprendre la pàgina tampoc iniciava una comprovació nova.
Correcció local: sessió limitada a 10 segons, altres peticions a 30 segons
inclòs el cos, JSON de sessió validat, cancel·lació en segon pla i
represa coalescent amb rellotge real. No es reintenta cap POST de manera
automàtica ni s'accepten respostes obsoletes. Reintent i controls PWA
visibles durant l'espera i en error. Enllaç `/?recovery=1` per obtenir
HTML de xarxa sense eliminar cookies, dades o subscripcions.

75 proves (60 API + 15 web), tipus, compilació i separació de secrets
superats al Mac i repetits en un contenidor Linux sense secrets ni xarxa
externa. Regressions Chrome UI/PWA/arrencada superades amb dades sintètiques: petició pendent,
timeout, reintent, resposta tardana, represa, offline/online, JSON invàlid,
actualització durant l'espera i recuperació fora de cache. Captura d'error
mòbil revisada, controls sense desbordament a 320, 390 i 1280 px.

### Publicació i desplegament verificats

Commit públic `1907b9b`, només a `main`. Clonació nova amb fitxers
idèntics al codi provat, arrel pública separada i autors noreply; 386
objectes revisats sense coincidències amb secrets coneguts ni dades
privades examinades. Paquet del commit net, 94 fitxers públics i SHA-256
verificats. Revisió dirigida, no una auditoria externa.

Activada la versió `20261017t154831z-3083220d`, saludable, Node 24.21.0,
uid 1000 i arrel readonly. Candidata comprovada amb configuració real en
només lectura i persistència sintètica separada. Hash persistent, secret
de sessió, claus, comptes, noms i configuració idèntics abans i després.
Només ha canviat el tag de Compose i s'ha reiniciat la MiniApp: sessions
revocades, mateixa contrasenya. Avisos encara desactivats, sense correus
ni push reals. Caddy, DNS i serveis aliens intactes. Còpia privada de
retorn, release i imatge anteriors conservats; verificador i fitxers
temporals de la candidata retirats.

HTTPS verificat: HTML, JavaScript, CSS, worker i recursos idèntics al
build provat. Tretze endpoints privats sense sessió responen `401` i
`no-store`. Chrome mòbil arriba al login, comprova estàtics offline,
represa automàtica i `/?recovery=1`, sense cache d'API ni paràmetres.
Cap login amb contrasenya real ni consulta autenticada dels comptes en
aquestes comprovacions. Migració local addicional des de la compilació
anterior exacta: amb el worker antic i l'HTML antic encara en cache,
`/?recovery=1` carrega el bundle nou i permet arribar al login; després
s'accepta explícitament el worker nou, sense esborrar emmagatzematge.
Resultat al Safari/PWA de l'iPhone real pendent
de confirmació de l'usuari; no cal esborrar dades ni rotar secrets.

## Targetes uniformes, saldo actiu i previsió de crèdits

2026-10-17: ajust aprovat amb GPT-6.1 Sol / High. Indicacions: mateixa mida
i estructura, Free amb prepagament sense avís basat en la quota diària,
vigilància dels crèdits i possible data d'esgotament.

Nou GET real dels dos comptes, sense payloads complets, claus o dades
personals als logs. Un compte retorna prepagament i entrada `subscription`
simultània; l'altre Free. El responsable confirma que el primer és Free
amb crèdits comprats. Documentació oficial revisada: Free substituït pel
prepagament, no suma; els crèdits comprats no caduquen. La data d'esgotament
serà estimada, no una data de caducitat de Brevo.

Implementat: selector compartit de saldo actiu amb referència
Free explícita; saldo normalitzat intacte i altres imports als detalls.
Targetes plegades de mateixa mida i blocs comuns, desplegables independents.
Avisos de crèdits en lloc del saldo del pla per Free amb prepagament;
percentatge del volum Free ignorat. Reserva absent desconeguda, zero sense
activar Free. Canvis de saldo actiu no hereten la supressió d'un altre saldo.

Historial de saldo xifrat, separat de la configuració, amb credencials
segregades per empremta i escriptures serialitzades. Mostres de les lectures
existents; cap GET extra, monitor nou ni suma d'enviaments SMTP. Almenys
7 dies i 8 dates observades, descens net positiu i horitzó màxim 365 dies.
Recàrrega o buit de més de 36 hores reinicia observació. Error del fitxer
no bloqueja sessió ni comptes. `lowDays` opcional, desactivat per defecte,
per avisar de previsió propera; el llindar de crèdits té prioritat.

88 proves (72 API + 16 web), tipus, compilació i límits de secrets
superats localment. Chrome UI/PWA verificats amb dades sintètiques:
igualtat de mides a 320–1280 px, saldo actiu, zero, absència, antiguitat,
previsió, configuració, sessions, offline i actualització controlada.
Captures mòbil i escriptori revisades. Safari/iPhone real pendent.

La implementació inicial només havia llegit dades reals. La publicació,
el desplegament i aplicar la referència privada Free al compte confirmat
s'han autoritzat posteriorment; no es dedueix del nom, id ni saldo 300.
El responsable confirma que es refereix als avisos de la MiniApp, no a
correus del proveïdor Brevo. L'ajust afecta només les regles de la MiniApp;
no cal modificar preferències ni avisos del compte a Brevo.

### Publicació i desplegament verificats

2026-10-17: commit públic `4466941`, només a `main`. Clonació nova amb
99 fitxers públics i 432 objectes d'historial revisats sense coincidències
amb secrets coneguts ni patrons privats examinats. Arrel pública separada,
autoria noreply, cap branca o tag privat descarregat. Revisió dirigida,
no una auditoria externa. Paquet del commit net i SHA-256 verificat.

Repetides les 88 proves, tipus, compilació i límits de secrets a Linux,
amb uid 1000, treball temporal, sense secrets ni xarxa externa. Candidata
amb lectura readonly de la configuració real i persistència sintètica
separada de workspace, hash, noms i nou historial xifrat de saldo.
Comprovats reinici de l'historial, previsió sintètica i selecció Free amb
prepagament. Fitxers privats reals intactes durant aquestes comprovacions.

Activada la versió `20261017t174649z-367af77a`, saludable. Referència Free
aplicada al compte autoritzat amb l'app aturada per evitar concurrència;
només aquest camp, la revisió i els nous valors nuls opcionals del format
han canviat. Tot l'estat privat resultant comprovat després de tornar a
llegir-lo. Claus, hash persistent, secret de sessió, noms, aparença,
llindars i canals preservats. Avisos encara desactivats: cap correu ni
push real. Sessions revocades pel reinici, mateixa contrasenya.
Aquest desament ha creat el workspace xifrat a partir del bootstrap i
els noms existents; la còpia anterior conserva l'estat sense aquest fitxer.

Lectura GET de quotes reals al servidor, sense imprimir imports o dades
personals: saldo fresc, crèdits prepagament seleccionats i idèntics a Brevo,
quota diària no seleccionada com a saldo actiu. La previsió comença sense
historial; les lectures normals de l'app desen mostres al fitxer privat.
No s'han importat ni inventat mostres anteriors.

HTTPS comprovat: HTML, JavaScript, CSS, worker i recursos idèntics al build;
13 endpoints privats sense sessió rebutjats amb `401` i `no-store`.
Chrome mòbil ha comprovat login, manifest, icones, worker, offline estàtic,
represa automàtica i `/?recovery=1`, sense cache d'API ni dades privades.
Cap login públic amb la contrasenya real en aquestes comprovacions.
Còpia privada de recuperació, release i imatge anteriors conservats.
El format nou del workspace exigeix revisar/restaurar una còpia compatible
abans de retornar a una versió antiga; no s'han de perdre canvis posteriors.
Caddy, DNS i serveis aliens no modificats. Safari/iPhone real i entrega
real dels canals continuen pendents; cal acceptar l'actualització de la
PWA i tornar a entrar després del reinici.

## Estat de notificacions i activació només push

2026-10-22: revisió i ajust aprovats amb GPT-6.1 Sol / High. La revisió
ha distingit un avís extern basat en recompte propi de les regles de la
MiniApp; no s'ha inspeccionat ni modificat el servei extern.
Referència Free amb prepagament i llindars existents preservats.

Implementat: resum separat de servei del servidor, correu i push;
distinció entre dispositiu registrat, servei pausat i push actives al servidor.
Permís del dispositiu i subscripció comprovats en reprendre Configuració.
Regles de connexió i repetició en bloc comú; desament i prova separats.
Sense nous endpoints, secrets, format privat ni activació automàtica de correu.

94 proves (73 API + 21 web), tipus, compilació i límits de secrets superats.
Prova específica amb doble d'emissor: només push, sense crida d'email ni
consum del pressupost, bloqueig global respectat. Cap notificació real
durant les proves locals. Chrome UI/PWA/arrencada superats amb dades
sintètiques, inclosos servei pausat amb dispositiu registrat, push actives
amb correu desactivat, desament de regles comunes sense activar correu,
permís denegat i amplades 320–1280 px. Captures revisades visualment.

### Publicació, desplegament i activació verificats

Commit públic `27a6113`, només a `main`, i versió
`20261022t070723z-317d20cd`. Paquet del commit net, SHA-256 verificat i
94 proves repetides a Linux sense secrets ni xarxa externa. Candidata
amb configuració real readonly i persistència sintètica separada.
Clonació nova amb arrel pública separada: 101 fitxers i 462 objectes
revisats sense coincidències amb secrets coneguts o patrons privats.
Revisió dirigida, no una auditoria externa. Historial privat no publicat.

Activació push expressament autoritzada. Afegit només el gate de
notificacions a runtime privat; abans era absent i es considerava false.
Correu desactivat, dispositiu i claus VAPID existents conservats.
Amb el procés principal aturat per evitar escriptors concurrents,
una única prova push real ha estat acceptada pel proveïdor i registrada
durablement com a prova push. Protecció privada contra repetir-la.
Cap crida d'email ni increment del pressupost de correus.

Procés principal recreat i saludable, uid 1000, arrel readonly i zero
reinicis automàtics observats. Monitor en segon pla verificat per estat
d'incidents i una mostra de quota recent, sense navegador ni login real.
Metadades, llindars, comptes, claus Brevo, hash de contrasenya, secret de
sessió i subscripció push intactes. Canvis operatius esperats: revisió,
historial de prova, incidents del monitor i mostres de saldo.
Sessions revocades pel reinici; mateixa contrasenya.

HTTPS i Chrome mòbil verificats: recursos idèntics al build, 13 endpoints
privats sense sessió `401` i `no-store`, manifest, icones, worker, offline,
represa i recuperació. Còpia privada, imatge i release anteriors conservats;
Caddy, DNS i altres aplicacions intactes. Temporals de verificació retirats.
Acceptació del servei push no acredita aparició ni lectura: confirmació
de recepció amb l'app tancada pendent de l'usuari. Sense prova real de correu.
