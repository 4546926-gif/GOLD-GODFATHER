const $ = id => document.getElementById(id);
let chart, candleSeries, ema50Series, ema200Series, currentTf = "5m";
let latest = {}, scanResult = null;
const checkNames = [
  "Daily and 4H direction agree","1H market structure supports bias",
  "15M liquidity sweep detected","BOS or CHOCH confirmation",
  "Unfilled Fair Value Gap identified","Order Block near the gap",
  "50 EMA and 200 EMA aligned","5M entry candle confirmation",
  "Stop beyond swept high / low","At least 1:2 R:R to liquidity target",
  "No listed high-impact news window"
];
const fmt = n => Number.isFinite(n) ? n.toFixed(2) : "—";
const setToast = msg => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2800); };

function initChart(){
  const el=$("chart");
  chart=LightweightCharts.createChart(el,{layout:{background:{color:"#11151a"},textColor:"#89939e"},grid:{vertLines:{color:"#1d242b"},horzLines:{color:"#1d242b"}},rightPriceScale:{borderColor:"#303841"},timeScale:{borderColor:"#303841",timeVisible:true},crosshair:{mode:0}});
  candleSeries=chart.addCandlestickSeries({upColor:"#45c28a",downColor:"#ed6b70",borderUpColor:"#45c28a",borderDownColor:"#ed6b70",wickUpColor:"#45c28a",wickDownColor:"#ed6b70"});
  ema50Series=chart.addLineSeries({color:"#6ca8e8",lineWidth:1});
  ema200Series=chart.addLineSeries({color:"#b28be8",lineWidth:1});
  new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth,height:el.clientHeight})).observe(el);
}
function ema(values,period){let out=[],k=2/(period+1),prev=null;values.forEach((v,i)=>{prev=prev===null?v:v*k+prev*(1-k);if(i>=period-1)out.push({index:i,value:prev});});return out;}
function swings(candles,look=3){let highs=[],lows=[];for(let i=look;i<candles.length-look;i++){let h=true,l=true;for(let j=1;j<=look;j++){if(candles[i].high<=candles[i-j].high||candles[i].high<=candles[i+j].high)h=false;if(candles[i].low>=candles[i-j].low||candles[i].low>=candles[i+j].low)l=false;}if(h)highs.push({i,p:candles[i].high});if(l)lows.push({i,p:candles[i].low});}return {highs,lows};}
function structure(c){const s=swings(c);let h=s.highs.slice(-2),l=s.lows.slice(-2);if(h.length<2||l.length<2)return "Ranging";if(h[1].p>h[0].p&&l[1].p>l[0].p)return "Bullish";if(h[1].p<h[0].p&&l[1].p<l[0].p)return "Bearish";return "Ranging";}
function analyse(c5,c15,c1h,c4h,c1d,newsBlocked){
 const close=c=>c.map(x=>x.close), e5=ema(close(c5),50),e200=ema(close(c5),200);
 const last=c5.at(-1),prev=c5.at(-2),e50=e5.at(-1)?.value,e200v=e200.at(-1)?.value;
 const dBias=structure(c1d),h4Bias=structure(c4h),h1Bias=structure(c1h),m15Bias=structure(c15);
 const direction=dBias===h4Bias?dBias:"Mixed";
 const s15=swings(c15,2),recent=c15.at(-2),prior15=c15.slice(-20,-2);
 const prevHigh=Math.max(...prior15.map(x=>x.high)),prevLow=Math.min(...prior15.map(x=>x.low));
 const sweepDown=recent.low<prevLow&&recent.close>prevLow;
 const sweepUp=recent.high>prevHigh&&recent.close<prevHigh;
 const side=sweepDown?"BUY":sweepUp?"SELL":null;
 const c5s=swings(c5,2),recentHigh=Math.max(...c5.slice(-12,-2).map(x=>x.high)),recentLow=Math.min(...c5.slice(-12,-2).map(x=>x.low));
 const bos=side==="BUY"?last.close>recentHigh:side==="SELL"?last.close<recentLow:false;
 let fvg=null;for(let i=c5.length-3;i>=Math.max(2,c5.length-30);i--){if(side==="BUY"&&c5[i].low>c5[i-2].high){fvg={low:c5[i-2].high,high:c5[i].low};break;}if(side==="SELL"&&c5[i].high<c5[i-2].low){fvg={low:c5[i].high,high:c5[i-2].low};break;}}
 const fvgValid=!!fvg&&(side==="BUY"?last.close>fvg.low:last.close<fvg.high);
 let ob=null;if(side){for(let i=c5.length-4;i>=Math.max(0,c5.length-20);i--){if(side==="BUY"&&c5[i].close<c5[i].open&&c5.slice(i+1,i+4).some(x=>x.close>c5[i].high)){ob=c5[i];break;}if(side==="SELL"&&c5[i].close>c5[i].open&&c5.slice(i+1,i+4).some(x=>x.close<c5[i].low)){ob=c5[i];break;}}}
 const obNear=!!ob&&!!fvg&&Math.abs((ob.high+ob.low)/2-(fvg.high+fvg.low)/2)/last.close<.003;
 const emaAligned=!!side&&!!e50&&!!e200v&&(side==="BUY"?last.close>e50&&e50>e200v:last.close<e50&&e50<e200v);
 const entryCandle=!!side&&(side==="BUY"?last.close>last.open&&last.close>prev.high:last.close<last.open&&last.close<prev.low);
 const stop=side==="BUY"?Math.min(...c15.slice(-8).map(x=>x.low)):side==="SELL"?Math.max(...c15.slice(-8).map(x=>x.high)):null;
 const risk=side?Math.abs(last.close-stop):0;
 const target=side==="BUY"?Math.max(...swings(c1h).highs.slice(-5).map(x=>x.p)):side==="SELL"?Math.min(...swings(c1h).lows.slice(-5).map(x=>x.p)):null;
 const rr=side&&risk>0&&Number.isFinite(target)?Math.abs(target-last.close)/risk:0;
 const stopValid=!!side&&risk>0&&(side==="BUY"?stop<last.close:stop>last.close);
 const checks=[
  !!side&&direction===sideBias(side),
  !!side&&h1Bias===sideBias(side),
  !!side&&(sweepDown||sweepUp),
  !!side&&bos,
  !!side&&fvgValid,
  !!side&&obNear,
  emaAligned,
  entryCandle,
  stopValid,
  rr>=2,
  !newsBlocked
 ];
 const count=checks.filter(Boolean).length;
 const valid=count===11&&side;
 return {side,checks,count,dBias,h4Bias,h1Bias,m15Bias,direction,entry:last.close,stop,target,rr,valid:!!valid,e50,e200v,last};
}
function sideBias(s){return s==="BUY"?"Bullish":"Bearish";}
function paintChecks(result){
 $("checks").innerHTML=checkNames.map((n,i)=>`<div class="check-row ${result.checks[i]?"pass":"fail"}"><span class="check-icon">${result.checks[i]?"✓":"–"}</span><span>${n}</span><b class="status">${result.checks[i]?"PASS":"NOT MET"}</b></div>`).join("");
 $("confirmCount").textContent=`${result.count} / 11`;
 $("tfBias").innerHTML=[["1D",result.dBias],["4H",result.h4Bias],["1H",result.h1Bias],["15M",result.m15Bias],["5M",result.side?sideBias(result.side):"Ranging"]].map(([tf,b])=>`<div class="tf-row"><b>${tf}</b><span>${b}</span><em>${b==="Bullish"?"Bullish":b==="Bearish"?"Bearish":"Neutral / pending"}</em></div>`).join("");
}
function paintSignal(r){
 const status=r.valid?r.side:"WAIT";
 $("signalStatus").textContent=status;$("signalStatus").className="metric-value "+(r.valid?(r.side==="BUY"?"":""):"wait");
 $("signalNote").textContent=r.valid?"All 11 checks passed":"No confirmed A+ setup";
 $("setupTag").textContent=status;$("setupTag").className="tag "+(r.valid?"":"tag-wait");
 $("signalEmpty").classList.toggle("hidden",r.valid);$("tradeDetails").classList.toggle("hidden",!r.valid);
 if(r.valid){
  $("direction").textContent=r.side;$("direction").className="direction "+(r.side==="SELL"?"sell":"");
  $("entry").textContent=fmt(r.entry);$("stop").textContent=fmt(r.stop);
  const risk=Math.abs(r.entry-r.stop),sgn=r.side==="BUY"?1:-1;
  $("tp1").textContent=fmt(r.entry+sgn*risk*2);$("tp2").textContent=fmt(r.entry+sgn*risk*3);$("tp3").textContent=fmt(r.target);
  $("rr").textContent=`1 : ${r.rr.toFixed(2)}`;
  $("reason").textContent=`Daily and 4H bias align. Liquidity sweep, structure break, FVG, order-block proximity, EMA alignment and entry confirmation passed. Target: next detected 1H swing liquidity.`;
 }
 $("scanTime").textContent=new Date().toLocaleTimeString();
}
function isNewsBlocked(){const events=JSON.parse(localStorage.getItem("geai_news")||"[]"),now=Date.now();return events.some(t=>{let d=new Date(t).getTime();return now>=d-45*60000&&now<=d+15*60000;});}
async function getCandles(tf){const r=await fetch(`/api/candles?tf=${tf}`);const j=await r.json();if(!r.ok)throw new Error(j.error||"Data request failed");if(!j.values?.length)throw new Error("No candles returned");return j.values;}
async function scan(){
 $("refreshBtn").disabled=true;$("scanTime").textContent="Scanning…";
 try{
  const [c5,c15,c1h,c4h,c1d]=await Promise.all(["5m","15m","1h","4h","1d"].map(getCandles));
  latest={c5,c15,c1h,c4h,c1d};
  const r=analyse(c5,c15,c1h,c4h,c1d,isNewsBlocked());scanResult=r;
  paintChecks(r);paintSignal(r);
  const last=c5.at(-1),first=c5.at(-2),delta=last.close-first.close;
  $("price").textContent=fmt(last.close);$("change").textContent=`${delta>=0?"+":""}${fmt(delta)} vs prior candle`;$("change").className="change "+(delta>=0?"positive":"negative");
  $("lastCandle").textContent=new Date(last.time*1000).toLocaleString();$("updated").textContent=new Date().toLocaleTimeString();
  $("bias").textContent=r.direction;$("biasNote").textContent=`Daily ${r.dBias} · 4H ${r.h4Bias}`;
  $("connectionDot").className="dot ok";$("connectionText").textContent="Connected to Twelve Data";
  if(currentTf==="5m")drawChart(c5);else drawChart(await getCandles(currentTf));
  if(r.valid)saveSignal(r);
 }catch(e){
  $("connectionDot").className="dot bad";$("connectionText").textContent="Data unavailable";
  $("signalStatus").textContent="WAIT";$("signalNote").textContent="Live analysis unavailable";
  $("signalEmpty").classList.remove("hidden");$("tradeDetails").classList.add("hidden");
  $("checks").innerHTML=`<div class="check-row fail"><span class="check-icon">!</span><span>${e.message}</span></div>`;
  $("scanTime").textContent="Failed";
 }finally{$("refreshBtn").disabled=false;}
}
function drawChart(c){
 const data=c.map(x=>({time:x.time,open:x.open,high:x.high,low:x.low,close:x.close}));
 candleSeries.setData(data);
 const e50=ema(c.map(x=>x.close),50),e200=ema(c.map(x=>x.close),200);
 ema50Series.setData(e50.map(x=>({time:c[x.index].time,value:x.value})));
 ema200Series.setData(e200.map(x=>({time:c[x.index].time,value:x.value})));
 chart.timeScale().fitContent();
}
function saveSignal(r){
 let arr=JSON.parse(localStorage.getItem("geai_signals")||"[]");
 const key=`${r.side}-${r.last.time}`;
 if(!arr.some(x=>x.key===key)){arr.unshift({key,side:r.side,entry:r.entry,stop:r.stop,target:r.target,time:new Date().toISOString(),status:"OPEN"});localStorage.setItem("geai_signals",JSON.stringify(arr));renderStats();}
}
function renderStats(){const a=JSON.parse(localStorage.getItem("geai_signals")||"[]"),wins=a.filter(x=>x.status==="WIN").length,loss=a.filter(x=>x.status==="LOSS").length;$("totalSignals").textContent=a.length;$("winsLosses").textContent=`${wins} / ${loss}`;$("winRate").textContent=wins+loss?`${(wins/(wins+loss)*100).toFixed(1)}%`:"—";$("profitFactor").textContent="—";}
function renderNews(){const a=JSON.parse(localStorage.getItem("geai_news")||"[]");$("newsList").innerHTML=a.map((t,i)=>`<div class="news-item"><span>High-impact event · ${new Date(t).toLocaleString()}</span><button data-remove="${i}">Remove</button></div>`).join("");}
$("addNews").onclick=()=>{const v=$("newsTime").value;if(!v)return setToast("Choose an event date and time first.");const a=JSON.parse(localStorage.getItem("geai_news")||"[]");a.push(new Date(v).toISOString());localStorage.setItem("geai_news",JSON.stringify(a));$("newsTime").value="";renderNews();scan();};
$("newsList").onclick=e=>{const i=e.target.dataset.remove;if(i===undefined)return;const a=JSON.parse(localStorage.getItem("geai_news")||"[]");a.splice(Number(i),1);localStorage.setItem("geai_news",JSON.stringify(a));renderNews();scan();};
$("refreshBtn").onclick=scan;
$("timeframes").onclick=async e=>{const b=e.target.closest("button[data-tf]");if(!b)return;currentTf=b.dataset.tf;document.querySelectorAll("#timeframes button").forEach(x=>x.classList.toggle("selected",x===b));try{drawChart(await getCandles(currentTf));}catch(err){setToast(err.message);}};
$("exportBtn").onclick=()=>{const a=JSON.parse(localStorage.getItem("geai_signals")||"[]");const rows=[["time","side","entry","stop","target","status"],...a.map(x=>[x.time,x.side,x.entry,x.stop,x.target,x.status])];const csv=rows.map(r=>r.join(",")).join("\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const link=document.createElement("a");link.href=url;link.download="gold-edge-journal.csv";link.click();URL.revokeObjectURL(url);};
initChart();renderStats();renderNews();scan();setInterval(scan,5*60*1000);
