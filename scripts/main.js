const ID="talking-tokens-v14";
const CH="module."+ID;
const DEFAULT={bridgeEnabled:false,bridgeUrl:"ws://127.0.0.1:47944",style:"speech",position:"above",scale:1,holdMs:2200,showForGM:false,mappings:{}};
const STYLES={speech:"● ● ●",chat:"•••",thought:"•••",shout:"!",whisper:"…",emote:"✦"};
const STYLE_LABELS={speech:"Classic",chat:"Chat",thought:"Thought",shout:"Shout",whisper:"Whisper",emote:"Magic"};
const POSITIONS=["above","topLeft","topRight","left","right","below"];

class Settings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS={
    id:"talking-tokens-v14-settings",
    window:{title:"Talking Tokens V14",icon:"fa-solid fa-comments",resizable:true},
    position:{width:740},
    classes:["tt-settings-window"]
  };
  static PARTS={main:{template:"modules/talking-tokens-v14/templates/settings.hbs"}};
  async _prepareContext(options){
    const data=await super._prepareContext(options);
    const cfg=game.settings.get(ID,"config"),mappings=cfg.mappings||{};
    const actors=game.actors.contents.slice().sort((a,b)=>a.name.localeCompare(b.name));
    return {...data,cfg,
      styles:Object.keys(STYLES).map(id=>({id,label:STYLE_LABELS[id],symbol:STYLES[id],selected:id===cfg.style})),
      selectedStyle:STYLE_LABELS[cfg.style]||"Classic",
      selectedSymbol:STYLES[cfg.style]||STYLES.speech,
      positions:POSITIONS.map(id=>({id,selected:id===cfg.position})),
      users:game.users.contents.map(u=>{
        const m=mappings[u.id]||{},actorId=m.actorId??u.character?.id??"";
        return {id:u.id,name:u.name,gm:u.isGM,enabled:m.enabled??!u.isGM,discordId:m.discordId||"",
          actors:[{id:"",name:"— Not linked —",selected:!actorId},
            ...actors.map(a=>({id:a.id,name:a.name,selected:a.id===actorId}))]};
      })
    };
  }
  _onRender(context,options){
    super._onRender(context,options);
    const form=this.element.querySelector("form.tt-form");
    if(!form)return;
    // Visual style picker: the hidden input is saved by the existing form.
    const styleInput=form.querySelector('input[name="style"]');
    const choices=[...form.querySelectorAll("[data-tt-bubble-style]")];
    const preview=form.querySelector("[data-tt-selected-preview]");
    const previewLabel=form.querySelector("[data-tt-selected-label]");
    for(const button of choices){
      button.addEventListener("click",()=>{
        const style=button.dataset.ttBubbleStyle;
        if(!Object.hasOwn(STYLES,style) || !styleInput)return;
        styleInput.value=style;
        for(const choice of choices){
          const selected=choice.dataset.ttBubbleStyle===style;
          choice.classList.toggle("is-selected",selected);
          choice.setAttribute("aria-pressed",String(selected));
        }
        if(preview){
          preview.className="tt-bubble-preview tt-style-"+style;
          preview.textContent=STYLES[style];
        }
        if(previewLabel)previewLabel.textContent=STYLE_LABELS[style];
      });
    }
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      if(!game.user.isGM)return;
      const f=new FormData(form),old=game.settings.get(ID,"config"),mappings={};
      for(const u of game.users.contents){
        mappings[u.id]={enabled:f.has("enabled:"+u.id),actorId:String(f.get("actor:"+u.id)||""),
          discordId:String(f.get("discord:"+u.id)||"").trim()};
      }
      const value={
        ...old,bridgeEnabled:f.has("bridgeEnabled"),
        bridgeUrl:String(f.get("bridgeUrl")||DEFAULT.bridgeUrl).trim(),
        style:STYLES[f.get("style")]?f.get("style"):"speech",
        position:POSITIONS.includes(f.get("position"))?f.get("position"):"above",
        scale:Math.max(.5,Math.min(3,Number(f.get("scale"))||1)),
        holdMs:Math.max(300,Math.min(10000,Number(f.get("holdMs"))||2200)),
        showForGM:f.has("showForGM"),mappings
      };
      await game.settings.set(ID,"config",value);
      Tokens.restartBridge();
      ui.notifications.info("Talking Tokens settings saved.");
      this.close();
    });
    form.querySelectorAll("[data-test-user]").forEach(button=>button.addEventListener("click",()=>{
      const row=button.closest(".tt-user");
      const actorId=row?.querySelector("select[name^='actor:']")?.value || "";
      Tokens.test(button.dataset.testUser,actorId,styleInput?.value||"");
    }));
  }
}

class Tokens{
  static elements=new Map();
  static bridge=null;
  static retry=null;
  static frame=0;
  static config(){return game.settings.get(ID,"config");}
  static open(){if(!game.user.isGM)return;new Settings().render({force:true});}
  static relay(userId,speaking){
    if(!game.user.isGM)return;
    const payload={type:"speaking",userId,speaking:Boolean(speaking)};
    this.handle(payload);
    game.socket.emit(CH,payload);
  }
  static fromBridge(message){
    if(!game.user.isGM||message?.type!=="speaking")return;
    const cfg=this.config();
    let id=message.userId&&game.users.has(message.userId)?message.userId:null;
    if(!id&&message.discordId){
      id=Object.entries(cfg.mappings||{}).find(([,m])=>m.discordId&&m.discordId===String(message.discordId))?.[0];
    }
    if(!id&&message.playerName){
      id=game.users.contents.find(u=>u.name.toLowerCase()===String(message.playerName).toLowerCase())?.id;
    }
    if(id)this.relay(id,message.speaking);
  }
  static findToken(actorId) {
    if(!canvas?.ready || !actorId) return null;
    // TokenDocument.actorId remains tied to the world Actor, including unlinked tokens.
    const tokens=canvas.tokens?.placeables || [];
    const matches=t=>t.document?.actorId===actorId || t.actor?.id===actorId;
    return tokens.find(t=>matches(t) && t.visible!==false)
      || tokens.find(matches) || null;
  }
  static show(id,token,holdMs,styleOverride="") {
    const cfg=this.config();
    const style=Object.hasOwn(STYLES,styleOverride)?styleOverride:cfg.style;
    let old=this.elements.get(id);
    if(old && old.token!==token){this.hide(id);old=null;}
    if(!old){
      const el=document.createElement("div");
      el.setAttribute("aria-hidden","true");
      document.body.append(el);
      old={el,token,timer:null};
      this.elements.set(id,old);
    }
    old.el.className="tt-speaking tt-style-"+style;
    old.el.textContent=STYLES[style]||STYLES.speech;
    old.el.style.setProperty("--tt-scale",String(cfg.scale));
    clearTimeout(old.timer);
    old.timer=setTimeout(()=>this.hide(id),holdMs??cfg.holdMs??2200);
    this.draw();
    if(!this.frame)this.loop();
  }
  static handle(p){
    if(p?.type!=="speaking")return;
    const cfg=this.config(),u=game.users.get(p.userId);
    if(!u)return;
    const m=cfg.mappings?.[u.id]||{};
    if(!p.speaking||!(m.enabled??!u.isGM)||(u.isGM&&!cfg.showForGM)){
      this.hide(u.id);return;
    }
    const actorId=m.actorId||u.character?.id;
    const token=this.findToken(actorId);
    if(token)this.show(u.id,token);
    else console.debug(ID,"No token in current scene for user",u.name,"actor",actorId);
  }
  static hide(id){
    const it=this.elements.get(id);
    if(!it)return;
    clearTimeout(it.timer);it.el.remove();this.elements.delete(id);
    if(!this.elements.size&&this.frame){cancelAnimationFrame(this.frame);this.frame=0;}
  }
  static clear(){for(const id of [...this.elements.keys()])this.hide(id);}
  static loop(){
    if(!this.elements.size){this.frame=0;return;}
    this.draw();
    this.frame=requestAnimationFrame(()=>this.loop());
  }
  static draw(){
    if(!canvas?.ready) return false;
    // V14 can expose the canvas on app.canvas rather than renderer.canvas.
    const board=canvas.app?.canvas || canvas.app?.view
      || canvas.app?.renderer?.canvas || document.querySelector("canvas#board");
    const rect=board?.getBoundingClientRect?.();
    if(!rect || !rect.width || !rect.height) return false;
    const screen=canvas.app?.renderer?.screen;
    const sx=rect.width/(screen?.width || board.width || rect.width);
    const sy=rect.height/(screen?.height || board.height || rect.height);
    const pos=this.config().position;
    try{
      for(const [id,it] of this.elements){
        const t=it.token;
        if(!t||t.destroyed||!canvas.tokens.placeables.includes(t)){this.hide(id);continue;}
        // Token position in scene pixels; canvas.stage performs world-to-screen conversion.
        const x=t.document.x,y=t.document.y,w=t.w,h=t.h;
        let px=x+w/2,py=y,anchor="above";
        if(pos==="topLeft"){px=x;}else if(pos==="topRight"){px=x+w;}
        else if(pos==="left"){px=x;py=y+h/2;anchor="left";}
        else if(pos==="right"){px=x+w;py=y+h/2;anchor="right";}
        else if(pos==="below"){py=y+h;anchor="below";}
        const p=canvas.stage.toGlobal({x:px,y:py});
        it.el.style.left=(rect.left+p.x*sx)+"px";
        it.el.style.top=(rect.top+p.y*sy)+"px";
        it.el.dataset.anchor=anchor;
      }
    }catch(error){
      console.error(ID,"Could not position speaking bubbles",error);
      return false;
    }
    return true;
  }
  static test(userId,actorId="",style=""){
    if(!game.user.isGM)return;
    const user=game.users.get(userId);
    const resolved=actorId || this.config().mappings?.[userId]?.actorId || user?.character?.id;
    if(!canvas?.ready){
      ui.notifications.warn("Talking Tokens: Open a scene with the canvas loaded first.");
      return;
    }
    if(!resolved){
      ui.notifications.warn("Talking Tokens: Select an actor for "+(user?.name||"this user")+".");
      return;
    }
    const token=this.findToken(resolved);
    if(!token){
      ui.notifications.warn("Talking Tokens: No token found on this scene for "+(user?.name||"this user")+". Place that actor's token on the scene.");
      return;
    }
    // Test uses the actor currently selected in the form, even before Save.
    // This is a LOCAL preview; real speaker events are synchronized via sockets.
    this.show(userId,token,2200,style);
    if(this.draw())ui.notifications.info("Talking Tokens: Test bubble displayed for "+(user?.name||"player")+".");
    else ui.notifications.error("Talking Tokens: Could not locate the canvas element. See F12 console.");
  }
  static restartBridge(){
    if(!game.user.isGM)return;
    clearTimeout(this.retry);this.retry=null;
    if(this.bridge){this.bridge.onclose=null;this.bridge.close();this.bridge=null;}
    const cfg=this.config();
    if(!cfg.bridgeEnabled)return;
    if(!/^wss?:\/\//i.test(cfg.bridgeUrl)){
      ui.notifications.warn("Bridge URL must begin with ws:// or wss://");
      return;
    }
    try{
      const ws=new WebSocket(cfg.bridgeUrl);this.bridge=ws;
      ws.onopen=()=>console.info(ID,"Bridge connected");
      ws.onmessage=e=>{try{this.fromBridge(JSON.parse(e.data));}catch(err){console.warn(ID,"Invalid bridge message",err);}};
      ws.onerror=()=>console.warn(ID,"Bridge connection failed");
      ws.onclose=()=>{
        if(this.bridge!==ws)return;
        this.bridge=null;
        this.retry=setTimeout(()=>this.restartBridge(),5000);
      };
    }catch(err){console.error(ID,err);}
  }
}

Hooks.once("init",()=>{
  game.settings.register(ID,"config",{name:"Talking Tokens settings",scope:"world",config:false,type:Object,default:DEFAULT});
  game.settings.registerMenu(ID,"settings",{name:"Talking Tokens V14",label:"Open Settings",hint:"Speaker-to-actor mapping and bubble options",
    icon:"fas fa-comments",type:Settings,restricted:true});
});
Hooks.once("ready",()=>{
  game.socket.on(CH,p=>Tokens.handle(p));
  game.modules.get(ID).api={
    openSettings:()=>Tokens.open(),
    test:userId=>Tokens.test(userId),
    setSpeakingForUser:(id,speaking=true)=>Tokens.relay(id,speaking),
    receiveBridgeMessage:m=>Tokens.fromBridge(m)
  };
  Tokens.restartBridge();
});
Hooks.on("canvasTearDown",()=>Tokens.clear());
Hooks.on("getSceneControlButtons",controls=>{
  if(!game.user.isGM||!controls.tokens)return;
  controls.tokens.tools||={};
  controls.tokens.tools["talking-tokens"]={
    name:"talking-tokens",title:"Talking Tokens Settings",
    icon:"fa-solid fa-comment-dots",button:true,visible:true,
    order:Object.keys(controls.tokens.tools).length,
    onChange:()=>Tokens.open()
  };
});
