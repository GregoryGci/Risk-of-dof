/** Feedback partagé de toutes les pages ; aucun ordonnanceur ni observer de DOM en jeu. */
export function startThemeMotion(): () => void {
  const controller = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set<Animation>();
  function ripple(target: EventTarget | null, x?: number, y?: number): void {
    if (motion.matches || !document.body.classList.contains('legends')) return;
    const button = (target instanceof Element ? target : null)?.closest<HTMLButtonElement>('button');
    if (!button || button.disabled || !button.matches('.btn,.home-nav-button,.character-action,.home-class,.skin-class,.level-choice,.route-card')) return;
    if (animations.size >= 12) animations.values().next().value?.cancel();
    const rect = button.getBoundingClientRect(), dot = document.createElement('span');
    dot.className = 'theme-ripple'; dot.setAttribute('aria-hidden', 'true');
    dot.style.left = `${(x ?? rect.left + rect.width / 2) - rect.left}px`;
    dot.style.top = `${(y ?? rect.top + rect.height / 2) - rect.top}px`;
    button.append(dot);
    const animation = dot.animate([
      {transform: 'translate(-50%,-50%) scale(0)', opacity: .24},
      {transform: `translate(-50%,-50%) scale(${Math.hypot(rect.width,rect.height) / 10})`, opacity: 0},
    ], {duration: 500, easing: 'cubic-bezier(.2,.7,.3,1)'});
    animations.add(animation);
    void animation.finished.catch(()=>{}).finally(()=>{dot.remove();animations.delete(animation);});
  }
  document.addEventListener('pointerdown', event => {if(event.button===0)ripple(event.target,event.clientX,event.clientY);}, {signal: controller.signal});
  document.addEventListener('keydown', event => {
    if(!event.repeat&&(event.key==='Enter'||event.key===' '))ripple(event.target);
  }, {signal: controller.signal});
  const stop = () => {for(const animation of animations)animation.cancel();animations.clear();};
  motion.addEventListener('change', stop, {signal: controller.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();}, {signal: controller.signal});
  return () => {controller.abort();stop();};
}
