/** Shared explanation for preparation, multiplayer lobby and ranking filters. */
export function stasisLabel(tooltipId:string):string {
  return `<span class="stasis-help"><button type="button" class="stasis-label" aria-label="Comprendre le Stasis" aria-describedby="${tooltipId}">Stasis :</button><span id="${tooltipId}" class="stasis-tooltip" role="tooltip">Le Stasis est le niveau de difficulté de votre run, de 1 à 10. Plus il est élevé, plus les ennemis sont résistants, dangereux et nombreux, et plus les récompenses de fin augmentent. Terminez un Stasis pour débloquer le suivant. Le Stasis 5 correspond à l’ancien Cauchemar.</span></span>`;
}
