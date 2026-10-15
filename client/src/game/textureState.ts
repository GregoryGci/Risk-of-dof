import Phaser from 'phaser';

/** Les uploads de canvas et les RenderTextures changent les liaisons WebGL.
 * Le cache du pipeline doit être reconstruit avant les dessins de la scène.
 * Cela permet de regrouper plusieurs atlas sans conserver une liaison périmée.
 */
export function installTextureStateRefresh(scene:Phaser.Scene):void {
  const renderer=scene.game.renderer;
  if(!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer))return;
  const refresh=()=>{
    for(const pipeline of renderer.pipelines.pipelines.getArray())pipeline.activeTextures.length=0;
  };
  scene.game.events.on(Phaser.Core.Events.PRE_RENDER,refresh);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>scene.game.events.off(Phaser.Core.Events.PRE_RENDER,refresh));
}
