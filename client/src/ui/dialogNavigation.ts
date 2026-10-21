// Les fenêtres gardent le clavier : Tab parcourt leurs commandes, Échap ferme la plus haute.
export function setupDialogNavigation(): void {
  const closes:Record<string,string>={equipment:'equipment-close',encyclopedia:'encyclopedia-close',talents:'talents-close',details:'details-close',rest:'rest-close',history:'history-close','account-panel':'account-close',ladder:'ladder-close','game-settings':'game-settings-close',atlas:'atlas-close','home-view-overlay':'view-close'};
  const topDialog=()=>[...document.querySelectorAll<HTMLElement>('#boon-choices:not(.hidden),.overlay:not(.hidden)')]
    .filter(el=>el.getBoundingClientRect().width>0).reverse()
    .sort((a,b)=>Number(getComputedStyle(b).zIndex)-Number(getComputedStyle(a).zIndex))[0];
  const closeButton=(dialog:HTMLElement)=>dialog.id==='skin-shop'||dialog.id==='mastery'
    ?dialog.querySelector<HTMLButtonElement>('[data-close]')
    :document.getElementById(closes[dialog.id]) as HTMLButtonElement|null;
  // Une pression commencée dans la fenêtre puis relâchée dehors n'est pas un clic de fermeture.
  let backdropPress:HTMLElement|undefined;
  document.addEventListener('pointerdown',event=>{
    backdropPress=undefined;
    if(event.button!==0||!(event.target instanceof Element))return;
    const dialog=topDialog();
    if(dialog){if(event.target===dialog&&closeButton(dialog))backdropPress=dialog;}
  },{capture:true});
  document.addEventListener('pointercancel',()=>{backdropPress=undefined;},{capture:true});
  document.addEventListener('click',event=>{
    const pressed=backdropPress;backdropPress=undefined;
    if(!pressed||!(event.target instanceof Element))return;
    const dialog=topDialog();
    if(dialog===pressed&&event.target===dialog){
      event.preventDefault();event.stopPropagation();closeButton(dialog)?.click();
    }
  },{capture:true});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab' && event.key!=='Escape') return;
    const dialog=topDialog();
    if(!dialog) return;
    // Tab ouvre le panneau de détails en jeu : la même touche le referme (Shift+Tab parcourt toujours ses commandes).
    if(event.key==='Escape' || (event.key==='Tab' && !event.shiftKey && dialog.id==='details')) {
      const close=closeButton(dialog);
      if(close) { event.preventDefault();event.stopPropagation();close.click(); }
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
