// Animated cosmetics, round 2: big win effects, profile backdrops, title
// packs (data only) and the canvas-drawn avatar frames.
//
// Everything here draws onto <canvas data-cfx="kind:key[:part]"> elements.
// One shared animator (bottom of file) finds those canvases anywhere in the
// page, runs them only while they're on screen and drops them when they
// leave the DOM, so pages just render markup and never manage loops.
//   fx:<key>            win effect preview (design box 300x170, scaled)
//   bg:<key>            profile backdrop (draws at the canvas' real size)
//   frame:<key>:back    avatar frame layer behind the avatar circle
//   frame:<key>:front   avatar frame layer on top of it
// playWinFx(key, amount) plays a win effect full screen, once.

const DPR = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
const H = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const TAU = Math.PI * 2, P = 3.2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
let FXT = '+48,200';

/* eslint-disable */

/* ---------- shared drawing helpers ---------- */
function popScale(k){if(k<0)return 0;if(k<.12)return .5+k/.12*.7;if(k<.26)return 1.2-(k-.12)/.14*.2;return 1}
function winText(x,w,h,u,o={}){
  const at=o.at??.35,k=u-at;if(k<0)return;
  const s=o.scale?o.scale(k):popScale(k),a=u>P-.45?clamp((P-u)/.45):1;
  x.save();x.globalAlpha=a;x.translate(w/2+(o.dx||0),(o.y??h/2)+(o.dy||0));x.scale(s,s);
  x.font=`800 ${o.size||32}px Inter`;x.textAlign='center';x.textBaseline='middle';
  if(o.glow){x.shadowColor=o.glow;x.shadowBlur=18}
  x.fillStyle=o.fill?o.fill(x):(o.col||'#10b981');x.fillText(o.text||FXT,0,0);
  if(o.stroke){x.shadowBlur=0;x.lineWidth=1;x.strokeStyle=o.stroke;x.strokeText(o.text||FXT,0,0)}
  x.restore();
}
function coin(x,px,py,r,spin,a=1){x.save();x.globalAlpha=a;x.beginPath();x.ellipse(px,py,Math.max(.6,r*Math.abs(spin)),r,0,0,TAU);x.fillStyle=spin>0?'#D4AF37':'#b8901f';x.fill();x.lineWidth=1;x.strokeStyle='#f5df98';x.stroke();x.restore()}
function glowFill(x,col,b){x.shadowColor=col;x.shadowBlur=b}
const noiseCache={};
function noise(key,base,amt){
  if(noiseCache[key])return noiseCache[key];
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const d=g.createImageData(128,128);
  for(let i=0;i<d.data.length;i+=4){const v=Math.random()*amt;d.data[i]=d.data[i+1]=d.data[i+2]=v>amt/2?255:0;d.data[i+3]=Math.random()*28}
  g.putImageData(d,0,0);return noiseCache[key]=c;
}

/* ---------- premium FX helpers ---------- */
function flash(x,cx,cy,r,rgb,a){if(a<=0)return;x.save();x.globalCompositeOperation='lighter';const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(${rgb},${clamp(a)})`);g.addColorStop(.4,`rgba(${rgb},${clamp(a)*.35})`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);x.restore()}
function rays(x,cx,cy,n,len,rot,rgb,a){if(a<=0)return;x.save();x.globalCompositeOperation='lighter';x.translate(cx,cy);x.rotate(rot);for(let i=0;i<n;i++){x.rotate(TAU/n);const L=len*(.7+.3*H(i+n));const g=x.createLinearGradient(0,0,0,-L);g.addColorStop(0,`rgba(${rgb},${a})`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;const wd=L*Math.tan(Math.PI/n)*.45;x.beginPath();x.moveTo(0,0);x.lineTo(-wd,-L);x.lineTo(wd,-L);x.fill()}x.restore()}
function sparkle(x,px,py,s,col,a=1){if(s<=0||a<=0)return;x.save();x.globalCompositeOperation='lighter';x.globalAlpha=a;x.fillStyle=col;x.translate(px,py);x.beginPath();x.moveTo(0,-s);x.quadraticCurveTo(0,0,s,0);x.quadraticCurveTo(0,0,0,s);x.quadraticCurveTo(0,0,-s,0);x.quadraticCurveTo(0,0,0,-s);x.fill();x.beginPath();x.arc(0,0,s*.25,0,TAU);x.fill();x.restore()}
function coin3d(x,px,py,r,ang,a=1){const s=Math.cos(ang),rx=Math.max(.8,r*Math.abs(s)),th=r*.3*Math.abs(Math.sin(ang)),sd=Math.sin(ang)>=0?1:-1;x.save();x.globalAlpha=a;x.translate(px,py);
  if(th>.4){x.fillStyle='#7a560c';x.beginPath();x.ellipse(th*.6*sd,0,rx,r,0,0,TAU);x.fill();x.fillStyle='#b8901f';x.fillRect(Math.min(0,th*.6*sd),-r,Math.abs(th*.6),2*r)}
  const g=x.createLinearGradient(-rx,-r,rx,r);g.addColorStop(0,s>0?'#fff4bf':'#f0d070');g.addColorStop(.45,s>0?'#f0c443':'#c99a22');g.addColorStop(1,'#8a6410');x.fillStyle=g;x.beginPath();x.ellipse(0,0,rx,r,0,0,TAU);x.fill();
  x.strokeStyle='rgba(255,236,170,.85)';x.lineWidth=.8;x.beginPath();x.ellipse(0,0,rx*.72,r*.72,0,0,TAU);x.stroke();
  if(rx>r*.5){x.fillStyle='rgba(120,80,10,.55)';x.font=`800 ${r*.95}px Inter`;x.textAlign='center';x.textBaseline='middle';x.save();x.scale(rx/r,1);x.fillText('$',0,r*.05);x.restore()}
  if(s>.8){x.fillStyle='rgba(255,255,255,.9)';x.beginPath();x.ellipse(-rx*.35,-r*.42,rx*.2,r*.12,-.6,0,TAU);x.fill()}x.restore()}
function premiumText(x,w,h,u,o){const at=o.at??.35,k=u-at;if(k<0)return;const s=o.scale?o.scale(k):popScale(k),a=u>P-.45?clamp((P-u)/.45):1,sz=o.size||34,txt=o.text||FXT;
  x.save();x.globalAlpha=a;x.translate(w/2+(o.dx||0),(o.y??h/2)+(o.dy||0));x.scale(s*(o.sx||1),s);x.font=`800 ${sz}px Inter`;x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
  x.lineWidth=7;x.strokeStyle='rgba(0,0,0,.7)';x.strokeText(txt,0,3);
  const gr=x.createLinearGradient(0,-sz*.5,0,sz*.5);gr.addColorStop(0,o.g[0]);gr.addColorStop(.55,o.g[1]);gr.addColorStop(1,o.g[2]);
  if(o.glow){x.shadowColor=o.glow;x.shadowBlur=24}x.fillStyle=gr;x.fillText(txt,0,0);x.shadowBlur=0;
  x.lineWidth=1.2;x.strokeStyle=o.edge||'rgba(255,255,255,.6)';x.strokeText(txt,0,0);
  const sp=((u-at)*.9)%1.4-.2;if(sp>0&&sp<1){const tw=x.measureText(txt).width,sx=-tw/2+sp*tw;const sg=x.createLinearGradient(sx-18,0,sx+18,0);sg.addColorStop(0,'rgba(255,255,255,0)');sg.addColorStop(.5,'rgba(255,255,255,.55)');sg.addColorStop(1,'rgba(255,255,255,0)');
    x.globalCompositeOperation='lighter';x.fillStyle=sg;x.fillText(txt,0,0)}
  x.restore()}
function bolt(x0,y0,x1,y1,seed,disp){let pts=[[x0,y0],[x1,y1]];for(let l=0;l<6;l++){const n=[pts[0]];for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],L=Math.hypot(bx-ax,by-ay),o=(H(seed++)-.5)*L*disp;n.push([(ax+bx)/2+(-(by-ay)/L)*o,(ay+by)/2+((bx-ax)/L)*o],pts[i])}pts=n}return pts}
function strokePts(x,pts){x.beginPath();x.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)x.lineTo(pts[i][0],pts[i][1]);x.stroke()}

/* ================= BIG WIN FX ================= */

/* ================= BIG WIN FX ================= */
const FX=[
{n:'Coin fountain',r:'Common',k:'fx_coin_fountain',d:'A geyser of shiny 3D coins erupts from below, spinning and glinting as they fall.',f(x,t,w,h){const u=t%P;
  flash(x,w/2,h+20,170,'255,200,80',.55*clamp(u*4)*clamp((2.7-u)*1.5));rays(x,w/2,h+10,14,h*1.3,Math.sin(t*.6)*.15,'255,210,110',.12*clamp(u*3)*clamp((2.7-u)));
  const C=[];for(let i=0;i<64;i++){const s=u-H(i)*1.1;if(s<0||s>2.3)continue;const vx=(H(i+50)-.5)*230,vy=-(250+H(i+90)*130),py=h+14+vy*s+280*s*s;C.push([H(i+3),w/2+vx*s,py,4.5+H(i+3)*4.5,s*(5+H(i)*7)+H(i)*6,clamp((2.3-s)*3)])}
  C.sort((a,b)=>a[0]-b[0]).forEach(c=>coin3d(x,c[1],c[2],c[3],c[4],c[5]));
  for(let i=0;i<16;i++){const ph=(t*1.4+H(i+40))%1;sparkle(x,w/2+(H(i+41)-.5)*w*.75,h*(.15+.7*H(i+42)),Math.sin(ph*Math.PI)*6,'#fff6d0',clamp(u-.2))}
  premiumText(x,w,h,u,{at:.3,g:['#fffbe6','#f5c84a','#9a6a08'],glow:'rgba(240,190,60,.9)'})}},
{n:'Confetti pop',r:'Common',k:'fx_confetti_pop',d:'A party popper bursts with flipping paper, streamers and a bright ring, then the confetti flutters down.',f(x,t,w,h){const u=t%P,s=u-.3,cx=w/2,cy=h/2,C=[[16,185,129],[245,200,74],[239,68,68],[59,130,246],[244,114,182],[168,85,247]];
  if(s>0&&s<.35){x.save();x.globalAlpha=1-s/.35;x.strokeStyle='#fff';x.lineWidth=3*(1-s/.35)+.5;x.beginPath();x.arc(cx,cy,20+s*420,0,TAU);x.stroke();x.restore()}flash(x,cx,cy,120,'255,255,255',s>0?.7-s*2:0);
  if(s>0)for(let i=0;i<140;i++){const a=H(i)*TAU,sp=110+H(i+7)*280,d=(1-Math.exp(-4.5*s))/4.5,fall=Math.max(0,s-.35),px=cx+Math.cos(a)*sp*d+Math.sin(s*5+i)*9*clamp(fall*3),py=cy+Math.sin(a)*sp*d*.8+22*fall*fall+18*fall;
    const [r,g,b]=C[i%6],fl=Math.cos(s*(8+H(i+2)*8)+i),sh=.55+.45*Math.abs(fl);x.save();x.globalAlpha=clamp((2.7-s)*2);x.translate(px,py);x.rotate(H(i+5)*TAU+s*(2+H(i+3)*5));x.fillStyle=`rgb(${r*sh|0},${g*sh|0},${b*sh|0})`;
    const ty=i%4;if(ty<2){x.scale(fl,1);x.fillRect(-4.5,-2.5,9,5)}else if(ty==2){x.scale(1,fl);x.beginPath();x.arc(0,0,3,0,TAU);x.fill()}else{x.strokeStyle=x.fillStyle;x.lineWidth=2;x.beginPath();x.moveTo(-8,0);x.bezierCurveTo(-3,-6*fl,3,6*fl,8,0);x.stroke()}x.restore()}
  premiumText(x,w,h,u,{at:.3,g:['#ffffff','#ffe4f1','#f472b6'],glow:'rgba(244,114,182,.7)'})}},
{n:'Chip shower',r:'Rare',k:'fx_chip_shower',d:'Casino chips pour down, bounce off the table and settle, with shadows and proper chip edges.',f(x,t,w,h){const u=t%P,fl=h-18,G=320,C=[['#dc2626','#7f1d1d'],['#2563eb','#1e3a8a'],['#1f2937','#030712'],['#059669','#064e3b'],['#f8fafc','#94a3b8']];
  const tg=x.createLinearGradient(0,fl-10,0,h);tg.addColorStop(0,'rgba(16,90,60,0)');tg.addColorStop(1,'rgba(16,90,60,.45)');x.fillStyle=tg;x.fillRect(0,fl-10,w,h);flash(x,w/2,fl,160,'59,130,246',.25*clamp(u*2));
  const L=[];for(let i=0;i<30;i++){const s=u-H(i)*1.3;if(s<0)continue;const px=w*(.05+.9*H(i+11)),sf=Math.sqrt((fl+20)/G);let py,air=true;if(s<sf)py=-20+G*s*s;else{const s2=s-sf,v=2*G*sf*.32;py=fl-v*s2+G*s2*s2;if(py>=fl||s2>2*v/(2*G)){py=fl;air=false}}L.push([py,px,s,air,i])}
  L.sort((a,b)=>a[0]-b[0]).forEach(([py,px,s,air,i])=>{const r=10,hgt=fl-py;x.save();x.globalAlpha=clamp(.5-hgt/300);x.fillStyle='#000';x.beginPath();x.ellipse(px,fl+5,r*(1-hgt/600),3,0,0,TAU);x.fill();x.restore();
    const sq=air?Math.max(.22,Math.abs(Math.cos(s*7+i))):.42,[c1,c2]=C[i%5];x.save();x.translate(px,py);if(air)x.rotate(Math.sin(s*3+i)*.6);
    x.fillStyle=c2;x.beginPath();x.ellipse(0,3,r,r*sq,0,0,TAU);x.fill();x.fillRect(-r,0,2*r,3);x.fillStyle=c1;x.beginPath();x.ellipse(0,0,r,r*sq,0,0,TAU);x.fill();
    x.save();x.scale(1,sq);x.setLineDash([3.6,3.6]);x.lineWidth=3;x.strokeStyle=i%5==4?'#dc2626':'#f8fafc';x.beginPath();x.arc(0,0,8.4,0,TAU);x.stroke();x.setLineDash([]);x.lineWidth=.8;x.strokeStyle='rgba(255,255,255,.5)';x.beginPath();x.arc(0,0,5.5,0,TAU);x.stroke();x.restore();
    const hl=x.createLinearGradient(0,-r*sq,0,r*sq);hl.addColorStop(0,'rgba(255,255,255,.35)');hl.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=hl;x.beginPath();x.ellipse(0,0,r,r*sq,0,0,TAU);x.fill();x.restore()});
  premiumText(x,w,h,u,{at:.5,y:h*.42,g:['#e8f1ff','#7fb0ff','#1e40af'],glow:'rgba(59,130,246,.85)'})}},
{n:'777',r:'Rare',k:'fx_triple_seven',d:'Three reels spin and lock on sevens one after another.',f(x,t,w,h){const u=t%P,S=['7','BAR','$','♦','♣','★'],bw=58,bh=70,gap=10,x0=w/2-(bw*3+gap*2)/2,y0=h/2-bh/2-14;
  const all=u>1.45;
  for(let j=0;j<3;j++){const bx=x0+j*(bw+gap),stop=.55+j*.38;x.save();x.beginPath();x.roundRect(bx,y0,bw,bh,10);x.fillStyle='#141414';x.fill();
    x.lineWidth=2;x.strokeStyle=all&&Math.floor(u*8)%2?'#f5df98':'#2a2a2a';x.stroke();x.clip();x.font='800 26px Inter';x.textAlign='center';x.textBaseline='middle';
    if(u<stop){const off=(u*1100+j*90)%(S.length*40);for(let r=-1;r<3;r++){const idx=(Math.floor(off/40)+r+S.length*5)%S.length;x.globalAlpha=.55;x.fillStyle='#ddd';x.font=S[idx].length>1?'800 15px Inter':'800 26px Inter';x.fillText(S[idx],bx+bw/2,y0+bh/2+(off%40)-r*40)}}
    else{const b=u-stop<.15?Math.sin((u-stop)/.15*Math.PI)*6:0;x.fillStyle='#ef4444';glowFill(x,'#ef4444',all?14:0);x.fillText('7',bx+bw/2,y0+bh/2+b)}
    x.restore()}
  winText(x,w,h,u,{at:1.5,col:'#f5df98',y:y0+bh+26,size:24,glow:'#D4AF37'})}},
{n:'Money printer',r:'Rare',k:'fx_money_printer',d:'A cannon blast of detailed banknotes shoots upward, then the bills flip and drift down under green light rays.',f(x,t,w,h){const u=t%P,cx=w/2;
  rays(x,cx,h+30,16,h*1.4,t*.15,'52,211,153',.13*clamp(u*3)*clamp(2.8-u));flash(x,cx,h,140,'52,211,153',.5*clamp(.6-(u-.2)));
  const B=[];for(let i=0;i<34;i++){const s=u-.2-H(i)*.35;if(s<0)continue;const vx=(H(i+3)-.5)*300,vy=-(270+H(i+5)*170),d=(1-Math.exp(-2.4*s))/2.4,py=h+10+vy*d+34*s*s,px=cx+vx*d+Math.sin(s*2.5+i)*14*clamp(s-.5);B.push([H(i+9),px,py,s,i])}
  B.sort((a,b)=>a[0]-b[0]).forEach(([z,px,py,s,i])=>{const flip=Math.cos(s*(3+H(i)*3)+i),sc=.75+z*.45;x.save();x.globalAlpha=clamp((2.9-s)*2);x.translate(px,py);x.rotate(Math.sin(s*2+i)*.7+H(i)*.6);x.scale(sc,sc*Math.max(.12,Math.abs(flip)));
    const front=flip>0,g=x.createLinearGradient(-17,-8,17,8);g.addColorStop(0,front?'#3fae74':'#2d7d55');g.addColorStop(.5,front?'#2a8c58':'#226b44');g.addColorStop(1,front?'#1b6b42':'#164d32');x.fillStyle=g;x.fillRect(-17,-8.5,34,17);
    x.strokeStyle='rgba(220,255,235,.75)';x.lineWidth=.8;x.strokeRect(-15,-6.5,30,13);x.fillStyle='rgba(220,255,235,.25)';x.beginPath();x.ellipse(0,0,5,5.5,0,0,TAU);x.fill();x.strokeStyle='rgba(220,255,235,.6)';x.stroke();
    x.fillStyle='#e9fff3';x.font='800 5px Inter';x.textAlign='center';x.textBaseline='middle';x.fillText('100',-11,-3.5);x.fillText('100',11,3.5);x.font='800 7px Inter';x.fillText('$',0,.5);x.restore()});
  premiumText(x,w,h,u,{at:.45,g:['#ecfff5','#34d399','#065f46'],glow:'rgba(16,185,129,.9)'})}},
{n:'Firework',r:'Epic',k:'fx_firework',d:'Three rockets launch with spark trails and burst into glittering shells that crackle and leave smoke.',f(x,t,w,h){const u=t%P,R=[[.22,.3,'255,95,180',.02],[.78,.28,'255,210,70',.32],[.5,.2,'120,200,255',.62]];
  R.forEach(([fx,fy,rgb,t0],k)=>{const tx=w*fx,ty=h*fy,s=u-t0;if(s<0)return;const up=.42;
    if(s<up){const p=s/up,e=1-(1-p)*(1-p),py=h-(h-ty)*e,wob=Math.sin(s*30)*1.2;x.save();x.globalCompositeOperation='lighter';for(let j=0;j<10;j++){const pj=Math.max(0,p-j*.03),ej=1-(1-pj)*(1-pj);x.globalAlpha=1-j/10;x.fillStyle=`rgb(${rgb})`;x.beginPath();x.arc(tx+wob*(j?0:1),h-(h-ty)*ej,1.8-j*.12,0,TAU);x.fill()}x.restore();
      for(let j=0;j<6;j++){const ss=(s*3+H(j+k*10))%1;x.globalAlpha=1-ss;x.fillStyle='#ffd27a';x.fillRect(tx+(H(j+k)-.5)*6,py+ss*22,1.4,1.4)}x.globalAlpha=1;return}
    const b=s-up,pos=(i,bb)=>{const a=i/60*TAU+H(i+k*7)*.08,sp=(i%3?85:45)+H(i+k*99)*35,d=(1-Math.exp(-2.8*bb))/2.8;return[tx+Math.cos(a)*sp*d,ty+Math.sin(a)*sp*d+22*bb*bb]};
    flash(x,tx,ty,90,rgb,.9-b*2.5);
    for(let j=0;j<5;j++){const pr=10+b*26+H(j+k)*8,sx2=tx+(H(j*3+k)-.5)*40,sy2=ty+(H(j*5+k)-.5)*30+b*10,sg=x.createRadialGradient(sx2,sy2,0,sx2,sy2,pr);sg.addColorStop(0,`rgba(140,140,150,${clamp(.12-b*.04)})`);sg.addColorStop(1,'rgba(140,140,150,0)');x.fillStyle=sg;x.fillRect(sx2-pr,sy2-pr,2*pr,2*pr)}
    x.save();x.globalCompositeOperation='lighter';x.lineCap='round';for(let i=0;i<60;i++){const [px,py]=pos(i,b),[qx,qy]=pos(i,Math.max(0,b-.09)),life=clamp(1.9-b*1.1),tw=b>.7?(H(Math.floor(t*25)+i)>.5?1:.25):1;
      const g=x.createLinearGradient(qx,qy,px,py);g.addColorStop(0,`rgba(${rgb},0)`);g.addColorStop(1,`rgba(${rgb},${life*tw})`);x.strokeStyle=g;x.lineWidth=2;x.beginPath();x.moveTo(qx,qy);x.lineTo(px,py);x.stroke();
      x.globalAlpha=life*tw;x.fillStyle='#fff';x.beginPath();x.arc(px,py,1.1,0,TAU);x.fill();x.globalAlpha=1;
      if(b>.55&&i%3==0)sparkle(x,px+(H(i+Math.floor(t*12))-.5)*8,py+(H(i+3+Math.floor(t*12))-.5)*8,2.5*H(i+Math.floor(t*20)),'#fff',life)}x.restore()});
  premiumText(x,w,h,u,{at:1.05,y:h*.66,g:['#ffffff','#ffd1ea','#c026d3'],glow:'rgba(236,72,153,.85)'})}},
{n:'Cash slam',r:'Epic',k:'fx_cash_slam',d:'Speed lines pull in, the number crashes down, the ground cracks, debris and dust fly and the screen shakes.',f(x,t,w,h){const u=t%P,imp=.42,cx=w/2,cy=h/2,cyc=Math.floor(t/P);
  if(u<imp){const p=u/imp;x.save();x.globalCompositeOperation='lighter';for(let i=0;i<40;i++){const a=H(i)*TAU,r1=w*.75*(1-p)+40,r2=r1+30+H(i+1)*40;x.globalAlpha=p*.6;x.strokeStyle='#d1fae5';x.lineWidth=1;x.beginPath();x.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);x.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);x.stroke()}x.restore()}
  const k=u-imp,sh=k>0?Math.exp(-k*8)*9:0;x.save();x.translate((H(Math.floor(u*60))-.5)*sh,(H(Math.floor(u*60)+3)-.5)*sh);
  if(k>0){const fade=clamp((P-u-.2)/.6);x.save();x.lineCap='round';for(let c=0;c<9;c++){const a=Math.PI*(.05+.9*H(c+cyc*9))+Math.PI,pts=[[cx+Math.cos(a)*30,cy+20]];let px=pts[0][0],py=pts[0][1];const grow=clamp(k*6);
      for(let s=0;s<6*grow;s++){px+=Math.cos(a)*-14*(Math.cos(a)<0?-1:1)*0+Math.cos(a)*14;py+=Math.abs(Math.sin(a))*3+(H(c*20+s)-.5)*6;pts.push([px,py])}
      x.strokeStyle=`rgba(16,185,129,${.6*fade})`;x.lineWidth=3;glowFill(x,'#10b981',10);strokePts(x,pts);x.shadowBlur=0;x.strokeStyle=`rgba(0,0,0,${.8*fade})`;x.lineWidth=1.4;strokePts(x,pts)}x.restore();
    flash(x,cx,cy+18,180,'167,243,208',.9-k*3);
    for(let i=0;i<22;i++){const a=Math.PI+.15+H(i+cyc)*(Math.PI-.3),sp=120+H(i+5)*180,px=cx+Math.cos(a)*sp*k*(Math.cos(a)<0?1:1),py=cy+16+Math.sin(a)*sp*k+260*k*k;if(py>h+10)continue;x.save();x.translate(px,py);x.rotate(k*10*H(i));x.fillStyle=i%3?'#4b5563':'#1f2937';x.beginPath();x.moveTo(-3,-2);x.lineTo(2,-3);x.lineTo(3,2);x.lineTo(-2,3);x.fill();x.restore()}
    for(let i=0;i<10;i++){const dir=i%2?1:-1,px=cx+dir*(20+k*120*(.5+H(i)*.8)),py=cy+20-k*12*H(i+2),r=10+k*40*(.6+H(i+3));const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(180,190,200,${.35*clamp(1-k/1.6)})`);g.addColorStop(1,'rgba(180,190,200,0)');x.fillStyle=g;x.fillRect(px-r,py-r,2*r,2*r)}}
  x.restore();
  premiumText(x,w,h,u,{at:.18,size:36,g:['#ffffff','#6ee7b7','#047857'],glow:'rgba(16,185,129,.9)',scale:k=>k<.24?4.2-(k/.24)*3.2:(k<.34?1-Math.sin((k-.24)/.1*Math.PI)*.08:1)})}},
{n:'Shockwave',r:'Epic',k:'fx_shockwave',d:'A sonic boom: a white-hot core, chromatic pressure rings and dust that gets pushed out as each ring passes.',f(x,t,w,h){const u=t%P,cx=w/2,cy=h/2,t0=.35,k=u-t0;
  if(k<0){const p=u/t0;flash(x,cx,cy,30+p*20,'186,230,253',p*.8);return}
  flash(x,cx,cy,200,'224,242,254',.95-k*2.2);
  const rings=[0,.13,.26].map(d=>Math.max(0,k-d)*290);
  for(let i=0;i<70;i++){const a=H(i)*TAU,r0=30+H(i+1)*150;let push=0;rings.forEach(R=>{if(R>r0)push+=Math.min(30,(R-r0)*.25)});const r=r0+push;x.globalAlpha=.25+.35*clamp(push/20);x.fillStyle='#bae6fd';x.fillRect(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.62,1.6,1.6)}x.globalAlpha=1;
  x.save();x.globalCompositeOperation='lighter';rings.forEach((R,j)=>{if(R<=0)return;const al=clamp(1-R/320);[['255,60,90',-2],['60,220,255',2],['255,255,255',0]].forEach(([c,o])=>{x.strokeStyle=`rgba(${c},${al*(o?.5:.9)})`;x.lineWidth=(o?3:2)*(1-j*.25);x.beginPath();x.ellipse(cx+o,cy,R,R*.62,0,0,TAU);x.stroke()});
    const g=x.createRadialGradient(cx,cy,Math.max(0,R-16),cx,cy,R);g.addColorStop(0,'rgba(56,189,248,0)');g.addColorStop(1,`rgba(56,189,248,${al*.25})`);x.save();x.scale(1,.62);x.fillStyle=g;x.beginPath();x.arc(cx,cy/.62,R,0,TAU);x.fill();x.restore()});x.restore();
  const pulse=rings.reduce((m,R)=>m+Math.max(0,1-Math.abs(R-60)/30),0);
  premiumText(x,w,h,u,{at:t0,g:['#ffffff','#bae6fd','#0369a1'],glow:'rgba(56,189,248,.9)',scale:q=>popScale(q)*(1+pulse*.06)})}},
{n:'Lightning strike',r:'Epic',k:'fx_lightning',d:'A branching bolt cracks down twice, the sky flashes, sparks spray off the impact and the number keeps crackling.',f(x,t,w,h,o){const u=t%P,cyc=Math.floor(t/P),cx=w/2,cy=h/2-6;
  const strikes=[[.25,.42,cyc*97],[.5,.62,cyc*97+500]];strikes.forEach(([a,b,seed])=>{if(u<a||u>b)return;const fl=1-(u-a)/(b-a);x.globalAlpha=fl*.45;x.fillStyle='#c7d2fe';x.fillRect(0,0,w,h);x.globalAlpha=1;
    const sx=w*(.3+.4*H(seed)),main=bolt(sx,-5,cx,cy-14,seed,.42),br=[];for(let j=0;j<3;j++){const p=main[10+j*14|0];br.push(bolt(p[0],p[1],p[0]+(H(seed+j+40)-.5)*120,p[1]+30+H(seed+j+50)*40,seed+j*77,.5))}
    x.save();x.globalCompositeOperation='lighter';x.lineJoin='round';[[10,'rgba(129,140,248,.25)'],[4,'rgba(165,180,252,.7)'],[1.6,'#ffffff']].forEach(([lw,c])=>{x.lineWidth=lw*fl;x.strokeStyle=c;strokePts(x,main);x.lineWidth=lw*.5*fl;br.forEach(p=>strokePts(x,p))});x.restore();flash(x,cx,cy-10,90,'199,210,254',fl)});
  if(u>.25){const k=u-.25;x.save();x.globalCompositeOperation='lighter';for(let i=0;i<30;i++){const a=-Math.PI*H(i+cyc)-.0,sp=60+H(i+9)*140,px=cx+Math.cos(a)*sp*k,py=cy-14+Math.sin(a)*sp*k+220*k*k;x.globalAlpha=clamp(1-k*1.4);x.strokeStyle='#fde68a';x.lineWidth=1.3;x.beginPath();x.moveTo(px,py);x.lineTo(px-Math.cos(a)*5,py-Math.sin(a)*5-k*6);x.stroke()}x.restore()}
  if(u>.45){x.save();x.globalCompositeOperation='lighter';for(let i=0;i<4;i++){const s=Math.floor(t*16)+i*7;if(H(s)>.6)continue;const a=H(s+1)*TAU,r=48+H(s+2)*14,p0=[cx+Math.cos(a)*r,cy+6+Math.sin(a)*r*.45],p1=[cx+Math.cos(a+.5)*(r+6),cy+6+Math.sin(a+.5)*(r+6)*.45];
    x.strokeStyle='#c7d2fe';x.lineWidth=1.2;glowFill(x,'#818cf8',8);strokePts(x,bolt(p0[0],p0[1],p1[0],p1[1],s,.5))}x.restore()}
  premiumText(x,w,h,u,{at:.28,y:h/2+6,g:['#ffffff','#c7d2fe','#4338ca'],glow:'rgba(129,140,248,.95)'})}},
{n:'Gold rain',r:'Legendary',k:'fx_gold_rain',d:'A storm of gold streaks pours down behind a polished gold number.',f(x,t,w,h){const u=t%P;x.globalCompositeOperation='lighter';
  for(let i=0;i<90;i++){const sp=180+H(i+1)*220,py=((H(i)*(h+40))+t*sp)%(h+40)-20,px=w*H(i+7);x.globalAlpha=.25+H(i+2)*.5;x.strokeStyle=i%3?'#D4AF37':'#fff1b8';x.lineWidth=1.4;x.beginPath();x.moveTo(px,py);x.lineTo(px,py+8+H(i+3)*10);x.stroke()}
  x.globalCompositeOperation='source-over';x.globalAlpha=1;
  winText(x,w,h,u,{at:.25,size:36,glow:'#D4AF37',fill:x=>{const g=x.createLinearGradient(-90,0,90,0),p=((t*.6)%1.6)-.3;g.addColorStop(0,'#b88a1b');g.addColorStop(clamp(p-.12),'#D4AF37');g.addColorStop(clamp(p),'#fffbe6');g.addColorStop(clamp(p+.12),'#D4AF37');g.addColorStop(1,'#b88a1b');return g}})}},
{n:'Comet',r:'Legendary',k:'fx_comet',d:'A blazing comet with a long tapered tail crosses the sky and hits the number, sending out a ring and burning debris.',f(x,t,w,h){const u=t%P,t1=.7,cx=w/2,cy=h/2,sx=-40,sy=-30,pos=q=>{const e=q*q*(1.2-.2*q);return[sx+(cx-sx)*e,sy+(cy-sy)*e+Math.sin(q*Math.PI)*-10]};
  for(let i=0;i<40;i++){x.globalAlpha=.3*H(i+2);x.fillStyle='#fff';x.fillRect(w*H(i),h*H(i+1),1,1)}x.globalAlpha=1;
  if(u<t1){const p=u/t1;x.save();x.globalCompositeOperation='lighter';for(let j=40;j>=0;j--){const q=Math.max(0,p-j*.011),[px,py]=pos(q),f=j/40,r=(1-f)*9+1;const g=x.createRadialGradient(px,py,0,px,py,r*2);
      g.addColorStop(0,j<4?'rgba(255,255,255,.95)':`rgba(255,${200-f*120|0},${80-f*60|0},${(1-f)*.55})`);g.addColorStop(1,'rgba(249,115,22,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r*2,0,TAU);x.fill()}
    for(let i=0;i<24;i++){const age=(t*2+H(i))%1,q=Math.max(0,p-age*.3),[px,py]=pos(q);x.globalAlpha=1-age;x.fillStyle=i%2?'#fde68a':'#fb923c';x.fillRect(px+(H(i+5)-.5)*14*age,py+(H(i+7)-.5)*14*age+age*8,1.6,1.6)}x.restore();
    const [hx,hy]=pos(p);flash(x,hx,hy,40,'255,240,200',.9)}
  else{const k=u-t1;flash(x,cx,cy,170,'255,190,120',1-k*2.5);x.save();x.globalCompositeOperation='lighter';x.strokeStyle=`rgba(253,230,138,${clamp(1-k*1.6)})`;x.lineWidth=3;x.beginPath();x.ellipse(cx,cy,20+k*260,(20+k*260)*.45,0,0,TAU);x.stroke();
    for(let i=0;i<50;i++){const a=H(i)*TAU,sp=70+H(i+8)*220,d=(1-Math.exp(-3*k))/3,b=(1-Math.exp(-3*Math.max(0,k-.06)))/3,px=cx+Math.cos(a)*sp*d,py=cy+Math.sin(a)*sp*d*.7+60*k*k,qx=cx+Math.cos(a)*sp*b,qy=cy+Math.sin(a)*sp*b*.7+60*k*k;
      x.globalAlpha=clamp(1.6-k);x.strokeStyle=i%2?'#fde68a':'#f97316';x.lineWidth=1.6;x.beginPath();x.moveTo(qx,qy);x.lineTo(px,py);x.stroke()}x.restore()}
  premiumText(x,w,h,u,{at:t1,g:['#fffbeb','#fdba74','#c2410c'],glow:'rgba(249,115,22,.95)'})}},
{n:'Vault burst',r:'Legendary',k:'fx_vault_burst',d:'The bolts on a steel vault door retract and the wheel spins. The door swings open on a flood of golden light and coins pour out.',f(x,t,w,h){const u=t%P,cx=w/2,cy=h/2,R=56,open=clamp((u-.85)/.4);
  const glowA=clamp((u-.75)/.3);flash(x,cx,cy,R*2.6,'255,215,120',glowA*(1-clamp((u-2)/1)));rays(x,cx,cy,18,w*.8,t*.25,'255,220,140',.22*glowA*clamp(2.9-u));
  if(u>1){const k=u-1,Cn=[];for(let i=0;i<40;i++){const a=H(i)*TAU,sp=60+H(i+3)*170,s=Math.max(0,k-H(i+6)*.25);Cn.push([H(i+9),cx+Math.cos(a)*sp*s,cy+Math.sin(a)*sp*s*.7+120*s*s,4+H(i+9)*4.5,s*9+i,clamp(2.2-s)])}Cn.sort((a,b)=>a[0]-b[0]).forEach(c=>coin3d(x,c[1],c[2],c[3],c[4],c[5]))}
  if(open<1){x.save();x.translate(cx-R*open*1.1,cy);x.scale(Math.cos(open*1.45),1);x.globalAlpha=1-open*.3;
    const g=x.createRadialGradient(-R*.3,-R*.3,R*.1,0,0,R);g.addColorStop(0,'#9aa4b2');g.addColorStop(.6,'#5b6472');g.addColorStop(1,'#2b313a');x.fillStyle=g;x.beginPath();x.arc(0,0,R,0,TAU);x.fill();
    x.lineWidth=5;x.strokeStyle='#3b424d';x.stroke();x.lineWidth=1.5;x.strokeStyle='rgba(255,255,255,.25)';x.beginPath();x.arc(0,0,R-6,0,TAU);x.stroke();x.beginPath();x.arc(0,0,R*.62,0,TAU);x.stroke();
    const ret=clamp((u-.2)/.35);for(let i=0;i<14;i++){const a=i/14*TAU,r=R-10-ret*5;x.fillStyle='#d1d5db';x.beginPath();x.arc(Math.cos(a)*r,Math.sin(a)*r,2.6,0,TAU);x.fill();x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.arc(Math.cos(a)*r+.7,Math.sin(a)*r+.7,1.2,0,TAU);x.fill()}
    x.rotate(clamp(u/.85)**2*Math.PI*2.2);x.strokeStyle='#e5e7eb';x.lineCap='round';x.lineWidth=4.5;for(let i=0;i<5;i++){x.rotate(TAU/5);x.beginPath();x.moveTo(0,0);x.lineTo(0,-R*.5);x.stroke();x.fillStyle='#f3f4f6';x.beginPath();x.arc(0,-R*.52,4,0,TAU);x.fill()}
    x.fillStyle='#9ca3af';x.beginPath();x.arc(0,0,9,0,TAU);x.fill();x.restore();
    if(u>.7&&open<1){x.save();x.globalCompositeOperation='lighter';x.strokeStyle=`rgba(255,230,160,${clamp((u-.7)*4)*(1-open)})`;x.lineWidth=3;glowFill(x,'#fde68a',18);x.beginPath();x.arc(cx-R*open*1.1,cy,R+1,0,TAU);x.stroke();x.restore()}}
  premiumText(x,w,h,u,{at:1.05,g:['#fffbe6','#f5c84a','#8a5a06'],glow:'rgba(240,190,60,.95)'})}},
{n:'Supernova',r:'Legendary',k:'fx_supernova',d:'A star swells and pulses as matter streams into it, then collapses to a point and blows out into a shell of colour with nebula clouds.',f(x,t,w,h){const u=t%P,cx=w/2,cy=h/2,tc=.55,k=u-tc;
  if(u<tc){const p=u/tc,r=6+p*14+Math.sin(t*30)*p*1.5;x.save();x.globalCompositeOperation='lighter';for(let i=0;i<60;i++){const a=H(i)*TAU+p*2,rr=(1-((p+H(i+1))%1))*140+r,r2=rr+8;x.globalAlpha=.6;x.strokeStyle=i%2?'#c4b5fd':'#93c5fd';x.lineWidth=1;x.beginPath();x.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*.75);x.lineTo(cx+Math.cos(a-.05)*r2,cy+Math.sin(a-.05)*r2*.75);x.stroke()}x.restore();
    flash(x,cx,cy,r*3.5,'255,240,220',.9);x.fillStyle='#fff';x.beginPath();x.arc(cx,cy,r*.7,0,TAU);x.fill()}
  else if(k<.07){const r=Math.max(1,20*(1-k/.07));flash(x,cx,cy,30,'255,255,255',1);x.fillStyle='#fff';x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill()}
  else{const b=k-.07;x.save();x.globalCompositeOperation='lighter';x.globalAlpha=clamp(.55-b*3);x.fillStyle='#fff';x.fillRect(0,0,w,h);x.globalAlpha=1;
    for(let i=0;i<6;i++){const a=H(i+30)*TAU,d=b*60*(.5+H(i+31)),px=cx+Math.cos(a)*d,py=cy+Math.sin(a)*d*.7,r=30+b*70;const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`hsla(${(i*60+t*20)%360},90%,60%,${.28*clamp(2.6-b)})`);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(px-r,py-r,2*r,2*r)}
    for(let i=0;i<160;i++){const a=i/160*TAU+H(i)*.04,sp=(.8+H(i+1)*.4)*170,d=(1-Math.exp(-2.2*b))/2.2,d2=(1-Math.exp(-2.2*Math.max(0,b-.1)))/2.2,px=cx+Math.cos(a)*sp*d,py=cy+Math.sin(a)*sp*d*.75,qx=cx+Math.cos(a)*sp*d2,qy=cy+Math.sin(a)*sp*d2*.75;
      x.globalAlpha=clamp(1.8-b*.9);x.strokeStyle=`hsl(${(a/TAU*360+t*50)%360},95%,68%)`;x.lineWidth=1.4;x.beginPath();x.moveTo(qx,qy);x.lineTo(px,py);x.stroke()}
    x.globalAlpha=clamp(1-b*1.2);x.strokeStyle='#fff';x.lineWidth=2;x.beginPath();x.ellipse(cx,cy,b*230,b*230*.75,0,0,TAU);x.stroke();x.restore();flash(x,cx,cy,40,'255,255,255',.6)}
  premiumText(x,w,h,u,{at:.66,g:['#ffffff','#e9d5ff','#7e22ce'],glow:'rgba(168,85,247,.95)'})}},
{n:'Black hole',r:'Exotic',k:'fx_black_hole',d:'Light streams spiral into a singularity that grows an accretion disk, then collapses, and the win stretches out of it.',f(x,t,w,h){const u=t%P,cx=w/2,cy=h/2,T=1.15;
  for(let i=0;i<50;i++){const d=Math.hypot(w*H(i)-cx,h*H(i+1)-cy),pull=u<T?clamp(u/T)*Math.min(1,1400/(d*d+1)):0;x.globalAlpha=.4*H(i+2);x.fillStyle='#fff';x.fillRect(cx+(w*H(i)-cx)*(1-pull),cy+(h*H(i+1)-cy)*(1-pull),1,1)}x.globalAlpha=1;
  const hr=u<T?8+clamp(u/.6)*12:Math.max(0,20-(u-T)*160);
  if(u<T+.15){x.save();x.globalCompositeOperation='lighter';for(let i=0;i<140;i++){const p=clamp((u-H(i)*.5)/(T-.3)),a=H(i+2)*TAU+p*8;if(p<=0||p>=1)continue;const r=(1-p)*(70+H(i+1)*130)+hr*1.3,r2=(1-Math.max(0,p-.04))*(70+H(i+1)*130)+hr*1.3,a2=a-.18;
      x.globalAlpha=.3+.7*p;x.strokeStyle=i%3?'#c4b5fd':'#fdba74';x.lineWidth=1.2;x.beginPath();x.moveTo(cx+Math.cos(a2)*r2,cy+Math.sin(a2)*r2*.5);x.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.5);x.stroke()}
    const da=clamp(u/.5)*(u<T?1:clamp(1-(u-T)*6));for(let j=0;j<16;j++){const r=hr*1.25+j*2.2;x.globalAlpha=da*(1-j/16)*.8;x.strokeStyle=`hsl(${(t*90+j*8)%360},95%,${70-j*2}%)`;x.lineWidth=1.6;x.beginPath();x.ellipse(cx,cy,r*1.9,r*.42,0,0,TAU);x.stroke()}
    x.globalAlpha=da;x.strokeStyle=`hsl(${(t*90+40)%360},100%,80%)`;x.lineWidth=2;glowFill(x,x.strokeStyle,18);x.beginPath();x.arc(cx,cy,hr*1.05,0,TAU);x.stroke();x.restore();
    x.fillStyle='#000';x.beginPath();x.arc(cx,cy,hr,0,TAU);x.fill()}
  if(u>T){const k=u-T;flash(x,cx,cy,160,'196,181,253',1-k*2.4);x.save();x.globalCompositeOperation='lighter';for(let j=0;j<3;j++){const r=Math.max(0,k-j*.1)*240;x.strokeStyle=`hsla(${(t*90+j*50)%360},95%,70%,${clamp(1-r/240)})`;x.lineWidth=2;x.beginPath();x.ellipse(cx,cy,r,r*.5,0,0,TAU);x.stroke()}x.restore()}
  premiumText(x,w,h,u,{at:T+.02,size:36,g:['#ffffff','#e9d5ff','#6d28d9'],glow:'rgba(139,92,246,.95)',scale:k=>popScale(k),sx:u>T&&u<T+.3?1+(1-(u-T)/.3)*1.6:1})}},
{n:'Jackpot.exe',r:'Exotic',k:'fx_jackpot_exe',d:'The screen glitches out as if the casino just crashed from paying you.',f(x,t,w,h,o){const u=t%P,f=Math.floor(t*18);
  x.font='500 11px "JetBrains Mono"';x.textAlign='left';for(let i=0;i<26;i++){const px=(i/26)*w,sp=40+H(i)*80;for(let j=0;j<8;j++){const py=((H(i+j*31)*h)+t*sp)%h;x.globalAlpha=.08+H(i*j+f%7)*.12;x.fillStyle='#10b981';x.fillText(H(i*7+j+Math.floor(t*4))>.5?'1':'0',px,py)}}
  x.globalAlpha=1;x.fillStyle='rgba(255,255,255,.035)';for(let y=0;y<h;y+=3)x.fillRect(0,y,w,1);
  if(u>.3){const a=u>P-.45?clamp((P-u)/.45):1,gl=H(f)<.35||u<.6;x.save();x.globalAlpha=a;x.font='800 32px Inter';x.textAlign='center';x.textBaseline='middle';x.globalCompositeOperation='lighter';
    const dx=gl?(H(f+1)-.5)*10:1.5;x.fillStyle='#ff0040';x.fillText(FXT,w/2-dx,h/2);x.fillStyle='#00e5ff';x.fillText(FXT,w/2+dx,h/2+(gl?1:0));x.globalCompositeOperation='source-over';x.fillStyle='#fff';x.fillText(FXT,w/2,h/2);
    x.font='500 11px "JetBrains Mono"';x.fillStyle='#10b981';x.fillText(Math.floor(t*3)%2?'> JACKPOT.EXE':'> JACKPOT.EXE_',w/2,h/2-30);x.restore()}
  if(H(f+5)<.4&&o&&o.c){const cw=o.c.width,ch=o.c.height;x.save();x.setTransform(1,0,0,1,0,0);for(let i=0;i<3;i++){const sy=H(f+i*9)*ch,sh=(4+H(f+i*3)*14)/h*ch*.6,dx=(H(f+i*5)-.5)*30/w*cw*.4;x.drawImage(o.c,0,sy,cw,sh,dx,sy,cw,sh)}x.restore()}}}
];


/* ================= PROFILE BACKDROPS ================= */

const magmaCache={};
function magmaLayers(w,h){const mk=`${Math.round(w)}x${Math.round(h)}`;if(magmaCache[mk])return magmaCache[mk];const W=Math.round(w*DPR),Hh=Math.round(h*DPR),S=[];for(let i=0;i<38;i++)S.push([H(i*3+500)*W,H(i*3+501)*Hh]);
  const mkc=()=>{const c=document.createElement('canvas');c.width=W;c.height=Hh;return c};const rock=mkc(),crack=mkc(),glow=mkc(),tmp=mkc();
  const rc=rock.getContext('2d'),cc=crack.getContext('2d'),rd=rc.createImageData(W,Hh),cd=cc.createImageData(W,Hh);
  for(let y=0;y<Hh;y++)for(let X=0;X<W;X++){let d1=1e12,d2=1e12,id=0;for(let i=0;i<S.length;i++){const dx=X-S[i][0],dy=y-S[i][1],d=dx*dx+dy*dy;if(d<d1){d2=d1;d1=d;id=i}else if(d<d2)d2=d}
    const e=(Math.sqrt(d2)-Math.sqrt(d1))/DPR,o=(y*W+X)*4,th=1.2+H(id+700)*1.4,n=Math.random()*10,base=20+H(id+800)*16+n,k=clamp(1-e/10);
    rd.data[o]=base+k*k*120;rd.data[o+1]=base*.62+k*k*28;rd.data[o+2]=base*.5;rd.data[o+3]=255;
    const a=clamp(1-(e-th*.4)/th);cd.data[o]=255;cd.data[o+1]=150+a*80;cd.data[o+2]=50+a*60;cd.data[o+3]=a*255}
  rc.putImageData(rd,0,0);cc.putImageData(cd,0,0);const gc=glow.getContext('2d');gc.filter=`blur(${7*DPR}px)`;gc.drawImage(crack,0,0);gc.drawImage(crack,0,0);gc.filter='none';
  return magmaCache[mk]={rock,crack,glow,tmp,tg:tmp.getContext('2d'),W,H:Hh}}

function felt(x,w,h,base,dark,rail,key){const g=x.createRadialGradient(w/2,h*.45,10,w/2,h/2,w*.7);g.addColorStop(0,base);g.addColorStop(1,dark);x.fillStyle=g;x.fillRect(0,0,w,h);
  x.globalAlpha=.6;x.drawImage(noise(key,base,255),0,0,w,w);x.globalAlpha=1;x.strokeStyle=rail;x.lineWidth=2;x.beginPath();x.roundRect(14,14,w-28,h-28,h/2-14);x.stroke();x.globalAlpha=.4;x.beginPath();x.roundRect(22,22,w-44,h-44,h/2-22);x.stroke();x.globalAlpha=1}
function bricks(x,w,h,c1,c2,mortar){x.fillStyle=mortar;x.fillRect(0,0,w,h);const bw=34,bh=14;for(let r=0;r<h/bh+1;r++)for(let c=-1;c<w/bw+1;c++){const i=r*40+c,ox=r%2?bw/2:0;x.fillStyle=H(i)<.5?c1:c2;x.globalAlpha=.7+H(i+3)*.3;x.fillRect(c*bw+ox+1,r*bh+1,bw-2,bh-2)}x.globalAlpha=1}
const BG=[
{n:'Green felt',r:'Common',k:'bg_green_felt',d:'The classic table, with felt grain and a gold rail.',f(x,t,w,h){felt(x,w,h,'#126b45','#06281a','#D4AF37aa','n1')}},
{n:'Red felt',r:'Common',k:'bg_red_felt',d:'Back-room high-limit table felt.',f(x,t,w,h){felt(x,w,h,'#8a1525','#2b0509','#e5c37a99','n2')}},
{n:'Back alley',r:'Common',k:'bg_back_alley',d:'Wet bricks under a street lamp that keeps flickering.',f(x,t,w,h){bricks(x,w,h,'#3a2420','#2c1a17','#140c0b');const fl=H(Math.floor(t*10))<.12?.35:1;
  const g=x.createRadialGradient(w*.18,0,0,w*.18,0,w*.6);g.addColorStop(0,`rgba(255,200,120,${.55*fl})`);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,0,w,h)}},
{n:'Neon strip',r:'Rare',k:'bg_neon_strip',d:'A dark wall with pink and cyan neon tubes that flicker.',f(x,t,w,h){bricks(x,w,h,'#15151c','#101016','#08080b');x.lineCap='round';
  const fl=H(Math.floor(t*8))<.08?.25:1;x.lineWidth=4;x.strokeStyle='#ff4fd8';glowFill(x,'#ff4fd8',18);x.globalAlpha=fl;x.beginPath();for(let px=20;px<=w-20;px+=4){const py=h*.22+Math.sin(px*.05)*8;px==20?x.moveTo(px,py):x.lineTo(px,py)}x.stroke();
  x.globalAlpha=1;x.strokeStyle='#22e5ff';glowFill(x,'#22e5ff',18);x.beginPath();x.roundRect(28,h*.68,w-56,h*.16,10);x.stroke();x.shadowBlur=0}},
{n:'Vault door',r:'Rare',k:'bg_vault_door',d:'The inside of the bank vault, with the wheel turning slowly.',f(x,t,w,h){const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#3f4650');g.addColorStop(1,'#16191d');x.fillStyle=g;x.fillRect(0,0,w,h);
  const cx=w*.82,cy=h*.5;x.beginPath();x.arc(cx,cy,h*.62,0,TAU);x.fillStyle='#2b3138';x.fill();x.lineWidth=8;x.strokeStyle='#596270';x.stroke();
  for(let i=0;i<16;i++){const a=i/16*TAU;x.fillStyle='#9aa3af';x.beginPath();x.arc(cx+Math.cos(a)*h*.53,cy+Math.sin(a)*h*.53,3.2,0,TAU);x.fill()}
  x.save();x.translate(cx,cy);x.rotate(t*.25);x.strokeStyle='#b6bec9';x.lineWidth=6;for(let i=0;i<3;i++){x.rotate(TAU/3);x.beginPath();x.moveTo(0,0);x.lineTo(0,-h*.32);x.stroke()}x.restore();x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,0,w,h)}},
{n:'Poker table',r:'Rare',k:'bg_poker_table',d:'A top-down table with cards, chip stacks and an overhead lamp.',f(x,t,w,h){x.fillStyle='#2a1a10';x.fillRect(0,0,w,h);x.fillStyle='#4a2c18';x.beginPath();x.ellipse(w/2,h/2,w*.48,h*.46,0,0,TAU);x.fill();
  x.fillStyle='#0f5a3a';x.beginPath();x.ellipse(w/2,h/2,w*.43,h*.39,0,0,TAU);x.fill();const C=['#dc2626','#2563eb','#111827'];
  [[.16,.35],[.84,.62],[.2,.7],[.8,.3]].forEach(([px,py],k)=>{for(let j=0;j<5;j++){x.fillStyle=C[(k+j)%3];x.beginPath();x.ellipse(w*px,h*py-j*2.4,9,5,0,0,TAU);x.fill();x.strokeStyle='#fff6';x.lineWidth=1;x.stroke()}});
  for(let i=0;i<3;i++){x.save();x.translate(w*(.36+i*.07),h*.24);x.rotate((i-1)*.15);x.fillStyle='#f8fafc';x.fillRect(-8,-11,16,22);x.restore()}
  const g=x.createRadialGradient(w/2,h/2,10,w/2,h/2,w*.55);g.addColorStop(0,`rgba(255,240,200,${.12+Math.sin(t*1.5)*.03})`);g.addColorStop(1,'rgba(0,0,0,.55)');x.fillStyle=g;x.fillRect(0,0,w,h)}},
{n:'Rainy window',r:'Rare',k:'bg_rainy_window',d:'City lights blurred behind rain running down the glass.',f(x,t,w,h){const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0b1430');g.addColorStop(1,'#1c1030');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.globalCompositeOperation='lighter';const C=['#f59e0b','#ef4444','#38bdf8','#a78bfa','#fde68a'];for(let i=0;i<34;i++){const r=6+H(i)*16;x.globalAlpha=.08+H(i+1)*.14;x.fillStyle=C[i%5];x.beginPath();x.arc(w*H(i+2),h*(.35+.6*H(i+3)),r,0,TAU);x.fill()}
  x.globalCompositeOperation='source-over';x.strokeStyle='rgba(200,220,255,.35)';x.lineWidth=1;for(let i=0;i<60;i++){const sp=120+H(i)*160,py=(H(i+9)*h+t*sp)%(h+20)-10,px=w*H(i+4);x.globalAlpha=.3+H(i+5)*.4;x.beginPath();x.moveTo(px,py);x.lineTo(px-2,py+10);x.stroke()}x.globalAlpha=1}},
{n:'Spinning reels',r:'Epic',k:'bg_spinning_reels',d:'Slot reels rolling slowly behind you at different speeds.',f(x,t,w,h){x.fillStyle='#0c0a10';x.fillRect(0,0,w,h);const S=['7','BAR','♦','$','♣','★','♥'],cw=w/6;x.textAlign='center';x.textBaseline='middle';
  for(let c=0;c<6;c++){const sp=20+H(c)*30,off=(t*sp+c*13)%34;x.fillStyle=c%2?'#141019':'#0f0c14';x.fillRect(c*cw,0,cw,h);for(let r=-1;r<h/34+1;r++){const idx=(((r-Math.floor((t*sp+c*13)/34))%S.length)+S.length)%S.length;x.font=S[idx].length>1?'800 12px Inter':'800 20px Inter';x.fillStyle=S[idx]=='7'?'#ef444488':'#ffffff22';x.fillText(S[idx],c*cw+cw/2,r*34+off)}}
  const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,.85)');g.addColorStop(.5,'rgba(0,0,0,.1)');g.addColorStop(1,'rgba(0,0,0,.85)');x.fillStyle=g;x.fillRect(0,0,w,h)}},
{n:'City skyline',r:'Epic',k:'bg_skyline',d:'A Vegas-style skyline at night, with windows switching on and off.',f(x,t,w,h){const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0a0820');g.addColorStop(1,'#3b1450');x.fillStyle=g;x.fillRect(0,0,w,h);
  for(let i=0;i<40;i++){x.globalAlpha=.3+.7*Math.abs(Math.sin(t*1.5+i));x.fillStyle='#fff';x.fillRect(w*H(i),h*.45*H(i+1),1.2,1.2)}x.globalAlpha=1;x.fillStyle='#fef3c7';x.beginPath();x.arc(w*.82,h*.2,12,0,TAU);x.fill();
  let bx=0,i=0;while(bx<w){const bw=18+H(i)*26,bh=h*(.25+H(i+1)*.45);x.fillStyle='#0b0b14';x.fillRect(bx,h-bh,bw,bh);for(let wy=h-bh+6;wy<h-4;wy+=7)for(let wx=bx+4;wx<bx+bw-4;wx+=6){if(H(wx*3+wy*7+Math.floor(t/1.5+(wx+wy)%5))>.6){x.fillStyle=H(wx+wy)>.8?'#f472b6':'#fde68a';x.fillRect(wx,wy,2.5,3)}}bx+=bw+1;i+=3}}},
{n:'Starfield',r:'Epic',k:'bg_starfield',d:'Stars flying past as if you\'re cruising at warp speed.',f(x,t,w,h){x.fillStyle='#03030a';x.fillRect(0,0,w,h);for(let i=0;i<220;i++){const z=1-((H(i)+t*.12*(.5+H(i+1)))%1),a=H(i+2)*TAU,d=H(i+3)*.9+.1,px=w/2+Math.cos(a)*d*w*.6/z*.25,py=h/2+Math.sin(a)*d*h*.6/z*.25;
  if(px<0||px>w||py<0||py>h)continue;const s=(1-z)*2.4;x.globalAlpha=clamp(1-z+.2);x.fillStyle=i%9==0?'#a5b4fc':'#fff';x.fillRect(px,py,s,s)}x.globalAlpha=1}},
{n:'Deep sea',r:'Epic',k:'bg_deep_sea',d:'Sunbeams fading into blue water, with bubbles rising and kelp swaying.',f(x,t,w,h){const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0e5a7a');g.addColorStop(1,'#03142a');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.globalCompositeOperation='lighter';for(let i=0;i<5;i++){const ox=w*(.1+i*.2)+Math.sin(t*.4+i)*20;x.globalAlpha=.06;x.fillStyle='#bae6fd';x.beginPath();x.moveTo(ox,0);x.lineTo(ox+22,0);x.lineTo(ox+70,h);x.lineTo(ox+20,h);x.fill()}x.globalCompositeOperation='source-over';
  for(let k=0;k<7;k++){const kx=w*(.05+k*.15);x.strokeStyle='#0f3d2e';x.lineWidth=4;x.beginPath();x.moveTo(kx,h);for(let y=h;y>h*.45;y-=6)x.lineTo(kx+Math.sin(y*.05+t*1.2+k)*6,y);x.stroke()}
  for(let i=0;i<26;i++){const sp=20+H(i)*30,py=h-((H(i+3)*h+t*sp)%(h+10)),px=w*H(i)+Math.sin(t*2+i)*4;x.globalAlpha=.5;x.strokeStyle='#bae6fd';x.lineWidth=1;x.beginPath();x.arc(px,py,1.5+H(i+5)*2.5,0,TAU);x.stroke()}x.globalAlpha=1}},
{n:'Aurora',r:'Legendary',k:'bg_aurora',d:'Northern lights rippling across a night sky full of stars.',f(x,t,w,h){x.fillStyle='#030714';x.fillRect(0,0,w,h);for(let i=0;i<60;i++){x.globalAlpha=.25+.5*H(i+3);x.fillStyle='#fff';x.fillRect(w*H(i),h*H(i+1),1,1)}
  x.globalCompositeOperation='lighter';[[.3,'52,211,153',0],[.42,'168,85,247',2],[.36,'34,211,238',4]].forEach(([b,c,ph])=>{for(let px=0;px<w;px+=3){const y=h*b+Math.sin(px*.018+t*.6+ph)*16+Math.sin(px*.05-t*.9+ph)*7,L=50+Math.sin(px*.03+t+ph)*22;
    const g=x.createLinearGradient(0,y,0,y+L);g.addColorStop(0,`rgba(${c},0)`);g.addColorStop(.3,`rgba(${c},.28)`);g.addColorStop(1,`rgba(${c},0)`);x.fillStyle=g;x.fillRect(px,y,3,L)}});
  x.globalCompositeOperation='source-over';x.globalAlpha=1;x.fillStyle='#02050c';x.beginPath();x.moveTo(0,h);for(let px=0;px<=w;px+=10)x.lineTo(px,h-14-Math.abs(Math.sin(px*.03))*16-H(px)*6);x.lineTo(w,h);x.fill()}},
{n:'Gold vault',r:'Legendary',k:'bg_gold_vault',d:'A wall of stacked gold bars with a shine sweeping across.',f(x,t,w,h){x.fillStyle='#1a1205';x.fillRect(0,0,w,h);const bw=46,bh=18;
  for(let r=0;r<h/bh+1;r++)for(let c=-1;c<w/bw+1;c++){const ox=r%2?bw/2:0,X=c*bw+ox+2,Y=r*bh+2;const g=x.createLinearGradient(X,Y,X,Y+bh-4);g.addColorStop(0,'#f6dd84');g.addColorStop(.5,'#D4AF37');g.addColorStop(1,'#8a6a12');x.fillStyle=g;
    x.beginPath();x.moveTo(X+4,Y);x.lineTo(X+bw-8,Y);x.lineTo(X+bw-4,Y+bh-4);x.lineTo(X,Y+bh-4);x.fill()}
  const p=((t*.35)%1.6-.3)*(w+h);x.globalCompositeOperation='lighter';const g=x.createLinearGradient(p-60,0,p+60,h*.5);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,250,220,.45)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.globalCompositeOperation='source-over';x.fillStyle='rgba(0,0,0,.3)';x.fillRect(0,0,w,h)}},
{n:'Magma',r:'Legendary',k:'bg_magma',d:'Cooling volcanic plates fill the whole card, split by molten seams with heat waves pulsing through. Embers and smoke rise off it.',f(x,t,w,h){const L=magmaLayers(w,h);
  x.drawImage(L.rock,0,0,w,h);x.save();x.globalAlpha=.85;x.drawImage(L.rock,0,0,w,h);x.restore();const pu=.75+Math.sin(t*1.7)*.25;
  x.save();x.globalCompositeOperation='lighter';x.globalAlpha=.55*pu;x.drawImage(L.glow,0,0,w,h);x.globalAlpha=.9;x.drawImage(L.crack,0,0,w,h);
  const g=L.tg;g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,L.W,L.H);g.drawImage(L.crack,0,0);g.globalCompositeOperation='source-in';
  const p=((t*.22)%1.5-.25)*(L.W+L.H),wg=g.createLinearGradient(p-L.W*.25,0,p+L.W*.25,L.H*.6);wg.addColorStop(0,'rgba(255,240,180,0)');wg.addColorStop(.5,'rgba(255,245,200,1)');wg.addColorStop(1,'rgba(255,240,180,0)');g.fillStyle=wg;g.fillRect(0,0,L.W,L.H);
  x.globalAlpha=1;x.drawImage(L.tmp,0,0,w,h);
  const bg=x.createLinearGradient(0,h,0,h*.4);bg.addColorStop(0,`rgba(255,90,20,${.28*pu})`);bg.addColorStop(1,'rgba(255,90,20,0)');x.fillStyle=bg;x.fillRect(0,0,w,h);x.restore();
  for(let i=0;i<8;i++){const ph=(t*.07+H(i+300))%1,px=w*H(i+301)+Math.sin(t*.5+i)*20,py=h*(1-ph)+10,r=20+ph*40;const sg=x.createRadialGradient(px,py,0,px,py,r);sg.addColorStop(0,`rgba(60,45,40,${.25*Math.sin(ph*Math.PI)})`);sg.addColorStop(1,'rgba(60,45,40,0)');x.fillStyle=sg;x.fillRect(px-r,py-r,2*r,2*r)}
  const vg=x.createRadialGradient(w/2,h/2,10,w/2,h/2,h*.55);vg.addColorStop(0,'rgba(10,4,2,.55)');vg.addColorStop(1,'rgba(10,4,2,0)');x.fillStyle=vg;x.fillRect(0,0,w,h);x.save();x.globalCompositeOperation='lighter';for(let i=0;i<70;i++){const sp=14+H(i)*36,py=h-((H(i+2)*h+t*sp)%(h+10)),px=w*H(i)+Math.sin(t*1.3+i)*9,fl=.55+.45*Math.sin(t*14+i*2);x.globalAlpha=clamp(py/h+.15)*fl;x.fillStyle=i%3?'#ffb347':'#ff4d1a';x.beginPath();x.arc(px,py,.8+H(i+6)*1.4,0,TAU);x.fill()}x.restore()}},
{n:'Event horizon',r:'Exotic',k:'bg_event_horizon',d:'A supermassive black hole fills the card. Its accretion disk burns brighter on the side spinning toward you, light bends over the top, and the colours slowly shift.',f(x,t,w,h){const cx=w/2,cy=h*.4,hr=h*.25,hue=t*25,rin=hr*1.15,rout=w*.72,K=40,sq=.24;
  x.fillStyle='#010104';x.fillRect(0,0,w,h);const ng=x.createRadialGradient(cx,cy,hr,cx,cy,w*.7);ng.addColorStop(0,`hsla(${hue%360},70%,30%,.35)`);ng.addColorStop(.5,`hsla(${(hue+60)%360},60%,15%,.18)`);ng.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=ng;x.fillRect(0,0,w,h);
  for(let i=0;i<320;i++){let sx=w*H(i)-cx,sy=h*H(i+1)-cy;const d=Math.hypot(sx,sy)||1,k=1+(hr*hr*1.6)/(d*d);sx*=k;sy*=k;const px=cx+sx,py=cy+sy;if(px<0||px>w||py<0||py>h)continue;x.globalAlpha=(.25+.6*H(i+2))*(.6+.4*Math.sin(t*2+i));x.fillStyle=i%11==0?'#c7d2fe':'#fff';x.fillRect(px,py,1,1)}x.globalAlpha=1;
  const ring=(k)=>{const f=k/K,r=rin+Math.pow(f,1.35)*(rout-rin),heat=1-f,lw=(rout-rin)/K*1.6,g=x.createLinearGradient(cx-r,0,cx+r,0),col=a=>`hsla(${(hue+30-heat*25+360)%360},100%,${45+heat*45}%,${a})`;
    const fl=.75+.25*Math.sin(k*1.7+t*3);g.addColorStop(0,col(.18*heat*fl+.04));g.addColorStop(.5,col(.5*heat*fl+.06));g.addColorStop(1,col(.95*heat*fl+.08));return{r,heat,lw,g}};
  x.save();x.globalCompositeOperation='lighter';
  for(let k=K-1;k>=0;k--){const R=ring(k);x.strokeStyle=R.g;x.lineWidth=R.lw;x.beginPath();x.ellipse(cx,cy,R.r,R.r*sq,0,Math.PI,TAU);x.stroke()}
  for(let k=0;k<16;k++){const R=ring(k),lr=hr*1.04+(R.r-rin)*.42;x.strokeStyle=R.g;x.lineWidth=R.lw*.8;x.globalAlpha=.9;x.beginPath();x.ellipse(cx,cy,lr,lr*.92,0,Math.PI,TAU);x.stroke();x.globalAlpha=.35;x.beginPath();x.ellipse(cx,cy,lr*.9,lr*.55,0,0,Math.PI);x.stroke()}
  x.globalAlpha=1;const rg=x.createRadialGradient(cx,cy,hr*.95,cx,cy,hr*1.5);rg.addColorStop(0,`hsla(${(hue+40)%360},100%,78%,.95)`);rg.addColorStop(.2,`hsla(${(hue+20)%360},100%,55%,.35)`);rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.beginPath();x.arc(cx,cy,hr*1.5,0,TAU);x.fill();x.restore();
  x.fillStyle='#000';x.beginPath();x.arc(cx,cy,hr,0,TAU);x.fill();
  x.save();x.globalCompositeOperation='lighter';x.strokeStyle=`hsla(${(hue+45)%360},100%,85%,.95)`;x.lineWidth=1.6;glowFill(x,`hsl(${(hue+40)%360},100%,65%)`,16);x.beginPath();x.arc(cx,cy,hr*1.02,0,TAU);x.stroke();x.shadowBlur=0;
  for(let k=K-1;k>=0;k--){const R=ring(k);x.strokeStyle=R.g;x.lineWidth=R.lw;x.beginPath();x.ellipse(cx,cy,R.r,R.r*sq,0,0,Math.PI);x.stroke()}
  for(let i=0;i<420;i++){const f=Math.pow(H(i),1.3),r=rin+f*(rout-rin),a=H(i+1)*TAU+t*(1.6*Math.pow(rin/r,1.5)),len=.08+H(i+2)*.12,heat=1-f;const front=Math.sin(a)>0;if(!front&&Math.abs(Math.cos(a))*r<hr)continue;
    x.globalAlpha=(.25+.75*heat)*(.7+.3*Math.cos(a));x.strokeStyle=`hsl(${(hue+40-heat*20)%360},100%,${70+heat*25}%)`;x.lineWidth=1;x.beginPath();x.ellipse(cx,cy,r,r*sq,0,a-len,a);x.stroke()}
  x.restore()}}
];


/* ================= AVATAR FRAMES (canvas) ================= */
function glow(x,c,b){x.shadowColor=c;x.shadowBlur=b}

const F=[
{n:'Cash band',r:'Common',k:'frame_cash_band',d:'A paper money band wrapped around you, with a 10K strap at the bottom.',back(x,t,R){x.lineWidth=9;x.strokeStyle='#1f7a4c';x.beginPath();x.arc(0,0,R+6,0,TAU);x.stroke();x.lineWidth=1;x.strokeStyle='#8ee0b3';x.setLineDash([2,4]);x.beginPath();x.arc(0,0,R+6,0,TAU);x.stroke();x.setLineDash([])},
  front(x,t,R){x.save();x.translate(0,R+6);x.fillStyle='#f3e9c6';x.fillRect(-24,-8,48,16);x.fillStyle='#7a5a12';x.font='800 10px Inter';x.textAlign='center';x.textBaseline='middle';x.fillText('$10K',0,1);x.restore()}},
{n:'Dealer button',r:'Common',k:'frame_dealer_button',d:'A thick white puck with DEALER printed around the edge.',back(x,t,R){x.beginPath();x.arc(0,0,R+12,0,TAU);x.fillStyle='#f4f4f0';x.fill();x.lineWidth=1.5;x.strokeStyle='#c9c9c2';x.beginPath();x.arc(0,0,R+9,0,TAU);x.stroke()},
  front(x,t,R){x.fillStyle='#111';x.font='800 9px Inter';x.textAlign='center';x.textBaseline='middle';const s='DEALER · DEALER · DEALER · ';for(let i=0;i<s.length;i++){const a=-Math.PI/2+(i/s.length)*TAU;x.save();x.rotate(a+Math.PI/2);x.translate(0,-(R+6));x.fillText(s[i],0,0);x.restore()}}},
{n:'Pixel ring',r:'Common',k:'frame_pixel_ring',d:'A chunky 8-bit ring that cycles through colours.',back(x,t,R){const p=5;for(let gx=-R-14;gx<=R+14;gx+=p)for(let gy=-R-14;gy<=R+14;gy+=p){const d=Math.hypot(gx+p/2,gy+p/2);if(d>R+1&&d<R+11){const a=Math.atan2(gy,gx);x.fillStyle=`hsl(${(a/TAU*360+t*80)%360|0},80%,60%)`;x.fillRect(gx,gy,p-.6,p-.6)}}}},
{n:'Dice orbit',r:'Rare',k:'frame_dice_orbit',d:'Three dice orbit you and tumble as they go.',back(x,t,R){x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=1;x.beginPath();x.arc(0,0,R+16,0,TAU);x.stroke()},
  front(x,t,R){for(let i=0;i<3;i++){const a=t*.8+i*TAU/3;x.save();x.translate(Math.cos(a)*(R+16),Math.sin(a)*(R+16));x.rotate(t*2+i);x.fillStyle='#f8fafc';x.beginPath();x.roundRect(-8,-8,16,16,3.5);x.fill();x.fillStyle='#111';const f=(Math.floor(t*1.2+i*2)%6)+1,P={1:[[0,0]],2:[[-3.5,-3.5],[3.5,3.5]],3:[[-4,-4],[0,0],[4,4]],4:[[-4,-4],[4,-4],[-4,4],[4,4]],5:[[-4,-4],[4,-4],[0,0],[-4,4],[4,4]],6:[[-4,-4],[4,-4],[-4,0],[4,0],[-4,4],[4,4]]}[f];
    P.forEach(([px,py])=>{x.beginPath();x.arc(px,py,1.6,0,TAU);x.fill()});x.restore()}}},
{n:'Laurel wreath',r:'Rare',k:'frame_laurel',d:'A victor\'s wreath of gold-green leaves tied with a ribbon.',front(x,t,R){for(const side of[-1,1]){for(let i=0;i<11;i++){const a=Math.PI/2+side*(.25+i*.23),r=R+7;x.save();x.translate(Math.cos(a)*r,Math.sin(a)*r);x.rotate(a+side*(Math.PI/2+.5));
    x.fillStyle=i%2?'#9ab43c':'#c8b04a';x.beginPath();x.ellipse(0,0,4,9,0,0,TAU);x.fill();x.restore()}}x.fillStyle='#b91c1c';x.beginPath();x.moveTo(-8,R+4);x.lineTo(8,R+4);x.lineTo(4,R+16);x.lineTo(0,R+11);x.lineTo(-4,R+16);x.fill()}},
{n:'Thorn vine',r:'Rare',k:'frame_thorn_vine',d:'A dark vine full of thorns curling around you, with one red rose.',front(x,t,R){x.strokeStyle='#2d3b23';x.lineWidth=3;x.beginPath();for(let i=0;i<=200;i++){const a=i/200*TAU,r=R+5+Math.sin(a*7)*4;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();
  x.fillStyle='#4a5a33';for(let i=0;i<20;i++){const a=i/20*TAU,r=R+5+Math.sin(a*7)*4;x.save();x.translate(Math.cos(a)*r,Math.sin(a)*r);x.rotate(a+(i%2?.6:-.6));x.beginPath();x.moveTo(-2,0);x.lineTo(0,-7);x.lineTo(2,0);x.fill();x.restore()}
  const pu=1+Math.sin(t*2)*.06;x.save();x.translate(Math.cos(-.7)*(R+6),Math.sin(-.7)*(R+6));x.scale(pu,pu);for(let i=0;i<5;i++){x.rotate(TAU/5);x.fillStyle=i%2?'#b91c1c':'#dc2626';x.beginPath();x.ellipse(0,-3,4,5,0,0,TAU);x.fill()}x.fillStyle='#7f1d1d';x.beginPath();x.arc(0,0,2.5,0,TAU);x.fill();x.restore()}},
{n:'Hourglass',r:'Rare',k:'frame_hourglass',d:'A clock-face ring with a sweeping hand, for players who are always on the clock.',back(x,t,R){x.lineWidth=6;x.strokeStyle='#3a3226';x.beginPath();x.arc(0,0,R+7,0,TAU);x.stroke()},
  front(x,t,R){for(let i=0;i<60;i++){const a=i/60*TAU,L=i%5?2.5:6;x.strokeStyle=i%5?'#a8916a':'#e8d3a6';x.lineWidth=i%5?1:2;x.beginPath();x.moveTo(Math.cos(a)*(R+4),Math.sin(a)*(R+4));x.lineTo(Math.cos(a)*(R+4+L),Math.sin(a)*(R+4+L));x.stroke()}
  const a=t*TAU/8-Math.PI/2;x.strokeStyle='#f5df98';x.lineWidth=2.5;glow(x,'#f5df98',8);x.beginPath();x.arc(0,0,R+14,a-.25,a);x.stroke();x.shadowBlur=0;x.fillStyle='#f5df98';x.beginPath();x.arc(Math.cos(a)*(R+14),Math.sin(a)*(R+14),2.5,0,TAU);x.fill()}},
{n:'Neon sign',r:'Epic',k:'frame_neon_sign',d:'A double neon tube in pink and cyan that sometimes buzzes and flickers.',front(x,t,R){const fl=H(Math.floor(t*9))<.07?.25:1,fl2=H(Math.floor(t*7)+50)<.05?.3:1;x.lineCap='round';
  x.globalAlpha=fl;x.strokeStyle='#ff4fd8';x.lineWidth=3.5;glow(x,'#ff4fd8',16);x.beginPath();x.arc(0,0,R+5,.15,TAU-.15);x.stroke();
  x.globalAlpha=fl2;x.strokeStyle='#22e5ff';glow(x,'#22e5ff',16);x.beginPath();x.arc(0,0,R+12,Math.PI+.2,Math.PI-.2+TAU);x.stroke();x.shadowBlur=0;x.globalAlpha=1;
  x.fillStyle='#555';[[R+5,.15],[R+5,-.15],[R+12,Math.PI+.2],[R+12,Math.PI-.2]].forEach(([r,a])=>{x.beginPath();x.arc(Math.cos(a)*r,Math.sin(a)*r,2.4,0,TAU);x.fill()})}},
{n:'Card fan',r:'Epic',k:'frame_card_fan',d:'A royal flush fanned out behind your head and swaying gently.',back(x,t,R){const S=['A','K','Q','J','10'];for(let i=0;i<5;i++){const a=-Math.PI/2+(i-2)*.38+Math.sin(t*1.2)*.04;x.save();x.rotate(a+Math.PI/2);x.translate(0,-R-6);
    x.fillStyle='#fafaf9';x.beginPath();x.roundRect(-13,-20,26,36,4);x.fill();x.strokeStyle='#d6d3d1';x.lineWidth=1;x.stroke();x.fillStyle=i%2?'#111':'#dc2626';x.font='800 11px Inter';x.textAlign='center';x.fillText(S[i],0,-6);x.font='10px Inter';x.fillText(i%2?'♠':'♥',0,6);x.restore()}
  x.lineWidth=4;x.strokeStyle='#D4AF37';x.beginPath();x.arc(0,0,R+2,0,TAU);x.stroke()}},
{n:'Slot reel ring',r:'Epic',k:'frame_slot_ring',d:'The ring is a slot reel, with symbols rolling round it nonstop.',back(x,t,R){x.lineWidth=18;x.strokeStyle='#161218';x.beginPath();x.arc(0,0,R+10,0,TAU);x.stroke();x.lineWidth=1.5;x.strokeStyle='#D4AF37';[R+1,R+19].forEach(r=>{x.beginPath();x.arc(0,0,r,0,TAU);x.stroke()})},
  front(x,t,R){const S=['7','$','♦','★','♣','7','♥','$','★','♦','♣','♥'];x.font='800 11px Inter';x.textAlign='center';x.textBaseline='middle';for(let i=0;i<12;i++){const a=i/12*TAU+t*.7;x.save();x.rotate(a);x.translate(0,-(R+10));x.fillStyle=S[i]=='7'?'#ef4444':'#f5df98';x.fillText(S[i],0,0);x.restore()}
  x.fillStyle='#ef4444';x.beginPath();x.moveTo(0,-R+2);x.lineTo(-5,-R-6);x.lineTo(5,-R-6);x.fill()}},
{n:'Ice crystal',r:'Epic',k:'frame_ice_crystal',d:'Frost spikes grow out of a frozen ring, with sparkles flashing on the ice.',front(x,t,R){x.lineWidth=3;x.strokeStyle='#bae6fd';glow(x,'#7dd3fc',10);x.beginPath();x.arc(0,0,R+3,0,TAU);x.stroke();x.shadowBlur=0;
  for(let i=0;i<18;i++){const a=i/18*TAU,L=6+H(i)*12;x.save();x.rotate(a);x.translate(0,-R-3);x.fillStyle='rgba(224,242,254,.85)';x.beginPath();x.moveTo(-3,0);x.lineTo(0,-L);x.lineTo(3,0);x.fill();
    x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=1;x.beginPath();x.moveTo(0,-L*.5);x.lineTo(-3,-L*.75);x.moveTo(0,-L*.5);x.lineTo(3,-L*.75);x.stroke();x.restore()}
  for(let i=0;i<4;i++){const s=Math.floor(t*2)+i*11,a=H(s)*TAU,r=R+4+H(s+1)*12,ph=(t*2)%1;x.save();x.translate(Math.cos(a)*r,Math.sin(a)*r);x.globalAlpha=Math.sin(ph*Math.PI);x.strokeStyle='#fff';x.lineWidth=1.2;const z=4*Math.sin(ph*Math.PI);x.beginPath();x.moveTo(-z,0);x.lineTo(z,0);x.moveTo(0,-z);x.lineTo(0,z);x.stroke();x.restore()}}},
{n:'Sakura',r:'Epic',k:'frame_sakura',d:'A full wreath of cherry blossoms and leaves, with petals tumbling past in the breeze.',back(x,t,R){x.save();x.globalCompositeOperation='lighter';const g=x.createRadialGradient(0,0,R,0,0,R+26);g.addColorStop(0,'rgba(244,114,182,.18)');g.addColorStop(1,'rgba(244,114,182,0)');x.fillStyle=g;x.beginPath();x.arc(0,0,R+26,0,TAU);x.fill();x.restore()},
  front(x,t,R){const sway=Math.sin(t*.8)*.02;x.save();x.rotate(sway);x.lineCap='round';
  x.strokeStyle='#4a2e1f';x.lineWidth=3.2;x.beginPath();for(let i=0;i<=160;i++){const a=i/160*TAU,r=R+6+Math.sin(a*5)*2.2;i?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r)}x.stroke();
  x.lineWidth=1.6;for(let i=0;i<12;i++){const a=i/12*TAU+.2,r=R+6+Math.sin(a*5)*2.2,d=i%2?1:-1;x.beginPath();x.moveTo(Math.cos(a)*r,Math.sin(a)*r);x.quadraticCurveTo(Math.cos(a+.08*d)*(r+7),Math.sin(a+.08*d)*(r+7),Math.cos(a+.16*d)*(r+10),Math.sin(a+.16*d)*(r+10));x.stroke()}
  for(let i=0;i<14;i++){const a=i/14*TAU+.1,r=R+9+(i%2?3:-1);x.save();x.translate(Math.cos(a)*r,Math.sin(a)*r);x.rotate(a+(i%2?.9:-.9));const g=x.createLinearGradient(0,-6,0,6);g.addColorStop(0,'#86c06a');g.addColorStop(1,'#3f7a3a');x.fillStyle=g;x.beginPath();x.ellipse(0,0,2.3,6,0,0,TAU);x.fill();x.strokeStyle='rgba(20,50,20,.6)';x.lineWidth=.5;x.beginPath();x.moveTo(0,-5);x.lineTo(0,5);x.stroke();x.restore()}
  const petal=(len,wd)=>{x.beginPath();x.moveTo(0,0);x.quadraticCurveTo(-wd,-len*.45,-wd*.42,-len);x.lineTo(0,-len*.84);x.lineTo(wd*.42,-len);x.quadraticCurveTo(wd,-len*.45,0,0);x.fill()};
  for(let i=0;i<17;i++){const a=i/17*TAU+H(i)*.12,r=R+6+Math.sin(a*5)*2.2+(H(i+3)-.5)*6,sz=.8+H(i+5)*.45,bud=i%6==5;x.save();x.translate(Math.cos(a)*r,Math.sin(a)*r);x.rotate(H(i+9)*TAU+Math.sin(t*1.3+i)*.05);x.scale(sz,sz);
    if(bud){x.fillStyle='#ec4899';x.beginPath();x.ellipse(0,0,2.6,3.6,0,0,TAU);x.fill();x.restore();continue}
    x.shadowColor='rgba(244,114,182,.7)';x.shadowBlur=6;const g=x.createRadialGradient(0,0,0,0,0,7);g.addColorStop(0,'#fff5fa');g.addColorStop(.55,'#fbcfe8');g.addColorStop(1,'#f472b6');x.fillStyle=g;
    for(let p=0;p<5;p++){x.rotate(TAU/5);petal(7,4.4)}x.shadowBlur=0;x.fillStyle='#be185d';x.beginPath();x.arc(0,0,1.5,0,TAU);x.fill();x.fillStyle='#fde047';for(let s=0;s<5;s++){const sa=s/5*TAU+.3;x.beginPath();x.arc(Math.cos(sa)*2.6,Math.sin(sa)*2.6,.7,0,TAU);x.fill()}x.restore()}
  x.restore();
  for(let i=0;i<16;i++){const ph=(t*.18+H(i))%1,orb=H(i+2)*TAU+ph*1.6,rr=R+16+H(i+4)*22+ph*10,px=Math.cos(orb)*rr+ph*14,py=Math.sin(orb)*rr+ph*26;x.save();x.globalAlpha=Math.sin(ph*Math.PI);x.translate(px,py);x.rotate(t*1.7+i);x.scale(Math.cos(t*3+i*1.3),1);
    const g=x.createLinearGradient(0,-4,0,4);g.addColorStop(0,'#fff0f6');g.addColorStop(1,'#f9a8d4');x.fillStyle=g;petal(5.5,3.4);x.restore()}}},
{n:'Lightning ring',r:'Legendary',k:'frame_lightning_ring',d:'A ring of live electricity with arcs that keep jumping off it.',front(x,t,R){const pu=.7+Math.sin(t*4)*.3;x.strokeStyle='#a5b4fc';x.lineWidth=2.5;glow(x,'#818cf8',18*pu);x.beginPath();x.arc(0,0,R+5,0,TAU);x.stroke();
  const f=Math.floor(t*16);for(let k=0;k<3;k++){const s=f*7+k*31,a0=H(s)*TAU,len=.6+H(s+1)*.8;x.strokeStyle=k?'#c7d2fe':'#fff';x.lineWidth=k?1.2:1.8;x.beginPath();for(let i=0;i<=10;i++){const a=a0+len*i/10,r=R+5+(i&&i<10?(H(s+i*3)-.5)*16:0);i?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r)}x.stroke()}x.shadowBlur=0}},
{n:'Lava crack',r:'Legendary',k:'frame_lava_crack',d:'Molten lava flows under a ring of cracked rock, with pulsing seams, dripping lava and embers.',back(x,t,R){const pu=.6+Math.sin(t*2.4)*.4;
  x.save();x.globalCompositeOperation='lighter';const hg=x.createRadialGradient(0,0,R+4,0,0,R+30);hg.addColorStop(0,`rgba(249,115,22,${.35*pu})`);hg.addColorStop(1,'rgba(249,115,22,0)');x.fillStyle=hg;x.beginPath();x.arc(0,0,R+30,0,TAU);x.fill();x.restore();
  let lg;if(x.createConicGradient){lg=x.createConicGradient(t*.9,0,0);['#ff3b0a','#ff9a1f','#ffd34d','#ff6a00','#e11d0a','#ff9a1f','#ff3b0a'].forEach((c,i,a)=>lg.addColorStop(i/(a.length-1),c))}else lg='#ff7a1a';
  x.lineWidth=17;x.strokeStyle=lg;glow(x,'#ff6a00',14*pu);x.beginPath();x.arc(0,0,R+8.5,0,TAU);x.stroke();x.shadowBlur=0;
  const N=14,W=[];let tot=0;for(let c=0;c<N;c++){W.push(.5+H(c+90));tot+=W[c]}let acc=0;for(let c=0;c<N;c++){const gap=.012+H(c+70)*.016,a0=acc/tot*TAU+gap+.3;acc+=W[c];const a1=acc/tot*TAU-gap+.3;x.beginPath();const st=6;
    for(let s=0;s<=st;s++){const a=a0+(a1-a0)*s/st,r=R+16.5+(s&&s<st?(H(c*13+s)-.5)*3:0);s?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r)}
    for(let s=st;s>=0;s--){const a=a0+(a1-a0)*s/st,r=R+.5+(s&&s<st?(H(c*17+s)-.5)*2:0);x.lineTo(Math.cos(a)*r,Math.sin(a)*r)}x.closePath();
    const am=(a0+a1)/2,g=x.createLinearGradient(Math.cos(am)*R,Math.sin(am)*R,Math.cos(am)*(R+17),Math.sin(am)*(R+17));g.addColorStop(0,'#3a1a10');g.addColorStop(.5,H(c)>.5?'#241612':'#1c120f');g.addColorStop(1,'#120a08');x.fillStyle=g;x.fill();
    x.strokeStyle='rgba(255,255,255,.06)';x.lineWidth=.8;x.stroke();
    for(const off of[-.25,.25]){if(H(c+40+off*8)<.25)continue;const am2=am+(a1-a0)*off,w=(Math.sin(t*3-am2*2)+1)/2;x.strokeStyle=`rgba(255,${150+w*80|0},60,${.35+w*.65})`;glow(x,'#ff7a1a',8*w);x.lineWidth=1;x.beginPath();x.moveTo(Math.cos(am2-.02)*(R+2),Math.sin(am2-.02)*(R+2));x.lineTo(Math.cos(am2+.03)*(R+7),Math.sin(am2+.03)*(R+7));x.lineTo(Math.cos(am2-.01)*(R+11),Math.sin(am2-.01)*(R+11));x.lineTo(Math.cos(am2+.025)*(R+15),Math.sin(am2+.025)*(R+15));x.stroke();x.shadowBlur=0}}
  },
  front(x,t,R){[[.35,0],[-.25,.4],[.05,.75]].forEach(([dx,ph],i)=>{const a=Math.PI/2+dx,bx=Math.cos(a)*(R+15),by=Math.sin(a)*(R+15),p=(t*.45+ph)%1;const len=p<.7?p/.7*9:9,g=x.createLinearGradient(bx,by,bx,by+len);g.addColorStop(0,'#ff6a00');g.addColorStop(1,'#ffd34d');
    x.fillStyle=g;glow(x,'#ff6a00',8);x.beginPath();x.moveTo(bx-2.5,by-1);x.quadraticCurveTo(bx-1.5,by+len,bx,by+len+1.5);x.quadraticCurveTo(bx+1.5,by+len,bx+2.5,by-1);x.fill();
    if(p>.7){const k=(p-.7)/.3;x.globalAlpha=1-k;x.beginPath();x.arc(bx,by+10+k*k*40,1.8,0,TAU);x.fill();x.globalAlpha=1}x.shadowBlur=0});
  x.globalCompositeOperation='lighter';for(let i=0;i<26;i++){const ph=(t*.45+H(i))%1,a=H(i+4)*TAU,r=R+12+ph*30,fl=.5+.5*Math.sin(t*20+i*3);x.globalAlpha=(1-ph)*fl;x.fillStyle=i%3?'#ffb347':'#ff4d1a';glow(x,'#ff6a00',4);
    x.beginPath();x.arc(Math.cos(a)*r+Math.sin(t*3+i)*3,Math.sin(a)*r-ph*16,1+H(i+8)*1.2,0,TAU);x.fill()}x.shadowBlur=0;x.globalAlpha=1;x.globalCompositeOperation='source-over'}},
{n:'Hologram',r:'Legendary',k:'frame_hologram',d:'Cyan projector arcs with scanlines and the odd RGB glitch.',front(x,t,R){const f=Math.floor(t*12),gl=H(f)<.12;x.lineWidth=2;
  [[R+5,t*1.2,[18,8]],[R+11,-t*.8,[4,6]],[R+17,t*.5,[40,20]]].forEach(([r,rot,d],i)=>{x.save();x.rotate(rot);x.setLineDash(d);x.strokeStyle=i==1?'rgba(103,232,249,.6)':'#67e8f9';glow(x,'#22d3ee',10);x.beginPath();x.arc(0,0,r,0,TAU);x.stroke();x.restore()});x.shadowBlur=0;x.setLineDash([]);
  x.save();x.beginPath();x.arc(0,0,R,0,TAU);x.clip();x.fillStyle='rgba(103,232,249,.08)';for(let y=-R;y<R;y+=3)x.fillRect(-R,y+((t*20)%3),2*R,1);x.restore();
  if(gl){x.globalCompositeOperation='lighter';x.strokeStyle='rgba(255,0,80,.7)';x.lineWidth=2;x.beginPath();x.arc(3,0,R+5,0,TAU);x.stroke();x.strokeStyle='rgba(0,229,255,.7)';x.beginPath();x.arc(-3,1,R+5,0,TAU);x.stroke();x.globalCompositeOperation='source-over'}}},
{n:'Galaxy orbit',r:'Legendary',k:'frame_galaxy_orbit',d:'Tilted orbits with little planets circling you, including one with rings.',back(x,t,R){x.save();x.rotate(-.35);x.scale(1,.38);x.strokeStyle='rgba(196,181,253,.25)';x.lineWidth=2;[R+14,R+24].forEach(r=>{x.beginPath();x.arc(0,0,r,0,TAU);x.stroke()});x.restore()},
  front(x,t,R){const P=[[R+14,1.1,5,'#f472b6'],[R+24,.7,7,'#fbbf24'],[R+14,1.1,3,'#67e8f9',Math.PI]];P.forEach(([r,sp,s,c,o],i)=>{const a=t*sp+(o||0),px=Math.cos(a)*r,py=Math.sin(a)*r*.38;const rx=px*Math.cos(-.35)-py*Math.sin(-.35),ry=px*Math.sin(-.35)+py*Math.cos(-.35);
    if(Math.sin(a)<0&&Math.hypot(rx,ry)<R+2)return;x.fillStyle=c;glow(x,c,10);x.beginPath();x.arc(rx,ry,s,0,TAU);x.fill();x.shadowBlur=0;if(i==1){x.strokeStyle='#fde68a';x.lineWidth=1;x.beginPath();x.ellipse(rx,ry,s+4,2,-.4,0,TAU);x.stroke()}});
  for(let i=0;i<10;i++){x.globalAlpha=.4+.6*Math.abs(Math.sin(t*2+i));x.fillStyle='#fff';const a=H(i)*TAU,r=R+6+H(i+1)*28;x.fillRect(Math.cos(a)*r,Math.sin(a)*r,1.4,1.4)}x.globalAlpha=1}},
{n:'Black hole',r:'Exotic',k:'frame_black_hole',d:'An accretion disk wraps around your avatar while nearby stars get pulled in.',back(x,t,R){x.globalCompositeOperation='lighter';for(let i=0;i<220;i++){const r=R+2+H(i)*22,a=H(i+1)*TAU+t*(2.2-(r-R)/20),px=Math.cos(a)*r,py=Math.sin(a)*r*.32;if(Math.sin(a)>0)continue;
    x.globalAlpha=.3+.7*(1-(r-R)/24);x.fillStyle=`hsl(${(t*40+r*3)%360},95%,${60+(1-(r-R)/24)*20}%)`;x.fillRect(px,py,2,1.3)}x.globalCompositeOperation='source-over';x.globalAlpha=1;
  x.strokeStyle=`hsl(${(t*40+20)%360},95%,70%)`;x.lineWidth=2;glow(x,x.strokeStyle,18);x.beginPath();x.arc(0,0,R+2,0,TAU);x.stroke();x.shadowBlur=0},
  front(x,t,R){x.globalCompositeOperation='lighter';for(let i=0;i<220;i++){const r=R+2+H(i)*22,a=H(i+1)*TAU+t*(2.2-(r-R)/20),px=Math.cos(a)*r,py=Math.sin(a)*r*.32;if(Math.sin(a)<=0)continue;
    x.globalAlpha=.3+.7*(1-(r-R)/24);x.fillStyle=`hsl(${(t*40+r*3)%360},95%,${60+(1-(r-R)/24)*20}%)`;x.fillRect(px,py,2,1.3)}
  for(let i=0;i<12;i++){const ph=(t*.35+H(i+9))%1,a=H(i+20)*TAU+ph*3,r=(1-ph)*(R+40)+R;x.globalAlpha=ph;x.fillStyle='#e9d5ff';x.fillRect(Math.cos(a)*r,Math.sin(a)*r,1.5,1.5)}x.globalCompositeOperation='source-over';x.globalAlpha=1}},
{n:'Hollow purple',r:'Exotic',k:'frame_hollow_purple',d:'A red orb and a blue orb race round you in opposite directions. When they collide, a purple shockwave rips around the ring.',
  back(x,t,R){const P=4,p=(t%P)/P,surge=p>.5&&p<.85?Math.sin((p-.5)/.35*Math.PI):0;
  const vg=x.createRadialGradient(0,0,R,0,0,R+34);vg.addColorStop(0,`rgba(88,28,135,${.55+surge*.3})`);vg.addColorStop(.5,`rgba(46,16,101,${.3+surge*.2})`);vg.addColorStop(1,'rgba(10,0,20,0)');x.fillStyle=vg;x.beginPath();x.arc(0,0,R+34,0,TAU);x.fill();
  x.lineWidth=7;x.strokeStyle='#0d0218';x.beginPath();x.arc(0,0,R+5,0,TAU);x.stroke();
  x.save();x.globalCompositeOperation='lighter';x.lineWidth=2;x.strokeStyle=`rgba(192,132,252,${.55+surge*.45})`;glow(x,'#a855f7',14+surge*20);x.beginPath();x.arc(0,0,R+5,0,TAU);x.stroke();x.restore()},
  front(x,t,R){const P=4,p=(t%P)/P,top=-Math.PI/2;x.save();x.globalCompositeOperation='lighter';
  const f=Math.floor(t*14);for(let k=0;k<6;k++){const s=f*11+k*7,a=H(s)*TAU,r0=R+5;x.strokeStyle=`rgba(${H(s+1)>.5?'216,180,254':'167,139,250'},.8)`;x.lineWidth=1;glow(x,'#a855f7',6);x.beginPath();let px=Math.cos(a)*r0,py=Math.sin(a)*r0;x.moveTo(px,py);
    for(let j=1;j<4;j++){const aa=a+j*.05,rr=r0+(H(s+j*3)-.3)*10;x.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr)}x.stroke()}
  for(let i=0;i<30;i++){const a=H(i)*TAU+t*(.4+H(i+1)*.6)*(i%2?1:-1),r=R+5+(H(i+2)-.5)*10+Math.sin(t*5+i)*2;x.globalAlpha=.4+.6*Math.abs(Math.sin(t*3+i));x.fillStyle=i%3?'#c084fc':'#f0abfc';x.fillRect(Math.cos(a)*r,Math.sin(a)*r,1.6,1.6)}x.globalAlpha=1;
  const orb=(a,c1,c2,sz,al)=>{x.globalCompositeOperation='source-over';for(let j=10;j>=0;j--){const aa=a.f(j),px=Math.cos(aa)*(R+5),py=Math.sin(aa)*(R+5);x.globalAlpha=al*(1-j/11)*(j?.5:1);const g=x.createRadialGradient(px,py,0,px,py,sz*(1-j*.06));g.addColorStop(0,'#fff');g.addColorStop(.35,c1);g.addColorStop(1,c2);x.fillStyle=g;x.beginPath();x.arc(px,py,sz*(1-j*.06),0,TAU);x.fill()}x.globalAlpha=1;x.globalCompositeOperation='lighter'};
  if(p<.5||p>.9){const q=p<.5?p/.5:0,al=p<.5?1:(p-.9)/.1,dt=.012;
    orb({f:j=>Math.PI/2+Math.PI*Math.max(0,q-j*dt)},'#ff2a2a','rgba(220,38,38,0)',10+Math.sin(t*12)*.8,al);
    orb({f:j=>Math.PI/2-Math.PI*Math.max(0,q-j*dt)},'#2f86ff','rgba(37,99,235,0)',10+Math.cos(t*12)*.8,al)}
  if(p>=.5){const k=(p-.5)/.5,tx=Math.cos(top)*(R+5),ty=Math.sin(top)*(R+5);
    if(k<.35){const kk=k/.35,r=6+kk*46;const g=x.createRadialGradient(tx,ty,0,tx,ty,r);g.addColorStop(0,`rgba(255,255,255,${1-kk})`);g.addColorStop(.3,`rgba(216,180,254,${.9*(1-kk)})`);g.addColorStop(1,'rgba(88,28,135,0)');x.fillStyle=g;x.beginPath();x.arc(tx,ty,r,0,TAU);x.fill();
      x.strokeStyle=`rgba(233,213,255,${1-kk})`;x.lineWidth=2;x.beginPath();x.arc(tx,ty,r*.8,0,TAU);x.stroke()}
    const wave=clamp(k/.5)*Math.PI,fade=k<.5?1:clamp(1-(k-.5)/.4);if(fade>0){for(const dir of[1,-1]){x.lineCap='round';x.lineWidth=6;x.strokeStyle=`rgba(168,85,247,${.6*fade})`;glow(x,'#a855f7',24);x.beginPath();x.arc(0,0,R+5,top,top+dir*wave,dir<0);x.stroke();
      x.lineWidth=2;x.strokeStyle=`rgba(255,255,255,${.9*fade})`;x.beginPath();x.arc(0,0,R+5,top,top+dir*wave,dir<0);x.stroke();
      const ha=top+dir*wave;x.fillStyle=`rgba(255,255,255,${fade})`;x.beginPath();x.arc(Math.cos(ha)*(R+5),Math.sin(ha)*(R+5),3.5,0,TAU);x.fill()}}x.shadowBlur=0}
  x.restore()}}
];


/* eslint-enable */
/* ================= catalog keys + metadata ================= */
const byKey = (arr) => Object.fromEntries(arr.map((it) => [it.k, it]));
const FX_BY_KEY = byKey(FX), BG_BY_KEY = byKey(BG), FRAME_BY_KEY = byKey(F);

// Accent colour per win effect (ticker flair, preview tint).
const FX_COLORS = {
  fx_coin_fountain: '#f5c84a', fx_confetti_pop: '#f472b6', fx_chip_shower: '#3b82f6', fx_triple_seven: '#ef4444',
  fx_money_printer: '#34d399', fx_firework: '#ec4899', fx_cash_slam: '#10b981', fx_shockwave: '#38bdf8',
  fx_lightning: '#818cf8', fx_gold_rain: '#D4AF37', fx_comet: '#f97316', fx_vault_burst: '#f5c84a',
  fx_supernova: '#a855f7', fx_black_hole: '#8b5cf6', fx_jackpot_exe: '#10b981',
};
export const fxColor = (key) => FX_COLORS[key] || '#10b981';
export const isCanvasFrame = (key) => !!FRAME_BY_KEY[key];
export const frameHasPart = (key, part) => !!(FRAME_BY_KEY[key] && FRAME_BY_KEY[key][part]);
export const hasWinFx = (key) => !!FX_BY_KEY[key];
export const hasBackdrop = (key) => !!BG_BY_KEY[key];

/** The equipped win effect plays when a win pays at least this many times the bet... */
export const BIG_WIN_MULTIPLIER = 2;
/** ...or when the winnings (net, in CC) reach this amount, whatever the multiplier. */
export const BIG_WIN_AMOUNT = 10000;

/* ================= markup helpers ================= */
/** Looping win-effect preview. width in px (height follows the 300x170 design box). */
export function fxPreviewHTML(key, width = 150) {
  const w = Math.round(width), h = Math.round(width * 170 / 300);
  return `<canvas data-cfx="fx:${key}" style="display:block;width:${w}px;height:${h}px;border-radius:${Math.round(w / 14)}px;background:#0a0d0c"></canvas>`;
}
/** Backdrop preview box with an optional overlay (e.g. a mini avatar) on top. */
export function backdropPreviewHTML(key, width = 150, overlay = '') {
  const w = Math.round(width), h = Math.round(width * 190 / 340);
  return `<div style="position:relative;width:${w}px;height:${h}px;border-radius:${Math.round(w / 14)}px;overflow:hidden;background:#070707;display:flex;align-items:center;justify-content:center">
    <canvas data-cfx="bg:${key}" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center">${overlay}</div></div>`;
}
/** Full-bleed backdrop canvas for a container that is already position:relative. */
export function backdropFillHTML(key) {
  return `<canvas data-cfx="bg:${key}" style="position:absolute;inset:0;width:100%;height:100%"></canvas>`;
}
/** Back and front canvas layers for a canvas avatar frame around an avatar of avSize px. */
export function frameLayersHTML(key, avSize) {
  const S = Math.round(avSize * 1.8), m = -S / 2;
  const layer = (part, z) => frameHasPart(key, part)
    ? `<canvas data-cfx="frame:${key}:${part}" style="position:absolute;left:50%;top:50%;width:${S}px;height:${S}px;margin:${m}px 0 0 ${m}px;pointer-events:none;z-index:${z}"></canvas>` : '';
  return { back: layer('back', 1), front: layer('front', 3) };
}

/* ================= animator ================= */
const live = new Set();
let io = null, started = false;
function attach(c) {
  if (c._cfx) return;
  const [kind, key, part] = c.dataset.cfx.split(':');
  const def = kind === 'fx' ? FX_BY_KEY[key] : kind === 'bg' ? BG_BY_KEY[key] : FRAME_BY_KEY[key];
  if (!def) return;
  const o = { c, x: c.getContext('2d'), kind, key, part, def, vis: true, t0: performance.now() / 1000 - H(live.size) * 2 };
  c._cfx = o; live.add(o); io && io.observe(c);
}
function scan() {
  document.querySelectorAll('canvas[data-cfx]').forEach(attach);
  for (const o of live) if (!o.c.isConnected) { live.delete(o); io && io.unobserve(o.c); }
}
function drawOne(o, t) {
  const c = o.c, cw = c.clientWidth, ch = c.clientHeight;
  if (!cw || !ch) return;
  const pw = Math.round(cw * DPR), ph = Math.round(ch * DPR);
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
  const x = o.x;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.shadowBlur = 0; x.setLineDash([]);
  x.clearRect(0, 0, pw, ph);
  if (o.kind === 'fx') { const s = cw / 300; x.setTransform(DPR * s, 0, 0, DPR * s, 0, 0); o.def.f(x, t, 300, 170, o); }
  else if (o.kind === 'bg') { x.setTransform(DPR, 0, 0, DPR, 0, 0); o.def.f(x, t, cw, ch, o); }
  else { const k = cw / 2 / 90; x.setTransform(DPR * k, 0, 0, DPR * k, pw / 2, ph / 2); o.def[o.part] && o.def[o.part](x, t, 50); }
}
function tick(now) {
  const t = now / 1000;
  for (const o of live) { if (!o.vis) continue; try { drawOne(o, t - o.t0); } catch (e) { console.error('[cfx]', o.key, e); live.delete(o); } }
  requestAnimationFrame(tick);
}
export function startCosmeticAnimator() {
  if (started || typeof document === 'undefined') return;
  started = true;
  io = new IntersectionObserver((es) => es.forEach((e) => { if (e.target._cfx) e.target._cfx.vis = e.isIntersecting; }), { rootMargin: '120px' });
  let pending = false;
  new MutationObserver(() => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; scan(); }); } })
    .observe(document.body, { childList: true, subtree: true });
  scan();
  requestAnimationFrame(tick);
}

/* ================= the signed-in player's equipped cosmetics ================= */
// Cached for a minute so the game shell can play the win effect instantly;
// the profile page invalidates it whenever something is equipped/unequipped.
let eqCache = null, eqAt = 0, eqLoading = null;
export function invalidateMyEquipped() { eqCache = null; eqAt = 0; }
/** fetcher(): Promise<{category: item}> — returns the cached map when fresh. */
export function myEquipped(fetcher) {
  if (eqCache && Date.now() - eqAt < 60000) return Promise.resolve(eqCache);
  if (!eqLoading) eqLoading = Promise.resolve().then(fetcher).then((m) => { eqCache = m || {}; eqAt = Date.now(); return eqCache; })
    .catch(() => eqCache || {}).finally(() => { eqLoading = null; });
  return eqLoading;
}

/* ================= full-screen win effect ================= */
let playing = null;
/** Plays the win effect `key` once over the whole screen, showing `amount` as the number. */
export function playWinFx(key, amount) {
  const fx = FX_BY_KEY[key];
  if (!fx || typeof document === 'undefined') return;
  if (playing) playing.remove();
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
  document.body.appendChild(c); playing = c;
  const x = c.getContext('2d'), t0 = performance.now() / 1000;
  const text = `+${Math.round(Number(amount) || 0).toLocaleString('en-US')}`;
  const step = (now) => {
    const t = now / 1000 - t0;
    if (t >= P || !c.isConnected) { c.remove(); if (playing === c) playing = null; return; }
    const W = innerWidth, Hh = innerHeight, pw = Math.round(W * DPR), ph = Math.round(Hh * DPR);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    x.setTransform(DPR, 0, 0, DPR, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.shadowBlur = 0; x.setLineDash([]);
    x.clearRect(0, 0, W, Hh);
    const dim = clamp(t * 4) * clamp((P - t) * 2.5) * 0.6, g = x.createRadialGradient(W / 2, Hh / 2, 0, W / 2, Hh / 2, Math.max(W, Hh) * 0.7);
    g.addColorStop(0, `rgba(0,0,0,${dim})`); g.addColorStop(1, `rgba(0,0,0,${dim * 0.5})`); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
    // Scale the 300x170 design up for big screens, but hand the effect the
    // whole screen (in design units) so rain, rays and flashes fill it.
    const s = Math.min(W / 300, Hh / 170, 2.6);
    x.setTransform(DPR * s, 0, 0, DPR * s, 0, 0);
    FXT = text;
    try { fx.f(x, t, W / s, Hh / s, { c }); } catch (e) { console.error('[winfx]', key, e); c.remove(); FXT = '+48,200'; return; }
    FXT = '+48,200';
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ================= catalog (mirrors backend/src/shop/catalog-round2.js) ================= */
export const ROUND2_FX = FX.map(({ n, r, k }) => ({ name: n, rarity: r, preview_key: k }));
export const ROUND2_BACKDROPS = BG.map(({ n, r, k }) => ({ name: n, rarity: r, preview_key: k }));
export const ROUND2_FRAMES = F.map(({ n, r, k }) => ({ name: n, rarity: r, preview_key: k }));

startCosmeticAnimator();

/** Low-level drawing helpers, shared with the pack-opening reveal. */
export { flash, rays, sparkle, coin3d };
