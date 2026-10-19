import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");

function sandbox() {
  const errors = [];
  const nodes = [];
  const config = {
    style: "speech", position: "above", scale: 1.75, zoomBehavior:"fixed", holdMs: 2200,
    animation: "pulse", globalBubbleOffset: {x: 25, y: -18},
    mappings: {player: {enabled: true, actorId: "actor1"}}
  };
  const token = {
    document: {id:"tok1", actorId:"actor1", x:100, y:200,
      getFlag(_scope, key) {
        return key === "bubbleOffset" ? {x: 10, y: 5} : undefined;
      }},
    actor: {id:"actor1"}, w:100, h:100, visible:true, destroyed:false
  };
  const scene = {id:"scene1"};
  const canvas = {
    ready:true,scene,
    tokens:{placeables:[token],get:id=>id==="tok1"?token:null},
    app:{
      canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})},
      renderer:{screen:{width:1000,height:800}}
    },
    stage:{scale:{x:1},toGlobal:p=>({x:p.x*canvas.stage.scale.x,y:p.y*canvas.stage.scale.x})}
  };
  const listeners = {};
  const Hooks = {
    once:(event, cb)=>(listeners[event]??=[]).push(cb),
    on:(event, cb)=>(listeners[event]??=[]).push(cb),
    call:(event,...args)=>!(listeners[event]||[]).some(cb=>cb(...args)===false)
  };
  const createElement = tag => ({
    tag,style:{setProperty(k,v){this[k]=v}},dataset:{},className:"",
    classList:{add(){}},setAttribute(){},replaceChildren(){},
    remove(){}
  });
  const document = {
    createElement,body:{append(el){nodes.push(el)}},
    querySelectorAll:()=>[],querySelector:()=>null
  };
  const module = {};
  const game = {
    user:{id:"gm",isGM:true},
    users:{
      get:id=>id==="player"?{id,isGM:false,character:{id:"actor1"}}:null,
      has:id=>id==="player",contents:[{id:"player",name:"Player",character:{id:"actor1"},isGM:false}]
    },
    actors:{contents:[]},modules:{get:()=>module},
    settings:{get:()=>config,register(){},registerMenu(){}},
    socket:{on(){},emit(){}}
  };
  const foundry = {
    applications:{api:{
      ApplicationV2:class {},
      HandlebarsApplicationMixin:Base=>Base
    }}
  };
  const ui = {notifications:{info(){},warn(){},error(){}}};
  const ctx = vm.createContext({
    Hooks,game,canvas,document,foundry,ui,
    WebSocket:class {},
    console:{error:(...values)=>errors.push(values.join(" ")),warn(){},debug(){},info(){}},
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    setTimeout:()=>1,clearTimeout(){}
  });
  vm.runInContext(source, ctx, {filename:"scripts/main.js"});
  for(const cb of listeners.init||[])cb();
  for(const cb of listeners.ready||[])cb();
  return {module,config,token,nodes,errors,canvas};
}

test("player voice draws using global offset and scale",()=>{
  const v=sandbox();
  v.module.api.setSpeakingForUser("player",true);
  assert.equal(v.nodes.length,1);
  const node=v.nodes[0];
  assert.equal(node.style.left,"185px"); // token center 150 + global 25 + token 10
  assert.equal(node.style.top,"187px");  // token top 200 - global 18 + token 5
  assert.equal(node.style["--tt-scale"],"1.75");
  assert.deepEqual(v.errors,[]);
});

test("GM → NPC socket draws using global offset and scale",()=>{
  const v=sandbox();
  v.module.api.handleNpcSpeaking({
    type:"npc-speaking",sceneId:"scene1",tokenId:"tok1",speaking:true
  });
  assert.equal(v.nodes.length,1);
  assert.equal(v.nodes[0].style.left,"185px");
  assert.equal(v.nodes[0].style.top,"187px");
  assert.deepEqual(v.errors,[]);
});

test("global configuration changes move an already visible bubble",()=>{
  const v=sandbox();
  v.module.api.handleNpcSpeaking({
    type:"npc-speaking",sceneId:"scene1",tokenId:"tok1",speaking:true
  });
  v.config.globalBubbleOffset={x:-20,y:40};
  v.module.api.handleNpcSpeaking({
    type:"npc-speaking",sceneId:"scene1",tokenId:"tok1",speaking:true
  });
  assert.equal(v.nodes[0].style.left,"140px");
  assert.equal(v.nodes[0].style.top,"245px");
  assert.deepEqual(v.errors,[]);
});


test("fixed-size bubbles keep CSS scale and 35px offset when zooming the map",()=>{
  const v=sandbox();
  v.module.api.handleNpcSpeaking({
    type:"npc-speaking",sceneId:"scene1",tokenId:"tok1",speaking:true
  });
  const node=v.nodes[0];
  v.canvas.stage.scale.x=2;
  v.module.api.handleNpcSpeaking({
    type:"npc-speaking",sceneId:"scene1",tokenId:"tok1",speaking:true
  });
  assert.equal(node.style.left,"335px"); // 2*150 + 35 CSS px
  assert.equal(node.style.top,"387px");  // 2*200 - 13 CSS px
  assert.equal(node.style["--tt-scale"],"1.75"); // not 3.5
  v.canvas.stage.scale.x=.5;
  v.module.api.handleNpcSpeaking({
    type:"npc-speaking",sceneId:"scene1",tokenId:"tok1",speaking:true
  });
  assert.equal(node.style.left,"110px");
  assert.equal(node.style.top,"87px");
  assert.equal(node.style["--tt-scale"],"1.75");
  assert.deepEqual(v.errors,[]);
});

test("follow-map mode scales bubble and offsets with camera zoom",()=>{
  const v=sandbox();
  v.config.zoomBehavior="scene";
  v.canvas.stage.scale.x=2;
  v.module.api.handleNpcSpeaking({
    type:"npc-speaking",sceneId:"scene1",tokenId:"tok1",speaking:true
  });
  assert.equal(v.nodes[0].style.left,"370px"); // 2*(150+35)
  assert.equal(v.nodes[0].style.top,"374px");  // 2*(200-13)
  assert.equal(v.nodes[0].style["--tt-scale"],"3.5");
  assert.deepEqual(v.errors,[]);
});
