(function(){
const W=1080,H=1920,DUR=36;
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const P={mode:'ejer',price:3000000,aprice:1750000,fee:5200};
const save=()=>{}; // the reel stores nothing on the device
try{localStorage.removeItem('boligreel.v1')}catch(e){} // clear data saved by older versions
const num=v=>Math.min(Math.max(v,0),1e9);

/* ---------- numbers ---------- */
const kr=n=>Math.round(n).toLocaleString('da-DK');
const kr2=(n,d=2)=>n.toLocaleString('da-DK',{minimumFractionDigits:d,maximumFractionDigits:d});
function annuity(L,r,y){if(L<=0)return 0;const i=r/100/12,n=y*12;return L*i/(1-Math.pow(1+i,-n))}
function loanYear(L,r,y,bidFn){let b=L,it=0,pr=0,bd=0;const i=r/100/12,pay=annuity(L,r,y);for(let m=0;m<12;m++){const a=b*i,d=bidFn?b*bidFn(b)/12:0,p=pay-a;b-=p;it+=a;pr+=p;bd+=d}return{int:it,pr,bid:bd,mo:(it+pr+bd)/12}}
function netFromGross(g){if(g<=0)return 0;const am=.08*g,pi=g-am,pf=54100,bf=Math.min(.1275*g,63300);return g-am-.1201*Math.max(pi-pf,0)-.25*Math.max(pi-bf-pf,0)-.075*Math.max(pi-641200,0)-.075*Math.max(pi-777900,0)}
function grossForNet(n){let lo=0,hi=6e6;for(let k=0;k<60;k++){const m=(lo+hi)/2;netFromGross(m)<n?lo=m:hi=m}return hi}
function fradrag(D){const t=100000;return .33*Math.min(D,t)+.25*Math.max(D-t,0)}
function calc(){
  const o={mode:P.mode};
  if(P.mode==='ejer'){
    const p=P.price,U=.05*p,rk=.8*p,bank=.15*p;
    const bidFn=b=>{let a=0;[[0,.4,.45],[.4,.6,.85],[.6,.8,1.2]].forEach(([l,h,r])=>{a+=Math.max(0,Math.min(b-l*p,(h-l)*p))*r/100});return b>0?a/b:0};
    const R=loanYear(rk,3.5,30,bidFn),B=loanYear(bank,5.5,20);
    const costs=(1850+.006*p)+(1825+.0125*rk)+(1825+.0125*bank)+(4000+.003*rk)+(.01*bank+2500)+15000+9000;
    const v=.8*.9*p,evs=.0051*Math.min(v,9.2e6)+.014*Math.max(v-9.2e6,0),gs=.02*.8*.35*p;
    const tax=(evs+gs)/12,util=1500+700+550+350,ins=9000/12+.01*p/12+150;
    o.price=p;o.U=U;o.costs=costs;o.cash=U+costs;
    o.loan=rk+bank;o.loanMo=R.mo+B.mo;o.factor=o.loanMo/(o.loan/1000);
    o.l2a=`Realkredit 80%: ${kr(rk)} · F5 3,5%`;o.l2b=`Bank loan 15%: ${kr(bank)} · 5,5%`;
    o.extra=[['Property taxes',tax],['Heat, power, water',util],['Insurance & upkeep',ins]];
    o.house=o.loanMo+tax+util+ins;
    o.fr=fradrag(R.int+R.bid+B.int)/12;
    o.debt=o.loan;
    o.l1b=`Tinglysning, loan fees, adviser`;
    o.title=`How To Buy A ${kr(p)} kr Home`;o.sub='Denmark · Ejerbolig · October 2026';
  }else{
    const a=P.aprice,U=.05*a,L=.95*a;const A=loanYear(L,4,30);
    const costs=(1825+.0125*L)+(.01*L+3000)+8000;
    const util=800+450,ins=150+300;
    o.price=a;o.U=U;o.costs=costs;o.cash=U+costs;
    o.loan=L;o.loanMo=A.mo;o.factor=o.loanMo/(L/1000);
    o.l2a=`Andelslån 95%: ${kr(L)}`;o.l2b=`Bank rate 4,0% · 30 years`;
    o.extra=[['Boligafgift',P.fee],['Heat & power',util],['Insurance & upkeep',ins]];
    o.house=o.loanMo+P.fee+util+ins;
    o.fr=fradrag(A.int)/12;o.debt=L;
    o.l1b=`Pant registration, bank fee, adviser`;
    o.title=`How To Buy A ${kr(a)} kr Andel`;o.sub='Denmark · Andelsbolig · October 2026';
  }
  o.net=o.house-o.fr;
  o.req=6500*2+2500;
  o.gfInc=o.debt/4;
  o.budInc=grossForNet((o.net+5000+o.req)*12/2)*2;
  o.inc=Math.max(o.gfInc,o.budInc);
  return o;
}
let D=calc();

/* ---------- drawing helpers ---------- */
const C={bg1:'#0A2F39',bg2:'#0F4C59',box:'#FFFFFF',ink:'#101C21',hi:'#F4C24F',soft:'rgba(255,255,255,.72)',faint:'rgba(255,255,255,.08)',line:'rgba(255,255,255,.18)'};
const FD='"Archivo Narrow","Arial Narrow",sans-serif',FM='"IBM Plex Mono",monospace',FB='"Public Sans",sans-serif';
const cl=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const pr=(t,a,b)=>cl((t-a)/(b-a));
const eo=x=>1-Math.pow(1-x,3);
const eb=x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)};
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function fit(text,font,size,max){ctx.font=`${font.replace('$',size)}`;let s=size;while(ctx.measureText(text).width>max&&s>20){s-=2;ctx.font=font.replace('$',s)}return s}
function box(text,x,y,{font=`700 $px ${FD}`,size=72,pad=26,max=960,alpha=1,dx=0,bg=C.box,fg=C.ink,cx=0}={}){
  if(alpha<=0)return 0;
  const s=fit(text,font,size,max-pad*2);ctx.font=font.replace('$',s);
  const w=ctx.measureText(text).width+pad*2,h=s*1.32;
  const bx=x+((W-w)/2-x)*cx+dx;
  ctx.save();ctx.globalAlpha=alpha;rr(bx,y,w,h,14);ctx.fillStyle=bg;ctx.fill();
  ctx.fillStyle=fg;ctx.textBaseline='middle';ctx.fillText(text,bx+pad,y+h/2+s*.04);ctx.restore();return h;
}
function txt(text,x,y,{font,color=C.soft,alpha=1,align='left',max=900}){if(alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';
  // wrap
  const words=String(text).split(' ');let line='',yy=y;const lh=parseInt(font.match(/(\d+)px/)[1])*1.3;
  for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width>max&&line){ctx.fillText(line,x,yy);line=w;yy+=lh}else line=t}
  ctx.fillText(line,x,yy);ctx.restore();return yy+lh-y}
function spaced(text,x,y,font,color,alpha,sp=4){ctx.save();ctx.globalAlpha=alpha;ctx.font=font;ctx.fillStyle=color;let cx=x;for(const ch of text){ctx.fillText(ch,cx,y);cx+=ctx.measureText(ch).width+sp}ctx.restore()}

/* ---------- scenes ---------- */
const STEPS=()=>[
  {k:'CASH NEEDED',da:'Kontantbehov',t0:3,
    lines:[`Udbetaling 5%: ${kr(D.price)} × 0,05 = ${kr(D.U)}`,`+ ${D.l1b} ≈ ${kr(D.costs)}`,`US video shortcut was price × 8% = ${kr(D.price*.08)}`],
    val:D.cash,unit:' kr',note:'Paid from savings before you get the keys'},
  {k:'LOAN PAYMENT',da:'Ydelse',t0:10,
    lines:[D.l2a,D.l2b,`${kr(D.loan/1000)} × ${kr2(D.factor)} per 1.000 kr`],
    val:D.loanMo,unit:' kr/md',note:'Before tax, year 1, incl. bidrag'},
  {k:'ALL HOUSING COSTS',da:'Boligudgift',t0:17,
    lines:D.extra.map(([a,b])=>`+ ${a}: ${kr(b)}`),
    val:D.house,unit:' kr/md',note:`After rentefradrag: ${kr(D.net)} kr/md`},
  {k:'INCOME NEEDED',da:'Gældsfaktor & rådighedsbeløb',t0:24,
    lines:[`Danish banks don't use 43%. They use gældsfaktor 4.`,`Debt ${kr(D.debt)} ÷ 4 = ${kr(D.gfInc)}`,`Budget test, ${kr(D.req)} kr/md left over: ${kr(D.budInc)}`],
    val:D.inc,unit:' kr/yr',note:'Household gross income, 2 adults + 1 child'}
];
const listText=(i,v)=>`${i+1}. ${kr(v)} kr${['',' /md',' /md',' /yr'][i]}`;

function draw(t){
  const g=ctx.createLinearGradient(0,0,W*0.4,H);g.addColorStop(0,C.bg1);g.addColorStop(1,C.bg2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // faint grid of a ledger
  ctx.save();ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=2;for(let y=120;y<H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.restore();
  // progress
  ctx.fillStyle=C.line;ctx.fillRect(60,64,W-120,6);ctx.fillStyle=C.hi;ctx.fillRect(60,64,(W-120)*cl(t/DUR),6);

  const S=STEPS();
  // hook → title
  const mv=eo(pr(t,2.3,3.1));
  const titleY=820+(150-820)*mv, titleSize=78-10*mv;
  if(t<3.1){
    const a=eo(pr(t,0.1,0.6));
    const lbl='OCTOBER 2026 HOUSING MATH';ctx.font=`600 34px ${FB}`;const lw=ctx.measureText(lbl).width+5*lbl.length;
    spaced(lbl,(W-lw)/2,titleY-60,`600 34px ${FB}`,C.hi,a*(1-mv),5);
  }
  box(D.title,60,titleY,{size:titleSize,cx:1-mv,alpha:eo(pr(t,0.3,0.8))});
  if(t<3.1){
    const a=eo(pr(t,0.9,1.4))*(1-mv);
    txt('The Danish version: udbetaling, ydelse, gældsfaktor',W/2,titleY+170,{font:`400 38px ${FB}`,align:'center',alpha:a,max:900});
  }
  txt(D.sub,62,292,{font:`600 32px ${FB}`,color:C.soft,alpha:eo(pr(t,2.9,3.4))});

  // list stack
  S.forEach((s,i)=>{
    const ta=s.t0+5.6, a=pr(t,ta,ta+0.45);
    if(a<=0)return;
    const hl=t>=31?(Math.floor((t-31.2)/0.5)===i?1:0):0;
    box(listText(i,s.val),60,350+i*124,{size:68,alpha:1,dx:(1-eb(a))*-500,bg:hl?C.hi:C.box});
  });

  // step panel
  const panelY=900,panelH=860;
  const cur=S.findIndex(s=>t>=s.t0&&t<s.t0+7);
  if(cur>=0){
    const s=S[cur],lt=t-s.t0;
    const pa=eo(pr(lt,0,0.4))*(1-pr(lt,6.6,7));
    ctx.save();ctx.globalAlpha=pa;rr(60,panelY,W-120,panelH,28);ctx.fillStyle=C.faint;ctx.fill();ctx.strokeStyle=C.line;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    spaced(`STEP ${cur+1} · ${s.k}`,104,panelY+84,`700 36px ${FB}`,C.hi,pa,4);
    txt(s.da,104,panelY+136,{font:`italic 400 32px ${FB}`,alpha:pa});
    let y=panelY+230;
    s.lines.forEach((ln,j)=>{
      const a=eo(pr(lt,0.6+j*0.9,1.0+j*0.9))*pa;
      const h=txt(ln,104+(1-a)*30,y,{font:`500 40px ${FM}`,color:'#FFFFFF',alpha:a,max:W-220});
      y+=Math.max(h,60)+26;
    });
    const ca=eo(pr(lt,3.4,4.6));
    const v=s.val*ca;
    ctx.save();ctx.globalAlpha=pa*eo(pr(lt,3.3,3.6));ctx.strokeStyle=C.line;ctx.beginPath();ctx.moveTo(104,panelY+560);ctx.lineTo(W-104,panelY+560);ctx.stroke();ctx.restore();
    if(lt>3.3){
      ctx.save();ctx.globalAlpha=pa;ctx.fillStyle=C.hi;const sz=fit(`${kr(v)}${s.unit}`,`500 $px ${FM}`,104,W-208);ctx.font=`500 ${sz}px ${FM}`;ctx.textBaseline='alphabetic';ctx.fillText(`${kr(v)}${s.unit}`,104,panelY+690);ctx.restore();
      txt(s.note,104,panelY+770,{font:`400 32px ${FB}`,alpha:pa*eo(pr(lt,4.4,4.9)),max:W-208});
    }
  }
  // outro
  if(t>=31){
    const a=eo(pr(t,31.1,31.7));
    ctx.save();ctx.globalAlpha=a;rr(60,panelY,W-120,panelH,28);ctx.fillStyle=C.faint;ctx.fill();ctx.restore();
    spaced('YOUR NUMBERS WILL DIFFER',104,panelY+96,`700 36px ${FB}`,C.hi,a,4);
    txt('Savings, other debt, kids and the bank you choose all change the answer.',104,panelY+180,{font:`400 40px ${FB}`,color:'#FFFFFF',alpha:a,max:W-208});
    const b=eo(pr(t,32.4,33.0));
    box('Try your own numbers',104,panelY+400,{size:66,alpha:b,bg:C.hi,dx:(1-b)*60});
    txt('Ejerbolig or andelsbolig · Boligberegner',104,panelY+560,{font:`600 34px ${FB}`,alpha:eo(pr(t,33.2,33.8))});
    txt('Save this before you talk to your bank.',104,panelY+640,{font:`400 34px ${FB}`,alpha:eo(pr(t,33.8,34.4))});
  }
  txt('Estimate · rates and fees October 2026 · not financial advice',W/2,H-60,{font:`400 26px ${FB}`,color:'rgba(255,255,255,.5)',align:'center',alpha:pr(t,3,3.5),max:1000});
}
window.__draw=draw;window.__DUR=DUR;
window.__set=o=>{
  if(o.mode==='ejer'||o.mode==='andel')P.mode=o.mode;
  for(const k of ['price','aprice','fee'])if(typeof o[k]==='number'&&isFinite(o[k]))P[k]=num(o[k]);
  D=calc()};

/* ---------- player ---------- */
const playB=document.getElementById('play'),scrub=document.getElementById('scrub'),tm=document.getElementById('time');
let t=0,playing=true,last=null;
function frame(now){
  if(last==null)last=now;const dt=(now-last)/1000;last=now;
  if(playing){t+=dt;if(t>DUR){t=0}}
  draw(t);scrub.value=t;tm.textContent=t.toFixed(1)+'s';
  requestAnimationFrame(frame);
}
playB.onclick=()=>{playing=!playing;playB.textContent=playing?'Pause':'Play'};
document.getElementById('restart').onclick=()=>{t=0;playing=true;playB.textContent='Pause'};
scrub.oninput=()=>{t=+scrub.value;playing=false;playB.textContent='Play'};
const priceI=document.getElementById('price'),feeI=document.getElementById('fee');
function sync(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===P.mode)));
  document.getElementById('feeRow').hidden=P.mode!=='andel';
  document.getElementById('plabel').textContent=P.mode==='ejer'?'Purchase price':'Price of the andel';
  if(document.activeElement!==priceI)priceI.value=P.mode==='ejer'?P.price:P.aprice;
  if(document.activeElement!==feeI)feeI.value=P.fee;
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{P.mode=b.dataset.mode;D=calc();sync();save();t=0;playing=true;playB.textContent='Pause'});
priceI.oninput=()=>{const v=num(+priceI.value);if(v>=100000){P.mode==='ejer'?P.price=v:P.aprice=v;D=calc();save()}};
priceI.onchange=()=>{t=0;playing=true;playB.textContent='Pause'};
feeI.oninput=()=>{const v=num(+feeI.value);if(isFinite(v)){P.fee=v;D=calc();save()}};
sync();
if(!window.__RENDER){(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>requestAnimationFrame(frame));draw(0)}
})();
