import { useEffect, useRef } from "react";



// Exact original CampusPath AI HTML/CSS/vanilla-JS is kept intact.

// React only supplies live data through postMessage; no dashboard styling is rewritten.

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CampusPath AI · Student Dashboard</title>
<style>
:root{--bg:#0b1020;--card:#121935;--c2:#1a2250;--bd:#27315f;--tx:#e8ecff;--mu:#8f9bc7;--p:#7c5cff;--b:#3b82f6;--ok:#34d399;--wn:#fbbf24;--er:#f87171;--g:linear-gradient(135deg,#7c5cff,#3b82f6);box-sizing:border-box;padding-top:env(safe-area-inset-top,0px)}
*{box-sizing:border-box}html{scroll-padding-top:env(safe-area-inset-top,0px)}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
button,input,select{font:inherit;color:inherit}button{cursor:pointer}
:focus-visible{outline:2px solid var(--b);outline-offset:2px}
#side{position:fixed;inset:0 auto 0 0;width:230px;background:#0e1430;border-right:1px solid var(--bd);padding:16px 12px;overflow:auto;z-index:30;transition:transform .2s}
.logo{font-weight:800;font-size:18px;padding:4px 10px 16px}.logo b{background:var(--g);-webkit-background-clip:text;color:transparent}
.nv{display:flex;gap:10px;width:100%;background:none;border:0;padding:10px 12px;border-radius:12px;color:var(--mu);text-align:left}
.nv:hover{background:var(--c2);color:var(--tx)}.nv.on{background:var(--g);color:#fff}
#wrap{margin-left:230px;min-height:100vh}
header{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;display:flex;gap:12px;align-items:center;padding:12px 24px;background:rgba(11,16,32,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--bd)}
#menu{display:none}.ib{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:8px 12px;position:relative}
.sr{flex:1;position:relative;max-width:520px}.sr input{width:100%;background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:9px 14px}
#drop{position:absolute;top:44px;left:0;right:0;background:var(--card);border:1px solid var(--bd);border-radius:14px;box-shadow:0 12px 30px #0008;overflow:hidden}
#drop div{padding:9px 14px;cursor:pointer}#drop div:hover{background:var(--c2)}
.dot{position:absolute;top:4px;right:6px;width:8px;height:8px;border-radius:50%;background:var(--er)}
.av{width:36px;height:36px;border-radius:50%;background:var(--g);display:grid;place-items:center;font-weight:700;border:0}
#pm{position:absolute;right:24px;top:58px;background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:6px;min-width:160px;box-shadow:0 12px 30px #0008}
main{padding:24px;width:100%;max-width:none;margin:0}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:0}.sub{color:var(--mu);margin:2px 0 14px}
section{margin-bottom:34px}.sh{display:flex;justify-content:space-between;align-items:end;gap:10px;flex-wrap:wrap}
.card{background:var(--card);border:1px solid var(--bd);border-radius:18px;box-shadow:0 8px 24px #0005;overflow:hidden}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}
.pad{padding:16px}.ev{display:flex;flex-direction:column}.ev .body{padding:14px 16px;display:flex;flex-direction:column;gap:5px;flex:1}
.post{height:120px;display:grid;place-items:center;font-size:44px;position:relative}
.match{position:absolute;top:10px;left:10px;background:#0b1020cc;border:1px solid var(--p);border-radius:20px;padding:2px 10px;font-size:12px;font-weight:700}
.mu{color:var(--mu)}.t{font-weight:700;font-size:15px}.ok{color:var(--ok)}.wn{color:var(--wn)}.er{color:var(--er)}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.sp{margin-top:auto;padding-top:8px}
.bt{border:1px solid var(--bd);background:var(--c2);border-radius:12px;padding:8px 14px}.bt:hover{border-color:var(--p)}
.pr{background:var(--g);border:0;color:#fff;font-weight:600}.bt[disabled]{opacity:.55;cursor:default}.dn{background:#2a1530;border-color:#5b2a4a;color:var(--er)}
.fb{display:flex;gap:4px;margin-left:auto}.fb button{background:none;border:0;opacity:.55;font-size:15px;padding:2px 5px;border-radius:8px}.fb button:hover,.fb .a{opacity:1;background:var(--c2)}
.chip{display:inline-block;background:var(--c2);border:1px solid var(--bd);border-radius:20px;padding:2px 10px;font-size:12px;margin:2px 4px 2px 0}
.chip button{background:none;border:0;color:var(--er);padding:0 0 0 4px}
.cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
.cat{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px;text-align:center}.cat:hover{border-color:var(--p);background:var(--c2)}.cat i{font-size:28px;font-style:normal;display:block}
.hero{background:linear-gradient(135deg,#1b1650,#12295e);border:1px solid var(--bd);border-radius:20px;padding:22px;display:flex;gap:20px;justify-content:space-between;flex-wrap:wrap}
.tl{display:flex;gap:3px;margin-top:8px}.tl span{width:26px;height:10px;border-radius:3px;background:var(--ok)}.tl .x{background:#4a5590}
.note{background:#1a1850;border:1px solid var(--p);border-radius:14px;padding:10px 14px;margin-bottom:18px;display:flex;justify-content:space-between;gap:10px}
.tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}.tabs .bt.on{background:var(--g);border:0}
.f{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px}.f select{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:8px}
.sk{background:linear-gradient(90deg,var(--card),var(--c2),var(--card));background-size:200% 100%;animation:sh 1.2s infinite;border-radius:18px;height:300px}@keyframes sh{to{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.sk{animation:none}}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.cal>div{background:var(--card);border:1px solid var(--bd);border-radius:10px;min-height:62px;padding:4px;font-size:12px;cursor:pointer}
.cal .h{min-height:0;text-align:center;background:none;border:0;color:var(--mu)}.cal .td{border-color:var(--p)}
.d{display:inline-block;width:8px;height:8px;border-radius:50%;margin:1px}.k-class{background:#64748b}.k-reg{background:var(--ok)}.k-rec{background:var(--p)}.k-saved{background:var(--wn)}
.it{border-left:3px solid;padding:4px 8px;margin:4px 0;background:var(--c2);border-radius:8px;font-size:12px}
.wk{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));gap:8px;overflow-x:auto}
.tt{display:grid;grid-template-columns:60px repeat(5,1fr);gap:4px;overflow-x:auto;min-width:420px}.tt div{padding:6px;border-radius:8px;background:var(--c2);text-align:center;font-size:12px}.tt .b{background:#35408a}.tt .br{background:#2f5d50;color:#c9f7e6}.tt small{opacity:.8;font-size:10px}.tt .e{cursor:pointer;outline:1px dashed var(--p)}
.mo{position:fixed;inset:0;background:#000a;display:grid;place-items:center;z-index:50;padding:16px}.mo .card{max-width:440px;width:100%;padding:22px}
#toast{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:var(--c2);border:1px solid var(--p);border-radius:12px;padding:10px 16px;z-index:60}
#bnav{display:none;position:fixed;bottom:0;left:0;right:0;background:#0e1430;border-top:1px solid var(--bd);padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));z-index:25;justify-content:space-around}
#bnav button{background:none;border:0;color:var(--mu);font-size:11px;padding:4px 8px}#bnav .on{color:var(--p)}
.live{font-size:12px;color:var(--mu)}.live:before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ok);margin-right:6px}
.tg{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--bd)}
.un{border-left:3px solid var(--p)}
@media(max-width:900px){#side{transform:translateX(-100%)}#side.open{transform:none}#wrap{margin-left:0}#menu{display:block}main{padding:16px 14px 90px}#bnav{display:flex}header{padding:10px 14px}.grid{grid-template-columns:1fr}.hn{display:none}}
</style></head><body>
<aside id="side"></aside>
<div id="wrap">
<header><button id="menu" class="ib" data-a="menu" aria-label="Menu">☰</button>
<div class="sr"><input id="q" placeholder="Search title, organizer, skill, venue…" autocomplete="off" aria-label="Search events"><div id="drop" hidden></div></div>
<span class="live hn" id="live"></span><span style="flex:1"></span>
<button class="ib" data-a="nav" data-i="notifications" aria-label="Notifications">🔔<span class="dot" id="nd"></span></button>
<button class="av" data-a="pm" aria-label="Profile menu">\${P.initials}</button><div id="pm" hidden></div></header>
<main id="main"></main></div>
<nav id="bnav"></nav><div id="modal"></div><div id="toast" hidden></div>
<script>
const TODAY=(()=>{
  const d=new Date();
  const year=d.getFullYear();
  const month=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return \`\${year}-\${month}-\${day}\`;
})(),NAV=[["dashboard","🏠","Dashboard"],["discover","🧭","Discover Events"],["recommended","✨","Recommended For You"],["registrations","📝","My Registrations"],["saved","🔖","Saved Events"],["calendar","📅","My Calendar"],["profile","👤","My Profile"],["notifications","🔔","Notifications"],["settings","⚙️","Settings"]];
const CATS=[["Technical Workshops","🛠️"],["Hackathons","💻"],["Career","💼"],["Cultural","🎭"],["Sports","🏅"],["Academic","📚"],["Competitions","🏆"],["Seminars","🎤"],["Other","✨"]];
/* ---- mock data: replace with FastAPI/MongoDB responses ---- */
const mk=(id,title,cat,org,date,s,e,venue,type,mode,skills,dept,yrs,seats,dl,em,hue,desc)=>({id,title,cat,org,date,s,e,venue,type,mode,skills,dept,yrs,seats,dl,em,hue,desc});
let EV=[
mk(1,"AI & Machine Learning Workshop","Technical Workshops","AI Club","2026-10-10",10,12,"Seminar Hall 1","Workshop","Offline",["Python","Machine Learning"],"CSE","2nd–4th",40,"2026-10-08","🤖",260,"Hands-on session on building and evaluating ML models with scikit-learn."),
mk(2,"Machine Learning Bootcamp","Technical Workshops","Data Science Society","2026-10-12",14,16,"Lab 3","Bootcamp","Offline",["Python","Statistics","Machine Learning"],"CSE, IT","3rd–4th",30,"2026-10-10","📊",230,"Two-hour intensive on feature engineering and model tuning."),
mk(3,"ML Hackathon 2026","Hackathons","Coding Club","2026-10-14",9,17,"Innovation Lab","Hackathon","Offline",["Python","Machine Learning","Teamwork"],"All","All",120,"2026-10-11","🚀",285,"Eight-hour sprint to solve a real campus data problem."),
mk(4,"Resume & Internship Clinic","Career","Placement Cell","2026-10-05",11,12,"Auditorium","Seminar","Offline",["Communication"],"All","3rd–4th",200,"2026-10-04","💼",205,"Mentors review your resume and walk through internship strategy."),
mk(5,"Cloud Basics Webinar","Seminars","IEEE Student Branch","2026-10-06",16,17,"Online (Meet)","Webinar","Online",["Cloud","Linux"],"CSE, IT","All",500,"2026-10-06","☁️",215,"Intro to cloud services and deployment."),
mk(6,"Inter-Dept Football Cup","Sports","Sports Council","2026-10-10",15,18,"Main Ground","Tournament","Offline",["Teamwork"],"All","All",90,"2026-10-07","⚽",150,"Knockout tournament across departments."),
mk(7,"Open Mic Night","Cultural","Cultural Club","2026-10-09",17,19,"Amphitheatre","Showcase","Offline",["Performance"],"All","All",150,"2026-10-08","🎤",330,"Music, poetry and stand-up."),
mk(8,"Research Paper Writing Seminar","Academic","Research Cell","2026-10-07",12,13,"Seminar Hall 2","Seminar","Offline",["Research","Writing"],"All","3rd–4th",60,"2026-10-06","📝",190,"How to structure and publish a paper."),
mk(9,"Data Viz Challenge","Competitions","Analytics Guild","2026-10-08",13,15,"Lab 1","Competition","Offline",["Python","Data Visualization"],"CSE, IT","All",50,"2026-10-07","📈",245,"Tell a story with data in two hours."),
mk(10,"Intro to Git (past)","Technical Workshops","Coding Club","2026-09-25",11,12,"Lab 2","Workshop","Offline",["Git"],"All","All",40,"2026-09-24","🌿",160,"Version control basics.")];
const P={name:"",email:"",college:"",dept:"",year:"",interests:[],skills:[],goals:[],domains:[],initials:"ST"};
const CLS={};

const TTBLOCKS={1:[],2:[],3:[],4:[],5:[]};

let TT_SLOTS=[];
let TT_CONFIG=null;
/* ---- API adapter: swap bodies for fetch('/api/...'); polling now, SSE/WebSocket later ---- */
const api={
 recs(){const w=[...P.interests,...P.skills,...P.goals,...P.domains].join(" ").toLowerCase();
  return EV.filter(e=>e.date>=TODAY).map(e=>{const m=e.skills.filter(s=>w.includes(s.toLowerCase())||(e.title+e.cat).toLowerCase().split(" ").some(x=>x.length>3&&w.includes(x))).length;
   const a=avail(e),r=[];if(m)r.push("Matches your interests","Matches your skills");if(/AI|Machine|Data/.test(e.title))r.push("Matches your career goal");if(a.free)r.push("Fits your available time");
   return{eventId:e.id,matchScore:m?Math.min(97,60+m*12+(a.free?8:0)+(/AI|Machine/.test(e.title)?8:0)):null,recommendationReason:r,availability:a.free?"free":"conflict",ranking:0}}).sort((x,y)=>(y.matchScore||0)-(x.matchScore||0)).map((r,i)=>({...r,ranking:i+1}))},
 signal(id,type){S.sig.push({eventId:id,type,ts:Date.now()});/* POST /api/interactions */}};
const S={view:"dashboard",ev:null,q:"",load:false,fail:false,cold:true,tab:"Upcoming",cv:"month",cd:TODAY,cat:"",f:{},edit:false,editTT:false,
 reg:{},saved:new Set([5]),hid:new Set(),sig:[],recs:[],upd:new Date(),poll:30,
 notes:[{t:"AI Workshop registration confirmed.",w:"2h ago",r:0},{t:"New event matches your interests: Machine Learning Bootcamp.",w:"5h ago",r:0},{t:"New event is available during your free period.",w:"Yesterday",r:0},{t:"Registration deadline is tomorrow: Research Paper Writing Seminar.",w:"Yesterday",r:1},{t:"Your registered event starts tomorrow: Resume & Internship Clinic.",w:"2d ago",r:1}]};
const $=s=>document.querySelector(s),fmt=h=>{

  const totalMinutes=Math.round(Number(h)*60);

  const H24=Math.floor(totalMinutes/60);

  const minutes=totalMinutes%60;

  const H12=H24%12||12;

  const mm=String(minutes).padStart(2,"0");

  return H12+":"+mm+" "+(H24<12?"AM":"PM");

},tr=e=>fmt(e.s)+" – "+fmt(e.e),
 dt=d=>new Date(d+"T00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),dow=d=>new Date(d+"T00:00").getDay();
function posterUrl(e){const p=e&&e.poster_url;if(typeof p!=="string"||p.indexOf("/uploads/posters/")!==0)return"";if(!/^[A-Za-z0-9_/.-]+$/.test(p))return"";return"http://127.0.0.1:8000"+p}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function extras(e){
 var ps=Array.isArray(e.resource_persons)?e.resource_persons.filter(function(p){return p&&p.name}):[];
 var u=e.report_pdf_url,rp=(typeof u==="string"&&/^https?:[/][/]/i.test(u))?u:"",h="";
 if(ps.length){
  h+='<p><b>Resource Person(s)</b></p><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:14px">';
  ps.forEach(function(p){
   h+='<div class="card pad" style="background:var(--c2)"><div class="t">'+esc(p.name)+'</div>';
   if(p.designation)h+='<div>'+esc(p.designation)+'</div>';
   if(p.organization)h+='<div class="mu">'+esc(p.organization)+'</div>';
   if(/^https?:[/][/]/i.test(p.linkedin_url||""))h+='<a href="'+esc(p.linkedin_url)+'" target="_blank" rel="noopener noreferrer" style="color:var(--b);font-size:13px">LinkedIn profile ↗</a>';
   h+='</div>';
  });
  h+='</div>';
 }
 if(rp)h+='<p><b>Event Report</b></p><p><a class="bt pr" href="'+esc(rp)+'" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none">📄 View / Download Report (PDF)</a></p>';
 return h;
}
function avail(e){const rr=(typeof R==="function")?R(e.id):null;if(rr&&rr.scheduleStatus==="conflict")return{free:false,clash:rr.scheduleDetail||"overlaps a class"};if(rr&&(rr.scheduleStatus==="free"||rr.scheduleStatus==="tight"))return{free:true};const d=dow(e.date);if(e.mode==="Online"&&0)return{free:1};const c=CLS[d]||{};for(const h in c)if(+h<e.e&&+h+1>e.s)return{free:false,clash:c[h]+" at "+fmt(+h)};return{free:true}}
function free(d){const c=CLS[d]||{},o=[];let s=null;for(let h=9;h<=17;h++){const f=h<17&&!c[h];if(f&&s===null)s=h;if(!f&&s!==null){o.push([s,h]);s=null}}return o}



/* ---- Load the authenticated student's timetable from MongoDB ---- */

async function loadSavedTimetable(sourceTimetable=null){

  /*

   * IMPORTANT:

   * The onboarding timetable is stored as:

   * {

   *   monday: [{ subject, startTime, endTime, ... }],

   *   tuesday: [...], ...

   * }

   * We convert that exact structure into the dashboard CLS map.

   */

  const dayNumber={monday:1,tuesday:2,wednesday:3,thursday:4,friday:5};

  const dayAliases={

    mon:"monday",monday:"monday",

    tue:"tuesday",tues:"tuesday",tuesday:"tuesday",

    wed:"wednesday",wednesday:"wednesday",

    thu:"thursday",thur:"thursday",thurs:"thursday",thursday:"thursday",

    fri:"friday",friday:"friday"

  };



  const toHour=(value)=>{

    if(value===undefined || value===null || value==="") return null;

    const text=String(value).trim().toUpperCase();

    const m = text.match(
  /^([0-9]{1,2})(?::([0-9]{2}))?(?::[0-9]{2})? *(AM|PM)?$/
);

    if(!m) return null;

    let h=Number(m[1]);

    const minutes=Number(m[2]||0);

    const meridiem=m[3];

    if(meridiem==="PM" && h<12) h+=12;

    if(meridiem==="AM" && h===12) h=0;

    return h + minutes/60;

  };



  const parseRange=(block)=>{

    let start=toHour(block?.startTime ?? block?.start ?? block?.from ?? block?.start_time);

    let end=toHour(block?.endTime ?? block?.end ?? block?.to ?? block?.end_time);



    if((start===null || end===null) && block?.time){

      const matches =
  String(block.time).match(
    /[0-9]{1,2}(?::[0-9]{2})? *(?:AM|PM)?/gi
  ) || [];

      if(start===null && matches[0]) start=toHour(matches[0]);

      if(end===null && matches[1]) end=toHour(matches[1]);

    }



    if(start===null) return null;

    if(end===null || end<=start) end=start+1;

    return {start,end};

  };

  

  const normalizeSaved = (raw) => {
  const result = {};

  if (!raw) return result;

  const parseTime = (value) => {
    if (!value) return null;

    const match = String(value)
      .trim()
      .match(/^([0-9]{1,2}):([0-9]{2})$/);

    if (!match) return null;

    return Number(match[1]) + Number(match[2]) / 60;
  };

  const dayNumber = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5
  };

  const dayAliases = {
    mon: "monday",
    monday: "monday",
    tue: "tuesday",
    tues: "tuesday",
    tuesday: "tuesday",
    wed: "wednesday",
    wednesday: "wednesday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    thursday: "thursday",
    fri: "friday",
    friday: "friday"
  };

  Object.entries(raw).forEach(([rawDay, blocks]) => {
    const dayKey =
      dayAliases[String(rawDay).trim().toLowerCase()];

    const day = dayNumber[dayKey];

    if (!day || !Array.isArray(blocks)) return;

    result[day] = {};

    blocks.forEach((block) => {
      const start = parseTime(block?.startTime);
      const end = parseTime(block?.endTime);

      if (start === null || end === null) return;
      const breakKind = String(block?.type ?? "").trim().toLowerCase();
      if (["lunch","break","personal","travel"].indexOf(breakKind) >= 0) return;

      const label = String(
        block?.subject ??
        block?.course ??
        block?.courseName ??
        block?.title ??
        block?.name ??
        "Class"
      ).trim() || "Class";

      for (
        let h = Math.floor(start);
        h < Math.ceil(end);
        h++
      ) {
        result[day][h] = label;
      }
    });
  });

  return result;
};


  let saved =
  sourceTimetable?.timetable ||
  sourceTimetable ||
  {};
  console.log("SAVED BEFORE NORMALIZE:", saved);


  /* Prefer the timetable received from React when available. */

  if(saved && typeof saved === "object" && !Array.isArray(saved) && saved.timetable){

    saved=saved.timetable;

  }



  /* Otherwise fetch the timetable for THIS authenticated student. */

  if(!saved || (typeof saved === "object" && Object.keys(saved).length===0)){

    const token=localStorage.getItem("token");

    if(!token){

      console.warn("TIMETABLE: no authentication token found");

      return;

    }



    try{

      const response=await fetch("http\://127.0.0.1:8000/api/student/timetable",{

        method:"GET",

        headers:{

          "Authorization":\`Bearer \${token}\`,

          "Content-Type":"application/json"

        },

        cache:"no-store"

      });



      const data=await response.json().catch(()=>({}));



      console.log("TIMETABLE GET STATUS:",response.status);

      console.log("TIMETABLE GET RESPONSE:",data);



      if(!response.ok){

        console.error("TIMETABLE GET FAILED:",data);

        return;

      }



      saved=data?.timetable || {};
      TT_CONFIG=data?.config || null;

    }catch(error){

      console.error("TIMETABLE GET ERROR:",error);

      return;

    }

  }

  console.log("SAVED AFTER FETCH:", saved);

  const classMap=normalizeSaved(saved);

  console.log("CLASS MAP AFTER NORMALIZE:", classMap);

  /* Preserve the exact onboarding start/end times for the profile timetable. */

  Object.keys(TTBLOCKS).forEach(k=>TTBLOCKS[k]=[]);

  const addExactBlock = (d, block) => {

  const parseTime = (value) => {

    if (!value) return null;

    const text = String(value).trim();

    // Handles your actual MongoDB format: "08:50", "09:45"
    const match = text.match(/^([0-9]{1,2}):([0-9]{2})$/);

    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    return hour + minute / 60;
  };

  const start = parseTime(block?.startTime);
  const end = parseTime(block?.endTime);

  if (start === null || end === null) return;

  const label = String(
    block?.subject ??
    block?.course ??
    block?.courseName ??
    block?.title ??
    block?.name ??
    "Class"
  ).trim() || "Class";

  const kind = String(block?.type ?? "").trim().toLowerCase();
  const isBreak = ["lunch","break","personal","travel"].indexOf(kind) >= 0;
  TTBLOCKS[d].push({
    s: start,
    e: end,
    t: kind,
    label: (isBreak && label === "Class") ? (kind.charAt(0).toUpperCase() + kind.slice(1)) : label
  });
};

  if(Array.isArray(saved)){

    saved.forEach(item=>{

      const dayKey=dayAliases[String(item?.day ?? item?.dayName ?? item?.weekday ?? item?.dayOfWeek ?? "").trim().toLowerCase()];

      const d=dayNumber[dayKey];

      if(d)addExactBlock(d,item);

    });

  }else if(saved && typeof saved==="object"){

    Object.entries(saved).forEach(([rawDay,blocks])=>{

      const dayKey=dayAliases[String(rawDay).trim().toLowerCase()];

      const d=dayNumber[dayKey];

      if(d && Array.isArray(blocks))blocks.forEach(block=>addExactBlock(d,block));

    });

  }

  Object.keys(TTBLOCKS).forEach(k=>TTBLOCKS[k].sort((a,b)=>a.s-b.s));

  const allBlocks=Object.values(TTBLOCKS).flat();
  const hhmm=(v)=>{const m=String(v||"").trim().match(/^([0-9]{1,2}):([0-9]{2})$/);return m?Number(m[1])+Number(m[2])/60:null;};
  const cfgStart=hhmm(TT_CONFIG&&TT_CONFIG.collegeStartTime);
  const cfgEnd=hhmm(TT_CONFIG&&TT_CONFIG.collegeEndTime);
  /* Rows are the stretches of time between real boundaries: the college day start/end and every class start/end. */
  let points=[];
  if(cfgStart!==null)points.push(cfgStart);
  if(cfgEnd!==null)points.push(cfgEnd);
  allBlocks.forEach(x=>{points.push(x.s);points.push(x.e);});
  if(!points.length)points=[8+50/60,16+10/60];
  points=points.map(v=>Math.round(v*60)).sort((a,b)=>a-b).filter((v,i,a)=>i===0||v!==a[i-1]).map(v=>v/60);
  TT_SLOTS=[];
  for(let i=0;i<points.length-1;i++){TT_SLOTS.push({s:points[i],e:points[i+1]});}
  if(!TT_SLOTS.length)TT_SLOTS=[{s:points[0],e:points[0]+1}];



  /* Completely remove the demo timetable first. */

  Object.keys(CLS).forEach(k=>delete CLS[k]);



  Object.entries(classMap).forEach(([day,slots])=>{

    CLS[day]={...slots};

  });



  console.log("FINAL STUDENT TIMETABLE:",saved);

  console.log("FINAL DASHBOARD CLASS MAP:",CLS);



  render();

}

const R=id=>S.recs.find(r=>String(r.eventId)===String(id))||{},E=id=>EV.find(e=>String(e.id)===String(id)),up=()=>EV.filter(e=>e.date>=TODAY);
const toast=m=>{const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2600)};

/* ---- React bridge: data is supplied by StudentDashboard.jsx; UI/CSS stays unchanged ---- */
window.applyCampusPathData = function(data){
  if(!data) return;
  const incomingStudent=data.student||{};
  let savedUser={};
  let savedStudent={};
  try { savedUser=JSON.parse(localStorage.getItem("user")||"{}"); } catch(e) {}
  try { savedStudent=JSON.parse(localStorage.getItem("student")||"{}"); } catch(e) {}
  const student={
    ...savedStudent,
    ...savedUser,
    ...incomingStudent,
    name: incomingStudent.name || savedUser.name || savedStudent.name || "",
    email: incomingStudent.email || savedUser.email || savedStudent.email || "",
    department: incomingStudent.department || savedUser.department || savedStudent.department || ""
  };
  Object.assign(P, {
    name: student.name,
    email: student.email,
    college: student.college || "",
    dept: student.department || student.dept || "",
    year: student.year || "",
    interests: Array.isArray(student.interests)?student.interests:P.interests,
    skills: Array.isArray(student.skills)?student.skills:P.skills,
    goals: Array.isArray(student.goals)?student.goals:(student.career_goal?[student.career_goal]:P.goals),
    domains: Array.isArray(student.domains)?student.domains:(student.preferred_domains||P.domains)
  });
  P.initials=(P.name||"Student").split(/\\\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  // Load real registrations supplied by the React parent component.
const incomingRegistrations = data.registrations;

S.reg = {};

if (Array.isArray(incomingRegistrations)) {
  incomingRegistrations.forEach((registration) => {
    const eventId = String(
      registration.event_id ??
      registration.eventId ??
      registration.event?._id ??
      registration.event?.id ??
      ""
    );

    const status = String(registration.status ?? "registered").toLowerCase();

    if (!eventId || status === "cancelled") return;

    S.reg[eventId] =
      status === "completed" ? "Completed" : "Registered";
  });
} else if (
  incomingRegistrations &&
  typeof incomingRegistrations === "object"
) {
  Object.entries(incomingRegistrations).forEach(([eventId, status]) => {
    const normalizedStatus = String(
      typeof status === "object" ? status.status : status
    ).toLowerCase();

    if (!eventId || normalizedStatus === "cancelled") return;

    S.reg[String(eventId)] =
      normalizedStatus === "completed" ? "Completed" : "Registered";
  });
}
  const incoming=Array.isArray(data.events)?data.events:[];
  if(incoming.length){
    const normalizeCategory=event=>{
      const raw=String(
        event.cat ??
        event.category ??
        event.event_category ??
        event.eventCategory ??
        ""
      ).trim().toLowerCase();

      if(raw.includes("hackathon") || raw.includes("hack")) return "Hackathons";
      if(raw.includes("workshop") || raw.includes("bootcamp") || raw.includes("training")) return "Technical Workshops";
      if(raw.includes("career") || raw.includes("placement") || raw.includes("internship")) return "Career";
      if(raw.includes("cultural") || raw.includes("culture")) return "Cultural";
      if(raw.includes("sport")) return "Sports";
      if(raw.includes("academic")) return "Academic";
      if(raw.includes("competition") || raw.includes("contest")) return "Competitions";
      if(raw.includes("seminar") || raw.includes("webinar")) return "Seminars";
      return "Other";
    };

    const normalizeListValue=value=>{
      if(Array.isArray(value)) return value.filter(Boolean).join(", ");
      return value == null ? "" : String(value).trim();
    };

    const parseHour=value=>{
      if(value==null || value==="") return null;
      const text=String(value).trim().toLowerCase();
      const m=text.match(/(\\\d{1,2})(?::(\\\d{2}))?\\\s*(am|pm)?/i);
      if(!m) return null;
      let h=Number(m[1]);
      const ap=m[3];
      if(ap==="pm" && h!==12) h+=12;
      if(ap==="am" && h===12) h=0;
      return h;
    };

    const parseTimeRange=event=>{
      let s=Number(event.s);
      let e=Number(event.e);
      if(!Number.isFinite(s)) s=parseHour(event.start_time ?? event.startTime);
      if(!Number.isFinite(e)) e=parseHour(event.end_time ?? event.endTime);
      if((s==null || !Number.isFinite(s)) && event.time){
        const matches=String(event.time).match(/\\\d{1,2}(?::\\\d{2})?\\\s*(?:am|pm)?/gi)||[];
        if(matches.length) s=parseHour(matches[0]);
        if(matches.length>1) e=parseHour(matches[1]);
      }
      if(!Number.isFinite(s)) s=0;
      if(!Number.isFinite(e)) e=s+1;
      return {s,e};
    };

    EV=incoming.map((event,index)=>{
      const time=parseTimeRange(event);
      const cat=normalizeCategory(event);
      const venue=normalizeListValue(event.venue ?? event.location ?? event.event_location) || "Not specified";
      const org=normalizeListValue(event.org ?? event.organizer ?? event.club_name ?? event.clubName) || "Unknown Organizer";
      const dept=normalizeListValue(event.dept ?? event.department ?? event.departments) || "All";
      const yrs=normalizeListValue(event.yrs ?? event.year ?? event.eligibility_year) || "All";

      let type=normalizeListValue(event.type ?? event.event_type ?? event.eventType);
      if(!type){
        type=cat==="Hackathons" ? "Hackathon" :
          cat==="Technical Workshops" ? "Workshop" :
          cat==="Competitions" ? "Competition" :
          cat==="Seminars" ? "Seminar" : cat;
      }

      let mode=normalizeListValue(event.mode ?? event.event_mode ?? event.eventMode);
      if(!mode){
        const locationText=venue.toLowerCase();
        mode=(locationText.includes("online") || locationText.includes("zoom") || locationText.includes("meet")) ? "Online" : "Offline";
      }

      return {
        ...event,
        id:String(event.id ?? event._id ?? event.event_id ?? event.eventId ?? index+1),
        cat, org, venue, type, mode,
        skills:Array.isArray(event.skills)?event.skills:[],
        dept, yrs,
        s:time.s, e:time.e,
        seats:event.seats ?? event.capacity ?? 0,
        dl:event.dl ?? event.registration_deadline ?? event.deadline ?? event.date,
        em:event.em ?? event.emoji ?? "📅",
        hue:event.hue ?? 220,
        desc:event.desc ?? event.description ?? ""
      };
    });
  }
  const recs = Array.isArray(data.recommended)

  ? data.recommended

  : Array.isArray(data.recommendations)

    ? data.recommendations

    : [];
 api.recs = function () {

  return recs

    .map((r, index) => ({

      eventId:

        r.eventId ??

        r.event_id ??

        r._id ??

        r.id,



      matchScore: (() => {
  const scores = [
    r.matchScore,
    r.match_score,
    r.recommendation_score,
    r.contextRerankedScore,
    r.diversity_score
  ]
    .map(Number)
    .filter(Number.isFinite);

  return scores.length ? scores[0] : null;
})(),



      recommendationReason:

        Array.isArray(r.recommendationReason)

          ? r.recommendationReason

          : [],



      availability:

        r.availability || "free",
      scheduleStatus: r.scheduleStatus ?? null,
      scheduleDetail: r.scheduleDetail ?? null,



      ranking:

        r.ranking || index + 1

    }))

    .filter((r) => E(r.eventId));

};
  if (
  data.timetable &&
  typeof data.timetable === "object" &&
  Object.keys(data.timetable).length
) {

  Object.keys(CLS).forEach(k => delete CLS[k]);

  Object.entries(data.timetable).forEach(([day, blocks]) => {

    const dayMap = {
      monday: 1,
      mon: 1,
      tuesday: 2,
      tue: 2,
      wednesday: 3,
      wed: 3,
      thursday: 4,
      thu: 4,
      friday: 5,
      fri: 5,
    };

    const d =
      dayMap[String(day).trim().toLowerCase()];

    if (!d || !Array.isArray(blocks)) return;

    CLS[d] = CLS[d] || {};

    blocks.forEach(block => {

      const start =
        block?.startTime ||
        block?.start ||
        block?.from ||
        block?.time;

      const label =
        block?.subject ||
        block?.course ||
        block?.courseName ||
        block?.title ||
        block?.name ||
        block?.label ||
        "Class";

      if (!start) return;

      const match =
        String(start).match(
          /^([0-9]{1,2})(?::([0-9]{2}))? *(AM|PM)?$/i
        );

      if (!match) return;

      let hour = Number(match[1]);
      const minute = Number(match[2] || 0);
      const period = String(match[3] || "").toUpperCase();

      if (period === "PM" && hour < 12) hour += 12;
      if (period === "AM" && hour === 12) hour = 0;

      CLS[d][hour] = label;

    });

  });

}
  S.cold=false;
  S.load=false;
  S.fail=false;
  refresh();
  render();
};
window.addEventListener("message", function(ev){
  if(ev.data && ev.data.type === "CAMPUSPATH_DASHBOARD_DATA"){
    window.applyCampusPathData(ev.data.payload);
  }
});
const _campusPathRender=render;
render=function(){
  _campusPathRender();
  const initials=(P.initials||"ST").toUpperCase();
  document.querySelectorAll(".av").forEach(x=>x.textContent=initials);
};

/* ---- components ---- */
function card(e,rec){const r=R(e.id),a=avail(e),st=S.reg[e.id],sv=S.saved.has(e.id);
return\`<article class="card ev"><div class="post" style="\${posterUrl(e)?"background:#0e1429 url('"+posterUrl(e)+"') center/cover no-repeat":"background:linear-gradient(135deg,hsl("+e.hue+" 70% 35%),hsl("+(e.hue+50)+" 70% 22%))"}">\${posterUrl(e)?"":e.em}\${rec&&r.matchScore!=null?\`<span class="match">⭐ \${Math.round(Number(r.matchScore))}% Match</span>\`:""}</div>
<div class="body"><div class="t">\${e.title}</div><div class="mu">\${e.org} · \${e.cat} · \${e.type}</div>
<div>📅 \${dt(e.date)}</div><div>⏰ \${tr(e)}</div><div>📍 \${e.venue}</div>
<div class="\${a.free?"ok":"wn"}">\${a.free?"✓ Fits your schedule":"⚠ Schedule conflict · "+a.clash}</div>
\${rec&&r.recommendationReason?.length?\`<div class="mu" style="font-size:12px">\${r.recommendationReason.map(x=>"✓ "+x).join("<br>")}</div>\`:""}
<div class="row sp"><button class="bt" data-a="view" data-i="\${e.id}">View Details</button>\${st==="Registered"?\`<button class="bt" disabled>Registered ✓</button>\`:\`<button class="bt pr" data-a="reg" data-i="\${e.id}">Register</button>\`}
<span class="fb"><button data-a="up" data-i="\${e.id}" title="Interested" aria-label="Interested">👍</button><button data-a="down" data-i="\${e.id}" title="Not interested" aria-label="Not interested">👎</button><button class="\${sv?"a":""}" data-a="save" data-i="\${e.id}" title="Save" aria-label="Save">🔖</button></span></div></div></article>\`}
const skel=n=>\`<div class="grid">\${"<div class=sk></div>".repeat(n)}</div>\`;
const err=(m,a)=>\`<div class="card pad" style="text-align:center"><div class="er t">\${m}</div><p class="mu">Check your connection, then try again.</p><button class="bt pr" data-a="retry">Retry</button></div>\`;
const empty=(i,m,s,b)=>\`<div class="card pad" style="text-align:center"><div style="font-size:34px">\${i}</div><div class="t">\${m}</div><p class="mu">\${s||""}</p>\${b||""}</div>\`;
const sec=(t,s,body,more)=>\`<section><div class="sh"><div><h2>\${t}</h2>\${s?\`<p class="sub">\${s}</p>\`:""}</div>\${more||""}</div>\${body}</section>\`;
const grid=(l,rec)=>\`<div class="grid">\${l.map(e=>card(e,rec)).join("")}</div>\`;
const cats=()=>\`<div class="cats">\${CATS.map(c=>\`<button class="cat" data-a="cat" data-i="\${c[0]}"><i>\${c[1]}</i>\${c[0]}</button>\`).join("")}</div>\`;
const recList=()=>S.recs.filter(r=>!S.hid.has(r.eventId)&&E(r.eventId)&&E(r.eventId).date>=TODAY).map(r=>E(r.eventId));
const coldNote=()=>S.cold?\`<div class="note"><span>Your recommendations are based on your profile. As you explore more events, we'll personalize them further.</span><button class="bt" data-a="hideCold">Got it</button></div>\`:"";
function fitSec(){const d=dow(TODAY),w=free(d),fit=up().filter(e=>e.date>TODAY&&avail(e).free).slice(0,2),cf=up().find(e=>!avail(e).free);
return sec("📅 Fits Your Schedule",\`You have free time today: \${w.map(x=>fmt(x[0])+" – "+fmt(x[1])).join(", ")||"none"}. Matched against your timetable.\`,fit.length||cf?grid([...fit,...(cf?[cf]:[])]):empty("📅","No events match your free periods yet.","New events are checked automatically."))}
/* ---- views ---- */
const V={
dashboard(){const w=free(dow(TODAY)),rl=recList(),n=rl.filter(e=>e.date===TODAY).length||Math.min(6,rl.length);
 if(S.load)return skel(3)+"<h2 style='margin:24px 0 12px'>Categories</h2>"+skel(2);
 const hr=new Date().getHours(),g=hr<12?"morning":hr<17?"afternoon":"evening";
 return\`<h1>CampusPath AI</h1><p class="sub">Discover campus events that match your interests, goals and schedule.</p>
<div class="hero"><div><h1>Good \${g}, \${P.name.split(" ")[0]} 👋</h1><div>You have \${n} recommended events today.</div><div class="mu">Your next available period: <b style="color:var(--tx)">\${w[0]?fmt(w[0][0])+" – "+fmt(w[0][1]):"—"}</b></div></div>
<div><div class="mu">Today's availability · 9 AM – 5 PM</div><div class="tl">\${[9,10,11,12,13,14,15,16].map(h=>\`<span class="\${(CLS[dow(TODAY)]||{})[h]?"x":""}" title="\${fmt(h)}"></span>\`).join("")}</div><div class="mu" style="font-size:12px">Green = free · Grey = class</div></div></div><br>\${coldNote()}\`+
 sec("✨ Recommended For You","Events selected based on your interests, skills, career goals and availability.",S.fail?err("Unable to load recommendations."):rl.length?grid(rl.slice(0,6),1):empty("🔍","No upcoming events to recommend right now. Events that have ended or that you already registered for are not shown here. Browse everything under Discover Events."),\`<button class="bt" data-a="nav" data-i="recommended">See all</button>\`)+
 (S.fail?"":fitSec())+
 sec("📆 Upcoming Events","",S.fail?err("Unable to load events."):up().length?grid(up().slice(0,3)):empty("📆","No upcoming events found."),\`<button class="bt" data-a="nav" data-i="discover">See All Events</button>\`)+
 sec("Event Categories","",cats())+
 sec("📝 My Registrations & 🔖 Saved","",\`<div class="row"><button class="bt" data-a="nav" data-i="registrations">My Registrations (\${Object.values(S.reg).filter(x=>x==="Registered").length})</button><button class="bt" data-a="nav" data-i="saved">Saved Events (\${S.saved.size})</button></div>\`)},
recommended(){if(S.load)return skel(6);const l=recList();return\`<h1>✨ Recommended For You</h1><p class="sub">Events selected based on your interests, skills, career goals and availability.</p>\${coldNote()}\${S.fail?err("Unable to load recommendations."):l.length?grid(l,1):empty("🔍","No upcoming events to recommend right now. Events that have ended or that you already registered for are not shown here. Browse everything under Discover Events.")}\`},
discover(){if(S.load)return skel(6);const f=S.f,q=S.q.toLowerCase(),o=k=>[...new Set(up().map(e=>e[k]).filter(v=>v!==undefined&&v!==null&&String(v).trim()!==""))],
 l=up().filter(e=>(!S.cat||e.cat===S.cat)&&(!q||[e.title,e.org,e.cat,e.venue,...e.skills].join(" ").toLowerCase().includes(q))&&(!f.org||e.org===f.org)&&(!f.venue||e.venue===f.venue)&&(!f.type||e.type===f.type)&&(!f.mode||e.mode===f.mode)&&(!f.dept||e.dept.includes(f.dept))&&(!f.year||e.yrs===f.year||e.yrs==="All")&&(!f.date||(f.date==="week"?e.date<="2026-10-09":e.date>"2026-10-09"))&&(!f.time||(f.time==="am"?e.s<12:e.s>=12))&&(!f.free||avail(e).free));
 const sel=(k,t,v)=>\`<select data-f="\${k}" aria-label="\${t}"><option value="">\${t}</option>\${v.map(x=>{const value=Array.isArray(x)?x[0]:x;const label=Array.isArray(x)?x[1]:x;return \`<option \${f[k]===value?"selected":""} value="\${value}">\${label}</option>\`;}).join("")}</select>\`;
 return\`<h1>🧭 Discover Events</h1><p class="sub">\${S.cat?"Category: "+S.cat+" · ":""}\${S.q?\`Results for "\${S.q}" · \`:""}\${l.length} events <button class="bt" data-a="clear">Clear filters</button></p>
<div class="f">\${sel("date","Date",[["week","This week"],["next","Next week"]])}\${sel("time","Time",[["am","Morning"],["pm","Afternoon"]])}\${sel("org","Organizer",o("org"))}\${sel("venue","Venue",o("venue"))}\${sel("dept","Department",["CSE","IT"])}\${sel("year","Year",["2nd–4th","3rd–4th"])}\${sel("type","Event type",o("type"))}\${sel("mode","Online/Offline",["Online","Offline"])}<label class="ib"><input type="checkbox" data-f="free" \${f.free?"checked":""}> Available during my free time</label></div>
\${S.fail?err("Unable to load events."):l.length?grid(l):empty("🔎","No events match these filters.","Try clearing a filter.")}\${sec("Browse by category","",cats())}\`},
detail(){const e=E(S.ev),r=R(e.id),a=avail(e),st=S.reg[e.id],rs=r.recommendationReason||[];
 return\`<button class="bt" data-a="back">← Back</button><br><br><div class="card"><div class="post" style="height:200px;font-size:80px;\${posterUrl(e)?"background:#0e1429 url('"+posterUrl(e)+"') center/cover no-repeat":"background:linear-gradient(135deg,hsl("+e.hue+" 70% 35%),hsl("+(e.hue+50)+" 70% 22%))"}">\${posterUrl(e)?"":e.em}\${r.matchScore!=null?\`<span class="match">⭐ \${r.matchScore}% Match</span>\`:""}</div><div class="pad"><h1>\${e.title}</h1><div class="mu">\${e.org} · \${e.cat}</div><p>\${e.desc}</p>
<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"><div>📅 \${dt(e.date)}</div><div>⏰ \${tr(e)}</div><div>📍 \${e.venue}</div><div>🎟️ \${e.type} · \${e.mode}</div><div>🪑 \${e.seats} seats available</div><div>⏳ Register by \${dt(e.dl)}</div><div>🎓 Years: \${e.yrs}</div><div>🏫 Departments: \${e.dept}</div><div>✅ Eligibility: \${e.yrs==="All"?"Open to all students":e.yrs+" year students"}</div></div>
<p><b>Skills</b><br>\${e.skills.map(s=>\`<span class="chip">\${s}</span>\`).join("")}</p>
\${extras(e)}
<div class="card pad" style="background:var(--c2)"><b>Why this event is recommended for you</b><br>\${rs.length?rs.map(x=>"✓ "+x).join("<br>"):"Based on your profile."}<br><span class="\${a.free?"ok":"wn"}">\${a.free?"✓ Available during your free period":"⚠ Schedule conflict · "+a.clash}</span></div><br>
<div class="row">\${st==="Registered"?\`<button class="bt" disabled>Registered ✓</button>\`:\`<button class="bt pr" data-a="reg" data-i="\${e.id}">Register Now</button>\`}<button class="bt" data-a="save" data-i="\${e.id}">\${S.saved.has(e.id)?"🔖 Saved":"Save Event"}</button><span class="fb"><button data-a="up" data-i="\${e.id}">👍</button><button data-a="down" data-i="\${e.id}">👎</button></span></div></div></div>\`},
registrations(){if(S.load)return skel(3);const t=S.tab,l=Object.entries(S.reg).filter(([i,s])=>t==="Upcoming"?s==="Registered":s===t).map(([i])=>E(i)).filter(Boolean);
 return\`<h1>📝 My Registrations</h1><div class="tabs">\${["Upcoming","Completed","Cancelled"].map(x=>\`<button class="bt \${t===x?"on":""}" data-a="tab" data-i="\${x}">\${x}</button>\`).join("")}</div>\`+
 (l.length?l.map(e=>\`<div class="card pad row" style="margin-bottom:10px;justify-content:space-between"><div><div class="t">\${e.title}</div><div class="mu">\${e.org} · \${dt(e.date)} · \${tr(e)} · \${e.venue}</div><span class="\${t==="Cancelled"?"er":"ok"}">\${t==="Upcoming"?"Registered ✓":t}</span></div><div class="row"><button class="bt" data-a="view" data-i="\${e.id}">View Event</button>\${t==="Upcoming"?\`<button class="bt dn" data-a="cancel" data-i="\${e.id}">Cancel</button>\`:""}</div></div>\`).join(""):empty("📝","You haven't registered for any events yet.","",\`<button class="bt pr" data-a="nav" data-i="recommended">See recommendations</button>\`))},
saved(){const l=[...S.saved].map(E);return\`<h1>🔖 Saved Events</h1><br>\`+(l.length?l.map(e=>\`<div class="card pad row" style="margin-bottom:10px;justify-content:space-between"><div><div class="t">\${e.title}</div><div class="mu">\${e.org} · \${dt(e.date)} · \${tr(e)} · \${e.venue}</div><span class="\${S.reg[e.id]==="Registered"?"ok":"mu"}">\${S.reg[e.id]==="Registered"?"Registered ✓":"Not registered"}</span></div><div class="row"><button class="bt" data-a="view" data-i="\${e.id}">View</button>\${S.reg[e.id]==="Registered"?"":\`<button class="bt pr" data-a="reg" data-i="\${e.id}">Register</button>\`}<button class="bt dn" data-a="save" data-i="\${e.id}">Remove from Saved</button></div></div>\`).join(""):empty("🔖","You haven't saved any events yet.","Save events to decide later.",\`<button class="bt pr" data-a="nav" data-i="discover">Discover events</button>\`))},
calendar(){if(S.load)return skel(2);const items=d=>{const o=[],c=dow(d)>0&&dow(d)<6?CLS[dow(d)]||{}:{};for(const h in c)o.push({k:"class",l:c[h],s:+h,e:+h+1});EV.filter(e=>e.date===d).forEach(e=>{const k=S.reg[e.id]==="Registered"?"reg":S.saved.has(e.id)?"saved":recList().includes(e)?"rec":null;if(k)o.push({k,l:e.title,s:e.s,e:e.e})});return o.sort((a,b)=>a.s-b.s)},
 col={class:"#64748b",reg:"var(--ok)",rec:"var(--p)",saved:"var(--wn)"},ln=i=>\`<div class="it" style="border-color:\${col[i.k]}">\${fmt(i.s)}–\${fmt(i.e)} \${i.l}</div>\`,cd=S.cd,D=new Date(cd+"T00:00"),iso=x=>x.toISOString().slice(0,10).replace(/./,c=>c),
 add=(x,n)=>{const y=new Date(x);y.setDate(y.getDate()+n);return new Date(y.getTime()-y.getTimezoneOffset()*6e4).toISOString().slice(0,10)};let body="";
 if(S.cv==="month"){const f=new Date(2026,9,1).getDay(),n=31;body=\`<div class="cal">\${"SMTWTFS".split("").map(x=>\`<div class="h">\${x}</div>\`).join("")}\${"<div class=h></div>".repeat(f)}\${Array.from({length:n},(_,i)=>{const d="2026-10-"+String(i+1).padStart(2,"0");return\`<div class="\${d===TODAY?"td":""}" data-a="day" data-i="\${d}">\${i+1}<br>\${[...new Set(items(d).map(x=>x.k))].map(k=>\`<span class="d k-\${k}"></span>\`).join("")}</div>\`}).join("")}</div>\`}
 else if(S.cv==="week"){const m=add(cd,-((dow(cd)+6)%7));body=\`<div class="wk">\${Array.from({length:7},(_,i)=>{const d=add(m,i);return\`<div class="card pad"><b>\${new Date(d+"T00:00").toLocaleDateString("en-US",{weekday:"short",day:"numeric"})}</b>\${items(d).map(ln).join("")||"<div class=mu>Free</div>"}</div>\`}).join("")}</div>\`}
 else body=\`<div class="card pad"><b>\${dt(cd)}</b>\${items(cd).map(ln).join("")||"<p class=mu>Nothing scheduled. Free day.</p>"}</div>\`;
 return\`<h1>📅 My Calendar</h1><p class="sub">Your timetable from onboarding, with registered, saved and recommended events.</p><div class="row" style="margin-bottom:12px">\${["month","week","day"].map(x=>\`<button class="bt \${S.cv===x?"pr":""}" data-a="calv" data-i="\${x}">\${x[0].toUpperCase()+x.slice(1)}</button>\`).join("")}<span class="mu"><span class="d k-class"></span>Classes <span class="d k-reg"></span>Registered <span class="d k-rec"></span>Recommended <span class="d k-saved"></span>Saved</span></div>\${body}\`},
profile(){const ed=S.edit,ch=(k,t)=>\`<div style="margin:10px 0"><b>\${t}</b><br>\${P[k].map((x,i)=>\`<span class="chip">\${x}\${ed?\`<button data-a="rmc" data-k="\${k}" data-i="\${i}" aria-label="Remove \${x}">✕</button>\`:""}</span>\`).join("")}\${ed?\`<input data-add="\${k}" placeholder="Add + Enter" style="background:var(--c2);border:1px solid var(--bd);border-radius:10px;padding:3px 8px">\`:""}</div>\`;
 const days=["Mon","Tue","Wed","Thu","Fri"];
 return\`<div class="sh"><h1>My Profile</h1><button class="bt \${ed?"pr":""}" data-a="edit">\${ed?"Save Profile":"Edit Profile"}</button></div><div class="card pad"><div class="row"><div class="av" style="width:56px;height:56px;font-size:20px">\${P.initials}</div><div><div class="t">\${P.name}</div><div class="mu">\${P.email}</div></div></div><p>🏫 \${P.college} · \${P.dept} · \${P.year}</p>\${ch("interests","Interests")}\${ch("skills","Skills")}\${ch("goals","Career Goals")}\${ch("domains","Preferred Domains")}</div><br>
<div class="card pad"><div class="sh"><b>Weekly Timetable (Mon–Fri)</b><button class="bt" data-a="editTT">\${S.editTT?"Done":"Edit Timetable"}</button></div><p class="mu">\${S.editTT?"Tap a slot to mark it as a class or free.":"Collected during onboarding. Used for availability matching."}</p><div class="tt"><div></div>\${days.map(d=>\`<div>\${d}</div>\`).join("")}\${TT_SLOTS.map(slot=>\`<div>\${fmt(slot.s)+" – "+fmt(slot.e)}</div>\${[1,2,3,4,5].map(d=>{const block=(TTBLOCKS[d]||[]).find(b=>b.s<slot.e-0.001&&b.e>slot.s+0.001);return \`<div class="\${block?(block.t&&["lunch","break","personal","travel"].indexOf(block.t)>=0?"b br":"b"):""} \${S.editTT?"e":""}" data-a="slot" data-d="\${d}" data-i="\${slot.s}">\${block?(String(block.label).replace(/[<>&]/g,"")+"<br><small>"+fmt(block.s)+" - "+fmt(block.e)+"</small>"):"Free"}</div>\`;}).join("")}\`).join("")}</div></div>\`},
notifications(){const u=S.notes.filter(n=>!n.r).length;return\`<div class="sh"><h1>Notifications</h1><button class="bt" data-a="markall">Mark all as read</button></div><p class="sub">\${u} unread</p>\`+S.notes.map((n,i)=>\`<div class="card pad row \${n.r?"":"un"}" style="margin-bottom:8px;justify-content:space-between"><div>\${n.r?"":"● "}\${n.t}<div class="mu" style="font-size:12px">\${n.w}</div></div>\${n.r?"":\`<button class="bt" data-a="read" data-i="\${i}">Mark as read</button>\`}</div>\`).join("")},
settings(){return\`<h1>Settings</h1><div class="card pad"><div class="tg"><div>Auto-refresh recommendations<div class="mu">Polling every \${S.poll}s. SSE/WebSocket can replace this later (not implemented).</div></div><button class="bt" data-a="poll">\${S.poll?"On":"Off"}</button></div><div class="tg"><div>Notify me about new matching events<div class="mu">Push notifications</div></div><button class="bt" data-a="toast" data-i="Preference saved">On</button></div><div class="tg"><div>Demo: simulate API failure<div class="mu">Shows error states with Retry</div></div><button class="bt" data-a="fail">\${S.fail?"On":"Off"}</button></div><div class="tg"><div>Interaction signals collected<div class="mu">views, saves, registrations, 👍/👎 (sent to recommendation API)</div></div><b>\${S.sig.length}</b></div></div>\`}};
/* ---- shell ---- */
function render(){const v=S.view;$("#main").innerHTML=v==="detail"?V.detail():V[v]\();
 const on=v==="detail"?"discover":v;$("#side").innerHTML=\`<div class="logo"><b>CampusPath</b> AI</div>\`+NAV.map(n=>\`<button class="nv \${on===n[0]?"on":""}" data-a="nav" data-i="\${n[0]}">\${n[1]} \${n[2]}</button>\`).join("")+\`<button class="nv" data-a="logout">🚪 Logout</button>\`;
 $("#bnav").innerHTML=[["dashboard","🏠","Home"],["recommended","✨","For You"],["calendar","📅","Calendar"],["saved","🔖","Saved"],["profile","👤","Profile"]].map(n=>\`<button class="\${on===n[0]?"on":""}" data-a="nav" data-i="\${n[0]}">\${n[1]}<br>\${n[2]}</button>\`).join("");
 $("#nd").hidden=!S.notes.some(n=>!n.r);$("#live").textContent=S.poll?"Live · updated "+S.upd.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"Auto-refresh off"}
function go(v,i){S.view=v;if(v==="detail")S.ev=i;S.load=["dashboard","discover","recommended","registrations","calendar"].includes(v);$("#side").classList.remove("open");$("#pm").hidden=true;scrollTo(0,0);render();if(S.load)setTimeout(()=>{S.load=false;render()},450)}
function refresh(){S.recs=api.recs();S.upd=new Date()}
function modal(h){$("#modal").innerHTML=h?\`<div class="mo" data-a="close"><div class="card" role="dialog">\${h}</div></div>\`:""}
document.addEventListener("click",ev=>{const t=ev.target.closest("[data-a]");if(!t)return;const a=t.dataset.a,i=t.dataset.i,id=i;
 if(t.classList.contains("mo")&&ev.target!==t)return;
 if(!ev.target.closest(".sr"))$("#drop").hidden=true;
 const A={nav:()=>go(i),menu:()=>$("#side").classList.toggle("open"),pm:()=>{$("#pm").innerHTML=\`<button class="nv" data-a="nav" data-i="profile">👤 My Profile</button><button class="nv" data-a="nav" data-i="settings">⚙️ Settings</button><button class="nv" data-a="logout">🚪 Logout</button>\`;$("#pm").hidden=!$("#pm").hidden},
 logout:()=>{$("#pm").hidden=true;modal(\`<h2>Log out?</h2><p class="mu">You will need to log in again to access your dashboard.</p><div class="row"><button class="bt" data-a="close">Cancel</button><button class="bt pr" data-a="dologout">Logout</button></div>\`)},
 view:()=>{api.signal(id,"view");go("detail",id)},back:()=>go("dashboard"),close:()=>modal(""),dologout:()=>{modal("");parent.postMessage({type:"CAMPUSPATH_LOGOUT"},"*")},
 reg:()=>{const e=E(id);modal(\`<h2>Register for:</h2><div class="t">\${e.title}</div><p class="mu">\${dt(e.date)} \${tr(e)}<br>\${e.venue}</p>\${avail(e).free?"":\`<p class="wn">⚠ This overlaps with \${avail(e).clash}.</p>\`}<div class="row"><button class="bt" data-a="close">Cancel</button><button class="bt pr" data-a="confirm" data-i="\${id}">Confirm Registration</button></div>\`)},
 confirm:async()=>{
  const token=localStorage.getItem("token");
  if(!token){toast("Please login again");return;}
  const e=E(id);
  if(!e){toast("Event not found");return;}
  try{
    const response=await fetch(\`http\://127.0.0.1:8000/api/events/\${id}/register\`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":\`Bearer \${token}\`
      }
    });
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.detail||data.message||"Unable to register for this event");
    }
    S.reg[id]="Registered";
    api.signal(id,"register");
    S.notes.unshift({t:e.title+" registration confirmed.",w:"Just now",r:0});
    modal(\`<h2 class="ok">Registration successful.</h2><p class="mu">\${e.title} is added to your calendar.</p><button class="bt pr" data-a="nav" data-i="registrations">View My Registrations</button>\`);
    render();
  }catch(error){
    console.error("Register event error:",error);
    toast(error.message||"Unable to register for this event");
  }
},
 cancel:async()=>{
  const token=localStorage.getItem("token");
  if(!token){toast("Please login again");return;}
  try{
    const response=await fetch(\`http\://127.0.0.1:8000/api/events/\${id}/register\`,{
      method:"DELETE",
      headers:{
        "Content-Type":"application/json",
        "Authorization":\`Bearer \${token}\`
      }
    });
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.detail||data.message||"Unable to cancel registration");
    }
    S.reg[id]="Cancelled";
    toast("Registration cancelled");
    render();
  }catch(error){
    console.error("Cancel registration error:",error);
    toast(error.message||"Unable to cancel registration");
  }
},
save:async()=>{
  const token=localStorage.getItem("token");
  if(!token){toast("Please login again");return;}
  const alreadySaved=S.saved.has(id);
  try{
    const response=await fetch(\`http\://127.0.0.1:8000/api/events/\${id}/save\`,{
      method:alreadySaved?"DELETE":"POST",
      headers:{"Content-Type":"application/json","Authorization":\`Bearer \${token}\`}
    });
    const data=await response.json();
    if(!response.ok)throw new Error(data.detail||data.message||"Unable to update saved event");
    if(alreadySaved){
      S.saved.delete(id);
      toast("Removed from saved");
    }else{
      S.saved.add(id);
      api.signal(id,"save");
      toast("Event saved");
    }
    render();
  }catch(error){
    console.error("Save event error:",error);
    toast(error.message||"Unable to save event");
  }
},
 up:()=>{api.signal(id,"interested");toast("Thanks, we'll show more like this")},
 down:()=>{api.signal(id,"not_interested");S.hid.add(id);toast("Got it, we'll show fewer like this");if(S.view==="detail")go("dashboard");else render()},
 retry:()=>{S.fail=false;go(S.view)},hideCold:()=>{S.cold=false;render()},cat:()=>{S.cat=i;S.f={};go("discover")},clear:()=>{S.cat="";S.q="";S.f={};$("#q").value="";render()},tab:()=>{S.tab=i;render()},
 calv:()=>{S.cv=i;render()},day:()=>{S.cd=i;S.cv="day";render()},edit:()=>{S.edit=!S.edit;if(!S.edit)toast("Profile saved");render()},editTT:()=>{window.parent.postMessage({type:"CAMPUSPATH_EDIT_TIMETABLE"},"*")},
 rmc:()=>{P[t.dataset.k].splice(id,1);refresh();render()},slot:()=>{if(!S.editTT)return;const d=+t.dataset.d;CLS[d]=CLS[d]||{};CLS[d][id]?delete CLS[d][id]:CLS[d][id]="Class";refresh();render()},
 read:()=>{S.notes[id].r=1;render()},markall:()=>{S.notes.forEach(n=>n.r=1);render()},poll:()=>{S.poll=S.poll?0:30;render()},fail:()=>{S.fail=!S.fail;render()},toast:()=>toast(i)};A[a]&&A[a]\()});
document.addEventListener("change",e=>{const f=e.target.dataset.f;if(f){S.f[f]=e.target.type==="checkbox"?e.target.checked:e.target.value;render()}});
document.addEventListener("keydown",e=>{const k=e.target.dataset?.add;if(k&&e.key==="Enter"&&e.target.value.trim()){P[k].push(e.target.value.trim());refresh();render()}});
$("#q").addEventListener("input",e=>{const q=e.target.value.toLowerCase(),d=$("#drop");if(!q){d.hidden=true;return}const l=up().filter(x=>[x.title,x.org,x.cat,x.venue,...x.skills].join(" ").toLowerCase().includes(q)).slice(0,5);d.innerHTML=l.map(x=>\`<div data-a="view" data-i="\${x.id}">\${x.em} \${x.title} <span class="mu">· \${x.org}</span></div>\`).join("")||"<div class=mu>No events found</div>";d.hidden=false});
$("#q").addEventListener("keydown",e=>{if(e.key==="Enter"){S.q=e.target.value;S.cat="";$("#drop").hidden=true;go("discover")}});
refresh();loadSavedTimetable();render();setTimeout(()=>{S.load=false;render()},450);S.load=true;render();
setInterval(()=>{if(S.poll&&!S.fail){refresh();if(!S.load&&["dashboard","recommended"].includes(S.view))render()}},30000);/* swap for SSE/WebSocket later */
</script></body></html>
`;

function StudentDashboardUI({ student, events, recommendations, registrations, savedEventIds, timetable, onEditTimetable, onLogout }) {

  const frameRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "CAMPUSPATH_EDIT_TIMETABLE") {
        onEditTimetable?.();
      }
      if (event.data?.type === "CAMPUSPATH_LOGOUT") {
        onLogout?.();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEditTimetable, onLogout]);



  useEffect(() => {

    const frame = frameRef.current;

    if (!frame) return;

    console.log(
  "FRONTEND RECOMMENDATIONS VALUES:",
  JSON.stringify(
    recommendations,
    null,
    2
  )
);

    const payload = {

      student,

      events: Array.isArray(events) ? events : [],

      recommendations: Array.isArray(recommendations) ? recommendations : [],

      registrations: registrations || {},

      savedEventIds: Array.isArray(savedEventIds) ? savedEventIds : [],

      timetable: timetable || {},

    };



    const send = () => {

      frame.contentWindow?.postMessage(

        { type: "CAMPUSPATH_DASHBOARD_DATA", payload },

        "*"

      );

    };



    frame.addEventListener("load", send);

    if (frame.contentDocument?.readyState === "complete") send();

    return () => frame.removeEventListener("load", send);

  }, [student, events, recommendations, registrations, savedEventIds, timetable]);



  return (

    <iframe

      ref={frameRef}

      title="CampusPath AI Student Dashboard"

      srcDoc={DASHBOARD_HTML}

      style={{

        width: "100%",

        height: "100vh",

        minHeight: "760px",

        border: "0",

        display: "block",

      }}

    />

  );

}



export default StudentDashboardUI;