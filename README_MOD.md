# HellLadder Bot — Guide Modération / Admin

Ce guide est pour les modérateurs et admins.

## Commandes modo/admin

- `!killall` : stoppe tous les matchs et supprime les salons en cours (admin)
- `!killmatch` : stoppe le match du salon courant (admin)
- `!forcewin @joueur bo3|bo5` : force la victoire d’un joueur (modo)
- `!update <message>` : poste l’annonce d’update dans le salon updates (admin)

## Classements

- `!ranking` : classement global (tous serveurs)
- `!servranking` : classement du serveur actuel

## Rappel des permissions

Le bot doit avoir :
- Lire/écrire messages
- Gérer les salons
- Gérer les rôles

Les rôles d’équipe doivent exister :
- pride, greed, lust, envy, gluttony, wrath, sloth

## CSV automatiques

- `ladder_players.csv` (pseudo, équipe, points, wins, losses)
- `ladder_teams.csv` (classement des équipes par total de points)

## Format de stages (RPS)

- RPS → gagnant ban 3
- perdant ban 4
- gagnant choisit parmi les 2 restants (Random possible)
