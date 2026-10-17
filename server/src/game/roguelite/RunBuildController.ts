import {makeRng} from '@rod/shared';
import {applyEvolution, applyLevelReward, createRunBuild, validateRunBuild,eligibleEvolutions, generateLevelRewards,
  type LevelReward, type RogueliteCatalog, type RunBuild} from '@rod/shared/roguelite';

export type RunChoice=LevelReward|{id:string;kind:'evolution'|'blessing';definitionId:string;nextLevel:number};
export interface BuildChoiceOffer {runId: string; revision: number; buildRevision: number; expiresAtMs: number; choices: RunChoice[];source:'level'|'boss'|'elite'}
/**
 * Authoritative personal build, wired to the existing shared XP callback.
 * One instance per (run, player); the room derives the player from Client.sessionId.
 * Times use the simulation clock in milliseconds. Dead/disconnected players keep this instance.
 */
export class RunBuildController {
  private build: RunBuild;
  private pendingLevels = 0;
  private offerRevision = 0;
  private offer?: BuildChoiceOffer;
  private rewardedEvents = new Set<string>();
  private bonusQueue:{eventId:string;source:'boss'|'elite';blessings:string[]}[]=[];
  private levelCursor=2;
  private offerNumber=0;
  private luck=0;
  constructor(private catalog: RogueliteCatalog, readonly runId: string, readonly playerId: string,
    classId: string, private seed: number, trustedBuild?:RunBuild) {
    if (!runId || !playerId || !Number.isSafeInteger(seed)) throw new Error('Invalid build authority identity');
    this.build = trustedBuild?structuredClone(trustedBuild):createRunBuild(catalog,classId);validateRunBuild(catalog,this.build);
  }
  getSnapshot() {
    return structuredClone({runId: this.runId, playerId: this.playerId, build: this.build,
      pendingLevels: this.pendingLevels, offer: this.offer});
  }
  private buildView?:{key:string;value:RunBuild};
  get currentBuild():RunBuild {
    const key=`${this.build.revision}:${this.build.rerolls}:${this.build.banishes}`;
    if(this.buildView?.key!==key){const value=structuredClone(this.build);const freeze=(v:unknown)=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}};freeze(value);this.buildView={key,value};}
    return this.buildView!.value;
  }
  setLuck(luck:number) {this.luck=Number.isFinite(luck)?Math.max(0,luck):0;}
  addRerolls(count=1) {if(this.catalog.config.rewardRules)this.build.rerolls=Math.min(this.catalog.config.rewardRules.rerollMax,this.build.rerolls+count);}
  enqueueBonus(eventId:string,source:'boss'|'elite',blessings:string[],nowMs:number):boolean {
    this.validateClock(nowMs);if(typeof eventId!=='string'||!eventId||eventId.length>160||this.rewardedEvents.has(eventId))return false;
    this.rewardedEvents.add(eventId);
    this.bonusQueue.push({eventId,source,blessings});this.ensureOffer(nowMs);return true;
  }
  /** Called only by the existing shared-XP level callback, once per earned level. */
  enqueueLevels(count: number, nowMs: number): void {
    this.validateClock(nowMs);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(this.pendingLevels + count)) throw new Error('Invalid level count');
    this.pendingLevels += count; this.ensureOffer(nowMs);
  }
  private validateClock(nowMs: number) {if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error('Invalid simulation clock');}
  private ensureOffer(nowMs: number): void {
    if (this.offer || !this.pendingLevels&&!this.bonusQueue.length) return;
    this.offerRevision++;
    if (!Number.isSafeInteger(this.offerRevision)) throw new Error('Choice revision overflow');
    const bonus=this.pendingLevels?undefined:this.bonusQueue[0];
    let choices:RunChoice[];
    if(bonus) {
      const evolutions=eligibleEvolutions(this.catalog,this.build,bonus.source).map(id=>({id:`evolution:${id}`,kind:'evolution' as const,definitionId:id,nextLevel:1}));
      if(bonus.source==='elite')choices=[...bonus.blessings.slice(0,evolutions.length?2:3).map(id=>({id:`blessing:${id}`,kind:'blessing' as const,definitionId:id,nextLevel:1})),...evolutions.slice(0,1)];
      else choices=evolutions.length?evolutions:generateLevelRewards(this.catalog,this.build,makeRng((this.seed+this.offerRevision*31)>>>0),{level:this.levelCursor,luck:this.luck,offerNumber:++this.offerNumber});
    } else choices=generateLevelRewards(this.catalog,this.build,makeRng((this.seed+Math.imul(this.offerRevision,0x9e3779b9))>>>0),{level:this.levelCursor,luck:this.luck,offerNumber:++this.offerNumber});
    // Plus rien à proposer (secours plafonnés, Potion bannie) : le niveau ou le bonus est consommé sans carte.
    if(!choices.length){if(bonus)this.bonusQueue.shift();else{this.pendingLevels--;this.levelCursor++;}this.ensureOffer(nowMs);return;}
    this.offer = {runId: this.runId, revision: this.offerRevision, buildRevision: this.build.revision,source:bonus?.source??'level',
      expiresAtMs: nowMs + this.catalog.config.choiceTimeoutMs,
      choices};
  }
  /** Payload is an intention, never a spell definition, XP value, level, or full build. */
  choose(message: {runId?: unknown; revision?: unknown; choiceId?: unknown}, nowMs: number): RunChoice | undefined {
    this.validateClock(nowMs);
    if (!message || message.runId !== this.runId || message.revision !== this.offer?.revision || !this.offer) return;
    const selected = this.offer.choices.find(c => c.id === message.choiceId); if (!selected) return;
    if(selected.kind==='evolution') {
      const bonus=this.bonusQueue[0];if(!bonus)return;
      this.build=applyEvolution(this.catalog,this.build,selected.definitionId,bonus.source);
    }else if(selected.kind!=='blessing')this.build=applyLevelReward(this.catalog,this.build,selected as LevelReward);
    else this.build.revision++;
    if(this.offer.source==='level'){this.pendingLevels--;this.levelCursor++;}
    else this.bonusQueue.shift();
    this.offer = undefined; this.ensureOffer(nowMs); return structuredClone(selected);
  }
  /** Use only in multiplayer. Solo retains the existing pause-on-choice policy. */
  updateMultiplayer(nowMs: number): RunChoice | undefined {
    this.validateClock(nowMs);
    if (!this.offer || nowMs < this.offer.expiresAtMs) return;
    return this.choose({runId: this.runId, revision: this.offer.revision, choiceId: this.offer.choices[0].id}, nowMs);
  }
  reroll(message:{runId?:unknown;revision?:unknown},nowMs:number):boolean {
    this.validateClock(nowMs);
    if(!this.offer||this.offer.source!=='level'||message.runId!==this.runId||message.revision!==this.offer.revision||this.build.rerolls<=0)return false;
    const old=this.offer.choices.map(c=>c.id);this.build.rerolls--;this.build.revision++;this.offer=undefined;this.ensureOffer(nowMs);
    const offer=this.offer as BuildChoiceOffer|undefined;if(!offer)return true;
    const fresh=generateLevelRewards(this.catalog,this.build,makeRng((this.seed+this.offerRevision*17)>>>0),{level:this.levelCursor,luck:this.luck,offerNumber:this.offerNumber,exclude:old});
    // Pool épuisé : on garde le tirage normal plutôt qu'une offre vide.
    if(fresh.length)offer.choices=fresh;return true;
  }
  banish(message:{runId?:unknown;revision?:unknown;choiceId?:unknown},nowMs:number):boolean {
    this.validateClock(nowMs);
    if(!this.offer||this.offer.source!=='level'||message.runId!==this.runId||message.revision!==this.offer.revision||this.build.banishes<=0)return false;
    const selected=this.offer.choices.find(c=>c.id===message.choiceId);if(!selected)return false;
    this.build.banned.push(selected.definitionId);this.build.banishes--;this.build.revision++;
    const old=this.offer.choices.filter(c=>c.id!==selected.id);this.offer=undefined;this.ensureOffer(nowMs);
    const offer=this.offer as BuildChoiceOffer|undefined;if(!offer)return true;
    const replacement=generateLevelRewards(this.catalog,this.build,makeRng((this.seed+this.offerRevision*19)>>>0),{level:this.levelCursor,luck:this.luck,offerNumber:this.offerNumber,exclude:old.map(c=>c.id)});
    const choices=[...old,...replacement.slice(0,1)];if(choices.length)offer.choices=choices;return true;
  }
}
