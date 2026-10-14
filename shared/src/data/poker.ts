export interface PokerHand { name: string; power: number }
/** Carte 0..51 : rang 2..As et couleur trèfle/carreau/cœur/pique. */
export function cardLabel(card: number): string {
  return `${['2','3','4','5','6','7','8','9','10','V','D','R','A'][card % 13]}${['♣','♦','♥','♠'][Math.floor(card / 13)]}`;
}
export function evaluateHand(cards: number[]): PokerHand {
  if (cards.length !== 5 || new Set(cards).size !== 5 || cards.some(c => !Number.isInteger(c) || c < 0 || c > 51)) throw new Error('Main de cinq cartes distinctes requise');
  const ranks = cards.map(c => c % 13).sort((a,b) => a-b);
  const counts = [...new Set(ranks)].map(r => ranks.filter(v => v === r).length).sort((a,b) => b-a);
  const flush = cards.every(c => Math.floor(c / 13) === Math.floor(cards[0] / 13));
  const straight = counts.length === 5 && (ranks[4]-ranks[0] === 4 || ranks.join(',') === '0,1,2,3,12');
  const power = straight && flush ? 8 : counts[0] === 4 ? 7 : counts[0] === 3 && counts[1] === 2 ? 6 : flush ? 5 : straight ? 4 : counts[0] === 3 ? 3 : counts[0] === 2 && counts[1] === 2 ? 2 : counts[0] === 2 ? 1 : 0;
  return {name:['Carte haute','Paire','Double paire','Brelan','Suite','Couleur','Full','Carré','Quinte flush'][power],power};
}
