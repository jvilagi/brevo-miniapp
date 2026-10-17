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

El fus contrastat a la interfície dels comptes de prova va ser GMT+2.
És l'origen del valor inicial `Etc/GMT-2`, no una regla universal per a
tots els comptes. Verifica el fus i el pla de la teva instal·lació.

Revisió del 2026-10-03: l'hora exacta de reinici del saldo Free no està
verificada. La [documentació oficial del pla Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
confirma el reinici diari, però no n'especifica l'hora ni el fus. El dia
consultat als informes SMTP i el saldo retornat per l'API de compte no
s'han d'assumir sincronitzats a mitjanit. La pantalla indica saldo segons
Brevo, sense prometre una hora ni forçar-lo a 300 perquè avui no hi hagi
sol·licituds SMTP. Un retard o una diferència d'horari són hipòtesis,
no causes acreditades retrospectivament.

Revisió del 2026-10-17 per als comptes configurables: nou GET real dels dos
plans existents, sense desar payloads complets ni valors personals. Es
manté el patró de prepagament amb entrada de subscripció zero al primer
compte i Free al segon. En aquella lectura encara no s'havia observat un
saldo de subscripció positiu. Una consulta posterior del mateix dia ha
confirmat una entrada `subscription` amb saldo positiu i crèdits prepagament simultanis,
amb vertical Marketing de pagament activa; l'altre compte continua Free.
No es documenta aquí cap saldo, nom privat ni període personal.

La documentació de [Get account](https://developers.brevo.com/reference/get-account)
defineix `plan[].credits` com a saldo restant i `planVerticals.credits`
com a crèdits assignats: no són intercanviables. La nova versió reconeix
una única subscripció amb `creditsType=sendLimit` i saldo vàlid; si també
hi ha una reserva prepagament vàlida, es mostra separadament. No se sumen
els saldos. Subscripció zero amb reserva, sense més context, conserva el
règim prepagament ja verificat; combinacions conflictives queden desconegudes.

Ajust publicat i desplegat el 2026-10-17 (`d38533d`): la targeta mostra els dos
saldos com a xifres independents, no només la reserva en una nota. Si
Brevo acredita una vertical Marketing de pagament activa i un període
de subscripció explícit vàlid, es manté el saldo de subscripció zero amb
la reserva separada. Les dates admeten el format Unix documentat i el
format calendari observat a la resposta real; no serveixen per calcular
ni reiniciar crèdits. Sense aquest context, no es transforma un placeholder
zero en una subscripció activa. Un saldo absent es mostra com a desconegut.
El dia de renovació introduït manualment és només una referència, no
una data acreditada de l'API ni una regla per restablir saldo.

### Correcció de l'ordre de presentació

Revisió posterior del 2026-10-17: una nova consulta GET confirma que el
saldo prepagament ha disminuït mentre l'entrada `subscription` es manté
igual. No s'ha enviat cap correu de prova. Això acredita moviment entre
dues lectures, no una regla universal ni l'activació futura d'una quota.
Els noms, saldos i períodes privats no s'incorporen a aquest document.

El text desplegat afirmava que primer es consumia el pla. Era una
generalització incorrecta: la documentació dels complements distingeix
entre plans mensuals de pagament (pla primer) i Free amb prepagament
(els crèdits substitueixen la quota diària). A més, el prepagament dona
accés a funcions Starter: `planType=paid` i dates no acrediten per si sols
una subscripció mensual ni la prioritat de consum d'un compte.

Correcció publicada i desplegada el 2026-10-17 (`8510a86`): prepagament primer a
la vista i «Emails del pla» després, distintiu «Pla + prepagament» quan
es retornen tots dos saldos i explicació neutral. L'ordre visual no és
una simulació de facturació. Es mantenen els imports de cada resposta,
sense sumar-los ni restar activitat SMTP, sense canviar la normalització
o els llindars d'avís, ni convertir automàticament un saldo zero a Free.
Una entrada `subscription` es presenta com a saldo del pla, no com a
quota mensual o emails necessàriament utilitzables alhora amb prepagament.

Confirmat posteriorment pel responsable: el compte examinat és Free
amb crèdits comprats, no una subscripció mensual. Per això no es pot
generalitzar aquella entrada `subscription` a un contracte mensual real.
La referència «Free» ja disponible a Configuració adapta ara només
l'explicació: el prepagament substitueix la quota diària i els dos saldos
no estan disponibles alhora. La referència no sobreescriu el saldo ni
força `regime=free`, i un zero prepagament no activa la quota diària.
Sense referència explícita es mostra la regla Free en condicional, no
s'identifica cap compte per nom/id ni s'infereix Free perquè retorni 300.

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

## Avisos: endpoints d'escriptura explícita

Documentació revisada el 2026-10-17:
[Get senders](https://developers.brevo.com/reference/get-senders) retorna
`id`, `name`, `email` i `active`; el selector només admet remitents actius
del compte triat. [Send transactional email](https://developers.brevo.com/reference/send-transac-email)
admet `sender.id` i destinatari explícit, amb `htmlContent`/`textContent`.
El backend només considera `201` com a acceptació; no acredita entrega.
POST limitat als avisos habilitats i proves confirmades, mai a campanyes.
Les proves injecten emissors simulats: no s'ha validat cap enviament real.

## Fonts oficials

- [Compte i crèdits](https://developers.brevo.com/reference/get-account)
- [Informe diari SMTP](https://developers.brevo.com/reference/get-smtp-report)
- [Informe agregat SMTP](https://developers.brevo.com/reference/get-aggregated-smtp-report)
- [Campanyes](https://developers.brevo.com/reference/get-email-campaigns)
- [Semàntica d'informes transaccionals](https://help.brevo.com/hc/en-us/articles/208858829-Review-your-transactional-email-reports)
