# Seguretat

Projecte personal sense auditoria externa, SLA ni servei multiusuari.
Mantén les claus Brevo, `auth.env` i la configuració de producció fora
del checkout. Mai `VITE_*`, frontend, manifest, worker, logs o captures.

No publiquis vulnerabilitats que incloguin secrets o dades privades en
incidències públiques. Utilitza el contacte privat de l'autor, si el tens,
o el canal «Report a vulnerability» de GitHub **si està habilitat**.
No s'afirma que hi hagi un canal de divulgació privada habilitat encara.
Si no tens un canal privat, pots obrir una incidència demanant-lo sense
detalls explotables ni credencials. No s'ha fixat un termini de resposta.

Si exposes una clau, revoca-la a Brevo i crea'n una de nova. Eliminar-la
del commit actual no l'elimina de l'historial o còpies. Si exposes
`auth.env`, prepara una rotació administrativa de l'accés i recrea el backend.
El `SESSION_SECRET` també protegeix la configuració xifrada: migració abans
de rotar-lo, no canvi a cegues. Revisa també
logs i artefactes. No reutilitzis els secrets compromesos.

Producció requereix HTTPS, origen explícit i accés privat. No utilitzis
el servidor de desenvolupament com a servei públic. Els fitxers privats
requereixen permisos restringits; el worker només desa recursos estàtics.

Els canvis de contrasenya requereixen sessió i contrasenya actual, amb
protecció d'origen i límit d'intents. `access/password.json` és també
privat: conté el hash actual i preval sobre l'inicial. Protegeix-lo en
còpies de seguretat, exclusions i retorns de versió. No té contrasenya
en text pla. No hi ha recuperació pública, MFA ni rèpliques coordinades.

Els noms propis també són configuració privada (`access/account-names.json`),
no formen part del release ni de la imatge. Només es consulten i canvien
amb sessió; els canvis exigeixen origen, capçalera i límit d'intents.
El fitxer comparteix el directori d'escriptura però no el hash ni les claus.
Un únic procés backend; no edicions externes concurrents d'aquests fitxers.

## Comptes dinàmics i notificacions

El formulari privat de Configuració transmet la clau per HTTPS al backend.
No és una clau del bundle: no es retorna a cap GET, no es desa en storage
del navegador ni s'inclou en logs. Connectar, substituir claus, desconnectar
i configurar correus exigeix reautenticació. Després de validar una clau
amb Brevo es torna a comprovar que la sessió segueix vigent. Els canvis
usen revisions per rebutjar sobreescriptures concurrents.

`access/workspace.sealed.json` conté comptes, API keys, destinatari d'avisos,
claus VAPID privades i subscripcions push, xifrats amb AES-256-GCM i una clau
derivada del `SESSION_SECRET`. Permisos `0600`/`0700`, escriptura atòmica,
fora del checkout, imatge i release. El xifrat no protegeix davant d'algú
que també controli el secret o el procés backend. Cal conservar una còpia
privada de tots dos; canviar contrasenya no canvia el xifrat. Una rotació
del secret exigeix migració prèvia; no hi ha eina automàtica distribuïda.
Fitxer invàlid o xifrat amb una altra clau: arrencada tancada, sense fallback.

`ENABLE_NOTIFICATIONS` és opt-in i habilita correu i push. El correu és
l'únic POST a Brevo, a un endpoint fix, només amb destinatari, remitent i
compte configurats. Els noms i saldos dels incidents poden sortir al
destinatari escollit: verifica'l abans d'activar. Màxim 20 intents/dia UTC,
comptador persistent, reserva durable abans d'enviar i sense reintents
immediats en resultats incerts. No és una garantia d'entrega única.

Les push només mostren text genèric i no transporten saldos o noms.
L'endpoint i les claus de subscripció són privats: només s'accepten HTTPS
de serveis Apple, Mozilla o Google admesos, sense credencials ni ports
arbitraris, per reduir SSRF. Les subscripcions pertanyen al dispositiu,
no a una sessió de login: sortir de l'app no les revoca. Desactiva-les
abans de deixar d'utilitzar un dispositiu; no les activis en dispositius
compartits. Atura globalment els canals amb la variable del servidor.
El navegador gestiona la subscripció estàndard de PushManager; això no
és una cache d'API ni inclou API keys de Brevo o contrasenyes.
