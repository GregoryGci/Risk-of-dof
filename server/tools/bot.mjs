// Bot de test : rejoint une partie et joue tout seul (pratique pour tester le multijoueur sans ami).
// Usage : npm run bot -- ABCD        (ABCD = code de la partie ; sans code, le bot crée une partie)
import { Client } from '@colyseus/sdk';

const code = (process.argv[2] ?? '').toUpperCase();
const client = new Client(`ws://localhost:${process.env.PORT ?? 2567}`);
const room = code ? await client.joinById(code, { name: 'Bot' }) : await client.create('partie', { name: 'Bot' });
console.log(`[bot] connecté à la partie ${room.roomId}`);
for (const type of ['cast', 'projEnd', 'explode', 'dmg', 'death', 'atk', 'boss']) room.onMessage(type, () => {});
room.onMessage('item', (e) => {
  if (e.player === room.sessionId) console.log(`[bot] objet obtenu : ${e.item}`);
});
room.onLeave(() => process.exit(0));
if (!code) setTimeout(() => room.send('start'), 500);

/** Élément le plus proche du bot dans une collection synchronisée. */
function nearest(collection, me, filter = () => true) {
  let best = null;
  let bestDist = Infinity;
  collection?.forEach((e) => {
    const d = Math.hypot(e.x - me.x, e.y - me.y);
    if (filter(e) && d < bestDist) {
      bestDist = d;
      best = e;
    }
  });
  return { target: best, dist: bestDist };
}

setInterval(() => {
  const state = room.state;
  const me = state?.players?.get(room.sessionId);
  if (!me || !me.alive) return;

  const monster = nearest(state.monsters, me);
  const chest = nearest(state.chests, me, (c) => !c.opened);
  let dx = 0;
  let dy = 0;

  if (monster.target && monster.dist < 4) {
    // Monstre trop près : on recule.
    dx = -(monster.target.x - me.x) / (monster.dist || 1);
    dy = -(monster.target.y - me.y) / (monster.dist || 1);
  } else if (chest.target && me.kamas >= state.chestCost) {
    // Assez de kamas : on va ouvrir le coffre le plus proche.
    dx = (chest.target.x - me.x) / (chest.dist || 1);
    dy = (chest.target.y - me.y) / (chest.dist || 1);
    if (chest.dist < 1.2) room.send('interact');
  } else if (monster.target) {
    // Sinon on tourne autour du monstre le plus proche.
    dx = -(monster.target.y - me.y) / (monster.dist || 1);
    dy = (monster.target.x - me.x) / (monster.dist || 1);
  }
  room.send('input', { dx, dy, dir: 1 });
  if (monster.target && monster.dist < 11) for (let slot = 0; slot < 4; slot++) room.send('cast', { slot, tx: monster.target.x, ty: monster.target.y });
}, 120);

// Résumé périodique.
setInterval(() => {
  const me = room.state?.players?.get(room.sessionId);
  if (me) console.log(`[bot] t=${room.state.time.toFixed(0)}s diff=${room.state.difficulty.toFixed(2)} pv=${Math.ceil(me.hp)}/${me.maxHp} kamas=${me.kamas} objets=${me.items || '-'} monstres=${room.state.monsters.size}`);
}, 15000);
