# Flow

1. merge sur main
2. la CI sur main qui run `auto-release prepare-release`
3. creation/update de la branche de release avec
  - nouvelle version apply sur les packages
  - changelog généré
4. CI sur cette branche qui run
  - check de qualité
  - tests
  - build + deploy sur env de test (⚠️ ici on doit pouvoir override la version via le commit/time/whatever car risque de multiple déploiement ici)
  - possibilité de force de deploy sur pré-prod ??
5. lorsqu'on est ready, on merge cette MR
6. la CI sur main va procéder au tagging via `auto-release publish-release` (naming pas bon maybe ?)
7. la CI du tag s'occupe du build + deploy en pré-prod/prod (maybe de manière manuelle)

# Open questions

- procédure de hotfix ?
  - on peut proposer une solution qui viendrait poser le tag + update le changelog pour le user
  - et qui revert le changement de version dans un commit juste après le tag
- on garde que main ou on veut une release branch
- 1 ou 2 CI différente suite au merge ? 2 CI permet de retrouver facilement la CI de deploy car sera dispo sur l'interface des tags dans gitlab, mais ça fait 2 CI...
- quid de proposer des tools pour get la version depuis JS (pour l'afficher dans les logs ou sur le front)
- comment on propose une intégration poussés pour expo, react native, php, package.json classique ?
- calver ne fonctionne pas bien avec les hotfixs...
- la command `check` peut verifier qu'une MR ne modifie pas manuellement une version managée par auto release et prevent le merge
- 