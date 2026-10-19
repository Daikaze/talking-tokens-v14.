/**
 * Talking Tokens — GM -> NPC Voice Mode (Foundry V14)
 * The GM selects exactly one token and arms it with Shift+N (configurable).
 * With Discord connected, GM voice is routed to that token only while speaking.
 * Shift+M is an optional manual push-to-talk indicator (no Discord required).
 * A small GM-only HUD offers Stop and Hold to Talk buttons as well.
 */
const TT_ID="talking-tokens-v14";
const GM_HOOK="talking-tokens-v14.gmVoicePacket";
const GM_CHAT="module."+TT_ID;

class GMNpcVoice {
  static target=null;  // { sceneId, tokenId, name }
  static discordSpeaking=false;
  static manualSpeaking=false;
  static manualTimer=null;
  static indicator=null;

  static get api(){return game.modules.get(TT_ID)?.api;}
  static get isGM(){return game.user?.isGM===true;}

  static selected(){
    if(!canvas?.ready)return null;
    const selected=canvas.tokens?.controlled || [];
    if(selected.length!==1)return null;
    const t=selected[0];
    return t?.document?.id && t.actor ? t : null;
  }

  static sameTarget(token) {
    return this.target?.sceneId===canvas.scene?.id &&
      this.target?.tokenId===token?.document?.id;
  }

  static resolveToken() {
    if(!this.target || this.target.sceneId!==canvas.scene?.id)return null;
    return canvas.tokens?.get?.(this.target.tokenId)
      || canvas.tokens?.placeables.find(t=>t.document?.id===this.target.tokenId);
  }

  static toggleTarget() {
    if(!this.isGM)return false;
    const token=this.selected();
    if(!token){
      ui.notifications.warn("Talking Tokens: Select exactly one NPC token first.");
      return false;
    }
    if(this.sameTarget(token)){
      this.deactivate();
      return true;
    }
    this.deactivate();
    this.target={
      sceneId:canvas.scene.id,
      tokenId:token.document.id,
      name:token.document.name||token.actor?.name||"NPC"
    };
    this.renderHUD();
    ui.notifications.info("Talking Tokens: GM voice now routes to "+this.target.name+". Press Shift+N on the same token to stop.");
    return true;
  }

  static deactivate(){
    if(!this.isGM)return;
    if(this.target)this.broadcast(false);
    this.target=null;
    this.discordSpeaking=false;
    this.manualSpeaking=false;
    this.stopHeartbeat();
    this.renderHUD();
  }

  static payload(speaking){
    if(!this.target)return null;
    return {
      type:"npc-speaking",sceneId:this.target.sceneId,
      tokenId:this.target.tokenId,speaking:!!speaking
    };
  }

  static broadcast(speaking){
    if(!this.isGM || !this.target || !this.api?.handleNpcSpeaking)return;
    if(speaking && !this.resolveToken()){
      this.deactivate();
      return;
    }
    const packet=this.payload(speaking);
    this.api.handleNpcSpeaking(packet); // also show instantly for GM
    game.socket.emit(GM_CHAT,packet);  // show for everybody watching this scene
  }

  static refresh(){
    if(!this.target)return;
    this.broadcast(this.discordSpeaking || this.manualSpeaking);
  }

  static receiveGMVoice(message){
    if(!this.isGM || !this.target || message?.type!=="speaking")return true;
    // Discord ID is stored in the ordinary Foundry GM user row. Do not need
    // "Show for GM" checked: NPC mode takes precedence over GM token bubbles.
    const ownId=game.settings.get(TT_ID,"config").mappings?.[game.user.id]?.discordId;
    if(!ownId || String(message.discordId||"")!==String(ownId))return true;
    this.discordSpeaking=Boolean(message.speaking);
    this.refresh(); // repeated bridge heartbeats keep the bubble visible
    this.renderHUD();
    return false; // suppress normal GM-token routing for this packet
  }

  static startManual(){
    if(!this.isGM || !this.target)return false;
    if(this.manualSpeaking)return true;
    this.manualSpeaking=true;
    this.refresh();
    this.manualTimer=setInterval(()=>this.refresh(),750);
    this.renderHUD();
    return true;
  }

  static stopHeartbeat(){
    if(this.manualTimer!==null)clearInterval(this.manualTimer);
    this.manualTimer=null;
  }

  static stopManual(){
    if(!this.manualSpeaking)return false;
    this.manualSpeaking=false;
    this.stopHeartbeat();
    this.refresh(); // Discord speech may still be active
    this.renderHUD();
    return true;
  }

  static renderHUD(){
    if(!this.isGM)return;
    if(!this.target){
      this.indicator?.remove();
      this.indicator=null;
      return;
    }
    let root=this.indicator;
    if(!root){
      root=document.createElement("div");
      root.id="tt-gm-npc-hud";
      root.setAttribute("role","status");
      const icon=document.createElement("i");
      icon.className="fas fa-microphone";
      const label=document.createElement("span");
      label.className="tt-gm-npc-name";
      const stop=document.createElement("button");
      stop.type="button";stop.className="tt-gm-npc-stop";stop.textContent="Stop (Shift+N)";
      stop.title="Stop speaking through this NPC";
      stop.addEventListener("click",()=>this.deactivate());
      const talk=document.createElement("button");
      talk.type="button";talk.className="tt-gm-npc-talk";talk.textContent="Hold to Talk";
      talk.title="Hold to show the NPC bubble manually, without Discord";
      talk.addEventListener("pointerdown",event=>{
        if(event.button!==0)return;
        event.preventDefault();
        try{talk.setPointerCapture(event.pointerId);}catch(_){}
        this.startManual();
      });
      for(const type of ["pointerup","pointercancel","lostpointercapture"]){
        talk.addEventListener(type,()=>this.stopManual());
      }
      root.append(icon,label,talk,stop);
      document.body.append(root);
      this.indicator=root;
    }
    const name=root.querySelector(".tt-gm-npc-name");
    if(name)name.textContent="GM → "+this.target.name;
    root.classList.toggle("is-speaking",this.discordSpeaking||this.manualSpeaking);
    const talk=root.querySelector(".tt-gm-npc-talk");
    if(talk)talk.textContent=this.manualSpeaking?"Speaking…":"Hold to Talk";
  }
}

Hooks.once("init",()=>{
  // Foundry V14 built-in keybinding manager. Users may remap these keys in
  // Game Settings > Configure Controls > Talking Tokens V14.
  game.keybindings.register(TT_ID,"toggleGmNpc",{
    name:"GM → NPC Voice Target (Toggle)",
    hint:"Select exactly one token, then toggle automatic GM Discord voice routing.",
    editable:[{key:"KeyN",modifiers:["SHIFT"]}],
    restricted:true,repeat:false,
    onDown:()=>{if(!game.user.isGM)return false;return GMNpcVoice.toggleTarget();}
  });
  game.keybindings.register(TT_ID,"manualGmNpc",{
    name:"GM → NPC Manual Speech (Hold)",
    hint:"Hold to show the selected NPC speaking even without Discord. First arm it with Shift+N.",
    editable:[{key:"KeyM",modifiers:["SHIFT"]}],
    restricted:true,repeat:false,
    onDown:()=>{if(!game.user.isGM)return false;return GMNpcVoice.startManual();},
    onUp:()=>{if(!game.user.isGM)return false;return GMNpcVoice.stopManual();}
  });
});

Hooks.once("ready",()=>{
  if(!game.user.isGM)return;
  Hooks.on(GM_HOOK,message=>GMNpcVoice.receiveGMVoice(message));
  Hooks.on("canvasTearDown",()=>GMNpcVoice.deactivate());
  window.addEventListener("blur",()=>GMNpcVoice.stopManual());
  const api=GMNpcVoice.api;
  if(api)api.gmNpc={
    toggleTarget:()=>GMNpcVoice.toggleTarget(),
    deactivate:()=>GMNpcVoice.deactivate(),
    startManual:()=>GMNpcVoice.startManual(),
    stopManual:()=>GMNpcVoice.stopManual(),
    getTarget:()=>GMNpcVoice.target
  };
});

Hooks.on("getSceneControlButtons",controls=>{
  if(!game.user?.isGM || !controls.tokens)return;
  controls.tokens.tools ||= {};
  controls.tokens.tools["talking-tokens-gm-npc"]={
    name:"talking-tokens-gm-npc",
    title:"GM → NPC Voice (Shift+N): select one token first",
    icon:"fa-solid fa-microphone-lines",
    button:true,visible:true,
    order:Object.keys(controls.tokens.tools).length,
    onChange:()=>GMNpcVoice.toggleTarget()
  };
});
