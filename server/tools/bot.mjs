// Bot de test : rejoint une partie et joue tout seul (pratique pour tester le multijoueur sans ami).
// Usage : npm run bot -- ABCD        (ABCD = code de la partie ; sans code, le bot crée une partie)
import { Client } from '@colyseus/sdk';

const code = (process.argv[2] ?? '').toUpperCase();
const client = new Client(`ws://localhost:${process.env.PORT ?? 2567}`);
const room = code ? await client.joinById(code, { name: 'Bot' }) : await client.create('partie', { name: 'Bot' });
console.log(`[bot] connecté à la partie ${room.roomId}`);
for (const type of ['cast', 'projEnd', 'explode', 'dmg', 'death', 'atk']) room.onMessage(type, () => {});
room.onLeave(() => process.exit(0));
if (!code) setTimeout(() => room.send('start'), 500);

setInterval(() => {
  const state = room.state;
  const me = state?.players?.get(room.sessionId);
  if (!me || !me.alive) return;
  // Cible : le monstre le plus proche.
  let target = null;
  let best = Infinity;
  state.monsters.forEach((m) => {
    const d = Math.hypot(m.x - me.x, m.y - me.y);
    if (d < best) {
      best = d;
      target = m;
    }
  });
  if (!target) {
    room.send('input', { dx: 0, dy: 0, dir: 1 });
    return;
  }
  // Recule si le monstre est trop près, sinon tourne autour ; tire avec tout ce qui est prêt.
  const dx = (target.x - me.x) / (best || 1);
  const dy = (target.y - me.y) / (best || 1);
  const flee = best < 4;
  room.send('input', { dx: flee ? -dx : -dy, dy: flee ? -dy : dx, dir: 1 });
  if (best < 11) for (let slot = 0; slot < 4; slot++) room.send('cast', { slot, tx: target.x, ty: target.y });
}, 120);
