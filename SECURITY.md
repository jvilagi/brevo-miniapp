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
`auth.env`, rota la configuració d'accés i recrea el backend. Revisa també
logs i artefactes. No reutilitzis els secrets compromesos.

Producció requereix HTTPS, origen explícit i accés privat. No utilitzis
el servidor de desenvolupament com a servei públic. Els fitxers privats
requereixen permisos restringits; el worker només desa recursos estàtics.
