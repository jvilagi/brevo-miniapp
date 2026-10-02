# Brevo MiniApp

PWA de consulta de dos comptes Brevo, especialment pensada per a iPhone.
Targetes desplegables amb consum, saldo disponible, estadístiques
transaccionals i gràfic dels últims set dies. Projecte independent,
no oficial de Brevo, amb marca pròpia i paleta inspirada en la seva app.

Autor: **Jordi Vilà**. Codi disponible sota **PolyForm Noncommercial 1.0.0**;
no és una llicència de programari lliure ni open source.

## Instal·lar amb els teus comptes

Cada instal·lació utilitza les seves claus i contrasenya. No s'inclouen
credencials de l'autor ni es connecta amb la seva instància privada.

Requisits: Git, Node.js 24 LTS i npm; macOS/Linux. Windows natiu no verificat.

```bash
git clone https://github.com/jvilagi/brevo-miniapp.git
cd brevo-miniapp
npm ci --include=optional
```

Segueix la [guia d'instal·lació](docs/installation.md) per crear
`~/.config/brevo-miniapp/accounts.env`, **fora del repositori**, amb
permisos `0600` i les dues API keys pròpies. La plantilla buida és
[`deploy/accounts.env.example`](deploy/accounts.env.example).

Després, en un terminal interactiu:

```bash
npm run setup:auth
npm run dev
```

La primera comanda crea la contrasenya local amb entrada oculta i no
sobreescriu `auth.env` si existeix. Obre `http://127.0.0.1:5174/` i entra
amb aquesta contrasenya. L'API escolta al port 3000; els serveis locals
no s'exposen a la xarxa. Atura'ls amb `Ctrl+C`. Els ports ocupats fan
fallar l'arrencada, sense canviar de port automàticament.

Les claus només les llegeix el backend. No les posis a `.env` dins del
checkout, `VITE_*`, frontend, captures, logs o incidències de GitHub.
`.env.example` enumera variables admeses, però no es carrega automàticament.
Es poden indicar fitxers privats alternatius amb `BREVO_SECRETS_FILE`
i `AUTH_SECRETS_FILE`; vegeu la guia. Els secrets de producció també
han de viure fora del codi i de la imatge Docker.

## Funcionament i límits

- React + TypeScript + Vite; Node.js 24 + Fastify; contractes compartits.
- Accés privat amb scrypt, sessions HttpOnly, límits d'intents i logout.
  Reiniciar el backend revoca les sessions; no hi ha base de dades.
- Memòria cau de dades de 60 segons al servidor; errors parcials i dades
  antigues identificades, fins a 15 minuts. Una dada absent no és zero.
- Quota, saldo i consum separats. El saldo es llegeix de l'API: no es
  calcula com `300 - enviats` ni se sumen crèdits prepagament i quota Free.
- SMTP i campanyes de màrqueting són fonts separades. Els totals únics
  provenen de l'informe agregat, no de sumar dies.
- Service worker només estàtic: no desa API, sessions o dades autenticades.
  Sense xarxa es mostra la interfície, no dades privades persistents.
- Un únic fus horari per als dos comptes. El valor inicial `Etc/GMT-2`
  és GMT+2 fix; verifica el fus de Brevo abans de canviar-lo.
- Model actual: dos comptes i una contrasenya compartida per instal·lació,
  no un servei multiusuari. Claus introduïdes al servidor, no al navegador.

## Comprovacions

```bash
npm run check
```

Comprova tipus, 31 proves (27 API + 4 presentació), compilació i separació
de secrets. Les proves utilitzen dades sintètiques i no contacten amb Brevo.
També hi ha `npm test`, `npm run typecheck` i `npm run build`.

`npm run test:ui` i `npm run test:pwa` requereixen Playwright i un navegador;
configuració a [`apps/web/README.md`](apps/web/README.md). Chrome mòbil i
escriptori verificats entre 320–1280 px, offline, represa i actualització
controlada. Safari/iPhone real continua pendent; no es garanteix paritat.

`npm run notices:generate` regenera els avisos de les dependències del
bundle del navegador després de canviar versions. Cal revisar les
llicències abans de distribuir dependències actualitzades.

## Desplegament propi i iPhone

Interfície i API han de compartir un mateix origen **HTTPS**. Producció
exigeix definir explícitament `PUBLIC_ORIGIN` amb el teu domini.
Hi ha Dockerfile multi-stage, Compose per a la xarxa externa `web` i
un exemple de Caddy/Cloudflare Tunnel: [`deploy/README.md`](deploy/README.md).
No hi ha CI/CD ni desplegament automàtic. Els exemples s'han d'adaptar
al teu servidor; no exposis el servidor de desenvolupament.

Un cop publicada la teva instància HTTPS, obre-la amb Safari i afegeix-la
a la pantalla d'inici. [Indicacions oficials d'Apple](https://support.apple.com/ca-es/guide/iphone/iphea86e5236/ios).
Cal tornar a entrar quan la sessió caduqui o es reiniciï el backend.

## Autoria i llicència

Copyright © 2026 Jordi Vilà. El codi, la documentació i les icones originals
s'ofereixen sota [PolyForm Noncommercial 1.0.0](LICENSE), amb el text oficial
íntegre. [NOTICE](NOTICE) conté l'avís `Required Notice:` que cal transmetre
en redistribuir, juntament amb la llicència o el seu URL.

Permet els usos no comercials definits a la llicència, inclosos usos
personals i els de les organitzacions que enumera. No exigeix un crèdit
visible dins de la interfície ni publicar les modificacions. Els usos
comercials no coberts requereixen autorització separada de Jordi Vilà;
el repositori no la concedeix. Preval el text de `LICENSE`.

Les dependències conserven les seves llicències i avisos; vegeu
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No es distribueixen
logotips oficials de Brevo ni es concedeixen drets sobre la seva marca.

## Documentació i contribucions

- [Instal·lació amb claus pròpies](docs/installation.md)
- [Arquitectura](docs/architecture.md)
- [Semàntica i validació de l'API](docs/brevo-api-validation.md)
- [Disseny i comprovacions](docs/design.md)
- [Estat i límits](docs/status.md)
- [Seguretat](SECURITY.md)
- [Contribucions](CONTRIBUTING.md)

Les instruccions per a agents són a `AGENTS.md`; treballa al teu checkout.
Els miralls sota `sources/` no són part de l'aplicació ni es distribueixen.
