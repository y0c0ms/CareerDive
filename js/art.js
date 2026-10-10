// ---- PAL (palette.md)
const PAL={
  water:['#6f9e9d','#5a8b99','#498492','#3d758e'],
  haze:['#61718a','#57557c','#46557c'],
  caustic:['#b3cbb6','#90b3a8','#7ca79e'],
  rock:['#2a3428','#3f4a3b','#57625a','#86877c'],
  midRock:['#2a3428','#57625a','#7b7f70','#848a86'],
  moss:['#385042','#4c7c5c'],
  sand:['#2a3429','#4b5b4a','#617461','#717a69'],
  vein:['#b1a47a','#8c9170'],
  kelp:['#2f6e5a','#48c090','#60e484','#85c5a8'],
  pink:['#c018c0','#e448cc','#f88ce4'],
  gold:['#c0600c','#e4a830','#f0d860'],
  crimson:['#a81860','#d83048','#f05460'],
  blue:['#182490','#3c3cc0','#6084e4'],
  purple:['#3a3290','#5448a8','#9484dc'],
  teal:['#3c8c94','#60b4b4','#9cd8d0'],
  salmon:['#9b5372','#cc606c','#e89096'],
  yellow:['#b8861c','#e4b43c','#f4e48c'],
  sun:['#e4a830','#f0d860','#f8ecb0'],
  sky:['#7fb5c8','#9fcad4','#c9e0d8'],
  cloud:['#9fb4bc','#c9d8d4','#eef2e8']
};

// ---- recipe 1: Seeded RNG + helpers
function makeRng(seed){ let s=seed>>>0;
  return function(){ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
const ri=(rng,a,b)=>a+Math.floor(rng()*(b-a+1));
const pick=(rng,arr)=>arr[Math.floor(rng()*arr.length)];
function scatter(rng,W,n,clusters){
  const cs=[]; for(let i=0;i<clusters;i++) cs.push(rng()*W);
  const out=[];
  for(let i=0;i<n;i++){ const c=pick(rng,cs), off=(rng()+rng()+rng()-1.5)*W*0.12;
    out.push((((c+off)%W)+W)%W); }
  return out.sort((a,b)=>a-b); }

// ---- recipe 2: Value noise + fbm (seamless) and cellular edges
const sstep=(a,b,v)=>{ const t=Math.min(1,Math.max(0,(v-a)/(b-a))); return t*t*(3-2*t); };
const hashN=(x,y,seed)=>{ let n=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed|0,1442695041))|0;
  n=Math.imul(n^(n>>>13),1274126177); n^=n>>>16; return (n>>>0)/4294967296; };
function makeNoise(seed){
  const hash=(x,y)=>hashN(x,y,seed);
  const sm=t=>t*t*(3-2*t);
  function n2(x,y,wx,wy){ let xi=Math.floor(x),yi=Math.floor(y); const fx=sm(x-xi),fy=sm(y-yi);
    let x1=xi+1,y1=yi+1;
    if(wx){ xi=((xi%wx)+wx)%wx; x1=(xi+1)%wx; }
    if(wy){ yi=((yi%wy)+wy)%wy; y1=(yi+1)%wy; }
    const a=hash(xi,yi),b=hash(x1,yi),c=hash(xi,y1),d=hash(x1,y1);
    return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy; }
  function fbm(x,y,oct=3,wx,wy){ let v=0,amp=0.5,f=1,tot=0;
    for(let o=0;o<oct;o++){ v+=amp*n2(x*f,y*f,wx&&wx*f,wy&&wy*f); tot+=amp; amp/=2; f*=2; }
    return v/tot; }
  return {n2,fbm}; }
// Distance to the nearest cell edge, taken perpendicular to the bisector of the two nearest seeds: (d2^2-d1^2)/|p2-p1| = twice the distance to the
// bisector, so a line threshold th gives the same line width everywhere. The old field d2-d1 has a gradient of only 2|p2-p1|/(d1+d2): where both nearest
// seeds are far away and nearly equidistant (a big empty patch of the 3-row tile) it is almost flat, stays under th over a whole region and drew
// a solid pale wedge with hard straight edges. The old 3x3 neighbour window also missed nearer seeds in 1.5:1 cells (field jumps where the window
// shifted). The window now spans 1.5 cell diagonals; cells that cannot beat the current second-nearest are skipped by a rectangle bound.
function cellEdge(W,H,cx,cy,seed,warp=0){
  const r=makeRng(seed), nz=makeNoise(seed+1), pts=[], out=new Float32Array(W*H), cw=W/cx, ch=H/cy, diag=1.5*Math.hypot(cw,ch), Rx=Math.ceil(diag/cw), Ry=Math.ceil(diag/ch);
  for(let j=0;j<cy;j++) for(let i=0;i<cx;i++) pts.push([(i+r())*cw,(j+r())*ch]);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const sx=x+(warp?(nz.fbm(x/W*4,y/H*4,2,4,4)-0.5)*warp*2:0), sy=y+(warp?(nz.fbm(x/W*4+9,y/H*4,2,4,4)-0.5)*warp*2:0);
    const ci=Math.floor(sx/cw), cj=Math.floor(sy/ch); let d1=1e18,d2=1e18,x1=0,y1=0,x2=0,y2=0;
    for(let dj=-Ry;dj<=Ry;dj++){ const jj=cj+dj, wj=((jj%cy)+cy)%cy, oy=(jj-wj)*ch, gy=Math.max(0,jj*ch-sy,sy-(jj+1)*ch);
      for(let di=-Rx;di<=Rx;di++){ const ii=ci+di, gx=Math.max(0,ii*cw-sx,sx-(ii+1)*cw); if(gx*gx+gy*gy>=d2) continue;
        const wi=((ii%cx)+cx)%cx, p=pts[wj*cx+wi], qx=p[0]+(ii-wi)*cw, qy=p[1]+oy, d=(qx-sx)*(qx-sx)+(qy-sy)*(qy-sy);
        if(d<d1){d2=d1;x2=x1;y2=y1;d1=d;x1=qx;y1=qy;}else if(d<d2){d2=d;x2=qx;y2=qy;} } }
    const s=Math.hypot(x2-x1,y2-y1);
    out[y*W+x]=s>0?(d2-d1)/s:Math.sqrt(d2)-Math.sqrt(d1); }
  return out; }

// ---- recipe 3: Blue-noise threshold tile. A 4x4 Bayer lattice makes hard 50% checkerboards that crawl when the view scrolls;
// this is a tileable 32x32 rank map (Mitchell best-candidate, toroidal distance, seeded, ~5 ms at load) used as the ordered-dither threshold.
const BN_SHIFT=5, BN_N=1<<BN_SHIFT, BN_MASK=BN_N-1, BN_AREA=BN_N*BN_N;
const BN=(()=>{ const rng=makeRng(0xB1E5), rank=new Uint16Array(BN_AREA), free=Array.from({length:BN_AREA},(_,i)=>i), dist=new Float32Array(BN_AREA);
  const tor=d=>Math.min(d,BN_N-d);
  const place=(count,rankOf)=>{ dist.fill(1e9);
    for(let k=0;k<count;k++){
      let bi=0,bd=-1; for(let c=k?3:1;c>0;c--){ const j=Math.floor(rng()*free.length); if(dist[free[j]]>bd){ bd=dist[free[j]]; bi=j; } }
      const p=free[bi], qx=p&BN_MASK, qy=p>>BN_SHIFT; free[bi]=free[free.length-1]; free.pop(); rank[p]=rankOf(k);
      for(let i=0;i<free.length;i++){ const f=free[i], dx=tor(Math.abs((f&BN_MASK)-qx)), dy=tor(Math.abs((f>>BN_SHIFT)-qy)), d=dx*dx+dy*dy; if(d<dist[f]) dist[f]=d; } } };
  place(BN_AREA>>1,k=>k); place(BN_AREA-(BN_AREA>>1),k=>BN_AREA-1-k);   // lighter half grows up from 0, the other half is the reverse ranking
  return rank; })();
const bayer=(x,y)=>(BN[((y&BN_MASK)<<BN_SHIFT)|(x&BN_MASK)]+0.5)/BN_AREA;
function rampAt(ramp,v,x,y){
  const t=Math.min(Math.max(v,0),1)*(ramp.length-1), i=Math.floor(t);
  if(i>=ramp.length-1) return ramp[ramp.length-1];
  return (t-i)>bayer(x,y)?ramp[i+1]:ramp[i]; }

// ---- recipe 4: Palette helpers (new ramps, hue shift)
const hex2rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const rgb2hex=c=>'#'+c.map(v=>Math.round(Math.min(255,Math.max(0,v))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>{ const A=hex2rgb(a),B=hex2rgb(b); return rgb2hex(A.map((v,i)=>v+(B[i]-v)*t)); };
const shadeOf=hex=>mix(hex,'#2a3a7c',0.35), lightOf=hex=>mix(hex,'#fff0a0',0.35);
function makeRamp(dark,mid,light,n){ const out=[];
  for(let i=0;i<n;i++){ const t=i/(n-1); out.push(t<0.5?mix(dark,mid,t*2):mix(mid,light,(t-0.5)*2)); }
  return out; }
// usage: PAL.orange=makeRamp(shadeOf('#e0801c'),'#e0801c',lightOf('#e0801c'),3);

// ---- recipe 5: Pixel canvas helpers
function mkCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d',{willReadFrequently:true}); x.imageSmoothingEnabled=false; return {c,x,w,h}; }
const px=(ctx,x,y,col)=>{ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),1,1); };
const rect=(ctx,x,y,w,h,col)=>{ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
function line(ctx,x0,y0,x1,y1,col,th=1){ x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1; let e=dx-dy; ctx.fillStyle=col;
  for(;;){ ctx.fillRect(x0,y0,th,th); if(x0===x1&&y0===y1)break; const e2=2*e;
    if(e2>-dy){e-=dy;x0+=sx;} if(e2<dx){e+=dx;y0+=sy;} } }
function paint(cv,fn){ const id=cv.x.getImageData(0,0,cv.w,cv.h), d=id.data, cache={};
  for(let y=0;y<cv.h;y++) for(let x=0;x<cv.w;x++){ const col=fn(x,y); if(!col)continue;
    const c=cache[col]||(cache[col]=hex2rgb(col)), o=(y*cv.w+x)*4; d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=255; }
  cv.x.putImageData(id,0,0); return cv; }
function stamp(ctx,src,x,y,flip){ x=Math.round(x); y=Math.round(y);
  if(!flip){ ctx.drawImage(src.c,x,y); return; }
  ctx.save(); ctx.translate(x+src.w,y); ctx.scale(-1,1); ctx.drawImage(src.c,0,0); ctx.restore(); }
function gridSprite(rows,pal){ const cv=mkCanvas(rows[0].length,rows.length);
  rows.forEach((r,y)=>{ for(let x=0;x<r.length;x++){ const c=pal[r[x]]; if(c) px(cv.x,x,y,c); } }); return cv; }

// ---- recipe 6: Rock generator
function makeRock(w,h,seed,o={}){
  const rng=makeRng(seed), nz=makeNoise(seed), R=o.ramp||PAL.rock, M=PAL.moss, moss=o.moss||0, steep=o.steep||0.6, top=[], cv=mkCanvas(w,h), hills=[];
  for(let i=0;i<(o.bumps||2);i++) hills.push([i?w*rng():w*(0.5+0.3*(o.lean||0)),w*(0.3+0.25*rng()),i?0.5+0.4*rng():1]);
  for(let x=0;x<w;x++){ let e=0.05;
    for(const [c,r,a] of hills){ const u=(x-c)/r; if(Math.abs(u)<1) e=Math.max(e,a*Math.pow(1-u*u,steep)); }
    top[x]=Math.max(0,Math.round(h-h*0.96*e*(0.85+0.3*nz.fbm(x/7,1.7,3)))); }
  const slope=x=>top[Math.max(0,x-2)]-top[Math.min(w-1,x+2)];
  paint(cv,(x,y)=>{ if(y<top[x]) return null; const d=y-top[x];
    if(d<2+moss*3*nz.n2(x/3,0.5)){
      if(moss>0.05&&nz.n2(x/5,9.2)<moss) return d<1?M[1]:M[0];
      return slope(x)>=0?R[3]:R[2]; }
    const s=nz.fbm(x/11,y/5+seed%7,3)+0.08*(1-d/h);
    return s>0.8?R[3]:s>0.73?R[2]:s>0.66?R[1]:R[0]; });
  for(let k=0;k<(o.cracks||0);k++){ let x=ri(rng,2,w-3), y=top[x]+ri(rng,3,8), n=ri(rng,6,16);
    while(n-->0&&x>0&&x<w-1&&y<h){ px(cv.x,x,y,R[0]); if(rng()<0.35) px(cv.x,x+1,y,R[3]); x+=ri(rng,-1,1); y+=rng()<0.7?1:0; } }
  cv.top=top; return cv; }
// usage: makeRock(70,100,3,{lean:-1,steep:0.5,moss:0.3,cracks:5})

// ---- recipe 7: Branching coral (8 looks from one routine)
const CORAL_KINDS={
  staghorn:{w:42,h:40,ramp:'gold',   n:3,len:8, spread:0.80,split:3,depth:3,taper:0.85,thick:4,curl:0.3},
  pinkbush:{w:46,h:36,ramp:'pink',   n:4,len:8, spread:0.85,split:3,depth:3,taper:0.80,thick:3,curl:0.3},
  crimson: {w:40,h:44,ramp:'crimson',n:3,len:13,spread:0.40,split:2,depth:3,taper:0.85,thick:3,curl:0.5},
  whip:    {w:30,h:40,ramp:'blue',   n:6,len:11,spread:0.30,split:2,depth:2,taper:0.95,thick:3,curl:0.6},
  yellow:  {w:34,h:20,ramp:'yellow', n:4,len:7, spread:1.10,split:2,depth:3,taper:0.80,thick:2,curl:0.3},
  mintree: {w:42,h:44,ramp:'teal',   n:1,len:14,spread:0.70,split:3,depth:3,taper:0.65,thick:4,curl:0.3},
  spray:   {w:40,h:28,ramp:'purple', n:7,len:11,spread:1.30,split:2,depth:2,taper:0.80,thick:3,curl:0.3},
  chunky:  {w:40,h:34,ramp:'salmon', n:3,len:8, spread:0.80,split:3,depth:3,taper:0.85,thick:5,curl:0.3}
};
function coralBranch(kind,seed,s=1){
  const P=CORAL_KINDS[kind], rng=makeRng(seed), R=PAL[P.ramp], WW=Math.ceil(P.w*s*2.4)+8, HH=Math.ceil(P.h*s*1.7)+8, wk=mkCanvas(WW,HH), cx=WW>>1;
  function grow(x,y,a,len,d){
    const x2=x+Math.sin(a)*len, y2=y-Math.cos(a)*len, pen=Math.max(1,Math.round(P.thick*s*d/P.depth));
    if(pen>1) line(wk.x,x+1,y+1,x2+1,y2+1,R[0],pen);
    line(wk.x,x,y,x2,y2,d<2?R[2]:R[1],pen);
    if(d===0){ rect(wk.x,x2,y2,pen>1?2:1,pen>1?2:1,R[2]); return; }
    for(let k=0;k<P.split;k++){ if(P.split>1&&rng()<0.12) continue;
      const off=(k-(P.split-1)/2)*P.spread*(0.7+0.6*rng())+P.curl*(rng()-0.5);
      grow(x2,y2,a+off,len*P.taper*(0.8+0.4*rng()),d-1); } }
  for(let i=0;i<P.n;i++){ const f=P.n>1?i/(P.n-1)-0.5:0;
    grow(cx+f*P.w*s*0.5,HH-4,f*P.spread*2.2+(rng()-0.5)*0.3,P.len*s*(0.8+0.4*rng()),P.depth); }
  const d=wk.x.getImageData(0,0,WW,HH).data; let y0=HH,m=0;
  for(let y=0;y<HH;y++) for(let x=0;x<WW;x++) if(d[(y*WW+x)*4+3]){ y0=Math.min(y0,y); m=Math.max(m,Math.abs(x-cx)+1); }
  const cv=mkCanvas(2*m+1,HH-4-y0+4); cv.x.drawImage(wk.c,cx-m,y0,2*m+1,cv.h,0,0,2*m+1,cv.h); return cv; }
// usage: coralBranch('staghorn',7)  coralBranch('pinkbush',3,0.4)

// ---- recipe 8: Fan, tube, brain, table coral and anemone
function makeFan(w,h,seed,ramp){ const rng=makeRng(seed), cv=mkCanvas(w,h), R=ramp||PAL.crimson, bx=w>>1, by=h-4, n=ri(rng,11,16), pts=[];
  for(let i=0;i<n;i++){ const a=(i/(n-1)-0.5)*2.5, len=(h-8)*(0.75+0.25*rng())*(1-0.3*Math.abs(a)/1.25); pts.push([a,len]); }
  const at=(a,r)=>[bx+Math.sin(a)*r,by-Math.cos(a)*r];
  for(let r=4;r<h;r+=4) for(let i=0;i<n-1;i++){ if(r>Math.min(pts[i][1],pts[i+1][1])) continue;
    const p=at(pts[i][0],r), q=at(pts[i+1][0],r); line(cv.x,p[0],p[1],q[0],q[1],R[0]); }
  pts.forEach(([a,l])=>{ const p=at(a,l); line(cv.x,bx,by,p[0],p[1],R[1]); });
  pts.forEach(([a,l])=>{ const p=at(a,l); px(cv.x,p[0],p[1],R[2]); });
  rect(cv.x,bx-1,by,2,4,R[0]); return cv; }
function makeTubes(w,h,seed,ramp){ const rng=makeRng(seed), cv=mkCanvas(w,h), R=ramp||PAL.gold; let x=1;
  while(x<w-4){ const tw=ri(rng,3,4), top=h-ri(rng,Math.floor(h*0.4),h-2);
    for(let y=top+1;y<h;y++) for(let k=0;k<tw;k++) px(cv.x,x+k,y,k===0?R[2]:k===tw-1?R[0]:R[1]);
    rect(cv.x,x,top,tw,1,R[2]); rect(cv.x,x+1,top,tw-2,1,PAL.rock[0]); x+=tw-1+ri(rng,0,1); }
  return cv; }
function makeBrain(w,h,seed,ramp){ const nz=makeNoise(seed), cv=mkCanvas(w,h), R=ramp||PAL.salmon, cx=(w-1)/2;
  return paint(cv,(x,y)=>{ const dx=(x-cx)/(w/2), dy=(y-(h-1))/(h-1), r=dx*dx+dy*dy; if(r>1||y>=h) return null;
    if(y>=h-2||r>0.86) return R[0];
    if(Math.abs(nz.fbm(x/5,y/4,2)-0.5)<0.05) return R[0];
    return rampAt(R,Math.min(1,Math.max(0,0.55-0.4*dx-0.5*dy)),x,y); }); }
function makeTable(w,h,seed,ramp){ const nz=makeNoise(seed), cv=mkCanvas(w,h), R=ramp||PAL.teal, cx=w>>1, py=Math.round(h*0.38), ry=Math.max(3,Math.round(h*0.16)), rx=w/2-1;
  paint(cv,(x,y)=>{ const sw=y>h-5?3:1; return y>py&&Math.abs(x-cx)<=sw?(x>=cx?R[0]:R[1]):null; });
  paint(cv,(x,y)=>{ const dx=(x-cx)/rx, dy=(y-py-3)/ry; return dx*dx+dy*dy<=1?(bayer(x,y)<0.5?R[0]:R[1]):null; });
  return paint(cv,(x,y)=>{ const dx=(x-cx)/rx, dy=(y-py)/ry; if(dx*dx+dy*dy>1) return null;
    const rib=Math.sin(Math.atan2(y-py,x-cx)*7+seed)>0.75; return rib?R[1]:rampAt(R,0.7-0.4*Math.abs(dx)+0.2*nz.n2(x/4,y/3),x,y); }); }
function makeAnemone(w,h,seed,ramp,tip){ const rng=makeRng(seed), cv=mkCanvas(w,h), R=ramp||PAL.pink, T=tip||PAL.caustic[0], cx=w>>1, bh=Math.round(h*0.3), n=ri(rng,12,18);
  for(let y=h-bh;y<h;y++){ const half=2+((y-(h-bh))>>1); rect(cv.x,cx-half,y,half*2+1,1,R[1]); px(cv.x,cx-half,y,R[0]); px(cv.x,cx+half,y,R[0]); }
  for(let i=0;i<n;i++){ const a=(i/(n-1)-0.5)*2.4, len=(h-bh)*(0.55+0.45*rng()), curl=(rng()-0.5)*len*0.5;
    for(let t=0;t<=1;t+=1/len) px(cv.x,cx+Math.sin(a)*len*t+curl*t*t,h-bh-Math.cos(a)*len*t,t>0.82?T:t>0.4?R[2]:R[1]); }
  return cv; }
// usage: makeFan(36,36,2) makeTubes(26,22,4) makeBrain(30,16,5) makeTable(40,26,6) makeAnemone(26,26,8)

// ---- recipe 9: Kelp / sea grass with N sway frames
function makeKelp(w,h,frames,seed,o={}){
  const rng=makeRng(seed), R=o.ramp||PAL.kelp, nb=o.blades||Math.round(w/3), sway=o.sway||2.5, ml=o.minLen??0.35, bl=[], out=[];
  for(let i=0;i<nb;i++) bl.push({x:2+rng()*(w-4),len:h*(ml+(1-ml)*Math.pow(rng(),1.5)),ph:rng()*6.28,k:1.6+rng()*1.6,a:0.6+0.8*rng()});
  for(let f=0;f<frames;f++){ const cv=mkCanvas(w,h), t=f/frames*Math.PI*2;
    bl.forEach(b=>{ for(let j=0;j<=b.len;j++){ const u=j/b.len, x=b.x+Math.sin(t+b.ph+u*b.k)*sway*b.a*Math.pow(u,1.3);
      rect(cv.x,x,h-1-j,u<0.6?(o.thick||2):1,1,R[Math.min(R.length-1,Math.floor(u*R.length))]); } });
    out.push(cv); }
  return out; }
// usage: makeKelp(60,40,6,5)  (grass)   makeKelp(24,90,8,9,{blades:5,sway:8,thick:2,minLen:0.6})  (tall kelp)

// ---- recipe 10: Caustic net (surface band, and light veins on sand)
function makeCaustic(W,H,seed,o={}){
  const E=cellEdge(W,H,o.cx||12,o.cy||3,seed,o.warp??6), nz=makeNoise(seed+3), cv=mkCanvas(W,H), C=o.cols||[PAL.caustic[0],PAL.caustic[2]], gl=o.glow||0;
  return paint(cv,(x,y)=>{ const e=E[y*W+x], th=1.3*(o.th||1.6)*(1-(o.fade||0)*y/H)*(0.3+1.4*nz.fbm(x/W*12,y/H*5,2,12,5));   // 1.3: the true edge distance is ~25% narrower than the old d2-d1 line at the same th
    if(e<th) return C[0];
    if(e<th*2.2&&bayer(x,y)<0.5) return C[1];
    if(gl&&e<th*5&&bayer(x,y)<gl*0.3*(1-e/(th*5))) return C[1];
    return null; }); }

// ---- recipe 11: Light shafts. Wide, soft, LIGHTER than the water they cross, strongest just under the surface and fading with depth.
// Flat tone steps (no alpha, no dither); every step is the local water colour (o.base(y) -> hex for texture row y) lifted toward o.light.
function makeShafts(W,H,seed,o={}){
  const rng=makeRng(seed), nz=makeNoise(seed+7), cv=mkCanvas(W,H), n=o.n||5, slope=o.slope||0.3, light=o.light||PAL.caustic[0], AMT=[0.1,0.17,0.25], memo=new Map();
  const col=(y,l)=>{ const b=o.base(y), k=b+l; let c=memo.get(k); if(!c){ c=mix(b,light,AMT[l-1]); memo.set(k,c); } return c; };
  for(let i=0;i<n;i++){
    const x0=(i+0.15+rng()*0.7)*W/n, w0=11+rng()*13, sl=slope*(0.85+rng()*0.3), len=H*(0.5+0.12*rng()), pw=0.8+0.2*rng();
    for(let y=0;y<len;y++){
      const hw=w0*(0.8+0.5*y/H)*(1+0.2*(nz.n2(y/11,i*3.7)-0.5)), vert=sstep(0,14,y)*(1-sstep(len*0.12,len,y))*(0.85+0.3*nz.n2(y/23,i*5.3+1))*pw, cx=x0-sl*y;
      for(let dx=-Math.ceil(hw)-1;dx<=Math.ceil(hw)+1;dx++){
        const X=((Math.round(cx+dx)%W)+W)%W, v=sstep(1,0.08,Math.abs(dx)/hw)*vert+(hashN(X,y,seed)-0.5)*0.07;
        const l=v<0.12?0:v<0.34?1:v<0.58?2:3; if(l) px(cv.x,X,y,col(y,l)); } } }
  return cv; }

// ---- recipe 12: Cracked sand seabed tile
function makeSand(W,H,seed,cx=7,cy=3,fadeTop=0){
  const nz=makeNoise(seed), R=PAL.sand, cv=mkCanvas(W,H);
  paint(cv,(x,y)=>{ const v=nz.fbm(x/W*8,y/H*3,3,8,3);
    if(v<0.2&&bayer(x,y)<0.55) return R[0];
    return rampAt([R[1],R[2],R[3]],sstep(0.3,0.72,v),x,y); });
  const veins=makeCaustic(W,H,seed+5,{cx,cy,th:1.0,warp:10,cols:[PAL.vein[0],PAL.vein[1]]});
  cv.x.drawImage(veins.c,0,0);
  for(let y=0;y<fadeTop;y++) for(let x=0;x<W;x++) if(bayer(x,y)>(y+1)/(fadeTop+1)) cv.x.clearRect(x,y,1,1);
  return cv; }

// ---- recipe 13: Water background
function makeWater(W,H,seed){ const nz=makeNoise(seed), cv=mkCanvas(W,H), Wt=PAL.water;
  return paint(cv,(x,y)=>{ const v=y/H, base=rampAt([Wt[1],Wt[2],Wt[3]],sstep(0,0.3,v),x,y);
    const edge=Math.max(0,Math.abs(x/W-0.5)*2-0.78)*3;
    const haze=sstep(0.55,0.88,v+(nz.fbm(x/W*6,v*3,3,6,3)-0.5)*0.3)*0.95+edge*sstep(0.3,0.6,v);
    return haze>bayer(x,y)?PAL.haze[2]:base; }); }

// ---- recipe 14: Far hazy reef silhouette
function makeHaze(W,H,seed,o={}){
  const rng=makeRng(seed), nz=makeNoise(seed), R=o.ramp||PAL.haze, top=[], cv=mkCanvas(W,H), base=o.base||0.55, amp=o.amp||0.4, ms=[];
  for(let i=0;i<(o.lumps||14);i++) ms.push([rng()*W,3+rng()*9,rng()]);
  for(let x=0;x<W;x++){ let t=H*base-(nz.fbm(x/W*7,0.5,3,7,1)-0.5)*H*amp;
    for(const [mx,r,k] of ms){ let dx=Math.abs(x-mx); dx=Math.min(dx,W-dx); if(dx<r) t=Math.min(t,H*base-Math.sqrt(r*r-dx*dx)*(0.6+k*0.5)); }
    top[x]=Math.round(t); }
  paint(cv,(x,y)=>{ const d=y-top[x]; if(d<0) return null;
    if(d<3) return bayer(x,y)<0.6?R[1]:R[2];
    return nz.fbm(x/6,y/5,2)>0.6?R[1]:R[2]; });
  for(let x=0;x<W;x++) if(rng()<0.25) px(cv.x,x,top[x]-ri(rng,1,3),R[2]);
  cv.top=top; return cv; }

// ---- recipe 15: Mid reef
function makeMidReef(W,H,seed,corals,n=40){
  const rng=makeRng(seed), nz=makeNoise(seed), R=PAL.midRock, cv=mkCanvas(W,H), top=[], base=Math.round(H*0.8);
  for(let x=0;x<W;x++) top[x]=Math.round(base-H*0.5*sstep(0.5,0.7,nz.fbm(x/W*6,0.3,3,6,1))-1.5*nz.n2(x/3,2));
  paint(cv,(x,y)=>{ const d=y-top[x], foot=base+5-y, mound=base-top[x]>3; if(d<0||foot<0||(foot<5&&bayer(x,y)>foot/5)) return null;
    if(!mound) return bayer(x,y)<0.35?R[3]:R[2];
    if(d<2) return R[3];
    const v=nz.fbm(x/5,y/3,3); return v<0.42?R[0]:v<0.58?R[1]:R[2]; });
  scatter(rng,W,n,6).forEach(cx=>{ const c=pick(rng,corals), x=Math.round(cx), y=top[x%W]+ri(rng,1,3);
    stamp(cv.x,c,x-(c.w>>1),y-c.h,rng()<0.5); });
  scatter(rng,W,24,5).forEach(cx=>{ const x=Math.round(cx), y=top[x%W]+ri(rng,2,6);
    for(let i=0;i<ri(rng,2,4);i++) line(cv.x,x+i,y,x+i+ri(rng,-1,1),y-ri(rng,3,7),PAL.teal[1]); });
  cv.top=top; return cv; }

// ---- recipe 16: Fish sprite (2 frames) + school movement
const FISH_A=["..............","...kkkkkkk....","kk.kbbwbbbkk..","kbkbbbwbbbbek.","kk.kBBwBBBkk..","...kkkkkkk...."];
const FISH_B=["..............","...kkkkkkk....","k..kbbwbbbkk..","kkkbbbwbbbbek.","k..kBBwBBBkk..","...kkkkkkk...."];
const FISH_PALS={red:{b:'#f05454',B:'#d83048',w:'#b3cbb6',e:'#2a3428',k:'#a81860'},blue:{b:'#6084e4',B:'#3c3cc0',w:'#b3cbb6',e:'#2a3428',k:'#182490'}};
function makeFish(pal){ return [gridSprite(FISH_A,pal),gridSprite(FISH_B,pal)]; }
function makeSchool(n,cx,cy,rng){
  return Array.from({length:n},()=>({x:cx+(rng()-0.5)*34,y:cy+(rng()-0.5)*18,ph:rng()*6.28,sp:0.8+rng()*0.4,img:null})); }
function schoolStep(fish,t,dt,W,dir=1,speed=14){
  fish.forEach(f=>{ f.x+=dir*speed*f.sp*dt; if(dir>0&&f.x>W+14) f.x=-14; if(dir<0&&f.x<-14) f.x=W+14;
    f.img.setPosition(Math.round(f.x),Math.round(f.y+Math.sin(t*2+f.ph)*2)).setFlipX(dir<0).setFrame(Math.floor(t*6+f.ph)%2); }); }

// ---- recipe 17: Jellyfish
function makeJelly(r,frames,seed,ramp){
  const rng=makeRng(seed), R=ramp||PAL.purple, out=[], tn=ri(rng,4,6), tl=Math.round(r*1.8), yb=Math.round(r*1.2)+1, W=r*2+3, H=yb+tl+2;
  for(let f=0;f<frames;f++){ const ph=f/frames*Math.PI*2, rh=r*(1+0.18*Math.sin(ph)), cv=mkCanvas(W,H);
    paint(cv,(x,y)=>{ const dx=(x-(W-1)/2)/r, dy=(yb-y)/rh, q=dx*dx+dy*dy; if(dy<0||q>1) return null;
      if(q>0.78||dy<0.1) return R[0];
      if(dy<0.35&&((x+y)&1)) return null;
      return rampAt([R[1],R[2],PAL.caustic[0]],0.55-0.45*dx+0.4*dy-0.3,x,y); });
    for(let i=0;i<tn;i++){ const x0=2+i*(W-5)/(tn-1);
      for(let t=0;t<tl;t++) if(t%4!==3) px(cv.x,x0+Math.sin(ph+i*1.3+t*0.5)*1.6*(t/tl),yb+1+t,t>tl*0.6?R[2]:R[1]); }
    out.push(cv); }
  return out; }

// ---- recipe 18: Bubbles
function makeBubbles(){ const a=PAL.caustic[1], s=PAL.caustic[0], P={a,s};
  return [gridSprite([".....",".....","..a..",".....","....."],P),
          gridSprite([".....",".aaa.",".a.a.",".aaa.","....."],P),
          gridSprite([".aaa.","as..a","a...a","a...a",".aaa."],P)]; }
function makeBubbleField(n,W,H,rng){
  return Array.from({length:n},()=>({x:rng()*W,y:rng()*H,sp:6+rng()*10,ph:rng()*6.28,f:ri(rng,0,2),img:null})); }
function bubbleStep(bs,t,dt,W,H){
  bs.forEach(b=>{ b.y-=b.sp*dt; if(b.y<-4){ b.y=H+4; b.x=Math.random()*W; }
    b.img.setPosition(Math.round(b.x+Math.sin(t*2+b.ph)*1.5),Math.round(b.y)); }); }

// ---- recipe 19: Diver sprite (4 swim frames + rise + sink)
const DIVER_PAL={k:'#2a3428',y:'#e4a830',Y:'#c0600c',b:'#3c3cc0',l:'#6084e4',d:'#182490',g:'#b3cbb6',s:'#e89096'};
const DIVER_BODY=["..........................","...........kkkk...kkkkk...","..........kyyyYk.kddddk...","..........kyyyYkkdggggk...",".........kkyyyYkdgggggk...",
  "....kkkkkbbYYYbbkdggssk...","..kkllllbbbbbbbbbkddddkk..",".kddddddddbbbbbbbbbbbbkkk.","..kkkkkkkkddddddbbbbbbssk.","...........kkkkkkkkkkkk...","..........................."];
const DIVER_FINS=[["kyyk.","kYyk.",".kk.."],[".kyyk","kkYyk","....."],["kyyk.",".....","kYyk."],[".....",".kyyk","kkYyk"]];
function tiltSprite(cv,slope,pad){ const out=mkCanvas(cv.w,cv.h+pad*2);
  for(let x=0;x<cv.w;x++) out.x.drawImage(cv.c,x,0,1,cv.h,x,pad-Math.round(slope*(x-cv.w/2)),1,cv.h);
  return out; }
function makeDiver(){ const body=DIVER_BODY.map(r=>r.split('')), frames=[];
  DIVER_FINS.forEach(fin=>{ const g=body.map(r=>r.slice()); fin.forEach((row,i)=>{ for(let x=0;x<row.length;x++) if(row[x]!=='.') g[5+i][x]=row[x]; });
    frames.push(gridSprite(g.map(r=>r.join('')),DIVER_PAL)); });
  const pad=8, big=tiltSprite(frames[1],0.6,pad), H=big.h, all=[];
  frames.forEach(f=>{ const c=mkCanvas(f.w,H); c.x.drawImage(f.c,0,pad); all.push(c); });
  all.push(big, tiltSprite(frames[0],-0.6,pad)); return all; }

// ---- recipe 21: Registering canvases as Phaser textures; sheets; parallax
function addTex(scene,key,cv){ if(scene.textures.exists(key)) scene.textures.remove(key); return scene.textures.addCanvas(key,cv.c); }
function addSheet(scene,key,cvs){ const w=cvs[0].w, h=cvs[0].h, s=mkCanvas(w*cvs.length,h);
  cvs.forEach((f,i)=>s.x.drawImage(f.c,i*w,0)); const tex=addTex(scene,key,s);
  cvs.forEach((_,i)=>tex.add(i,0,i*w,0,w,h)); return tex; }
function addParallax(scene,key,y,w,factor,depth){
  const imgs=[0,1].map(()=>scene.add.image(0,y,key).setOrigin(0,0).setScrollFactor(0).setDepth(depth));
  return {imgs,w,pf:factor,drift:0,driftSpeed:0}; }
function updateParallax(scene,layers,dt){ const sx=scene.cameras.main.scrollX;
  layers.forEach(l=>{ l.drift+=l.driftSpeed*dt; const off=((Math.round(sx*l.pf+l.drift)%l.w)+l.w)%l.w; l.imgs[0].x=-off; l.imgs[1].x=l.w-off; }); }
// usage in create(): addTex(this,'sand',makeSand(320,48,4)); const sand=addParallax(this,'sand',132,320,0.8,4); sand.driftSpeed=0;
//   addSheet(this,'fish',makeFish(FISH_PALS.red)); this.add.image(50,60,'fish',0);
//   in update(t,dtMs): updateParallax(this,[sand],dtMs/1000);

// ---- recipe 22: Frame animation without regenerating anything
function animate(scene,items,fps){ // items: [{img,frames}]  img = Phaser Image on a sheet; frames = frame count
  let i=0; scene.time.addEvent({delay:1000/fps,loop:true,callback:()=>{ i++; items.forEach(it=>it.img.setFrame((i+(it.off||0))%it.frames)); }}); }

