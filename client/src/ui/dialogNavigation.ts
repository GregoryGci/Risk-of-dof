// Les fenêtres gardent le clavier : Tab parcourt leurs commandes, Échap ferme la plus haute.
export function setupDialogNavigation(): void {
  const closes:Record<string,string>={equipment:'equipment-close',encyclopedia:'encyclopedia-close',talents:'talents-close',details:'details-close',shop:'shop-close',history:'history-close','account-panel':'account-close',ladder:'ladder-close',atlas:'atlas-close'};
  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab' && event.key!=='Escape') return;
    const dialogs=[...document.querySelectorAll<HTMLElement>('.overlay:not(.hidden)')].filter(el=>el.getBoundingClientRect().width>0).sort((a,b)=>Number(getComputedStyle(b).zIndex)-Number(getComputedStyle(a).zIndex));
    const dialog=dialogs[0];
    if(!dialog) return;
    // Tab ouvre le panneau de détails en jeu : la même touche le referme (Shift+Tab parcourt toujours ses commandes).
    if(event.key==='Escape' || (event.key==='Tab' && !event.shiftKey && dialog.id==='details')) {
      const close=closes[dialog.id];
      if(close) { event.preventDefault();event.stopPropagation();document.getElementById(close)?.click(); }
      return;
    }
    const focusable=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]')].filter(el=>el.getBoundingClientRect().width>0);
    if(!focusable.length) return;
    event.preventDefault();event.stopPropagation();
    const current=focusable.indexOf(document.activeElement as HTMLElement);
    const next=current<0 ? event.shiftKey?focusable.length-1:0 : (current+(event.shiftKey?-1:1)+focusable.length)%focusable.length;
    focusable[next].focus();
  },{capture:true});
}
