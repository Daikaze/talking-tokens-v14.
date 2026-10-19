/**
 * Talking Tokens v0.2.3 — GM-only bubble position editor
 * Shift+B toggles editing for the selected token, or the armed GM NPC.
 * Drag the visible bubble preview. Offset is saved on the placed TokenDocument.
 */
const TT_BUBBLE_ID="talking-tokens-v14";
class TalkingBubblePositionEditor {
  static active=null; // {sceneId,tokenId,token,element,panel,offset,drag,frame}
  static MAX_OFFSET=10000;

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
    return !!this.active && !!token &&
      this.active.sceneId===canvas.scene?.id && this.active.tokenId===token.document?.id;
  }
  static draftFor(token) {
    return this.isEditingToken(token) ? this.active.offset : null;
  }

  static toggle() {
    if(!game.user?.isGM)return false;
    if(this.active){this.close();return true;}
    const token=this.targetToken();
    if(!token?.document || !canvas?.ready){
      ui.notifications.warn("Talking Tokens: Select one token (or arm one NPC with Shift+N) before moving a bubble.");
      return false;
    }
    this.open(token);
    return true;
  }

  static open(token) {
    this.close();
    const previous=token.document.getFlag(TT_BUBBLE_ID,"bubbleOffset")||{};
    const offset={x:Number(previous.x)||0,y:Number(previous.y)||0};
    const bubble=document.createElement("div");
    const cfg=game.settings.get(TT_BUBBLE_ID,"config");
    const style=cfg.style||"speech";
    bubble.className="tt-speaking tt-editor-bubble tt-style-"+style;
    bubble.setAttribute("role","button");
    bubble.setAttribute("tabindex","0");
    bubble.setAttribute("aria-label","Drag to position the token speech bubble");
    bubble.title="Drag this bubble to the desired position";
    bubble.style.setProperty("--tt-scale",String(cfg.scale||1));
    if(cfg.imagePath){
      bubble.classList.add("tt-custom-image");
      const img=document.createElement("img");
      img.className="tt-bubble-art";
      img.src=cfg.imagePath;img.alt="";
      bubble.replaceChildren(img);
    } else {
      bubble.textContent={speech:"● ● ●",chat:"•••",thought:"•••",shout:"!",whisper:"…",emote:"✦"}[style]||"● ● ●";
    }
    bubble.addEventListener("pointerdown",event=>this.startDrag(event));
    const panel=document.createElement("div");
    panel.id="tt-bubble-editor-panel";
    const label=document.createElement("strong");
    label.textContent="Move bubble: "+(token.document.name||token.actor?.name||"Token");
    const sub=document.createElement("span");
    sub.textContent="Drag the bubble • position saves when released";
    const reset=document.createElement("button");
    reset.type="button";reset.textContent="Reset position";
    reset.addEventListener("click",()=>void this.reset());
    const done=document.createElement("button");
    done.type="button";done.textContent="Done (Shift+B)";
    done.addEventListener("click",()=>this.close());
    panel.append(label,sub,reset,done);
    document.body.append(bubble,panel);
    this.active={sceneId:canvas.scene.id,tokenId:token.document.id,token,element:bubble,panel,offset,drag:null,frame:0};
    this.renderFrame();
    ui.notifications.info("Talking Tokens: Drag the bubble, then press Shift+B or Done.");
  }

  static toWorld(clientX,clientY) {
    const canvasElement=canvas.app?.canvas||canvas.app?.view||canvas.app?.renderer?.canvas
      ||document.querySelector("canvas#board");
    const rect=canvasElement?.getBoundingClientRect?.();
    if(!rect?.width || !rect?.height)return null;
    const renderer=canvas.app?.renderer?.screen;
    const factorX=rect.width/(renderer?.width||canvasElement.width||rect.width);
    const factorY=rect.height/(renderer?.height||canvasElement.height||rect.height);
    return canvas.stage.toLocal({
      x:(clientX-rect.left)/factorX,y:(clientY-rect.top)/factorY
    });
  }

  static startDrag(e) {
    if(!this.active || e.button!==0)return;
    const world=this.toWorld(e.clientX,e.clientY);
    if(!world)return;
    e.preventDefault();e.stopPropagation();
    this.active.drag={pointerId:e.pointerId,x:world.x,y:world.y,
      originalX:this.active.offset.x,originalY:this.active.offset.y};
    try{this.active.element.setPointerCapture(e.pointerId);}catch(_){}
    this.active.element.classList.add("is-dragging");
  }

  static move(e) {
    if(!this.active?.drag || e.pointerId!==this.active.drag.pointerId)return;
    const world=this.toWorld(e.clientX,e.clientY);
    if(!world)return;
    const {x,y,originalX,originalY}=this.active.drag;
    const cap=this.MAX_OFFSET;
    this.active.offset={
      x:Math.max(-cap,Math.min(cap,Math.round(originalX+world.x-x))),
      y:Math.max(-cap,Math.min(cap,Math.round(originalY+world.y-y)))
    };
    this.positionPreview();
  }

  static async release(e) {
    if(!this.active?.drag || e.pointerId!==this.active.drag.pointerId)return;
    const entry=this.active;
    this.move(e);
    entry.drag=null;
    entry.element.classList.remove("is-dragging");
    try{entry.element.releasePointerCapture(e.pointerId);}catch(_){}
    try{
      await entry.token.document.setFlag(TT_BUBBLE_ID,"bubbleOffset",{
        x:entry.offset.x,y:entry.offset.y
      });
      ui.notifications.info("Talking Tokens: Saved bubble position for "+(entry.token.document.name||"token")+".");
    }catch(error){
      console.error(TT_BUBBLE_ID,"Bubble offset save failed",error);
      ui.notifications.error("Talking Tokens: Could not save bubble position. Check token permission.");
    }
  }

  static async reset() {
    if(!this.active)return;
    const entry=this.active;
    entry.offset={x:0,y:0};
    this.positionPreview();
    try{
      await entry.token.document.unsetFlag(TT_BUBBLE_ID,"bubbleOffset");
      ui.notifications.info("Talking Tokens: Restored default bubble position.");
    }catch(error){
      console.error(TT_BUBBLE_ID,"Bubble reset failed",error);
      ui.notifications.error("Talking Tokens: Could not reset bubble position.");
    }
  }

  static positionPreview() {
    const entry=this.active;
    if(!entry||!canvas?.ready)return;
    if(canvas.scene?.id!==entry.sceneId || !canvas.tokens?.placeables?.includes(entry.token)){
      this.close();return;
    }
    const canvasElement=canvas.app?.canvas||canvas.app?.view||canvas.app?.renderer?.canvas
      ||document.querySelector("canvas#board");
    const rect=canvasElement?.getBoundingClientRect?.();
    if(!rect?.width||!rect?.height)return;
    const screen=canvas.app?.renderer?.screen;
    const factorX=rect.width/(screen?.width||canvasElement.width||rect.width);
    const factorY=rect.height/(screen?.height||canvasElement.height||rect.height);
    const t=entry.token;
    const x=t.document.x,y=t.document.y,w=t.w,h=t.h;
    const pos=game.settings.get(TT_BUBBLE_ID,"config").position;
    let px=x+w/2,py=y,anchor="above";
    if(pos==="topLeft"){px=x;}
    else if(pos==="topRight"){px=x+w;}
    else if(pos==="left"){px=x;py=y+h/2;anchor="left";}
    else if(pos==="right"){px=x+w;py=y+h/2;anchor="right";}
    else if(pos==="below"){py=y+h;anchor="below";}
    px+=entry.offset.x;
    py+=entry.offset.y;
    const pt=canvas.stage.toGlobal({x:px,y:py});
    entry.element.style.left=(rect.left+pt.x*factorX)+"px";
    entry.element.style.top=(rect.top+pt.y*factorY)+"px";
    entry.element.dataset.anchor=anchor;
  }

  static renderFrame() {
    if(!this.active)return;
    this.positionPreview();
    if(this.active)this.active.frame=requestAnimationFrame(()=>this.renderFrame());
  }

  static close() {
    if(!this.active)return;
    const entry=this.active;
    this.active=null;
    if(entry.frame)cancelAnimationFrame(entry.frame);
    entry.element.remove();
    entry.panel.remove();
  }
}

Hooks.once("init",()=>{
  game.keybindings.register(TT_BUBBLE_ID,"moveBubble",{
    name:"GM — Move Token Talking Bubble",
    hint:"Select a token and press Shift+B to drag its talking bubble, then save automatically on release.",
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
    close:()=>TalkingBubblePositionEditor.close(),
    reset:()=>TalkingBubblePositionEditor.reset(),
    isEditingToken:t=>TalkingBubblePositionEditor.isEditingToken(t),
    draftFor:t=>TalkingBubblePositionEditor.draftFor(t)
  };
  // Capturing on window means dragging works even when the pointer leaves the bubble.
  window.addEventListener("pointermove",e=>TalkingBubblePositionEditor.move(e));
  window.addEventListener("pointerup",e=>void TalkingBubblePositionEditor.release(e));
  window.addEventListener("pointercancel",e=>void TalkingBubblePositionEditor.release(e));
  window.addEventListener("blur",()=>{if(TalkingBubblePositionEditor.active?.drag)TalkingBubblePositionEditor.close();});
  Hooks.on("canvasTearDown",()=>TalkingBubblePositionEditor.close());
});
