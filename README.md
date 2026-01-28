# HellLadder Bot (SSBU)

Bot Discord pour gérer un ladder SSBU avec équipes (7 péchés capitaux), matchmaking, report de résultats, et sélection de stage via RPS.

## Commandes utilisateur

- `!team <nom>` : choisir son équipe (obligatoire).
  - Équipes possibles : Pride, Greed, Lust, Envy, Gluttony, Wrath, Sloth
- `!ladder` : affiche les règles + bouton pour lancer un match (si tu as une équipe).
- `!ranking` : affiche le top joueurs (sans ping).

## Matchmaking

1) Utilise `!team` si ce n’est pas déjà fait.
2) Utilise `!ladder`, puis clique sur **Trouver un match**.
3) Quand un adversaire est trouvé, un salon privé est créé.

## Format du set (BO)

Dans le salon de match, les deux joueurs doivent choisir le même format :
- **BO3** ou **BO5**

Option :
- **Gentleman** (bouton ou `!gentleman bo3/bo5`) → pas de bans, on choisit directement un stage.

## Sélection de stage (RPS)

1) **Pierre / Feuille / Ciseaux** entre les deux joueurs.
2) **Gagnant** du RPS : ban **3** stages.
3) **Perdant** : ban **4** stages.
4) **Gagnant** : choisit le stage final parmi les **2** restants.
   - Bouton **Random map** disponible (choisit entre les 2).

## Report de résultat

Dans le salon de match :
- Menu **Reporter le résultat** (les deux joueurs doivent report la même chose)
- Le bot applique l’Elo et ferme le match.

## Elo

- Elo de départ : 1000
- K-factor : BO3 = 32, BO5 = 40

## CSV automatiques

Le bot génère automatiquement :
- `ladder_players.csv` (pseudo, équipe, points, wins, losses)
- `ladder_teams.csv` (classement des équipes par points total)

## Commandes admin

- `!killall` : stoppe tous les matchs et supprime les salons en cours.

## Notes importantes

- Le bot assigne automatiquement un rôle Discord correspondant à l’équipe.
- Les rôles doivent exister avec ces noms :
  - pride, greed, lust, envy, gluttony, wrath, sloth
- Le bot a besoin des permissions :
  - Lire/écrire messages
  - Gérer les salons
  - Gérer les rôles

---

## Version Discord (à copier/coller)

