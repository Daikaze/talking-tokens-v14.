/**
 * Talking Tokens v0.2.4 — direct world-wide Move + Resize bubble editor.
 *
 * Shift+B edits GLOBAL placement and global scale, not merely one token.
 * Optional "This Token" mode stores per-token adjustments in TokenDocument flags.
 * Preview drag/resize values are kept locally until pointerup; then persisted.
 */
const TT_BUBBLE_ID="talking-tokens-v14";
class TalkingBubblePositionEditor {
  static active=null;
  static MAX_OFFSET=10000;
  static MIN_SCALE=.5;
  static MAX_SCALE=3;

  static cfg(){return game.settings.get(TT_BUBBLE_ID,"config");}
  static zoom(){
    const z=Number(canvas.stage?.scale?.x);
    return Number.isFinite(z)&&z>0?z:1;
  }
  static clampScale(v){return Math.max(this.MIN_SCALE,Math.min(this.MAX_SCALE,Math.round(v*20)/20));}
  static offset(o){return {x:Number(o?.x)||0,y:Number(o?.y)||0};}

  static targetToken() {
    if(!canvas?.ready || !game.user?.isGM)return null;
    const selected=canvas.tokens?.controlled||[];
    if(selected.length===1)return selected[0];
    if(selected.length>1)return null;
    const target=game.modules.get(TT_BUBBLE_ID)?.api?.gmNpc?.getTarget?.();
    if(!target || target.sceneId!==canvas.scene?.id)return null;
    return canvas.tokens?.get?.(target.tokenId)
      || canvas.tokens?.placeables?.find(t=>t.document?.id===target.tokenId);
  }

  static isEditingToken(token) {
    return !!this.active && !!token
      && this.active.sceneId===canvas.scene?.id
      && this.active.tokenId===token.document?.id;
  }
  static draftFor(token){return this.isEditingToken(token)?this.active:null;}

  static toggle(){if(this.active){this.close();return true;}return this.openGlobal();}
  static openGlobal(){return this.open("global");}
  static openToken(){return this.open("token");}

  static open(scope="global"){
    if(!game.user?.isGM)return false;
    const token=this.targetToken();
    if(!token?.document || !canvas?.ready){
      ui.notifications.warn("Talking Tokens: Select exactly one token or arm an NPC with Shift+N first.");
      return false;
    }
    this.close();
    const cfg=this.cfg();
    const s=scope==="token"?"token":"global";
    const originalOffset=s==="global"
      ? cfg.globalBubbleOffset
      : token.document.getFlag(TT_BUBBLE_ID,"bubbleOffset");
    const savedTokenScale=Number(token.document.getFlag(TT_BUBBLE_ID,"bubbleScale"));
    const currentScale=s==="global" ? cfg.scale
      : (savedTokenScale>=this.MIN_SCALE&&savedTokenScale<=this.MAX_SCALE?savedTokenScale:cfg.scale);
    const offset=this.offset(originalOffset);
    const bubble=document.createElement("div");
    const style=cfg.style||"speech";
    bubble.className="tt-speaking tt-editor-bubble tt-style-"+style;
    bubble.setAttribute("role","group");
    bubble.setAttribute("aria-label","Move and resize talking bubble preview");
    bubble.title="Drag to move. Drag the lower-right grip to resize.";
    bubble.style.setProperty("--tt-scale",String(currentScale||1));
    if(cfg.imagePath){
      bubble.classList.add("tt-custom-image");
      const img=document.createElement("img");
      img.className="tt-bubble-art";img.src=cfg.imagePath;img.alt="";
      img.draggable=false;
      bubble.append(img);
    } else {
      const text=document.createElement("span");
      text.className="tt-editor-text";
      text.textContent={speech:"● ● ●",chat:"•••",thought:"•••",shout:"!",whisper:"…",emote:"✦"}[style]||"● ● ●";
      bubble.append(text);
    }
    const grip=document.createElement("div");
    grip.className="tt-bubble-resize-grip";
    grip.title="Drag to resize bubble";
    grip.setAttribute("role","button");
    grip.setAttribute("aria-label","Drag to resize bubble");
    bubble.append(grip);
    bubble.addEventListener("pointerdown",e=>this.begin(e,"move"));
    grip.addEventListener("pointerdown",e=>this.begin(e,"resize"));

    const panel=document.createElement("div");
    panel.id="tt-bubble-editor-panel";
    const title=document.createElement("strong");
    title.textContent="Move / Resize Bubble";
    const info=document.createElement("span");
    info.className="tt-editor-info";
    info.textContent="Drag bubble to move • Drag ↘ grip to resize";
    const scopeLabel=document.createElement("label");
    scopeLabel.textContent="Apply to: ";
    const select=document.createElement("select");
    const optionAll=document.createElement("option");
    optionAll.value="global";optionAll.textContent="Global — all bubbles";
    const optionToken=document.createElement("option");
    optionToken.value="token";optionToken.textContent="This token only";
    select.append(optionAll,optionToken);
    select.value=s;
    select.addEventListener("change",()=>this.changeScope(select.value));
    scopeLabel.append(select);
    const percent=document.createElement("strong");
    percent.className="tt-editor-percent";
    const reset=document.createElement("button");
    reset.type="button";reset.textContent="Reset";
    reset.addEventListener("click",()=>void this.reset());
    const done=document.createElement("button");
    done.type="button";done.textContent="Done (Shift+B)";
    done.addEventListener("click",()=>this.close());
    panel.append(title,info,scopeLabel,percent,reset,done);
    document.body.append(bubble,panel);
    this.active={
      sceneId:canvas.scene.id,tokenId:token.document.id,token,
      element:bubble,panel,scope:s,offset,scale:this.clampScale(Number(currentScale)||1),
      drag:null,frame:0,percent,select
    };
    this.updatePreview();
    this.renderFrame();
    ui.notifications.info("Talking Tokens: Editing "+(s==="global"?"GLOBAL bubbles (all tokens).":"this token.")+" Drag to move or use the corner grip to resize.");
    return true;
  }

  static changeScope(scope){
    if(!this.active || this.active.drag)return;
    const entry=this.active;
    const global=scope!=="token";
    const cfg=this.cfg();
    entry.scope=global?"global":"token";
    entry.offset=this.offset(global?cfg.globalBubbleOffset:entry.token.document.getFlag(TT_BUBBLE_ID,"bubbleOffset"));
    const localScale=Number(entry.token.document.getFlag(TT_BUBBLE_ID,"bubbleScale"));
    entry.scale=this.clampScale(global?(Number(cfg.scale)||1):
      (localScale>=this.MIN_SCALE&&localScale<=this.MAX_SCALE?localScale:Number(cfg.scale)||1));
    entry.select.value=entry.scope;
    this.updatePreview();
  }

  static board(){
    const node=canvas.app?.canvas||canvas.app?.view||canvas.app?.renderer?.canvas
      ||document.querySelector("canvas#board");
    const rect=node?.getBoundingClientRect?.();
    if(!rect?.width||!rect?.height)return null;
    const screen=canvas.app?.renderer?.screen;
    return {rect,sx:rect.width/(screen?.width||node.width||rect.width),
      sy:rect.height/(screen?.height||node.height||rect.height)};
  }

  static toWorld(clientX,clientY){
    const b=this.board();
    if(!b)return null;
    try {
      return canvas.stage.toLocal({x:(clientX-b.rect.left)/b.sx,y:(clientY-b.rect.top)/b.sy});
    }catch(e){console.warn(TT_BUBBLE_ID,"Cannot convert coordinates",e);return null;}
  }

  static begin(e,type){
    const entry=this.active;
    if(!entry || e.button!==0)return;
    if(!this.board())return;
    e.preventDefault();e.stopPropagation();
    entry.drag={type,pointerId:e.pointerId,
      clientX:e.clientX,clientY:e.clientY,
      originOffset:this.offset(entry.offset),originScale:entry.scale};
    try{entry.element.setPointerCapture(e.pointerId);}catch(_){}
    entry.element.classList.add("is-dragging");
  }

  static move(e){
    const entry=this.active;
    if(!entry?.drag || e.pointerId!==entry.drag.pointerId)return;
    const drag=entry.drag;
    if(drag.type==="move"){
      // Pointer deltas are already screen pixels. Do not convert through the
      // stage transform or saved offsets will jump with camera zoom.
      const z=this.cfg().zoomBehavior==="scene"?this.zoom():1;
      entry.offset={
        x:Math.max(-this.MAX_OFFSET,Math.min(this.MAX_OFFSET,Math.round(drag.originOffset.x+(e.clientX-drag.clientX)/z))),
        y:Math.max(-this.MAX_OFFSET,Math.min(this.MAX_OFFSET,Math.round(drag.originOffset.y+(e.clientY-drag.clientY)/z)))
      };
    }else{
      // Horizontal-right or diagonal-up drag increases scale.
      const delta=(e.clientX-drag.clientX)-(e.clientY-drag.clientY);
      entry.scale=this.clampScale(drag.originScale+delta/130);
    }
    this.updatePreview();
  }

  static async save(entry){
    try{
      if(entry.scope==="global"){
        // Preserve all other world settings (Discord mappings, bubble styles, etc.).
        const cfg=this.cfg();
        await game.settings.set(TT_BUBBLE_ID,"config",{
          ...cfg,globalBubbleOffset:this.offset(entry.offset),scale:this.clampScale(entry.scale)
        });
        ui.notifications.info("Talking Tokens: GLOBAL bubble position and size saved for all players.");
      } else {
        await entry.token.document.setFlag(TT_BUBBLE_ID,"bubbleOffset",this.offset(entry.offset));
        await entry.token.document.setFlag(TT_BUBBLE_ID,"bubbleScale",this.clampScale(entry.scale));
        ui.notifications.info("Talking Tokens: This token's position and size saved.");
      }
    }catch(error){
      console.error(TT_BUBBLE_ID,"Could not save bubble position/size",error);
      ui.notifications.error("Talking Tokens: Could not save changes.");
    }
  }

  static async release(e){
    const entry=this.active;
    if(!entry?.drag || e.pointerId!==entry.drag.pointerId)return;
    this.move(e);
    entry.drag=null;
    entry.element.classList.remove("is-dragging");
    try{entry.element.releasePointerCapture(e.pointerId);}catch(_){}
    await this.save(entry);
  }

  static async reset(){
    const entry=this.active;
    if(!entry)return;
    entry.drag=null;
    entry.offset={x:0,y:0};
    if(entry.scope==="global"){
      entry.scale=1;
    }else{
      entry.scale=this.clampScale(Number(this.cfg().scale)||1);
      try{
        await entry.token.document.unsetFlag(TT_BUBBLE_ID,"bubbleOffset");
        await entry.token.document.unsetFlag(TT_BUBBLE_ID,"bubbleScale");
        ui.notifications.info("Talking Tokens: Token overrides removed.");
      }catch(error){
        console.error(TT_BUBBLE_ID,error);
        ui.notifications.error("Talking Tokens: Could not reset token overrides.");
      }
      this.updatePreview();
      return;
    }
    this.updatePreview();
    await this.save(entry);
  }

  static updatePreview(){
    const entry=this.active;
    if(!entry)return;
    entry.element.style.setProperty("--tt-scale",String(entry.scale*(this.cfg().zoomBehavior==="scene"?this.zoom():1)));
    entry.percent.textContent=Math.round(entry.scale*100)+"%";
    this.positionPreview();
  }

  static positionPreview(){
    const entry=this.active;
    if(!entry||!canvas?.ready)return;
    if(entry.sceneId!==canvas.scene?.id || !canvas.tokens?.placeables?.includes(entry.token)){
      this.close();return;
    }
    const b=this.board();
    if(!b)return;
    const cfg=this.cfg();
    const token=entry.token;
    const x=token.document.x,y=token.document.y,w=token.w,h=token.h;
    let px=x+w/2,py=y,anchor="above";
    if(cfg.position==="topLeft")px=x;
    else if(cfg.position==="topRight")px=x+w;
    else if(cfg.position==="left"){px=x;py=y+h/2;anchor="left";}
    else if(cfg.position==="right"){px=x+w;py=y+h/2;anchor="right";}
    else if(cfg.position==="below"){py=y+h;anchor="below";}
    const global=entry.scope==="global"?entry.offset:this.offset(cfg.globalBubbleOffset);
    const local=entry.scope==="token"?entry.offset:this.offset(token.document.getFlag(TT_BUBBLE_ID,"bubbleOffset"));
    const p=canvas.stage.toGlobal({x:px,y:py});
    const z=cfg.zoomBehavior==="scene"?this.zoom():1;
    entry.element.style.left=(b.rect.left+p.x*b.sx+(global.x+local.x)*z)+"px";
    entry.element.style.top=(b.rect.top+p.y*b.sy+(global.y+local.y)*z)+"px";
    // Keep the editor preview consistent if zoom changes while editing.
    entry.element.style.setProperty("--tt-scale",String(entry.scale*z));
    entry.element.dataset.anchor=anchor;
  }

  static renderFrame(){
    if(!this.active)return;
    this.positionPreview();
    if(this.active)this.active.frame=requestAnimationFrame(()=>this.renderFrame());
  }

  static close(){
    const entry=this.active;
    if(!entry)return;
    this.active=null;
    if(entry.frame)cancelAnimationFrame(entry.frame);
    entry.element.remove();
    entry.panel.remove();
  }
}

Hooks.once("init",()=>{
  game.keybindings.register(TT_BUBBLE_ID,"moveBubble",{
    name:"GM — Move / Resize ALL Talking Bubbles",
    hint:"Select one token as a preview and press Shift+B. Changes default to Global (all tokens).",
    editable:[{key:"KeyB",modifiers:[foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.SHIFT]}],
    restricted:true,repeat:false,
    onDown:()=>TalkingBubblePositionEditor.toggle()
  });
});
Hooks.once("ready",()=>{
  const api=game.modules.get(TT_BUBBLE_ID)?.api;
  if(!api)return;
  api.bubbleEditor={
    toggle:()=>TalkingBubblePositionEditor.toggle(),
    openGlobal:()=>TalkingBubblePositionEditor.openGlobal(),
    openToken:()=>TalkingBubblePositionEditor.openToken(),
    close:()=>TalkingBubblePositionEditor.close(),
    reset:()=>TalkingBubblePositionEditor.reset(),
    isEditingToken:t=>TalkingBubblePositionEditor.isEditingToken(t),
    draftFor:t=>TalkingBubblePositionEditor.draftFor(t)
  };
  window.addEventListener("pointermove",e=>TalkingBubblePositionEditor.move(e));
  window.addEventListener("pointerup",e=>void TalkingBubblePositionEditor.release(e));
  window.addEventListener("pointercancel",e=>void TalkingBubblePositionEditor.release(e));
  window.addEventListener("blur",()=>{if(TalkingBubblePositionEditor.active?.drag)TalkingBubblePositionEditor.close();});
  Hooks.on("canvasTearDown",()=>TalkingBubblePositionEditor.close());
});
