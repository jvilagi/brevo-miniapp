# Semàntica i validació de l'API Brevo

Validació de només lectura amb dos comptes el 2026-10-01. Aquest document
conserva les conclusions tècniques, no credencials, identificadors,
respostes completes, saldos ni comptadors personals.

## Quota, consum i saldo

S'han observat règims Free i prepagament, contrastats amb la interfície
Brevo. `payAsYouGo.credits` representa saldo prepagament; no se suma amb
una entrada de subscripció ni amb la quota diària Free. Les entrades
simultànies i `planVerticals` poden ser ambigües: un sol camp no és
suficient per deduir el règim. Plans no acreditats queden desconeguts.

En Free, el saldo s'obté de `/v3/account`, no de restar activitat SMTP
a 300. Els crèdits prepagament substitueixen els enviaments Free segons
la [documentació oficial dels complements](https://help.brevo.com/hc/en-us/articles/4409354969746-Customize-your-plan-with-add-ons).
Un saldo prepagament zero no acredita per si sol un retorn a Free;
el backend ha de llegir el règim efectiu en cada actualització.

El fus contrastat als comptes de prova va ser GMT+2 i el reinici a
mitjanit. És l'origen del valor inicial `Etc/GMT-2`, no una regla universal
per a tots els comptes. Verifica el fus i el pla de la teva instal·lació.

## Estadístiques

- SMTP i campanyes són fonts separades. Els informes transaccionals no
  acrediten el consum total d'un compte que envia campanyes.
- `requests` són sol·licituds transaccionals, no entregues ni persones.
- `uniqueOpens` no acredita l'estimació d'obertures de la interfície Brevo;
  `uniqueClicks` no es presenta com a persones distintes.
- Els valors únics diaris no es poden sumar per obtenir totals únics.
  També s'han observat discrepàncies entre diari i agregat d'un mateix dia.
  Els resums utilitzen l'endpoint agregat amb dates explícites.
- A la prova, `days=1` va incloure dues dates i `days=7`, vuit. S'utilitzen
  `startDate` i `endDate` explícits: sis dies anteriors més avui.
- L'API omet dies sense activitat. Només es completen mètriques additives
  amb zero si els dies observats es reconcilien amb l'agregat fresc.
  Aquesta regla no s'aplica als valors únics. Altres absències són `null`.
- Obertures i clics poden correspondre a missatges enviats abans del dia
  observat; no es calculen percentatges de cohort amb aquests totals.

La integració GET autenticada, els cinc blocs de dades per compte, les
set dates, errors parcials i reutilització de cache s'han comprovat.
No s'han enviat emails ni modificat recursos Brevo durant la validació.

## Fonts oficials

- [Compte i crèdits](https://developers.brevo.com/reference/get-account)
- [Informe diari SMTP](https://developers.brevo.com/reference/get-smtp-report)
- [Informe agregat SMTP](https://developers.brevo.com/reference/get-aggregated-smtp-report)
- [Campanyes](https://developers.brevo.com/reference/get-email-campaigns)
- [Semàntica d'informes transaccionals](https://help.brevo.com/hc/en-us/articles/208858829-Review-your-transactional-email-reports)
