(function(){
const KEY='boligberegner.v1';
const kr=n=>(isFinite(n)?Math.round(n):0).toLocaleString('da-DK')+' kr';
const n0=n=>(isFinite(n)?Math.round(n):0).toLocaleString('da-DK');
const n2=(n,d=2)=>(isFinite(n)?n:0).toLocaleString('da-DK',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n,d=1)=>n2(n*100,d)+'%';

/* ---- type-dependent defaults (ejerbolig) ---- */
const TYPE={
  hus:{forsikring:9000,varme:1500,el:700,vand:550,renovation:350,faelles:150,vedlPct:1.0,grundPct:35},
  lejl:{forsikring:2500,varme:800,el:450,vand:0,renovation:0,faelles:2600,vedlPct:0.4,grundPct:10}
};
const RK={
  fast:{rkRate:4.5,rkKurs:98},
  f5:{rkRate:3.5,rkKurs:100},
  f3:{rkRate:3.3,rkKurs:100},
  fkort:{rkRate:2.7,rkKurs:100}
};

/* ---- input schema ---- */
const SECS=[
 {id:'hh',t:'Household',da:'Husstand',open:true},
 {id:'prop',t:'The home',da:'Boligen',open:true},
 {id:'fin',t:'Financing',da:'Finansiering',open:true},
 {id:'run',t:'Running costs',da:'Driftsudgifter',open:false},
 {id:'close',t:'Purchase costs',da:'Handelsomkostninger',open:false},
 {id:'crit',t:'Bank criteria',da:'Bankens krav',open:false}
];
const F=[
 ['hh','adults','Adults buying','Antal voksne','seg',2,null,{opts:[[1,'1'],[2,'2']]}],
 ['hh','kids','Children at home','Børn','num',1,null,{u:'',step:1}],
 ['hh','inc1','Gross income, adult 1','Bruttoindkomst','num',520000,null,{u:'kr/yr',step:5000}],
 ['hh','inc2','Gross income, adult 2','Bruttoindkomst','num',440000,null,{u:'kr/yr',step:5000,cond:s=>s.adults==2}],
 ['hh','netOverride','Net pay, whole household','Udbetalt løn i alt','num',0,null,{u:'kr/md',step:500,help:'Leave 0 to estimate from gross income. A figure from your payslips or forskudsopgørelse is more precise.'}],
 ['hh','savings','Savings for the purchase','Opsparing','num',350000,null,{u:'kr',step:10000}],
 ['hh','otherDebt','Other debt','Anden gæld (bil, SU …)','num',60000,null,{u:'kr',step:5000}],
 ['hh','otherDebtPay','Payments on other debt','Ydelse på anden gæld','num',1500,null,{u:'kr/md',step:100}],
 ['hh','fixedExp','Other fixed expenses','Faste udgifter','num',5500,null,{u:'kr/md',step:250,help:'Transport/car, daycare, non-home insurance, phone, subscriptions, union & a-kasse.'}],

 ['prop','propType','Type of home','Boligtype','seg','hus','ejer',{opts:[['hus','House'],['lejl','Apartment']]}],
 ['prop','price','Purchase price','Kontantpris','num',3200000,'ejer',{u:'kr',step:25000}],
 ['prop','aPrice','Price of the andel','Andelspris inkl. forbedringer','num',1750000,'andel',{u:'kr',step:25000}],
 ['prop','losore','Fixtures bought separately','Løsøre','num',25000,'andel',{u:'kr',step:1000,help:'Paid in cash. Banks rarely finance løsøre.'}],
 ['prop','udbPct','Down payment','Udbetaling','num',5,null,{u:'%',step:0.5,help:'Legal minimum 5%. On an ejerbolig, 20% or more removes the bank loan entirely.'}],
 ['prop','valPct','Public valuation, % of price','Offentlig ejendomsvurdering','num',90,'ejer',{u:'%',step:1,help:'Look it up on vurderingsportalen.dk.'}],
 ['prop','grundPct','Land value, % of price','Grundværdi','num',35,'ejer',{u:'%',step:1}],
 ['prop','promille','Municipal land-tax rate','Grundskyldspromille','num',20,'ejer',{u:'‰',step:0.1,help:'Varies by kommune, roughly 5–30‰.'}],
 ['prop','boligafgift','Monthly housing fee','Boligafgift','num',5200,'andel',{u:'kr/md',step:100,help:'Covers the association’s debt, building insurance, grundskyld and upkeep.'}],
 ['prop','fDebt','Your share of the association’s debt','Andel af foreningens gæld','num',650000,'andel',{u:'kr',step:10000,help:'From the association’s accounts. Shows the “technical price”.'}],
 ['prop','inclFDebt','Count association debt in gældsfaktor','Medregn foreningsgæld','chk',false,'andel',{help:'Some banks do this; most look at your personal debt only.'}],

 ['fin','rkProduct','Mortgage type','Realkreditlån','sel','f5','ejer',{opts:[['fast','Fixed rate, 30 years'],['f5','F5 (rate fixed 5 years)'],['f3','F3 (rate fixed 3 years)'],['fkort','F-kort / variable']]}],
 ['fin','rkRate','Mortgage interest rate','Rente','num',3.5,'ejer',{u:'%',step:0.05}],
 ['fin','rkKurs','Bond price','Kurs','num',100,'ejer',{u:'',step:0.25,help:'Below 100 means the loan principal must be larger to pay out the amount you need (kurstab).'}],
 ['fin','rkTerm','Mortgage term','Løbetid','num',30,'ejer',{u:'yr',step:1}],
 ['fin','rkIO','Interest-only years','Afdragsfrihed (10 år)','chk',false,'ejer',{help:'Lower payment now, more debt later. Often refused if gældsfaktor > 4.'}],
 ['fin','bankRate','Bank loan rate (80–95%)','Boliglån, rente','num',5.5,'ejer',{u:'%',step:0.1}],
 ['fin','bankTerm','Bank loan term','Boliglån, løbetid','num',20,'ejer',{u:'yr',step:1}],
 ['fin','bid1','Bidrag, 0–40% of value','Bidragssats','num',0.45,'ejer',{u:'%/yr',step:0.05}],
 ['fin','bid2','Bidrag, 40–60%','Bidragssats','num',0.85,'ejer',{u:'%/yr',step:0.05}],
 ['fin','bid3','Bidrag, 60–80%','Bidragssats','num',1.20,'ejer',{u:'%/yr',step:0.05,help:'Interest-only loans usually carry about 0.25 points more. This is added automatically.'}],
 ['fin','aRate','Andel loan rate','Andelsboliglån, rente','num',4.0,'andel',{u:'%',step:0.05}],
 ['fin','aTerm','Andel loan term','Løbetid','num',30,'andel',{u:'yr',step:1}],

 ['run','forsikring','Home insurance','Hus- og grundejerforsikring','num',9000,'ejer',{u:'kr/yr',step:250}],
 ['run','varme','Heating','Varme','num',1500,'ejer',{u:'kr/md',step:50}],
 ['run','el','Electricity','El','num',700,'ejer',{u:'kr/md',step:50}],
 ['run','vand','Water & drainage','Vand og afledning','num',550,'ejer',{u:'kr/md',step:25}],
 ['run','renovation','Waste collection','Renovation','num',350,'ejer',{u:'kr/md',step:25}],
 ['run','faelles','Owners’ association / common costs','Fællesudgifter / grundejerforening','num',150,'ejer',{u:'kr/md',step:50}],
 ['run','vedlPct','Maintenance','Vedligeholdelse','num',1.0,'ejer',{u:'% of price/yr',step:0.1}],
 ['run','aIndbo','Contents insurance','Indboforsikring','num',150,'andel',{u:'kr/md',step:25}],
 ['run','aVarme','Heating (aconto)','Varme','num',800,'andel',{u:'kr/md',step:50}],
 ['run','aEl','Electricity','El','num',450,'andel',{u:'kr/md',step:50}],
 ['run','aVand','Water, if not in the fee','Vand','num',0,'andel',{u:'kr/md',step:25}],
 ['run','aVedl','Interior upkeep','Indvendig vedligeholdelse','num',300,'andel',{u:'kr/md',step:50}],

 ['close','raadgiver','Buyer’s adviser / lawyer','Køberrådgiver','num',15000,'ejer',{u:'kr',step:500}],
 ['close','ejerskifte','Change-of-ownership insurance (your half)','Ejerskifteforsikring','num',9000,'ejer',{u:'kr',step:500}],
 ['close','rkGebyr','Mortgage case fee','Lånesagsgebyr','num',4000,'ejer',{u:'kr',step:250}],
 ['close','rkKurtPct','Brokerage & settlement fee','Kurtage og afregningsprovision','num',0.3,'ejer',{u:'%',step:0.05}],
 ['close','bankStiftPct','Bank arrangement fee','Stiftelsesprovision','num',1.0,'ejer',{u:'%',step:0.1}],
 ['close','bankGebyr','Bank setup fee','Etableringsgebyr','num',2500,'ejer',{u:'kr',step:250}],
 ['close','skoedeFix','Deed registration, fixed','Tinglysning skøde, fast','num',1850,'ejer',{u:'kr',step:25}],
 ['close','skoedePct','Deed registration, variable','Tinglysning skøde','num',0.6,'ejer',{u:'%',step:0.05}],
 ['close','aRaadgiver','Buyer’s adviser','Køberrådgiver','num',8000,'andel',{u:'kr',step:500}],
 ['close','aAdmin','Administrator transfer fee (buyer’s part)','Overdragelsesgebyr','num',0,'andel',{u:'kr',step:250,help:'Usually paid by the seller.'}],
 ['close','aStiftPct','Bank arrangement fee','Stiftelsesprovision','num',1.0,'andel',{u:'%',step:0.1}],
 ['close','aGebyr','Bank setup fee','Etableringsgebyr','num',3000,'andel',{u:'kr',step:250}],
 ['close','pantFix','Loan registration, fixed','Tinglysning pant, fast','num',1825,null,{u:'kr',step:25}],
 ['close','pantPct','Loan registration, variable','Tinglysning pant','num',1.25,null,{u:'%',step:0.05}],

 ['crit','gfLimit','Max debt-to-income','Gældsfaktor, maks.','num',4.0,null,{u:'×',step:0.1}],
 ['crit','perAdult','Required left-over per adult','Rådighedsbeløb pr. voksen','num',6500,null,{u:'kr/md',step:250}],
 ['crit','perChild','Required left-over per child','Rådighedsbeløb pr. barn','num',2500,null,{u:'kr/md',step:250}],
 ['crit','stressPP','Stress test: rate increase','Stresstest','num',1.0,null,{u:'pp',step:0.25}],
 ['crit','fHigh','Tax value of interest, first band','Rentefradrag','num',33,null,{u:'%',step:0.5}],
 ['crit','fThr','First band, per adult','Grænse pr. person','num',50000,null,{u:'kr/yr',step:1000}],
 ['crit','fLow','Tax value above the band','Rentefradrag over grænsen','num',25,null,{u:'%',step:0.5}]
];

/* ---- info popups: [what it means, how to find it, where the default comes from] ---- */
const EX='An example figure, not a statistic. Replace it with your own.';
const TY='A rough typical level. It changes when you switch between House and Apartment.';
const FEE='A typical level in 2026. Check the figure in your loan offer.';
const TL='The 2026 rate set by law (tinglysningsafgiftsloven), see skat.dk.';
const INFO={
 adults:['How many adults will be on the loan. The bank adds up their incomes and debts.','Count everyone who will sign the loan documents.',EX],
 kids:['Children living at home. The bank’s minimum rådighedsbeløb goes up for each child.','Count the children who live with you.',EX],
 inc1:['Yearly pay before tax and AM-bidrag (bruttoindkomst), including fixed bonuses the bank can count.','See “Lønindkomst” on your årsopgørelse or forskudsopgørelse at skat.dk, or multiply the gross monthly pay on your payslip by 12.',EX],
 inc2:['Yearly pay before tax and AM-bidrag for the second adult.','See “Lønindkomst” on their årsopgørelse or forskudsopgørelse at skat.dk, or multiply the gross monthly pay on their payslip by 12.',EX],
 netOverride:['What the household is actually paid each month after tax. The bank uses it for the rådighedsbeløb.','Add up “Udbetalt” on your latest payslips, or use the monthly figures on your forskudsopgørelse at skat.dk.','At 0 the calculator estimates net pay from gross income with 2026 tax rates from skat.dk, without church tax or pension.'],
 savings:['Cash you can put into the purchase: the down payment plus all purchase costs.','Add up your bank and savings accounts, minus any buffer you want to keep. Pension savings do not count.',EX],
 otherDebt:['Everything else you owe, such as car loans, SU loans, credit cards and consumer loans. It counts in the gældsfaktor.','Check your bank and loan statements. SU debt is shown by Udbetaling Danmark on borger.dk.',EX],
 otherDebtPay:['What you pay each month on your other debt.','See your loan statements or the payment overview in your online bank.',EX],
 fixedExp:['Fixed monthly costs that are not housing or debt. The bank subtracts them before it checks what is left.','Go through 3 months of bank statements and average your fixed payments.',EX],
 propType:['House or apartment. It switches the default running costs, maintenance and land share.','See the sales listing (salgsopstilling).','An example. Pick the type you are buying.'],
 price:['The asking or agreed price (kontantpris).','See the listing on boligsiden.dk or the estate agent’s salgsopstilling.',EX],
 aPrice:['What you pay the seller for the andel, including improvements (forbedringer). The association sets the highest legal price.','See the seller’s price list and the association’s nøgleoplysningsskema.',EX],
 losore:['Movable items bought with the andel, such as white goods or furniture, priced separately.','See the seller’s list of løsøre in the sales material.',EX],
 udbPct:['The share of the price you pay from your own savings.','Agree it with your bank. It must be at least 5%.','The legal minimum in the “god skik” rules for home loans (bekendtgørelse om god skik for boligkredit, Finanstilsynet).'],
 valPct:['The public property valuation (ejendomsvurdering) as a share of the price. Ejendomsværdiskat is worked out from it.','Search the address on vurderingsportalen.dk and divide the valuation by the price.','An example assumption. Use the real valuation when you have it.'],
 grundPct:['The land value (grundværdi) as a share of the price. Grundskyld is worked out from it.','Search the address on vurderingsportalen.dk and divide the land value by the price.','A rough typical level: 35% for a house, 10% for an apartment. It changes when you switch type.'],
 promille:['The municipal land tax rate, in per mille of the taxable land value.','Look up your kommune’s grundskyldspromille on the kommune’s website or at skat.dk.','A mid-range example. The rate differs by kommune, roughly 5–30‰.'],
 boligafgift:['The monthly fee you pay to the andelsboligforening.','See the nøgleoplysningsskema or the sales material for the andel.',EX],
 fDebt:['Your share of the association’s debt. You do not owe it personally, but you pay for it through the boligafgift.','See the association’s annual accounts (årsregnskab) or the nøgleoplysningsskema, and use your flat’s share (fordelingstal).',EX],
 inclFDebt:['Whether the bank counts your share of the association’s debt in your gældsfaktor.','Ask your bank how it treats andelsbolig debt.','Most banks look at personal debt only.'],
 rkProduct:['The type of realkredit loan.','Choose it with your bank or realkredit institute (for example Totalkredit, Nykredit, Realkredit Danmark or Jyske Realkredit).','F5 is a common choice. Picking a type fills in a typical rate and bond price.'],
 rkRate:['The interest rate on the realkreditlån, without bidrag.','See your loan offer (lånetilbud) or the current rates on your realkredit institute’s website.','A placeholder near October 2026 levels. It changes when you pick another mortgage type.'],
 rkKurs:['The price of the bonds behind the loan. At 100 you get the full amount paid out.','See your loan offer or the institute’s daily price list.','Typical: 100 for adjustable loans, around 98 for fixed rate. It changes when you pick another mortgage type.'],
 rkTerm:['How many years until the mortgage is paid off.','It is set in your loan offer, usually 30 years.','The longest standard term.'],
 rkIO:['Pay only interest and bidrag for the first 10 years, with no repayment.','Ask your bank. It usually needs a low loan-to-value or a strong budget.','Most first-time buyers start with repayment.'],
 bankRate:['The interest rate on the bank loan (boliglån) that covers 80–95% of the price.','See your bank’s loan offer.','A placeholder near October 2026 bank levels.'],
 bankTerm:['Years to repay the bank loan.','See your bank’s loan offer, often 10–30 years.','A common choice.'],
 bid1:['The yearly fee (bidrag) the realkredit institute charges on the part of the loan up to 40% of the value.','See your institute’s published bidragssatser or your loan offer.','Rounded from the large Danish institutes’ published rates. Check yours.'],
 bid2:['The yearly bidrag on the part of the loan between 40% and 60% of the value.','See your institute’s published bidragssatser or your loan offer.','Rounded from the large Danish institutes’ published rates. Check yours.'],
 bid3:['The yearly bidrag on the part of the loan between 60% and 80% of the value.','See your institute’s published bidragssatser or your loan offer.','Rounded from the large Danish institutes’ published rates. Check yours.'],
 aRate:['The interest rate on the bank’s andelsboliglån.','See your bank’s loan offer. Rates differ a lot between banks.','A placeholder near October 2026 levels. The cheapest offers start around 3%.'],
 aTerm:['Years to repay the andel loan.','See your bank’s loan offer, often up to 30 years.','A common maximum.'],
 forsikring:['Yearly house and owners’ insurance (hus- og grundejerforsikring).','See the ejerudgift in the salgsopstilling, or get a quote from an insurer.',TY],
 varme:['The monthly heating cost.','See the salgsopstilling, the energy label (energimærke) or ask the seller for last year’s bills.',TY],
 el:['The monthly electricity cost.','Use your current bills, adjusted for the size of the new home.',TY],
 vand:['Water and drainage (vand og afledning).','See the salgsopstilling or the local water company. For apartments it is often in the common costs.',TY],
 renovation:['The kommune’s fee for waste collection.','See the ejerudgift in the salgsopstilling or the kommune’s website.',TY],
 faelles:['The monthly fee to the ejerforening or grundejerforening.','See the salgsopstilling or the association’s budget.',TY],
 vedlPct:['Money set aside each year for repairs and upkeep, as a share of the price.','Read the tilstandsrapport and elinstallationsrapport for repairs that are coming.','A common rule of thumb: about 1% a year for a house and 0.4% for an apartment.'],
 aIndbo:['Contents insurance for your belongings. Building insurance is in the boligafgift.','Get a quote from your insurer.',EX],
 aVarme:['The monthly aconto payment for heating.','See the nøgleoplysningsskema or ask the association’s administrator.',EX],
 aEl:['The monthly electricity cost.','Use your current bills.',EX],
 aVand:['Water, only if it is billed separately from the boligafgift.','Ask the association or see the nøgleoplysningsskema.','Water is usually in the boligafgift.'],
 aVedl:['Upkeep inside your flat, such as paint, floors, kitchen and bathroom. The association keeps up the building.','Look at the condition of the flat and the association’s rules (vedtægter).',EX],
 raadgiver:['The fee for a buyer’s adviser or lawyer who checks the deal for you.','Ask 2–3 advisers for a fixed price.','A typical fixed price in 2026.'],
 ejerskifte:['Your half of the change-of-ownership insurance. The seller pays the other half when there is a tilstandsrapport and elinstallationsrapport.','See the insurance offer in the sales material.','A typical level for a house.'],
 rkGebyr:['The realkredit institute’s fee for setting up the loan.','See “omkostninger” in your loan offer.',FEE],
 rkKurtPct:['Brokerage and settlement fees on the bonds, as a share of the loan.','See “omkostninger” in your loan offer.',FEE],
 bankStiftPct:['The bank’s one-off fee for arranging the bank loan, as a share of the loan.','See your bank’s loan offer.',FEE],
 bankGebyr:['The bank’s fixed fee for setting up the loan.','See your bank’s loan offer.',FEE],
 skoedeFix:['The fixed state fee to register the deed (skøde).','It is set by law. See skat.dk or tinglysning.dk.',TL],
 skoedePct:['The variable state fee to register the deed, as a share of the price.','It is set by law. See skat.dk or tinglysning.dk.',TL],
 aRaadgiver:['The fee for an adviser who checks the andel, the association’s accounts and the contract.','Ask 2–3 advisers for a fixed price.','A typical fixed price in 2026.'],
 aAdmin:['The administrator’s fee for transferring the andel, if you pay part of it.','Ask the association’s administrator.','The seller usually pays it.'],
 aStiftPct:['The bank’s one-off fee for arranging the andel loan, as a share of the loan.','See your bank’s loan offer.',FEE],
 aGebyr:['The bank’s fixed fee for setting up the andel loan.','See your bank’s loan offer.',FEE],
 pantFix:['The fixed state fee to register the loan (pant), in the land register or the andelsboligbogen.','It is set by law. See skat.dk or tinglysning.dk.',TL],
 pantPct:['The variable state fee to register the loan, as a share of the loan.','It is set by law. See skat.dk or tinglysning.dk.',TL+' It was lowered from 1.45% on 1 January 2026.'],
 gfLimit:['The highest total debt divided by household gross income that the bank accepts.','Ask your bank. Most want 3.5–4.0.','Finanstilsynet’s guidance: above 4, with more than 60% loan-to-value, banks limit the loan types they offer.'],
 perAdult:['The money the bank wants each adult to have left every month after housing, debt and fixed bills.','Ask your bank for its rådighedsbeløb rules. Each bank sets its own.','A typical level in Danish banks. It is not an official figure.'],
 perChild:['The money the bank wants left every month for each child.','Ask your bank for its rådighedsbeløb rules. Each bank sets its own.','A typical level in Danish banks. It is not an official figure.'],
 stressPP:['How much higher the bank tests the interest rates, to see that you can still pay if rates rise.','Ask your bank how it stress-tests.','A common choice. Your bank may test differently.'],
 fHigh:['How much tax you save per krone of interest and bidrag, on the first band.','See the tax value of negative kapitalindkomst on skat.dk.','About 33% in 2026 (skat.dk). It depends on your kommune and church tax.'],
 fThr:['The amount of interest per adult that gets the higher tax value.','It is set by law. See skat.dk. Married couples can share it.','The 2026 limit per person (skat.dk).'],
 fLow:['How much tax you save per krone of interest above the band.','See the tax value of negative kapitalindkomst on skat.dk.','About 25% in 2026 (skat.dk).']
};

const DEF={mode:'ejer'};F.forEach(f=>DEF[f[1]]=f[5]);
let S=Object.assign({},DEF);
const MAX=1e9;
const num=v=>Math.min(Math.max(v,0),MAX);
// Stored data is untrusted: keep only known keys with the right type and range.
function clean(o){
  const out=Object.assign({},DEF);
  if(!o||typeof o!=='object')return out;
  if(o.mode==='ejer'||o.mode==='andel')out.mode=o.mode;
  F.forEach(([,id,,,type,,,opt])=>{
    if(!Object.prototype.hasOwnProperty.call(o,id))return;
    const v=o[id];
    if(type==='num'){if(typeof v==='number'&&isFinite(v))out[id]=num(v)}
    else if(type==='chk'){if(typeof v==='boolean')out[id]=v}
    else if(opt.opts.some(x=>String(x[0])===String(v)))out[id]=id==='adults'?+v:String(v);
  });
  return out;
}
let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
let remember=!!saved; // inputs are stored only after the user ticks "Remember my inputs"
if(saved)S=clean(saved);
function save(){if(!remember)return;try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function forget(){try{localStorage.removeItem(KEY)}catch(e){}}

/* ---- build ledger ---- */
const ledger=document.getElementById('ledger');
function buildLedger(){
  ledger.innerHTML='';
  SECS.forEach(sec=>{
    const d=document.createElement('details');d.className='sec';d.open=sec.open;d.id='sec-'+sec.id;
    d.innerHTML=`<summary><span>${sec.t} <span class="da">· ${sec.da}</span></span></summary><div class="fields"></div>`;
    const box=d.querySelector('.fields');
    F.filter(f=>f[0]===sec.id).forEach(f=>{
      const [_,id,label,da,type,def,show,o]=f;o.cond=o.cond||null;
      const w=document.createElement('div');w.className='f';w.dataset.id=id;
      if(show)w.dataset.show=show;
      const help=o.help?`<div class="help">${o.help}</div>`:'';
      if(type==='num'){
        w.innerHTML=`<label for="i-${id}">${label}<span class="da">${da}</span></label><div class="inp"><input id="i-${id}" type="number" inputmode="decimal" step="${o.step}"><span class="u">${o.u||''}</span></div>${help}`;
      }else if(type==='sel'){
        w.innerHTML=`<label for="i-${id}">${label}<span class="da">${da}</span></label><div class="inp"><select id="i-${id}">${o.opts.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}</select></div>${help}`;
      }else if(type==='seg'){
        w.innerHTML=`<label>${label}<span class="da">${da}</span></label><div class="seg sm" role="group" aria-label="${label}">${o.opts.map(x=>`<button type="button" id="i-${id}-${x[0]}" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>${help}`;
        w.style.gridTemplateColumns='minmax(0,1fr) auto';
      }else if(type==='chk'){
        w.className='f chk';
        w.innerHTML=`<input id="i-${id}" type="checkbox"><label for="i-${id}">${label} <span class="da">· ${da}</span></label>${help}`;
      }
      if(INFO[id])addTip(w,f);
      box.appendChild(w);
    });
    ledger.appendChild(d);
  });
  ledger.addEventListener('input',onInput);
  ledger.addEventListener('change',onInput);
  ledger.addEventListener('click',e=>{
    const q=e.target.closest('.qi');
    if(q){tipOpen===q&&tipPinned?hideTip():showTip(q,true);return}
    const b=e.target.closest('.seg button');if(!b)return;
    const id=b.closest('.f').dataset.id;let v=b.dataset.v;if(id==='adults')v=+v;
    S[id]=v;
    if(id==='propType')Object.assign(S,TYPE[v]);
    sync();calc();save();
  });
}
// "?" button after each label. Text comes from INFO (constants), set with textContent.
function defText(f){
  const [,,,,type,def,,o]=f;
  if(type==='chk')return def?'On':'Off';
  if(type!=='num')return String((o.opts.find(x=>String(x[0])===String(def))||[,def])[1]);
  return (def.toLocaleString('da-DK')+' '+(o.u||'')).trim();
}
function addTip(w,f){
  const [,id,label]=f,[what,how,src]=INFO[id];
  const lab=w.querySelector('label'),lh=document.createElement('div');lh.className='lh';
  lab.replaceWith(lh);
  const b=document.createElement('button');b.type='button';b.className='qi';b.textContent='?';
  b.setAttribute('aria-label','About: '+label);b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','tip-'+id);
  lh.append(lab,b);
  const t=document.createElement('div');t.className='tip';t.id='tip-'+id;t.setAttribute('role','note');t.hidden=true;
  [['What it is',what],['How to find it',how],['Default: '+defText(f),src]].forEach(([h,txt])=>{
    const p=document.createElement('p'),s=document.createElement('strong');s.textContent=h+'. ';p.append(s,txt);t.append(p);
  });
  w.append(t);
}
let tipOpen=null,tipPinned=false;
function showTip(b,pin){
  if(tipOpen&&tipOpen!==b)hideTip();
  document.getElementById(b.getAttribute('aria-controls')).hidden=false;
  b.setAttribute('aria-expanded','true');tipOpen=b;tipPinned=pin;
}
function hideTip(){
  if(!tipOpen)return;
  document.getElementById(tipOpen.getAttribute('aria-controls')).hidden=true;
  tipOpen.setAttribute('aria-expanded','false');tipOpen=null;tipPinned=false;
}
const canHover=matchMedia('(hover:hover) and (pointer:fine)');
ledger.addEventListener('mouseover',e=>{const q=e.target.closest('.qi');if(q&&canHover.matches&&!tipPinned)showTip(q,false)});
ledger.addEventListener('mouseout',e=>{
  if(!tipOpen||tipPinned||!e.target.closest('.qi,.tip'))return;
  const to=e.relatedTarget&&e.relatedTarget.closest?e.relatedTarget.closest('.qi,.tip'):null;
  if(to!==tipOpen&&!(to&&to.id===tipOpen.getAttribute('aria-controls')))hideTip();
});
document.addEventListener('click',e=>{if(tipOpen&&!e.target.closest('.qi,.tip'))hideTip()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tipOpen){const b=tipOpen;hideTip();b.focus()}});

function onInput(e){
  const el=e.target;if(!el.id||!el.id.startsWith('i-'))return;
  const id=el.id.slice(2);const f=F.find(x=>x[1]===id);if(!f)return;
  if(f[4]==='num'){const v=parseFloat(el.value);S[id]=isFinite(v)?num(v):0}
  else if(f[4]==='chk')S[id]=el.checked;
  else if(f[4]==='sel'){S[id]=el.value;if(id==='rkProduct'){Object.assign(S,RK[el.value]);sync(true)}}
  calc();save();
}
function sync(skipFocus){
  F.forEach(f=>{
    const [_,id,,,type,,show,o]=f;
    const w=ledger.querySelector(`.f[data-id="${id}"]`);
    let vis=!show||show===S.mode;if(vis&&o.cond)vis=o.cond(S);w.hidden=!vis;
    if(type==='num'){const el=document.getElementById('i-'+id);if(document.activeElement!==el)el.value=S[id]}
    else if(type==='sel')document.getElementById('i-'+id).value=S[id];
    else if(type==='chk')document.getElementById('i-'+id).checked=!!S[id];
    else if(type==='seg')w.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(String(S[id])===b.dataset.v)));
  });
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===S.mode)));
}

/* ---- finance core ---- */
function annuity(P,rPct,years){if(P<=0)return 0;const i=rPct/100/12,n=Math.max(1,years*12);return i===0?P/n:P*i/(1-Math.pow(1+i,-n))}
function loanYear(H,rPct,years,bidFn,io){
  let b=H,int=0,pr=0,bid=0;const i=rPct/100/12;const pay=io?0:annuity(H,rPct,years);
  for(let m=0;m<12;m++){const it=b*i;const bd=bidFn?b*bidFn(b)/12:0;const p=io?0:Math.max(0,pay-it);b-=p;int+=it;pr+=p;bid+=bd}
  return {interest:int,principal:pr,bidrag:bid,monthly:(int+pr+bid)/12,end:b};
}
function netFromGross(g){
  if(g<=0)return 0;
  const am=0.08*g,pi=g-am,pf=54100,beskf=Math.min(0.1275*g,63300);
  const bund=0.1201*Math.max(pi-pf,0),kom=0.25*Math.max(pi-beskf-pf,0);
  const mellem=0.075*Math.max(pi-641200,0),top=0.075*Math.max(pi-777900,0),ttop=0.05*Math.max(pi-2592700,0);
  return g-am-bund-kom-mellem-top-ttop;
}
function grossForNet(net){let lo=0,hi=6e6;for(let k=0;k<60;k++){const m=(lo+hi)/2;netFromGross(m)<net?lo=m:hi=m}return hi}
function fradrag(D,s){const thr=s.fThr*s.adults;return s.fHigh/100*Math.min(D,thr)+s.fLow/100*Math.max(D-thr,0)}

function compute(s,priceOverride){
  const r={mode:s.mode,cash:[],loans:[],month:[]};
  const adults=s.adults==2?2:1;
  const gross=s.inc1+(adults===2?s.inc2:0);
  const netEst=(netFromGross(s.inc1)+(adults===2?netFromGross(s.inc2):0))/12;
  const net=s.netOverride>0?s.netOverride:netEst;
  r.gross=gross;r.net=net;r.netEstimated=!(s.netOverride>0);
  r.req=s.perAdult*adults+s.perChild*s.kids;

  let loansN,loansS,debt,running,taxes,base;
  if(s.mode==='ejer'){
    const P=priceOverride??s.price;base=P;
    const U=P*s.udbPct/100,need=Math.max(0,P-U);
    const rkProv=Math.min(0.8*P,need),bank=need-rkProv;
    const H=rkProv/(Math.max(50,s.rkKurs)/100);
    const ioAdd=s.rkIO?0.25:0;
    const bidFn=b=>{if(b<=0)return 0;const t=[[0,.4,s.bid1],[.4,.6,s.bid2],[.6,.8,s.bid3]];let a=0;t.forEach(([lo,hi,rt])=>{a+=Math.max(0,Math.min(b-lo*P,(hi-lo)*P))*(rt+ioAdd)/100});return a/b};
    const io=!!s.rkIO;
    const rk=loanYear(H,s.rkRate,s.rkTerm,bidFn,io);
    const bk=loanYear(bank,s.bankRate,s.bankTerm,null,false);
    const rkS=loanYear(H,s.rkRate+s.stressPP,s.rkTerm,b=>bidFn(b)-ioAdd/100,false);
    const bkS=loanYear(bank,s.bankRate+s.stressPP,s.bankTerm,null,false);
    r.U=U;r.P=P;r.H=H;r.bank=bank;r.rkProv=rkProv;r.ltv=(H+bank)/P;
    r.loans=[
      {n:'Realkreditlån',d:`${({fast:'Fixed rate',f5:'F5',f3:'F3',fkort:'F-kort'})[s.rkProduct]}, ${s.rkTerm} yr${io?', 10 yr interest-only':''}`,amt:H,rate:s.rkRate,y:rk,bidRate:H>0?rk.bidrag/H:0},
      ...(bank>1?[{n:'Bank loan',d:`Boliglån, ${s.bankTerm} yr`,amt:bank,rate:s.bankRate,y:bk,bidRate:0}]:[])
    ];
    loansN=rk.monthly+bk.monthly;loansS=rkS.monthly+bkS.monthly;
    debt=H+bank;
    const V=P*s.valPct/100,G=P*s.grundPct/100;
    const evsBase=0.8*V;const evs=0.0051*Math.min(evsBase,9.2e6)+0.014*Math.max(evsBase-9.2e6,0);
    const gs=s.promille/1000*0.8*G;
    taxes=(evs+gs)/12;r.evs=evs;r.gs=gs;
    const util=s.varme+s.el+s.vand+s.renovation;
    const insUp=s.forsikring/12+P*s.vedlPct/100/12;
    running=util+insUp+s.faelles;
    r.cash=[
      ['Down payment','Udbetaling ('+n2(s.udbPct,1)+'%)',U],
      ['Deed registration','Tinglysning af skøde',s.skoedeFix+P*s.skoedePct/100],
      ['Mortgage registration','Tinglysning af pant, realkredit',H>0?s.pantFix+H*s.pantPct/100:0],
      ['Bank loan registration','Tinglysning af ejerpantebrev',bank>1?s.pantFix+bank*s.pantPct/100:0],
      ['Mortgage fees','Lånesagsgebyr, kurtage, afregning',H>0?s.rkGebyr+H*s.rkKurtPct/100:0],
      ['Bank loan fees','Stiftelsesprovision og gebyr',bank>1?bank*s.bankStiftPct/100+s.bankGebyr:0],
      ['Buyer’s adviser','Køberrådgiver',s.raadgiver],
      ['Change-of-ownership insurance','Ejerskifteforsikring, ½',s.ejerskifte]
    ];
    const interestDed=rk.interest+rk.bidrag+bk.interest, interestDedS=rkS.interest+rkS.bidrag+bkS.interest;
    r.ded=interestDed;r.fr=fradrag(interestDed,s);r.frS=fradrag(interestDedS,s);
    r.parts=[
      ['Interest & bidrag','Renter og bidrag',(rk.interest+rk.bidrag+bk.interest)/12,'--s1'],
      ['Repayment','Afdrag',(rk.principal+bk.principal)/12,'--s2'],
      ['Property taxes','Ejendomsværdiskat og grundskyld',taxes,'--s3'],
      ['Utilities','Varme, el, vand, renovation',util,'--s4'],
      ['Insurance & upkeep','Forsikring og vedligehold',insUp,'--s5'],
      ['Common costs','Fællesudgifter',s.faelles,'--s6']
    ];
    r.month=[
      ['Mortgage payment','Ydelse realkredit inkl. bidrag',rk.monthly],
      ...(bank>1?[['Bank loan payment','Ydelse boliglån',bk.monthly]]:[]),
      ['Property value tax','Ejendomsværdiskat',evs/12],
      ['Land tax','Grundskyld',gs/12],
      ['Heating','Varme',s.varme],['Electricity','El',s.el],['Water','Vand',s.vand],['Waste','Renovation',s.renovation],
      ['Insurance','Forsikring',s.forsikring/12],['Maintenance','Vedligeholdelse',P*s.vedlPct/100/12],
      ['Common costs','Fællesudgifter',s.faelles]
    ].filter(x=>x[2]>0.5);
    r.stressNote=`Mortgage ${n2(s.rkRate+s.stressPP)}%, bank ${n2(s.bankRate+s.stressPP)}%, with repayment`;
    r.principal=(rk.principal+bk.principal)/12;
  }else{
    const A=priceOverride??s.aPrice;base=A;
    const U=A*s.udbPct/100,L=Math.max(0,A-U);
    const ln=loanYear(L,s.aRate,s.aTerm,null,false);
    const lnS=loanYear(L,s.aRate+s.stressPP,s.aTerm,null,false);
    r.U=U;r.P=A;r.H=L;r.bank=0;r.ltv=A>0?L/A:0;
    r.loans=[{n:'Andel loan',d:`Andelsboliglån, ${s.aTerm} yr`,amt:L,rate:s.aRate,y:ln,bidRate:0}];
    loansN=ln.monthly;loansS=lnS.monthly;
    debt=L+(s.inclFDebt?s.fDebt:0);
    taxes=0;
    const util=s.aVarme+s.aEl+s.aVand,insUp=s.aIndbo+s.aVedl;
    running=util+insUp+s.boligafgift;
    r.cash=[
      ['Down payment','Udbetaling ('+n2(s.udbPct,1)+'%)',U],
      ['Fixtures','Løsøre',s.losore],
      ['Loan registration','Tinglysning af pant i andelsboligbogen',L>0?s.pantFix+L*s.pantPct/100:0],
      ['Bank loan fees','Stiftelsesprovision og gebyr',L>0?L*s.aStiftPct/100+s.aGebyr:0],
      ['Administrator fee','Overdragelsesgebyr',s.aAdmin],
      ['Buyer’s adviser','Køberrådgiver',s.aRaadgiver]
    ];
    r.ded=ln.interest;r.fr=fradrag(ln.interest,s);r.frS=fradrag(lnS.interest,s);
    r.parts=[
      ['Interest','Renter',ln.interest/12,'--s1'],
      ['Repayment','Afdrag',ln.principal/12,'--s2'],
      ['Housing fee','Boligafgift',s.boligafgift,'--s3'],
      ['Utilities','Varme, el, vand',util,'--s4'],
      ['Insurance & upkeep','Indbo og vedligehold',insUp,'--s5']
    ];
    r.month=[
      ['Andel loan payment','Ydelse andelsboliglån',ln.monthly],
      ['Housing fee','Boligafgift',s.boligafgift],
      ['Heating','Varme',s.aVarme],['Electricity','El',s.aEl],['Water','Vand',s.aVand],
      ['Contents insurance','Indboforsikring',s.aIndbo],['Interior upkeep','Vedligeholdelse',s.aVedl]
    ].filter(x=>x[2]>0.5);
    r.technical=A+s.fDebt;
    r.stressNote=`Andel loan ${n2(s.aRate+s.stressPP)}%, boligafgift +5%`;
    loansS+= s.boligafgift*0.05;
    r.principal=ln.principal/12;
  }
  r.loanMonthly=loansN;
  r.housingGross=loansN+taxes+running;
  r.housingNet=r.housingGross-r.fr/12;
  r.housingGrossS=loansS+taxes+running;
  r.housingNetS=r.housingGrossS-r.frS/12;
  r.cashNeed=r.cash.reduce((a,x)=>a+x[2],0);
  r.closing=r.cashNeed-r.U-(s.mode==='andel'?s.losore:0);
  r.totalDebt=debt+s.otherDebt;
  r.loanSum=r.H+r.bank;
  r.gf=gross>0?r.totalDebt/gross:Infinity;
  r.raad=net+r.fr/12-r.housingGross-s.otherDebtPay-s.fixedExp;
  r.raadS=net+r.frS/12-r.housingGrossS-s.otherDebtPay-s.fixedExp;
  r.base=base;
  // income needed
  const needNetM=r.housingNet+s.otherDebtPay+s.fixedExp+r.req;
  const share=adults===2&&gross>0?[s.inc1/gross,s.inc2/gross]:[1];
  // scale both incomes by a common factor until net covers need
  let lo=0,hi=20;for(let k=0;k<50;k++){const m=(lo+hi)/2;const nn=(netFromGross(gross*m*share[0])+(share[1]!=null?netFromGross(gross*m*share[1]):0))/12;nn<needNetM?lo=m:hi=m}
  r.grossForRaad=gross>0?gross*hi:grossForNet(needNetM*12/adults)*adults;
  r.grossForGf=r.totalDebt/s.gfLimit;
  r.grossNeeded=Math.max(r.grossForRaad,r.grossForGf);
  // checks
  const c=[];
  c.push({k:'udb',t:'Udbetaling ≥ 5%',st:s.udbPct>=5?'good':'bad'});
  c.push({k:'cash',t:'Savings cover the cash',st:s.savings>=r.cashNeed?'good':(s.savings>=r.cashNeed*0.9?'warn':'bad')});
  c.push({k:'gf',t:'Gældsfaktor '+n2(r.gf,1),st:r.gf<=s.gfLimit?'good':(r.gf<=s.gfLimit+0.5?'warn':'bad')});
  c.push({k:'raad',t:'Rådighedsbeløb',st:r.raad>=r.req?'good':(r.raad>=r.req*0.85?'warn':'bad')});
  c.push({k:'stress',t:'Stress test',st:r.raadS>=r.req?'good':(r.raadS>=r.req*0.85?'warn':'bad')});
  if(s.mode==='ejer'&&r.ltv>0.6&&r.gf>4&&(s.rkIO||s.rkProduct==='f3'||s.rkProduct==='fkort'))c.push({k:'ft',t:'Loan type limited (gf > 4)',st:'warn'});
  r.checks=c;
  r.overall=c.some(x=>x.st==='bad')?'bad':c.some(x=>x.st==='warn')?'warn':'good';
  return r;
}
function maxPrice(s){
  const ok=p=>{const r=compute(s,p);return s.savings>=r.cashNeed&&r.gf<=s.gfLimit&&r.raadS>=r.req&&r.raad>=r.req};
  if(!ok(10000))return {p:0,lim:limiter(s,10000)};
  let lo=10000,hi=40e6;for(let k=0;k<45;k++){const m=(lo+hi)/2;ok(m)?lo=m:hi=m}
  const p=Math.floor(lo/5000)*5000;return {p,lim:limiter(s,p+10000)};
}
function limiter(s,p){const r=compute(s,p);const L=[];if(s.savings<r.cashNeed)L.push('your savings');if(r.gf>s.gfLimit)L.push('the gældsfaktor limit');if(r.raad<r.req||r.raadS<r.req)L.push('the rådighedsbeløb'+(r.raad>=r.req?' under stress':''));return L}

/* ---- render ---- */
const $=id=>document.getElementById(id);
function row(a,da,v,cls=''){return `<tr class="${cls}"><td>${a}${da?` <span class="da">· ${da}</span>`:''}</td><td class="r">${v}</td></tr>`}
function calc(){
  const s=S,r=compute(s);
  // verdict
  const vt={good:'Likely approvable',warn:'Borderline: the bank will look closer',bad:'Not approvable as set up'}[r.overall];
  const vs={good:'Every bank test passes with these figures.',warn:'One or more tests are close to the limit. A bigger down payment, a lower price or less other debt helps.',bad:'At least one test fails. See the maximum price below.'}[r.overall];
  $('verdict').className='verdict '+r.overall;
  $('verdict').innerHTML=`<div><div class="vt">${vt}</div><div class="vs">${vs}</div></div><div class="chips">${r.checks.map(c=>`<span class="chip ${c.st}"><i></i>${c.t}</span>`).join('')}</div>`;

  // steps
  const isE=s.mode==='ejer';
  const quick=r.base*0.08;
  const factor=r.loanSum>0?r.loanMonthly/(r.loanSum/1000):0;
  const other=r.housingGross-r.loanMonthly;
  $('steps').innerHTML=`
   <div class="step"><div class="k"><b>1</b><span>Cash needed</span></div>
     <div class="big">${kr(r.cashNeed)}</div>
     <div class="formula">${n0(r.U)} udbetaling + ${n0(r.cashNeed-r.U)} costs</div>
     <div class="sub">Video’s shortcut: ${n0(r.base)} × 8% = <strong>${n0(quick)}</strong></div>
     <div class="sub">You have <strong>${n0(s.savings)}</strong>${s.savings>=r.cashNeed?'':` · short <strong>${n0(r.cashNeed-s.savings)}</strong>`}</div></div>
   <div class="step"><div class="k"><b>2</b><span>Loan payment</span></div>
     <div class="big">${kr(r.loanMonthly)}<small>/md</small></div>
     <div class="formula">${n0(r.loanSum/1000)} × ${n2(factor)} per 1.000 kr</div>
     <div class="sub">Loans <strong>${n0(r.loanSum)}</strong> · ydelse before tax, year 1</div></div>
   <div class="step"><div class="k"><b>3</b><span>All housing costs</span></div>
     <div class="big">${kr(r.housingGross)}<small>/md</small></div>
     <div class="formula">${n0(r.loanMonthly)} + ${n0(other)} ${isE?'skat, drift':'boligafgift, drift'}</div>
     <div class="sub">After rentefradrag <strong>${n0(r.housingNet)}</strong> · excl. afdrag <strong>${n0(r.housingNet-r.principal)}</strong></div></div>
   <div class="step"><div class="k"><b>4</b><span>Income needed</span></div>
     <div class="big">${kr(r.grossNeeded)}<small>/yr</small></div>
     <div class="formula">max(${n0(r.totalDebt)} ÷ ${n2(s.gfLimit,1)}, budget test)</div>
     <div class="sub">You earn <strong>${n0(r.gross)}</strong> gross · US rule ÷0.43: <strong>${n0(r.housingGross*12/0.43)}</strong></div></div>`;

  // max price
  const mp=maxPrice(s);
  $('maxp').innerHTML=`<span class="lbl">Highest ${isE?'price':'andel price'} that passes every test</span><span class="v">${kr(mp.p)}</span>
   <span class="why">${mp.p>0?`Same down payment %, rates and running costs. Above this, the first limit you hit is ${mp.lim.join(' and ')||'one of the bank tests'}.`:'With these inputs no price passes. Check savings, other debt and fixed expenses.'}${isE?'':' The boligafgift is held fixed, since it belongs to the specific association.'}</span>`;

  // bar
  const tot=r.parts.reduce((a,x)=>a+Math.max(0,x[2]),0)||1;
  $('bar').innerHTML=r.parts.filter(p=>p[2]>0.5).map(p=>`<span title="${p[0]}: ${kr(p[2])}" style="width:${p[2]/tot*100}%;background:var(${p[3]})"></span>`).join('');
  $('legend').innerHTML=r.parts.filter(p=>p[2]>0.5).map(p=>`<span><i style="background:var(${p[3]})"></i>${p[0]} <span class="num">${n0(p[2])}</span></span>`).join('');

  // cash table
  $('t-cash').innerHTML=`<table><tbody>${r.cash.filter(x=>x[2]>0.5).map(x=>row(x[0],x[1],kr(x[2]))).join('')}
    ${row('Total cash needed','',kr(r.cashNeed),'tot')}
    ${row('Your savings','Opsparing',kr(s.savings),'sub')}
    ${row(s.savings>=r.cashNeed?'Left after purchase':'Missing','',kr(Math.abs(s.savings-r.cashNeed)),'sub')}
    ${!isE?row('Technical price','Andelspris + foreningsgæld',kr(r.technical),'sub'):''}
  </tbody></table>`;

  // loans table
  $('t-loans').innerHTML=`<table><thead><tr><th>Loan</th><th class="r">Principal</th><th class="r">Rate</th><th class="r">Per month</th></tr></thead><tbody>
   ${r.loans.map(l=>`<tr><td>${l.n} <span class="da">· ${l.d}</span></td><td class="r">${n0(l.amt)}</td><td class="r">${n2(l.rate)}%${l.bidRate?`<br><small>+${n2(l.bidRate*100)}% bidrag</small>`:''}</td><td class="r">${n0(l.y.monthly)}</td></tr>`).join('')}
   <tr class="tot"><td>Total</td><td class="r">${n0(r.loanSum)}</td><td></td><td class="r">${n0(r.loanMonthly)}</td></tr>
   <tr class="sub"><td colspan="3">Year 1: interest${isE?' + bidrag':''} / repayment</td><td class="r">${n0(r.ded)} / ${n0(r.principal*12)}</td></tr>
   <tr class="sub"><td colspan="3">Loan-to-value <span class="da">· belåningsgrad</span></td><td class="r">${pct(r.ltv)}</td></tr>
   ${isE&&s.rkKurs<100?`<tr class="sub"><td colspan="3">Kurstab: principal above cash paid out</td><td class="r">${n0(r.H-r.rkProv)}</td></tr>`:''}
  </tbody></table>`;

  // month table
  $('t-month').innerHTML=`<table><tbody>${r.month.map(x=>row(x[0],x[1],kr(x[2]))).join('')}
   ${row('Housing, before tax','Brutto',kr(r.housingGross),'tot')}
   ${row('Interest deduction','Rentefradrag',' − '+kr(r.fr/12),'neg')}
   ${row('Housing, after tax','Netto',kr(r.housingNet),'tot')}
   ${row('of which repayment you keep as equity','Afdrag',kr(r.principal),'sub')}
   ${row('Per year, after tax','',kr(r.housingNet*12),'sub')}
  </tbody></table>`;

  // bank test
  const st=(v,req)=>`<span class="st ${v>=req?'good':(v>=req*0.85?'warn':'bad')}">${kr(v)}</span>`;
  $('t-bank').innerHTML=`<table><thead><tr><th>Monthly</th><th class="r">Normal</th><th class="r">Stress</th></tr></thead><tbody>
   <tr><td>Net pay <span class="da">· ${r.netEstimated?'estimated':'your figure'}</span></td><td class="r">${n0(r.net)}</td><td class="r">${n0(r.net)}</td></tr>
   <tr><td>+ Interest deduction</td><td class="r">${n0(r.fr/12)}</td><td class="r">${n0(r.frS/12)}</td></tr>
   <tr><td>− Housing, before tax</td><td class="r">${n0(r.housingGross)}</td><td class="r">${n0(r.housingGrossS)}</td></tr>
   <tr><td>− Other debt payments</td><td class="r">${n0(s.otherDebtPay)}</td><td class="r">${n0(s.otherDebtPay)}</td></tr>
   <tr><td>− Other fixed expenses</td><td class="r">${n0(s.fixedExp)}</td><td class="r">${n0(s.fixedExp)}</td></tr>
   <tr class="tot"><td>Rådighedsbeløb</td><td class="r">${st(r.raad,r.req)}</td><td class="r">${st(r.raadS,r.req)}</td></tr>
   <tr class="sub"><td>Bank minimum (${s.adults==2?2:1} adult${s.adults==2?'s':''}, ${s.kids} child${s.kids==1?'':'ren'})</td><td class="r">${n0(r.req)}</td><td class="r">${n0(r.req)}</td></tr>
   <tr class="sub"><td colspan="2">Stress scenario</td><td class="r" style="white-space:normal">${r.stressNote}</td></tr>
   <tr><td>Gældsfaktor <span class="da">· ${n0(r.totalDebt)} ÷ ${n0(r.gross)}</span></td><td class="r"><span class="st ${r.gf<=s.gfLimit?'good':(r.gf<=s.gfLimit+0.5?'warn':'bad')}">${n2(r.gf)}</span></td><td class="r">max ${n2(s.gfLimit,1)}</td></tr>
  </tbody></table>`;
  window.__last=r;
}

/* ---- toolbar ---- */
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{S.mode=b.dataset.mode;sync();calc();save()}));
$('reset').addEventListener('click',()=>{const m=S.mode;S=Object.assign({},DEF,{mode:m});save();sync();calc();flash('Example restored')});
function flash(t){$('toast').textContent=t;setTimeout(()=>$('toast').textContent='',2200)}
$('copy').addEventListener('click',()=>{
  const r=window.__last,s=S,isE=s.mode==='ejer';
  const lines=[
   `Boligberegning – ${isE?'Ejerbolig ('+(s.propType==='hus'?'hus':'ejerlejlighed')+')':'Andelsbolig'}`,
   `${isE?'Kontantpris':'Andelspris'}: ${kr(r.base)}`,
   `Udbetaling: ${kr(r.U)} (${n2(s.udbPct,1)}%)  ·  Handelsomkostninger: ${kr(r.cashNeed-r.U)}  ·  Kontantbehov i alt: ${kr(r.cashNeed)}`,
   ...r.loans.map(l=>`${l.n}: ${kr(l.amt)} @ ${n2(l.rate)}% – ydelse ${kr(l.y.monthly)}/md`),
   `Boligudgift før skat: ${kr(r.housingGross)}/md  ·  efter rentefradrag: ${kr(r.housingNet)}/md`,
   `Husstandens bruttoindkomst: ${kr(r.gross)}  ·  Gældsfaktor: ${n2(r.gf)}`,
   `Rådighedsbeløb: ${kr(r.raad)}/md (stresstest ${kr(r.raadS)}/md, krav ${kr(r.req)}/md)`,
   `Vurdering: ${{good:'Ser godkendelig ud',warn:'Grænsetilfælde',bad:'Ikke godkendelig som opstillet'}[r.overall]}`
  ].join('\n');
  const done=()=>flash('Copied');
  try{navigator.clipboard.writeText(lines).then(done,()=>fallback(lines))}catch(e){fallback(lines)}
});
function fallback(t){const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');flash('Copied')}catch(e){flash('Select and copy manually')}ta.remove()}

buildLedger();sync();calc();
if(saved)$('exnote').hidden=true;
const rem=$('remember');rem.checked=remember;
rem.addEventListener('change',()=>{remember=rem.checked;remember?save():forget();flash(remember?'Saved on this device':'Removed from this device')});

/* ---- updates, the same way as Heartbeat ---- */
// Live site only: cache the app so it opens offline. A new release (new sw.js) installs itself;
// the page then offers Restart, so nothing being typed is lost. Saved inputs are untouched.
if('serviceWorker' in navigator&&location.protocol==='https:'&&location.hostname.endsWith('github.io'))navigator.serviceWorker.register('sw.js').catch(()=>{});
if('serviceWorker' in navigator){
  const sw=navigator.serviceWorker;let wanted=false,claimed=!!sw.controller;
  // the first take-over on a brand-new install is not an update
  sw.addEventListener('controllerchange',()=>{if(!claimed){claimed=true;return}if(wanted)location.reload();else $('upd-bar').hidden=false});
  $('upd-restart').addEventListener('click',()=>location.reload());
  const check=()=>sw.getRegistration().then(r=>r&&r.update()).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
  setInterval(check,3600000);
  $('upd-btn').addEventListener('click',async()=>{
    const st=$('upd-status'),b=$('upd-btn');
    if(!$('upd-bar').hidden){location.reload();return}
    const reg=await sw.getRegistration().catch(()=>null);
    if(!reg){st.textContent='Loading the latest version…';location.reload();return}
    b.disabled=true;st.textContent='Checking…';wanted=true;
    try{await reg.update()}catch(e){wanted=false;b.disabled=false;st.textContent='Could not check. Connect to the internet and try again.';return}
    const w=reg.installing||reg.waiting;
    if(!w){wanted=false;b.disabled=false;st.textContent='You have the latest version.';return}
    st.textContent='New version found. Installing…';
    w.addEventListener('statechange',()=>{if(w.state==='redundant'){wanted=false;b.disabled=false;st.textContent='The update did not finish. Try again later.'}});
    if(reg.waiting)reg.waiting.postMessage('skip');
  });
}else $('upd-btn').addEventListener('click',()=>location.reload());
})();
