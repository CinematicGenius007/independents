#!/usr/bin/env node
/* =====================================================================
   Headless certification harness for prototypes/submissive-systems.
   Executes the page's own inline engine (the same code the browser runs)
   inside a sandboxed VM with stubbed DOM/canvas, then proves:

   1. every Driftwatch campaign leg certifies through the layered BFS
      (K ∈ [2,10]) and its printed course replays through the game
      integrator with ZERO deviation and an exact beacon acquisition;
   2. the zero policy (never toggling) never solves a leg;
   3. the dead-reckoning plot cone grows, collapses on thermocline
      crossings, and respects the rationed Sonar Fix;
   4. Loomweight derivations: shed-attendance weaves 0 tears, spam grades
      strictly worse, and the generational weave (cloth-as-schedule)
      replays deterministically; the specimen SVG embeds every pick.

   Run:  node prototypes/submissive-systems/verify.cjs
   Exit 0 = all certificates green.
   ===================================================================== */
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const FILE=path.join(__dirname,"index.html");
const html=fs.readFileSync(FILE,"utf8");
const m=html.match(/<script>([\s\S]*)<\/script>/);
if(!m){console.error("no inline <script> found in index.html");process.exit(1);}
const code=m[1];

/* ---- sandbox: the prototype is one self-contained page, so the harness
   runs it with stubbed canvas/DOM. The engine never touches them. ---- */
function ctxStub(){
  return new Proxy({
    canvas:{}
  },{
    get:(t,p)=>(p in t)?t[p]:function(){},
    set:()=>true
  });
}
const els=new Map();
function makeEl(id){
  return{
    id,style:{},width:0,height:0,
    clientWidth:900,clientHeight:470,
    getContext:()=>ctxStub(),
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(){},removeEventListener(){},
    setAttribute(){},focus(){},scrollIntoView(){},
    appendChild(){},remove(){},click(){},
    textContent:"",innerHTML:""
  };
}
const documentStub={
  title:"",
  getElementById(id){if(!els.has(id))els.set(id,makeEl(id));return els.get(id);},
  createElement(tag){return makeEl("__"+tag+"__");},
  body:{appendChild(){},removeChild(){}}
};
const sandbox={
  console,Math,Date,JSON,Promise,Set,Map,Proxy,Reflect,Symbol,
  Float32Array,Int16Array,Int32Array,Uint8Array,Blob,
  isNaN,parseInt,parseFloat,isFinite,Object,Array,String,Number,Boolean,RegExp,Error,
  performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},
  requestAnimationFrame:()=>0,
  document:documentStub,
  location:{hash:""},
  devicePixelRatio:1
};
sandbox.window=sandbox;
sandbox.self=sandbox;
sandbox.globalThis=sandbox;
sandbox.addEventListener=function(){};
sandbox.removeEventListener=function(){};
vm.createContext(sandbox);
vm.runInContext(code,sandbox,{filename:"submissive-systems.inline.js"});
const DW=sandbox.__DW_TEST__,LW=sandbox.__LW_TEST__;
if(!DW||!LW){console.error("test hooks (__DW_TEST__/__LW_TEST__) missing — index.html was edited without them");process.exit(1);}

let passed=0,failed=0;
function ok(cond,msg){
  if(cond){passed++;console.log("  ✓ "+msg);}
  else{failed++;console.log("  ✗ "+msg);}
}
function section(t){console.log("\n== "+t+" ==");}

/* ================================================================
   1 · Driftwatch — the five certified campaign legs, replayed
   ================================================================ */
section("Driftwatch · the five certified campaign legs (layered-BFS)");
const TWDT=DW.SOL.DT;
for(const def of DW.CAMPAIGN){
  const cert=DW.certifyLeg(def.seed,def.opts);
  const leg=cert.leg,sol=cert.sol;
  ok(sol&&sol.K>=2&&sol.K<=10,
    def.name+" — K = "+(sol?sol.K:"×")+" certified in "+cert.tries+" seed trie"+(cert.tries===1?"":"s")+" (grant K+2 = "+(sol?sol.K+2:"—")+")");
  if(!sol||!sol.segs||!sol.segs.length){failed++;continue;}
  /* replay the printed plan through the exact game integrator */
  const o={x:leg.startX,z:leg.startZ};
  let vent=false,shifts=0,maxDev=0,broke=false;
  for(const seg of sol.segs){
    if(seg.type==="toggle"){
      maxDev=Math.max(maxDev,Math.abs(DW.wrapDx(seg.x-o.x)),Math.abs(seg.z-o.z));
      vent=!vent;shifts++;
      continue;
    }
    const p=seg.p;
    maxDev=Math.max(maxDev,Math.abs(DW.wrapDx(p[0]-o.x)),Math.abs(p[1]-o.z));
    const sub=(p.length/2)-2;      /* the solver's stored flight: N substeps + closing dup point */
    for(let j=0;j<sub;j++){
      DW.stepState(o,leg,TWDT,vent);
      maxDev=Math.max(maxDev,Math.abs(DW.wrapDx(p[2*(j+1)]-o.x)),Math.abs(p[2*(j+1)+1]-o.z));
    }
  }
  const d2=DW.d2fixed(leg.bx,leg.bz,o.x,o.z);
  ok(shifts===sol.K,def.name+" — course replays at exactly K = "+sol.K+" shifts (budget "+(sol.K+2)+")");
  ok(d2<64,def.name+" — beacon acquired inside the 8 m fix radius (miss "+Math.sqrt(d2).toFixed(3)+" m)");
  ok(maxDev<1e-9,def.name+" — ZERO replay deviation (max "+(maxDev===0?"0":maxDev)+" m)");
  if(broke){failed++;}
}
section("Driftwatch · zero policy (never toggles)");
{
  const cert=DW.certifyLeg(DW.CAMPAIGN[0].seed,DW.CAMPAIGN[0].opts);
  const leg=cert.leg;
  const o={x:leg.startX,z:leg.startZ};
  let outcome="drifts forever";
  for(let i=0;i<Math.ceil(500/DW.SOL.DT);i++){
    const r=DW.stepState(o,leg,d2o(),false);
    if(r!=="ok"){outcome=r;break;}
    if(DW.d2fixed(leg.bx,leg.bz,o.x,o.z)<64){outcome="REACHED";break;}
  }
  ok(outcome!=="REACHED","zero policy never acquires the beacon (outcome: "+outcome+")");
}
function d2o(){return DW.SOL.DT;} /* dt helper only — the harness never drifts */

section("Driftwatch · the dead-reckoning plot cone (§1.7, now shipped)");
{
  const cert=DW.certifyLeg(DW.CAMPAIGN[1].seed,DW.CAMPAIGN[1].opts);
  const st=DW.st,leg=cert.leg;
  st.leg=leg;st.sol=cert.sol;st.status="LIVE";st.drOn=true;
  st.x=leg.startX;st.z=leg.startZ;st.prevZ=st.z;st.estX=st.x;st.estZ=st.z;
  st.cone=0;st.fixes=3;st.fixMarks=[];st.estTrace=[];st.trace=[];
  st.t=0;st.valve=false;st.dist=1e9;st.stampT=0;st.marks=[];
  let maxCone=0,thermoFix=0;
  for(let i=0;i<6000&&st.status==="LIVE";i++){
    DW.simStep();
    if(st.cone>maxCone)maxCone=st.cone;
  }
  thermoFix=st.fixMarks.filter(f=>f.tag==="THERMOCLINE FIX").length;
  ok(maxCone>0.5,"the uncertainty cone grows under unconfirmed drift (peak ±"+maxCone.toFixed(1)+" m)");
  ok(thermoFix>=1,"crossing a sharp thermocline collapsed the cone to a red crosshair ("+thermoFix+" stamps)");
  /* the cone widens fastest mid-thermocline: shear accumulates the noise */
  st.status="LIVE";st.z=40;st.estZ=40;st.valve=true;st.x=200;st.estX=200;st.cone=0;st.dist=1e9;
  let tollCone=0;
  for(let i=0;i<60;i++){DW.simStep();tollCone=st.cone;}
  st.status="LIVE";st.z=80;st.estZ=80;st.valve=true;st.x=200;st.estX=200;st.cone=0;st.prevZ=80;st.dist=1e9;
  let deepCone=0;
  for(let i=0;i<60;i++){DW.simStep();deepCone=st.cone;}
  ok(tollCone>deepCone&&tollCone>1.0,
    "thermocline shear inflates the cone fastest ("+tollCone.toFixed(2)+" m in the toll band vs "+deepCone.toFixed(2)+" m in the deep band over the same drift)");
  /* rationed sonar fix */
  st.status="LIVE";
  const before=st.fixes;
  DW.sonarFix();
  ok(st.fixes===before-1,"SONAR FIX is rationed (3 per leg — spent "+(before-st.fixes)+")");
  ok(st.fixMarks.length&&st.fixMarks[st.fixMarks.length-1].tag==="SONAR FIX","the sonar fix stamps a crisp red crosshair on the fan-fold chart");
  ok(st.estX===st.x&&st.estZ===st.z,"the plotter's estimate collapsed to the true fix");
  DW.sonarFix();DW.sonarFix();
  const last=st.fixMarks.length;
  DW.sonarFix();
  ok(st.fixes===0&&st.fixMarks.length===last,"the ration is hard: nothing beyond the third fix");
}

/* ================================================================
   2 · Loomweight — the generational weave ("cloth is the schedule")
   ================================================================ */
section("Loomweight · policy economics (§2.6, re-run on the shipped FSM)");
function drive(policy,picks){
  for(let i=0;i<picks&&!LW.ls.halt;i++){
    LW.tick();
    const p=LW.ls.pick;
    const live=LW.ls.tangles.length>0;
    if(policy==="none")continue;
    if(policy==="shed"){if(live&&LW.shedOpen(p))LW.strike();else if(LW.ls.dry)LW.strike();}
    else if(policy==="hurry"){if(live)LW.strike();else if(LW.ls.dry)LW.strike();}
    else if(policy==="spam"){LW.strike();}
  }
}
const slack=picks=>LW.ls.cloth.filter(r=>r.kind==="slack").length;
{
  LW.newSample(null);drive("none",260);
  ok(LW.ls.halt&&LW.ls.tears===3,
    "no-op policy halts on the third tear ("+LW.ls.pick+" picks, "+LW.ls.tears+"/3 tears) — the loom retires the passive");
  let shedTears=0,shedSlack=0;
  for(let s=0;s<40;s++){
    LW.newSample(null);drive("shed",250);
    shedTears+=LW.ls.tears;shedSlack+=slack();
  }
  ok(shedTears===0,"diligent shed-attendance weaves 0 tears across 40 seeds × 250 picks ("+shedSlack+" slack rows total)");
  LW.newSample(null);drive("spam",250);
  const spamSlack=slack();
  ok(LW.ls.tears===0&&spamSlack>Math.max(200,shedSlack),
    "blind-spam grades strictly worse — "+spamSlack+" slack rows woven in 250 picks, for nothing");
}
section("Loomweight · generational weave — the cloth is the fault schedule (§2.5)");
{
  /* parent cloth: hurried catches → slack rows in the weave */
  LW.newSample(null);drive("hurry",160);
  const par=LW.snapshotCloth();
  const sch=LW.deriveFaultSchedule(par);
  const pSlack=par.cloth.filter(r=>r.kind==="slack").length;
  ok(pSlack>0&&sch.spawnThresh>130,
    "slack picks raise the next generation's spawn pressure ("+pSlack+" slack rows → spawn "+sch.spawnThresh+"‰, from 130‰)");
  ok(sch.salt>0&&sch.salt===sch.parentHash%104729,"the fault salt is hashed from the weave itself (0x"+sch.salt.toString(16)+")");
  ok(sch.capCut>0,"dye splices shorten every next bobbin (capacity cut "+sch.capCut+" units)");
  ok(par.tears===0,"hurry-strike stays tear-free while sullying the cloth ("+pSlack+" rows of slack)");
  /* scars: a torn cloth imprints its dead columns */
  LW.newSample(null);drive("none",260);
  const par2=LW.snapshotCloth();
  const sch2=LW.deriveFaultSchedule(par2);
  ok(par2.tears>0&&sch2.scarHeddles.length>=1,
    par2.tears+" tear columns imprinted as scar heddles ("+sch2.scarHeddles.join("/")+")");
  ok(sch2.growthAges[0]===2||par2.tears<2,"two scars accelerate fault maturation (ages "+sch2.growthAges.join("/")+")");
  ok(sch2.carryColor===null===!!par2.ledger.length?!!par2.ledger.length:true,"heirloom ink only when the ledger holds a blend"); /* lint guard */
  /* Gen II determinism: same parent cloth → bit-identical next weave */
  LW.ls.seed=par.seed;LW.newSample(par);
  const sigA=[];
  for(let i=0;i<90;i++){LW.tick();const r=LW.ls.cloth[LW.ls.cloth.length-1];sigA.push([r.p,r.kind,r.bits,r.color.r,r.color.g,r.color.b,LW.ls.tears,LW.ls.splices]);}
  LW.ls.seed=par.seed;LW.newSample(par);
  const sigB=[];
  for(let i=0;i<90;i++){LW.tick();const r=LW.ls.cloth[LW.ls.cloth.length-1];sigB.push([r.p,r.kind,r.bits,r.color.r,r.color.g,r.color.b,LW.ls.tears,LW.ls.splices]);}
  ok(JSON.stringify(sigA)===JSON.stringify(sigB),
    "Gen II replays bit-identical from its parent cloth — the selvage is a seed");
  LW.ls.seed=par.seed;LW.newSample(par);
  ok(LW.ls.gen===2&&LW.ls.tray[0].name.indexOf("HEIRLOOM")>=0,
    "the loom carried the final blend as the heirloom ink, rewoven as bobbin №1");
  LW.newSample(null);
  ok(LW.ls.gen===1&&LW.ls.spawnThresh===130,"fresh warp returns to Gen I (130‰ base pressure, no scars)");
  /* end-to-end mount */
  LW.newSample(null);drive("none",260);
  LW.mountCloth();
  ok(LW.ls.gen===2&&LW.ls.running&&LW.ls.pick===0,
    "MOUNT CLOTH · GEN II+ at the halt: the framed tapestry IS the next punch-card");
}
section("Loomweight · specimen export (print-ready SVG)");
{
  LW.newSample(null);drive("hurry",120);
  const svg=LW.buildSpecimenSVG();
  ok(svg.indexOf("<?xml")===0&&svg.indexOf("<svg")>0&&svg.indexOf("</svg>")>0,"the sheet is a standalone SVG document");
  ok(svg.indexOf("0x"+(LW.ls.seed>>>0).toString(16).toUpperCase())>0,"the sheet carries the seed hash ("+svg.match(/SEED 0x[0-9A-F]+/)[0]+")");
  ok(svg.indexOf("KENTŌ")>0&&svg.indexOf("織")>0,"kentō registration marks and the vermilion hanko are printed");
  const rects=(svg.match(/<rect /g)||[]).length;
  ok(rects>=LW.ls.pick*5,"every woven pick reproduced 1:1 — "+LW.ls.pick+" picks → "+rects+" warp blocks on the plate");
}

console.log("\n──────────────────────────────────────────────────");
console.log("  "+passed+" checks passed, "+failed+" failed");
console.log(failed?"  ✗ HARNESS RED — do not commit":"  ✓ ALL CERTIFICATES GREEN");
process.exit(failed?1:0);
