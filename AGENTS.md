# Brevo MiniApp — instruccions de treball

## Coordinació amb en Jordi

- Abans de començar cada tasca nova, recomana un model i un nivell d'esforç
  (Instant, Medium, High o Extra High), explica breument el motiu i espera
  el seu OK. No tornis a demanar autorització per continuar la mateixa
  tasca ja aprovada.
- Abans de dissenyar la interfície, demana a en Jordi les seves indicacions
  de disseny. Indicació actual confirmada: utilitzar la paleta de colors
  de Brevo. Versió local ajustada a les captures de l'aplicació Brevo,
  amb marca pròpia de MiniApp, menta i violeta; vegeu `docs/design.md`.
  No es distribueixen logotips oficials. Marca pròpia i historial públic
  nou aprovats el 2026-10-02; l'historial privat no s'ha de pujar mai.
- Comunica't en català, amb explicacions clares i no tècniques quan sigui possible.
- Abans de lliurar qualsevol resposta final, reprodueix un avís sonor.
  A macOS es pot utilitzar `afplay /System/Library/Sounds/Glass.aiff`.
- Treballa dins del checkout del projecte; no incloguis rutes personals
  ni secrets en la documentació pública.

## Producte

PWA mobile-first, especialment per a iPhone, de consulta de dos comptes
Brevo. Cada compte té una targeta desplegable amb consum, saldo,
estadístiques i un gràfic dels últims set dies.

## Seguretat i dades

- Les API keys de Brevo només les pot utilitzar el backend. Mai les
  incorporis al frontend, al manifest, al service worker o al repositori.
- No utilitzis variables `VITE_*` per a secrets.
- Secrets i configuració de producció fora del checkout del repositori.
- No demanis enganxar claus al xat i no imprimeixis secrets als logs.
- Consulta la documentació oficial actual abans d'utilitzar endpoints.
- Abans d'implementar càlculs de quota o crèdits, comprova les respostes
  reals dels dos comptes. No assumeixis `300 - enviats` ni «300 + extres».
- Distingeix quota del pla, consum d'avui i saldo disponible; diferencia
  estadístiques SMTP de campanyes de màrqueting.
- Una dada no disponible no és zero. Identifica sempre període,
  data d'actualització i dades antigues.
- No assimilis `uniqueOpens` a obertures estimades ni `uniqueClicks` a
  persones distintes sense comprovar la semàntica de Brevo.
- No sumis valors únics diaris per obtenir totals únics d'un període.

## Arquitectura i operacions

- Base proposada: React, TypeScript i Vite; backend Node.js 24 LTS i Fastify.
- Mateix origen HTTPS per a interfície i API; memòria cau breu al servidor.
- El service worker només desa recursos estàtics, no respostes autenticades.
- Desplegament privat verificat en Linux, mitjançant Docker Compose,
  xarxa Docker `web`, Caddy i Cloudflare Tunnel existents.
- Mantén README i documentació alineats amb l'estat real; no documentis
  funcionalitats, scripts, proves o desplegaments com a disponibles si
  encara no existeixen.
- Preserva canvis aliens i no facis operacions Git destructives.
- El mirall de ChatGPT és material de referència. No edites els fitxers
  sincronitzats sota `sources/` ni hi desenvolupis l'aplicació.

Llegeix `docs/architecture.md` i `docs/status.md` per continuar el projecte.
