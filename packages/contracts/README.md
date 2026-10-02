# Contractes públics

Tipus públics compartits entre frontend i backend: salut del servei,
errors, règims de quota, mètriques SMTP, períodes i instantànies de compte.
No inclou secrets, configuració privada ni respostes completes de Brevo.

La ruta autenticada de comptes retorna aquestes instantànies. Cada
secció identifica estat fresc, antic o no disponible i data d'actualització;
cada mètrica absent és `null`. Els tipus separen quota diària Free de
saldo prepagament, avui de set dies i SMTP de campanyes de màrqueting.

Es compila abans del frontend i l'API amb les comandes del README principal.
