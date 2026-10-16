// The 12 animated game scenes (game previews, streak cards, hub tiles).
// Each scene is a pure draw(ctx, W, H, t, cx) — no DOM, no outside state.
// mountScene() runs them on a shared, visibility-aware, frame-capped loop.
import { onLeave } from './core.js';

/* eslint-disable */
const EM='#10b981',GOLD='#D4AF37',RED='#ef4444';
const w=a=>'rgba(255,255,255,'+a+')';
const em=a=>'rgba(16,185,129,'+a+')';
const rd=a=>'rgba(239,68,68,'+a+')';
const gd=a=>'rgba(212,175,55,'+a+')';
const PF='"Playfair Display",Georgia,serif';
function rr(c,x,y,ww,hh,r){r=Math.min(r,ww/2,hh/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+ww-r,y);c.arcTo(x+ww,y,x+ww,y+r,r);c.lineTo(x+ww,y+hh-r);c.arcTo(x+ww,y+hh,x+ww-r,y+hh,r);c.lineTo(x+r,y+hh);c.arcTo(x,y+hh,x,y+hh-r,r);c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();}
function hsh(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
const eOut=k=>1-Math.pow(1-k,3);
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));

const S={};

/* -------- Crash -------- */
S.crash=(c,W,H,t)=>{
  const P=8.4,p=t%P,climb=5.6,crashed=p>climb,u=crashed?1:p/climb,fl=p-climb;
  const x0=W*.03,x1=W*.97,y0=H*.87,amp=H*.66,K=2.2,mx=Math.exp(K)-1;
  const col=crashed?'239,68,68':'16,185,129';
  c.strokeStyle=w(.028);c.lineWidth=1;
  for(let i=0;i<4;i++){const y=H*.18+i*(H*.7/3);c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
  const px=k=>x0+k*(x1-x0),py=k=>y0-(Math.exp(k*K)-1)/mx*amp;
  const g=c.createLinearGradient(0,H*.15,0,y0);
  g.addColorStop(0,'rgba('+col+',.15)');g.addColorStop(1,'rgba('+col+',0)');
  c.beginPath();c.moveTo(x0,y0);
  for(let i=0;i<=48;i++){const k=u*i/48;c.lineTo(px(k),py(k));}
  c.lineTo(px(u),y0);c.closePath();c.fillStyle=g;c.fill();
  c.beginPath();c.lineWidth=Math.max(1.8,H*.021);c.lineJoin='round';c.lineCap='round';
  c.strokeStyle='rgba('+col+',.92)';
  for(let i=0;i<=48;i++){const k=u*i/48;i?c.lineTo(px(k),py(k)):c.moveTo(px(k),py(k));}
  c.stroke();
  if(!crashed){
    c.beginPath();c.arc(px(u),py(u),H*.028,0,7);c.fillStyle=EM;c.fill();
    c.beginPath();c.arc(px(u),py(u),H*.06,0,7);c.fillStyle=em(.14);c.fill();
  }
  c.font='700 '+(H*.19)+'px '+PF;c.textAlign='right';c.textBaseline='top';
  c.fillStyle=crashed?rd(.9):em(.88);
  c.fillText(crashed?'CRASH':(1+(Math.exp(u*K)-1)/mx*8.4).toFixed(2)+'\u00d7',W-H*.16,H*.1);
  if(crashed){c.fillStyle='rgba(239,68,68,'+(.12*Math.max(0,1-fl/1.4))+')';c.fillRect(0,0,W,H);}
};

/* -------- Blackjack -------- */
const BJ=[{v:'A',s:'♠',r:0},{v:'K',s:'♥',r:1},{v:'7',s:'♦',r:1},{v:'J',s:'♠',r:0},{v:'Q',s:'♥',r:1}];
S.bj=(c,W,H,t,cx)=>{
  const cw=H*.34,ch=H*.5,fl=Math.sin(t*.9)*H*.02,P=5.4,p=t%P;
  const slide=cl(p/.7,0,1),se=eOut(slide);
  BJ.forEach((cd,i)=>{
    const last=i===BJ.length-1;
    const rot=(-20+i*10.5)*Math.PI/180;
    let x=cx+(i-2)*cw*.78,y=H*.5+Math.abs(i-2)*H*.05+fl+Math.sin(t*.9+i*.5)*H*.012;
    let a=1;
    if(last){x+=(1-se)*W*.5;a=se;}
    c.save();c.globalAlpha=a;c.translate(x,y);c.rotate(rot);
    c.shadowColor='rgba(0,0,0,.55)';c.shadowBlur=H*.12;c.shadowOffsetY=H*.04;
    c.fillStyle='rgba(250,248,242,.95)';rr(c,-cw/2,-ch/2,cw,ch,cw*.09);c.fill();
    c.shadowColor='transparent';
    c.fillStyle=cd.r?'#b02020':'#141414';
    c.textAlign='left';c.textBaseline='top';
    c.font='700 '+(ch*.17)+'px Georgia,serif';c.fillText(cd.v,-cw/2+cw*.13,-ch/2+ch*.09);
    c.textAlign='center';c.textBaseline='middle';c.font=(ch*.38)+'px Georgia,serif';c.fillText(cd.s,0,ch*.04);
    c.restore();
  });
};

/* -------- Slots -------- */
const SY=['7','★','$','♦','BAR'];
S.slots=(c,W,H,t,cx)=>{
  const rw=H*.3,rh=H*.72,gap=H*.07,sh=rh/1.6;
  const x0=cx-(rw*3+gap*2)/2,y0=H*.5-rh/2;
  const P=5.2,p=t%P,cyc=Math.floor(t/P);
  for(let i=0;i<3;i++){
    const x=x0+i*(rw+gap),dur=2+i*.5;
    const k=cl(p/dur,0,1),e=eOut(k);
    const dist=(9+Math.floor(hsh(cyc*3+i)*5))*sh;
    const off=e*dist;
    c.fillStyle=w(.055);rr(c,x,y0,rw,rh,rw*.14);c.fill();
    c.save();rr(c,x,y0,rw,rh,rw*.14);c.clip();
    for(let r=-2;r<=3;r++){
      const y=y0+rh/2+r*sh-(off%sh);
      const idx=((Math.floor(off/sh)+r+i*2)%SY.length+SY.length)%SY.length;
      const sym=SY[idx];
      c.fillStyle=sym==='7'?EM:(sym==='★'?GOLD:w(.6));
      c.font='700 '+(sh*(sym==='BAR'?.26:.44))+'px '+PF;
      c.textAlign='center';c.textBaseline='middle';c.fillText(sym,x+rw/2,y);
    }
    c.restore();
    c.strokeStyle=w(.12);c.lineWidth=1;rr(c,x,y0,rw,rh,rw*.14);c.stroke();
  }
  const done=p>2.9;
  c.strokeStyle=done?em(.5):em(.16);c.lineWidth=done?1.6:1;
  c.beginPath();c.moveTo(x0-H*.05,H*.5);c.lineTo(x0+rw*3+gap*2+H*.05,H*.5);c.stroke();
};

/* -------- Roulette -------- */
S.roulette=(c,W,H,t,cx)=>{
  const R=H*.42,cy=H*.5,P=7.2,p=t%P,seed=Math.floor(t/P);
  const e=eOut(cl(p/5,0,1));
  const wheelA=e*10.5+seed;
  const pocket=Math.floor(hsh(seed)*19);
  c.save();c.translate(cx,cy);
  c.beginPath();c.arc(0,0,R*1.06,0,7);c.strokeStyle=w(.07);c.lineWidth=Math.max(1,H*.012);c.stroke();
  c.rotate(wheelA);
  const N=19;
  for(let i=0;i<N;i++){
    const a0=i/N*Math.PI*2,a1=(i+1)/N*Math.PI*2;
    c.beginPath();c.moveTo(0,0);c.arc(0,0,R,a0,a1);c.closePath();
    c.fillStyle=i===0?em(.5):(i%2?'rgba(150,25,25,.55)':'rgba(18,18,18,.9)');c.fill();
    c.strokeStyle=w(.05);c.lineWidth=.6;c.stroke();
  }
  c.beginPath();c.arc(0,0,R*.42,0,7);c.fillStyle='#0a0a0a';c.fill();
  c.strokeStyle=gd(.35);c.lineWidth=Math.max(1,H*.008);c.stroke();
  c.restore();
  const bA=-e*17+seed*2,bR=R*(1.02-.16*e);
  const bx=cx+Math.cos(bA)*bR,by=cy+Math.sin(bA)*bR;
  c.beginPath();c.arc(bx,by,H*.035,0,7);c.fillStyle='#f5f2e8';c.fill();
  if(p>5.2){
    const f=cl((p-5.2)/1.2,0,1);
    c.font='700 '+(H*.3)+'px '+PF;c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=pocket===0?em(.9*(1-f*.3)):w(.85*(1-f*.3));
    c.fillText(String(pocket),cx,cy);
  }
};

/* -------- Dice -------- */
S.dice=(c,W,H,t,cx)=>{
  const bw=Math.min(W*.55,H*2.4),bh=H*.09,tgt=.55;
  cx=Math.min(cx,W-bw/2-H*.06);
  const x0=cx-bw/2,y=H*.62;
  const P=3.4,p=t%P,seed=Math.floor(t/P);
  const roll=hsh(seed);
  const e=eOut(cl(p/1.5,0,1));
  const scramble=hsh(seed*3+Math.floor(p*16));
  const shown=p<1.5?scramble*(1-e)+roll*e:roll;
  const win=roll>tgt;
  c.fillStyle=w(.05);rr(c,x0,y,bw,bh,bh/2);c.fill();
  c.fillStyle=rd(.16);rr(c,x0,y,bw*tgt,bh,bh/2);c.fill();
  c.fillStyle=em(.2);rr(c,x0+bw*tgt,y,bw*(1-tgt),bh,bh/2);c.fill();
  c.strokeStyle=w(.25);c.lineWidth=Math.max(1,H*.01);
  c.beginPath();c.moveTo(x0+bw*tgt,y-H*.04);c.lineTo(x0+bw*tgt,y+bh+H*.04);c.stroke();
  const mx=x0+bw*shown;
  const settled=p>1.5;
  const col=settled?(win?EM:RED):'#ffffff';
  c.beginPath();c.arc(mx,y+bh/2,H*.055,0,7);c.fillStyle=col;c.fill();
  c.beginPath();c.arc(mx,y+bh/2,H*.11,0,7);c.fillStyle=(win?em:rd)(settled?.13:0);c.fill();
  c.font='700 '+(H*.26)+'px '+PF;c.textAlign='center';c.textBaseline='bottom';
  c.fillStyle=settled?(win?em(.95):rd(.95)):w(.8);
  c.fillText((shown*100).toFixed(2),cx,y-H*.12);
  c.font=(H*.1)+'px '+PF;c.fillStyle=w(.26);c.textBaseline='top';
  c.fillText('OVER 55.00',cx,y+bh+H*.1);
};

/* -------- Mines -------- */
S.mines=(c,W,H,t,cx)=>{
  const n=5,cell=H*.155,gap=H*.038,tot=n*cell+(n-1)*gap;
  const x0=cx-tot/2,y0=H*.5-tot/2;
  const P=8,p=t%P,seed=Math.floor(t/P);
  const picks=[];for(let i=0;i<7;i++)picks.push(Math.floor(hsh(seed*13+i)*25));
  const step=Math.floor(p/.6);
  const boom=step>=6;
  for(let i=0;i<25;i++){
    const r=Math.floor(i/n),q=i%n,x=x0+q*(cell+gap),y=y0+r*(cell+gap);
    const pi=picks.indexOf(i);
    const open=pi>=0&&pi<Math.min(step,6);
    const mine=boom&&i===picks[6];
    c.fillStyle=mine?rd(.2):(open?em(.13):w(.045));
    rr(c,x,y,cell,cell,cell*.22);c.fill();
    c.strokeStyle=mine?rd(.6):(open?em(.35):w(.05));c.lineWidth=1;c.stroke();
    if(open){
      c.save();c.translate(x+cell/2,y+cell/2);c.rotate(Math.PI/4);
      c.fillStyle=em(.85);rr(c,-cell*.16,-cell*.16,cell*.32,cell*.32,cell*.05);c.fill();c.restore();
    }
    if(mine){
      c.beginPath();c.arc(x+cell/2,y+cell/2,cell*.2,0,7);c.fillStyle=RED;c.fill();
      const f=cl((p-3.6)/.5,0,1);
      c.beginPath();c.arc(x+cell/2,y+cell/2,cell*.2+f*cell*1.2,0,7);
      c.strokeStyle=rd(.5*(1-f));c.lineWidth=Math.max(1,H*.02);c.stroke();
    }
  }
  if(boom){c.fillStyle=rd(.07*Math.max(0,1-(p-3.6)/1.4));c.fillRect(0,0,W,H);}
};

/* -------- Plinko -------- */
S.plinko=(c,W,H,t,cx)=>{
  const rows=6,gapx=H*.15,gapy=H*.1,top=H*.07;
  c.fillStyle=w(.24);
  for(let r=0;r<rows;r++)for(let i=0;i<=r+1;i++){
    const x=cx+(i-(r+1)/2)*gapx,y=top+r*gapy;
    c.beginPath();c.arc(x,y,H*.019,0,7);c.fill();
  }
  const slots=rows+2,sy=top+rows*gapy+H*.04,sw=gapx*.86,sh=H*.12;
  const mult=[9,3,1.4,.6,.6,1.4,3,9];
  for(let i=0;i<slots;i++){
    const x=cx+(i-(slots-1)/2)*gapx-sw/2;
    const hot=Math.abs(i-(slots-1)/2)>2.2;
    c.fillStyle=hot?gd(.2):em(.1);rr(c,x,sy,sw,sh,H*.02);c.fill();
    c.fillStyle=hot?gd(.85):em(.6);c.font='700 '+(H*.07)+'px '+PF;
    c.textAlign='center';c.textBaseline='middle';
    c.fillText((mult[i]||1)+'×',x+sw/2,sy+sh/2);
  }
  for(let b=0;b<4;b++){
    const idx=Math.floor(t/1.05)-b,age=t-idx*1.05;
    if(age<0||age>1.05*4)continue;
    const prog=age/.13;
    if(prog>rows+1)continue;
    let off=0;
    const rf=Math.floor(prog),frac=prog-rf;
    for(let r=0;r<rf;r++)off+=hsh(idx*31+r)>.5?.5:-.5;
    const nxt=hsh(idx*31+rf)>.5?.5:-.5;
    const x=cx+(off+nxt*frac)*gapx,y=top+prog*gapy-gapy;
    if(y<-H*.1)continue;
    c.beginPath();c.arc(x,y,H*.032,0,7);c.fillStyle=GOLD;c.fill();
    c.beginPath();c.arc(x,y,H*.06,0,7);c.fillStyle=gd(.12);c.fill();
  }
};

/* -------- Coinflip -------- */
S.coin=(c,W,H,t,cx)=>{
  const R=H*.28,cy=H*.5,P=4.2,p=t%P,seed=Math.floor(t/P);
  const e=eOut(cl(p/2.6,0,1));
  const heads=hsh(seed)>.5;
  const a=e*(Math.PI*(6+(heads?0:1)));
  const sx=Math.cos(a),face=sx>=0;
  const lift=Math.sin(cl(p/2.6,0,1)*Math.PI)*H*.12;
  c.save();c.translate(cx,cy-lift);
  c.beginPath();c.ellipse(0,R*1.5+lift,R*.7*Math.abs(sx)+R*.3,R*.14,0,0,7);
  c.fillStyle='rgba(0,0,0,'+(.3*(1-lift/(H*.12+.001)))+')';c.fill();
  c.scale(Math.max(Math.abs(sx),.04),1);
  c.beginPath();c.arc(0,0,R,0,7);
  c.fillStyle=face?'#c9a227':'#151515';c.fill();
  c.lineWidth=Math.max(1.5,H*.018);c.strokeStyle=face?gd(.9):w(.14);c.stroke();
  c.beginPath();c.arc(0,0,R*.78,0,7);c.strokeStyle=face?'rgba(255,235,170,.45)':gd(.3);c.lineWidth=1;c.stroke();
  c.font='700 '+(R*.9)+'px '+PF;c.textAlign='center';c.textBaseline='middle';
  c.fillStyle=face?'#2a1f00':GOLD;c.fillText(face?'H':'T',0,R*.04);
  c.restore();
};

/* -------- Rock Paper Scissors -------- */
function rpsGlyph(c,x,y,r,kind,col){
  c.strokeStyle=col;c.fillStyle=col;c.lineWidth=Math.max(1.6,r*.13);c.lineCap='round';
  if(kind===0){c.beginPath();c.arc(x,y,r*.62,0,7);c.stroke();c.beginPath();c.arc(x,y,r*.3,0,7);c.fill();}
  else if(kind===1){c.save();c.translate(x,y);c.rotate(-.12);rr(c,-r*.5,-r*.62,r,r*1.24,r*.12);c.stroke();c.restore();}
  else{c.beginPath();c.moveTo(x-r*.55,y-r*.55);c.lineTo(x+r*.35,y+r*.4);c.moveTo(x+r*.55,y-r*.55);c.lineTo(x-r*.35,y+r*.4);c.stroke();
    c.beginPath();c.arc(x-r*.5,y+r*.6,r*.17,0,7);c.stroke();c.beginPath();c.arc(x+r*.5,y+r*.6,r*.17,0,7);c.stroke();}
}
function fist(c,x,y,r,col){
  c.fillStyle=col;
  rr(c,x-r*.5,y-r*.44,r,r*.88,r*.3);c.fill();
  c.fillStyle='rgba(5,5,5,.35)';
  for(let i=0;i<3;i++){c.fillRect(x-r*.5,y-r*.2+i*r*.24,r,r*.05);}
}
S.rps=(c,W,H,t,cx)=>{
  const P=3.6,p=t%P,seed=Math.floor(t/P),r=H*.2;
  const spread=Math.min(W*.2,H*.62);
  const a=hsh(seed)*3|0,b=(a+1+(hsh(seed+9)*2|0))%3;
  const pump=p<1.2?Math.abs(Math.sin(p*7.5))*H*.09:0;
  const rev=p>1.2,f=cl((p-1.2)/.35,0,1);
  const win=(a-b+3)%3===1;
  const cAl=rev?(win?EM:w(.3)):w(.5),cBl=rev?(win?w(.3):EM):w(.5);
  const shift=rev?0:pump;
  if(rev){
    rpsGlyph(c,cx-spread,H*.5,r,a,cAl);
    rpsGlyph(c,cx+spread,H*.5,r,b,cBl);
  }else{
    fist(c,cx-spread+shift,H*.5-pump*.4,r,w(.5));
    fist(c,cx+spread-shift,H*.5-pump*.4,r,w(.5));
  }
  if(rev&&f>0){
    c.font='700 '+(H*.11)+'px '+PF;c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=w(.22*f);c.fillText('VS',cx,H*.5);
  }
};

/* -------- Uno -------- */
const UC=[[RED,'7'],['#3b82f6','4'],[EM,'+2'],[GOLD,'9'],[RED,'3'],['#3b82f6','R']];
S.uno=(c,W,H,t,cx)=>{
  const cw=H*.32,ch=H*.48;
  for(let i=0;i<5;i++){
    const idx=Math.floor(t/1.15)-4+i,age=t-idx*1.15;
    const k=cl(age/.45,0,1),e=eOut(k);
    const u=UC[((idx%UC.length)+UC.length)%UC.length];
    const rot=(hsh(idx*5)-.5)*.9;
    const x=cx+(1-e)*W*.45+(hsh(idx*3)-.5)*H*.3;
    const y=H*.5+(1-e)*-H*.25+(hsh(idx*7)-.5)*H*.16;
    c.save();c.globalAlpha=(.35+.65*(i/4))*cl(k*2.6,0,1);c.translate(x,y);c.rotate(rot*e);
    c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=H*.1;c.shadowOffsetY=H*.03;
    c.fillStyle=u[0];rr(c,-cw/2,-ch/2,cw,ch,cw*.14);c.fill();
    c.shadowColor='transparent';
    c.save();c.translate(0,0);c.rotate(-.6);
    c.fillStyle='rgba(250,250,250,.92)';c.beginPath();c.ellipse(0,0,cw*.38,ch*.3,0,0,7);c.fill();c.restore();
    c.fillStyle=u[0];c.font='700 '+(ch*.34)+'px '+PF;c.textAlign='center';c.textBaseline='middle';
    c.fillText(u[1],0,ch*.02);
    c.restore();
  }
};

/* -------- Higher or Lower -------- */
function faceDown(c,cw,ch){
  c.fillStyle='#0e1a16';rr(c,-cw/2,-ch/2,cw,ch,cw*.1);c.fill();
  c.strokeStyle=em(.45);c.lineWidth=1;c.stroke();
  c.strokeStyle=em(.28);
  for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(-cw/2+2,i*ch*.16);c.lineTo(cw/2-2,i*ch*.16+ch*.1);c.stroke();}
}
S.highlow=(c,W,H,t,cx)=>{
  const cw=H*.3,ch=H*.44,P=5,p=t%P,seed=Math.floor(t/P);
  const sp=Math.min(W*.16,H*.5);
  const A=Math.floor(hsh(seed)*99)+1,B=Math.floor(hsh(seed+41)*99)+1;
  [[cx-sp,1.1,A],[cx+sp,2.1,B]].forEach(([x,ft,val])=>{
    const k=cl((p-ft)/.6,0,1),ang=k*Math.PI,sx=Math.cos(ang),up=sx<0;
    c.save();c.translate(x,H*.5);c.scale(Math.max(Math.abs(sx),.03),1);
    if(!up)faceDown(c,cw,ch);
    else{
      c.fillStyle='rgba(250,248,242,.95)';rr(c,-cw/2,-ch/2,cw,ch,cw*.1);c.fill();
      c.fillStyle='#141414';c.font='700 '+(ch*.42)+'px '+PF;c.textAlign='center';c.textBaseline='middle';
      c.fillText(String(val),0,0);
    }
    c.restore();
  });
  if(p>3){
    const f=cl((p-3)/.4,0,1),hi=A>B;
    c.globalAlpha=f;
    c.font='700 '+(H*.16)+'px '+PF;c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=hi?em(.9):rd(.9);
    c.fillText(hi?'◀':'▶',cx,H*.5);
    c.globalAlpha=1;
  }
};

/* -------- Duels -------- */
function fighter(c,x,y,s,col,lean){
  c.save();c.translate(x,y);c.rotate(lean);
  c.fillStyle=col;
  c.beginPath();c.arc(0,-s*.72,s*.26,0,7);c.fill();
  rr(c,-s*.28,-s*.42,s*.56,s*.9,s*.2);c.fill();
  c.restore();
}
S.duels=(c,W,H,t,cx)=>{
  const P=1.5,p=t%P,seed=Math.floor(t/P),s=H*.3;
  const sp=Math.min(W*.17,H*.55);
  const aAtk=hsh(seed)>.5;
  const lunge=Math.sin(cl(p/.45,0,1)*Math.PI)*H*.12;
  const hit=p>.3&&p<.55;
  const hpA=cl(.85-((Math.floor(t/P))%6)*.12,.12,1),hpB=cl(.95-((Math.floor(t/P)+2)%6)*.12,.12,1);
  [[cx-sp,hpA],[cx+sp,hpB]].forEach(([x,hp],i)=>{
    const bw=s*1.1,bh=H*.045;
    c.fillStyle=w(.07);rr(c,x-bw/2,H*.14,bw,bh,bh/2);c.fill();
    c.fillStyle=hp>.4?em(.7):rd(.75);rr(c,x-bw/2,H*.14,bw*hp,bh,bh/2);c.fill();
  });
  const off=aAtk?lunge:-lunge;
  fighter(c,cx-sp+off,H*.72,s,aAtk?w(.8):w(.42),aAtk?.18:0);
  fighter(c,cx+sp+off,H*.72,s,aAtk?w(.42):w(.8),aAtk?0:-.18);
  if(hit){
    const f=(p-.3)/.25,tx=cx+(aAtk?sp:-sp)-(aAtk?s*.3:-s*.3);
    c.strokeStyle=rd(.8*(1-f));c.lineWidth=Math.max(1.5,H*.02);
    for(let i=0;i<3;i++){
      const a=(-.5+i*.5);
      c.beginPath();c.moveTo(tx+Math.cos(a)*s*.2,H*.55+Math.sin(a)*s*.2);
      c.lineTo(tx+Math.cos(a)*(s*.2+s*.35*f),H*.55+Math.sin(a)*(s*.2+s*.35*f));c.stroke();
    }
  }
};


/* ============================ engine ============================ */
export const SCENES = S;
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new Set();
let raf = 0;
function frame(now) {
  const t = now / 1000;
  for (const e of live) {
    if (!e.vis || now - e.last < 1000 / e.fps) continue;
    e.last = now; draw(e, t);
  }
  raf = live.size ? requestAnimationFrame(frame) : 0;
}
function sizeOf(e) {
  const r = e.canvas.getBoundingClientRect(); if (!r.width) return false;
  const d = Math.min(devicePixelRatio || 1, 2);
  const cw = Math.round(r.width * d), ch = Math.round(r.height * d);
  if (e.canvas.width !== cw || e.canvas.height !== ch) { e.canvas.width = cw; e.canvas.height = ch; }
  e.ctx.setTransform(d, 0, 0, d, 0, 0); e.W = r.width; e.H = r.height; return true;
}
function draw(e, t) {
  if (!sizeOf(e)) return;
  const c = e.ctx; c.clearRect(0, 0, e.W, e.H); c.save();
  const cx = e.cx ? e.cx(e.W) : e.W * 0.5;
  if (e.lift) { c.translate(e.W / 2, e.H * 0.05); c.scale(e.lift, e.lift); c.translate(-e.W / 2, 0); }
  let SH = e.H; if (e.H > e.W * 0.62) { SH = e.W * 0.62; c.translate(0, (e.H - SH) * 0.3); }
  (S[e.key] || (() => {}))(c, e.W, SH, t + e.off, cx);
  c.restore();
}
/**
 * Animate a scene on a canvas until the page is left.
 * opts: { fps=30, cx: W => centerX, lift: scale for "scene above the text" layouts }
 * Returns a handle with .setKey(key) and .stop().
 */
export function mountScene(canvas, key, opts = {}) {
  const e = { canvas, ctx: canvas.getContext('2d'), key, fps: opts.fps || 30, cx: opts.cx, lift: opts.lift, last: 0, vis: true, off: Math.random() * 4 };
  const io = new IntersectionObserver((es) => { es.forEach((x) => { e.vis = x.isIntersecting; }); }, { threshold: 0.01 });
  io.observe(canvas);
  const handle = {
    setKey(k) { e.key = k; if (REDUCED) draw(e, 3.2); },
    stop() { live.delete(e); io.disconnect(); },
  };
  if (REDUCED) { requestAnimationFrame(() => draw(e, 3.2)); }
  else { live.add(e); if (!raf) raf = requestAnimationFrame(frame); }
  onLeave(() => handle.stop());
  return handle;
}
