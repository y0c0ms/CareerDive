// ---- wildlife: sardine, clownfish, puffer, turtle, manta, crab, seahorse, starfish, octopus, angler (loads after art.js)
const WL_INK=PAL.rock[0];
const wlClamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
function wlGrid(w,h){ return {w,h,a:new Array(w*h).fill(null)}; }
function wlMask(g){ return new Uint8Array(g.w*g.h); }
function wlSet(g,x,y,c){ x=Math.round(x); y=Math.round(y); if(x>=0&&y>=0&&x<g.w&&y<g.h) g.a[y*g.w+x]=c; }
function wlGet(g,x,y){ return x>=0&&y>=0&&x<g.w&&y<g.h?g.a[y*g.w+x]:null; }
function wlDisc(g,m,cx,cy,r){ for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(g.h-1,Math.ceil(cy+r));y++)
  for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(g.w-1,Math.ceil(cx+r));x++){ const dx=x+0.5-cx,dy=y+0.5-cy; if(dx*dx+dy*dy<=r*r) m[y*g.w+x]=1; } }
function wlEll(g,m,cx,cy,rx,ry){ for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(g.h-1,Math.ceil(cy+ry));y++)
  for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(g.w-1,Math.ceil(cx+rx));x++){ const dx=(x+0.5-cx)/rx,dy=(y+0.5-cy)/ry; if(dx*dx+dy*dy<=1) m[y*g.w+x]=1; } }
function wlPoly(g,m,pts){ for(let y=0;y<g.h;y++) for(let x=0;x<g.w;x++){ const X=x+0.5,Y=y+0.5; let ins=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j];
    if((a[1]>Y)!==(b[1]>Y)&&X<(b[0]-a[0])*(Y-a[1])/(b[1]-a[1])+a[0]) ins=!ins; }
  if(ins) m[y*g.w+x]=1; } }
function wlPath(g,m,pts,r0,r1){ let L=0; for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  let acc=0; for(let i=1;i<pts.length;i++){ const a=pts[i-1],b=pts[i],sl=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(sl*3));
    for(let s=0;s<=n;s++){ const u=s/n,t=L?(acc+sl*u)/L:0; wlDisc(g,m,a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,r0+(r1-r0)*t); } acc+=sl; } }
function wlFill(g,m,col,ink){ const fn=typeof col==='function'?col:()=>col;
  for(let y=0;y<g.h;y++) for(let x=0;x<g.w;x++) if(m[y*g.w+x]) g.a[y*g.w+x]=fn(x,y);
  if(!ink) return;
  for(let y=0;y<g.h;y++) for(let x=0;x<g.w;x++) if(!m[y*g.w+x]&&((x>0&&m[y*g.w+x-1])||(x<g.w-1&&m[y*g.w+x+1])||(y>0&&m[(y-1)*g.w+x])||(y<g.h-1&&m[(y+1)*g.w+x]))) g.a[y*g.w+x]=ink; }
function wlShade(R,cx,cy,rx,ry,bias=0){ return (x,y)=>rampAt(R,wlClamp(0.52+bias-0.4*(x+0.5-cx)/rx-0.48*(y+0.5-cy)/ry),x,y); }
function wlCrop(grids){ let x0=1e9,y0=1e9,x1=-1,y1=-1; const w=grids[0].w,h=grids[0].h;
  grids.forEach(g=>{ for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(g.a[y*w+x]){ x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y); } });
  const cw=x1-x0+1,ch=y1-y0+1;
  return grids.map(g=>paint(mkCanvas(cw,ch),(x,y)=>g.a[(y+y0)*w+x+x0])); }

// ---- sardine: slim silver fish for dense schools, 3 tail-beat frames
const WL_SARD=[
  {ink:PAL.blue[0],d:PAL.blue[1],m:PAL.blue[2],s:PAL.cloud[0],l:PAL.cloud[2]},
  {ink:mix(PAL.teal[0],PAL.rock[0],0.5),d:PAL.teal[0],m:PAL.teal[1],s:PAL.caustic[0],l:PAL.cloud[2]},
  {ink:mix(PAL.gold[0],PAL.rock[0],0.35),d:PAL.yellow[0],m:PAL.yellow[1],s:PAL.cloud[1],l:PAL.sun[2]}];
function makeSardine(variant=0){ const P=WL_SARD[variant%3], out=[];
  const tails=[[[1,1],[1,4],[2,1],[2,2],[2,3],[2,4]],[[1,1],[1,2],[2,1],[2,2],[2,3]],[[1,3],[1,4],[2,2],[2,3],[2,4]]];
  for(let f=0;f<3;f++){ const g=wlGrid(12,6), m=wlMask(g);
    wlEll(g,m,7,3,3.9,2.1); tails[f].forEach(([x,y])=>{ m[y*g.w+x]=1; });
    wlFill(g,m,(x,y)=>x<3?P.d:y===1?(x>7?P.m:P.d):y===2?(x>7?P.s:P.m):y===3?P.s:P.l,P.ink);
    wlSet(g,4,1,P.m); wlSet(g,6,2,P.s); wlSet(g,9,2,P.ink); wlSet(g,8,3,P.l); wlSet(g,10,3,P.s); wlSet(g,6,4,P.s);
    out.push(g); }
  return wlCrop(out); }

// ---- clownfish: orange, white bands, dark fins, 3 frames (tail + fin wave)
function makeClownfish(){ const O=makeRamp(mix(PAL.gold[0],PAL.crimson[0],0.45),mix(PAL.gold[1],PAL.crimson[1],0.5),PAL.gold[2],4),
    W=[PAL.caustic[1],PAL.cloud[1],PAL.cloud[2]], K=mix(PAL.rock[0],PAL.purple[0],0.4), out=[];
  for(let f=0;f<3;f++){ const dt=[0,-1,1][f], df=[0,-1,0][f], g=wlGrid(20,16);
    let m=wlMask(g); wlPoly(g,m,[[6.4,8],[3.2,5.2+dt],[2.6,8+dt*0.6],[3.2,10.8+dt]]); wlFill(g,m,(x,y)=>O[(x+y)&1?1:2],K);
    m=wlMask(g); wlPoly(g,m,[[7,5.4],[8.2,3.6+df],[11,3.6+df],[12.3,5.6]]); wlFill(g,m,O[2],K);
    m=wlMask(g); wlPoly(g,m,[[9,10.6],[9.5,12.2],[11.4,10.8]]); wlFill(g,m,O[2],K);
    m=wlMask(g); wlEll(g,m,10,8,4.6,3);
    wlFill(g,m,(x,y)=>{ const band=(x>=10&&x<=11)||(x===7&&y>5); if(band) return rampAt(W,wlClamp(0.85-0.45*(y-6.5)/3),x,y);
      return wlShade(O,10,8,4.6,3,0.3)(x,y); },K);
    wlSet(g,9,5,K); wlSet(g,9,10,K); wlSet(g,12,5,K); wlSet(g,12,10,K);
    wlSet(g,12,6,W[2]); wlSet(g,13,6,W[2]); wlSet(g,12,7,W[2]); wlSet(g,13,7,K); wlSet(g,14,9,K);
    wlSet(g,8+f%2,9,O[3]); wlSet(g,9+f%2,9,O[3]);
    out.push(g); }
  return wlCrop(out); }

// ---- puffer: round yellow/cream pufferfish, 3 frames (puff + fin flutter)
function makePuffer(){ const Y=[mix(PAL.yellow[0],PAL.purple[0],0.25),PAL.yellow[0],PAL.yellow[1],PAL.yellow[2]], C=[PAL.yellow[2],PAL.sun[2],PAL.cloud[2]], K=mix(PAL.yellow[0],PAL.rock[0],0.55), out=[];
  for(let f=0;f<3;f++){ const r=[5,5.5,5.2][f], cx=10, cy=9, g=wlGrid(21,19);
    let m=wlMask(g); wlPoly(g,m,[[cx-r+1,cy+0.5],[cx-r-2.6,cy-2+(f-1)],[cx-r-3,cy+1],[cx-r-2.6,cy+3.6+(f-1)],[cx-r+1,cy+1.5]]); wlFill(g,m,Y[2],K);
    m=wlMask(g); wlPoly(g,m,[[cx-3,cy-r+1],[cx-2.5,cy-r-1.6],[cx+0.5,cy-r-1.2+(f===1?-1:0)],[cx+1,cy-r+1]]); wlFill(g,m,Y[2],K);
    m=wlMask(g); wlPoly(g,m,[[cx-2,cy+r-1],[cx-1,cy+r+1.4],[cx+1.5,cy+r-0.6]]); wlFill(g,m,Y[2],K);
    m=wlMask(g); wlDisc(g,m,cx,cy,r); wlDisc(g,m,cx+r-0.8,cy+1.4,2.2);
    [[-0.9,-r-0.6],[-3,-r+0.4],[1.4,-r+0.2],[-r+0.1,-1.8],[-r+0.7,2],[-2.6,r+0.1],[0.6,r+0.4],[r-0.6,-3]].forEach(([dx,dy])=>{ m[Math.round(cy+dy-0.5)*g.w+Math.round(cx+dx-0.5)]=1; });
    wlFill(g,m,(x,y)=>{ const dy=y+0.5-cy, dx=x+0.5-cx;
      if(dy>1.6+0.2*dx) return rampAt([Y[3],C[1],C[2]],wlClamp(0.55-0.3*dx/r-0.12*(dy-1.6)),x,y);
      return rampAt(Y,wlClamp(0.7-0.4*dx/r-0.5*dy/r),x,y); },K);
    [[cx-2,cy-3],[cx+1,cy-4],[cx-4,cy-0],[cx-1,cy-1]].forEach(([x,y])=>wlSet(g,x,y,Y[0]));
    const ex=cx+3,ey=cy-2;
    wlSet(g,ex-1,ey-1,C[2]); wlSet(g,ex,ey-1,C[2]); wlSet(g,ex+1,ey-1,C[2]); wlSet(g,ex-1,ey,C[2]); wlSet(g,ex,ey,K); wlSet(g,ex+1,ey,K);
    wlSet(g,ex-1,ey+1,C[1]); wlSet(g,ex,ey+1,C[2]); wlSet(g,ex+1,ey+1,C[1]);
    wlSet(g,cx+r,cy+2,K); wlSet(g,cx+r-1,cy+3,K);
    m=wlMask(g); wlPoly(g,m,[[cx-2.5,cy+1.5],[cx,cy+1.2],[cx+1,cy+3.4+(f===1?-1.5:0.4)],[cx-3,cy+4.2+(f===1?-1.5:0.4)]]); wlFill(g,m,(x,y)=>y<cy+3?Y[3]:C[1],K);
    out.push(g); }
  return wlCrop(out); }

// ---- sea turtle: side view facing right, 6 frames of a slow flipper stroke
function wlOver(dst,src){ for(let i=0;i<dst.a.length;i++) if(src.a[i]) dst.a[i]=src.a[i]; }
function wlFlipper(g,x0,y0,a0,a1,L,r0,r1,R,ink){ const d0=a0*Math.PI/180, d1=a1*Math.PI/180, mx=x0+Math.cos(d0)*L*0.5, my=y0+Math.sin(d0)*L*0.5,
    pts=[[x0,y0],[mx,my],[mx+Math.cos(d1)*L*0.5,my+Math.sin(d1)*L*0.5]], m=wlMask(g); wlPath(g,m,pts,r0,r1);
  wlFill(g,m,(x,y)=>rampAt(R,wlClamp(0.8-0.5*(y+0.5-Math.min(y0,my))/(L*0.6)+((x+y)%5===0?-0.18:0)),x,y),ink); }
function makeTurtle(){
  const K=mix(PAL.rock[0],PAL.purple[0],0.3), S=[mix(PAL.kelp[0],PAL.rock[0],0.55),PAL.kelp[0],mix(PAL.kelp[0],PAL.kelp[1],0.6),mix(PAL.kelp[1],PAL.kelp[2],0.5)],
    SK=[mix(PAL.yellow[0],PAL.kelp[0],0.5),mix(PAL.yellow[1],PAL.kelp[0],0.45),mix(PAL.yellow[1],PAL.kelp[1],0.35),mix(PAL.yellow[2],PAL.kelp[3],0.35)],
    SD=[mix(SK[0],PAL.purple[0],0.4),SK[0],SK[1],SK[2]], CR=[PAL.yellow[0],PAL.yellow[1],PAL.yellow[2],PAL.sun[2]],
    W=44, H=36, rng=makeRng(9), cx=19, cy=17.5, sc=6, jit=[]; for(let i=0;i<64;i++) jit.push((rng()-0.5)*0.2);
  const T=wlGrid(W,H); let m=wlMask(T);
  wlPoly(T,m,[[9,17],[3,19],[9,19.4]]); wlFill(T,m,SK[1],K);
  m=wlMask(T); wlPath(T,m,[[27,14.5],[30,12.5]],2.6,2.4); wlEll(T,m,33,11.6,3.8,3); wlEll(T,m,35.6,12.8,1.8,1.4);
  wlFill(T,m,(x,y)=>rampAt(SK,wlClamp(0.78-0.35*(x+0.5-32)/4-0.5*(y+0.5-11.6)/3.4),x,y),K);
  wlSet(T,34,10,K); wlSet(T,35,10,K); wlSet(T,34,11,K); wlSet(T,35,11,K); wlSet(T,34,9,SK[3]); wlSet(T,36,13,K); wlSet(T,35,14,SK[0]); wlSet(T,37,12,SK[0]);
  m=wlMask(T); wlEll(T,m,cx,cy,13.2,11); for(let y=Math.ceil(cy);y<H;y++) for(let x=0;x<W;x++) m[y*W+x]=0; wlEll(T,m,cx,cy,12.4,2.6);
  wlFill(T,m,(x,y)=>{ const X=x+0.5-cx, Y=y+0.5-cy;
    if(Y>-0.2) return rampAt(CR,wlClamp(0.45-0.4*X/12-0.3*(Y-0.3)),x,y);
    if(Y>-1.6) return S[0];
    const u=X, v=Y/0.86; let d1=1e9,d2=1e9,id=0;
    for(let j=-4;j<=1;j++) for(let i=-4;i<=4;i++){ const hx=i*sc+((j&1)?sc/2:0)+1, hy=j*sc*0.866-1.2, d=Math.hypot(u-hx,v-hy);
      if(d<d1){ d2=d1; d1=d; id=(i+5)*7+(j+5)*3; } else if(d<d2) d2=d; }
    if(d2-d1<1.2) return S[0];
    return rampAt(S,wlClamp(0.7-0.5*X/13+0.6*Y/11+jit[id&63]-(d1>2.4?0.1:0)+(d2-d1<2.2?-0.18:0)),x,y); },K);
  const out=[];
  for(let f=0;f<6;f++){ const ph=f/6*Math.PI*2, g=wlGrid(W,H), A=p=>50+60*Math.cos(p), B=p=>A(p)+34*Math.sin(p);
    wlFlipper(g,28,19,A(ph+0.7),B(ph+0.7),11,2.2,1.1,SD,K);
    wlFlipper(g,12,20.5,118+12*Math.cos(ph+1),124+16*Math.sin(ph+1),6,1.8,0.9,SD,K);
    wlOver(g,T);
    wlFlipper(g,26,19.6,A(ph),B(ph),14,3,1.2,SK,K);
    wlFlipper(g,13,21,112+14*Math.cos(ph+0.4),120+18*Math.sin(ph+0.4),7,2,0.9,SK,K);
    out.push(g); }
  return wlCrop(out); }

// ---- manta ray: slightly-above side view facing right, 6 wing-flap frames, 2 palettes
const WL_MANTA=[
  {ink:mix(PAL.haze[2],PAL.rock[0],0.6),R:[mix(PAL.haze[2],PAL.rock[0],0.45),PAL.haze[2],PAL.haze[1],mix(PAL.haze[0],PAL.caustic[1],0.35)],B:[PAL.caustic[2],PAL.caustic[1],PAL.caustic[0],PAL.cloud[2]]},
  {ink:mix(PAL.purple[0],PAL.rock[0],0.6),R:[mix(PAL.purple[0],PAL.rock[0],0.5),mix(PAL.purple[0],PAL.haze[2],0.45),mix(PAL.haze[2],PAL.purple[1],0.5),mix(PAL.purple[1],PAL.haze[0],0.5)],B:[PAL.haze[0],mix(PAL.haze[0],PAL.cloud[1],0.4),PAL.cloud[0],PAL.cloud[2]]}];
function makeManta(variant=0){ const P=WL_MANTA[variant%2], W=76, H=44, cy=22, out=[];
  const bez=(a,c,b,n)=>{ const o=[]; for(let i=0;i<=n;i++){ const t=i/n; o.push([(1-t)*(1-t)*a[0]+2*(1-t)*t*c[0]+t*t*b[0],(1-t)*(1-t)*a[1]+2*(1-t)*t*c[1]+t*t*b[1]]); } return o; };
  for(let f=0;f<6;f++){ const ph=f/6*Math.PI*2, s=Math.sin(ph), c=Math.cos(ph), g=wlGrid(W,H), sp=13+4.5*c, tipx=Math.round(33-4.5*s), curl=3*s, up=c>0.35;
    const tailPts=[[26,cy+0.3]]; for(let i=1;i<=13;i++) tailPts.push([26-i*2.2,cy+0.5+Math.sin(ph-i*0.55)*1.6*(i/13)]);
    let m=wlMask(g); wlPath(g,m,tailPts,1.5,0.35); wlFill(g,m,(x,y)=>x>12?P.R[1]:P.R[0],P.ink);
    const wing=(sg)=>{ const ty=cy+sg*sp, pts=bez([53,cy+sg*2.2],[tipx+13,cy+sg*(sp*0.55)+sg*curl*0.4],[tipx,ty],9).concat(bez([tipx,ty],[tipx-2-curl*0.6,cy+sg*sp*0.35],[24,cy+sg*1.4],8).slice(1)), mw=wlMask(g); wlPoly(g,mw,pts);
      wlFill(g,mw,(x,y)=>{ const d=Math.abs(y-cy)/sp, trail=(x-24)/32; return rampAt(up?[P.R[1],P.R[2],P.R[3],P.B[0]]:[P.R[0],P.R[1],P.R[2],P.R[3]],wlClamp(0.3+0.45*trail-0.35*d+(sg<0?0.1:0)+(((x*3+y*2)%9===0)?-0.1:0)),x,y); },P.ink); };
    wing(-1); wing(1);
    m=wlMask(g); wlEll(g,m,41,cy,15,5.4); wlPoly(g,m,[[52,cy-4.6],[58,cy-2.4],[59.5,cy+0.4],[58,cy+2.8],[52,cy+4.6]]);
    wlFill(g,m,(x,y)=>rampAt([P.R[0],P.R[1],P.R[2],P.R[3]],wlClamp(0.5+0.4*(x-25)/32-0.3*Math.abs(y-cy)/5.4+(y<cy?0.1:0)),x,y),P.ink);
    [[39,cy-3],[40,cy-3],[41,cy-3],[39,cy+3],[40,cy+3],[41,cy+3],[45,cy-3],[45,cy+3]].forEach(([x,y])=>wlSet(g,x,y,P.B[2]));
    wlSet(g,50,cy-3,P.ink); wlSet(g,51,cy-3,P.B[3]); wlSet(g,50,cy+3,P.ink); wlSet(g,51,cy+3,P.B[3]);
    for(const sg of [-1,1]){ const hm=wlMask(g); wlPath(g,hm,[[56,cy+sg*1.4],[60,cy+sg*2.4],[63.4,cy+sg*1.2]],1.5,0.5); wlFill(g,hm,P.R[2],P.ink); }
    wlSet(g,58,cy,P.B[0]); wlSet(g,57,cy,P.B[1]);
    out.push(g); }
  return wlCrop(out); }

// ---- crab: red-orange, front-ish view, 4 frames of sideways scuttle + claw wave
function makeCrab(){ const R=makeRamp(mix(PAL.crimson[0],PAL.purple[0],0.35),PAL.crimson[1],mix(PAL.crimson[2],PAL.gold[1],0.5),4), K=mix(PAL.crimson[0],PAL.rock[0],0.55), out=[],
    W=PAL.cloud[2], W2=PAL.caustic[0];
  for(let f=0;f<4;f++){ const g=wlGrid(28,18), cx=14, wave=[0,-1,-2,-1][f], wave2=[-2,-1,0,-1][f], leg=[0,1,0,-1][f];
    for(const sg of [-1,1]){
      for(let i=0;i<3;i++){ const m=wlMask(g), x0=cx+sg*(4+i*0.6), y0=11+i*0.6, lift=((f+i+(sg>0?2:0))%4<2)?-1:0, ex=cx+sg*(8.6+i*1.6+leg*sg*0.7), ey=14.2+i*0.8+lift;
        wlPath(g,m,[[x0,y0],[x0+sg*2.6,y0-1+lift*0.5],[ex,ey]],0.75,0.55); wlFill(g,m,i===1?R[1]:R[2],K); }
      const up=sg>0?wave:wave2, ax=cx+sg*8.4, ay=10.2+up*0.5, cyy=ay-3.8+up;
      let m=wlMask(g); wlPath(g,m,[[cx+sg*4.6,10.6],[ax,ay]],1.05,0.95); wlFill(g,m,R[1],K);
      m=wlMask(g); wlEll(g,m,ax+sg*1.4,cyy,3.3,2.9); wlFill(g,m,(x,y)=>rampAt(R,wlClamp(0.78-0.4*(y-cyy+3)/6-0.15*sg*(x-ax)/3),x,y),K);
      const tipx=ax+sg*4.2; m=wlMask(g); wlPoly(g,m,[[tipx-sg*0.6,cyy-1],[tipx+sg*0.4,cyy-4.6],[tipx+sg*1.6,cyy-3.4],[tipx+sg*1.1,cyy-0.2]]); wlFill(g,m,R[2],K);
      wlSet(g,tipx-sg*0.4,cyy-1.6,K); wlSet(g,tipx-sg*0.4,cyy-0.6,K);
      wlSet(g,ax+sg*0.4,cyy-1.2,R[3]); wlSet(g,ax-sg*0.6,cyy,R[3]);
    }
    let m=wlMask(g); wlEll(g,m,cx,12,7,4.4); wlFill(g,m,wlShade(R,cx,12,7,4.4,0.28),K);
    [[-3,9],[-1,8.5],[1,9],[3,9.5],[-5,11],[5,12],[-1,12.5],[2,13]].forEach(([dx,dy],i)=>wlSet(g,cx+dx,dy,i<4?R[3]:R[0]));
    [[-2,15],[0,15.5],[2,15]].forEach(([dx,dy])=>wlSet(g,cx+dx,dy,R[0]));
    for(const sg of [-1,1]){ const ex=cx+sg*2.6-(sg>0?0:1);
      wlSet(g,ex+(sg>0?0:1),8,R[2]); wlSet(g,ex+(sg>0?0:1),7,K);
      const mm=wlMask(g); wlDisc(g,mm,ex+1,5.4,1.6); wlFill(g,mm,(x,y)=>(y>=5&&x===ex+(sg>0?1:0)+(sg>0?0:0)&&y===6)?K:(y===4?W:(y===5?W:W2)),K);
      wlSet(g,ex+(sg>0?1:0),5,K); wlSet(g,ex+(sg>0?1:0),6,K); }
    out.push(g); }
  return wlCrop(out); }

// ---- seahorse: upright, curled tail, 4 frames (dorsal fin flutter + tail curl)
const WL_HORSE_BODY=[
  ".....k.k......",
  "....k4k3k.....",
  "...k44333k....",
  "...k433wekkk..",
  "..k4333eek22kk",
  "..k433322222k.",
  "...k4333kkkk..",
  "...k4332k.....",
  "..k443333k....",
  "..k4433222k...",
  ".k44333322k...",
  ".k44333322k...",
  ".k44133222k...",
  "..k4133222k...",
  "..k413222k....",
  "...k41222k....",
  "...k4122k.....",
  "....k122k.....",
  "....k122k.....",
  "....k122k....."];
const WL_HORSE_TAIL=[
  ["....k12k..kk.","....k22k.k22k","....k2k2kk2kk",".....kk22k2k.","......kkkk..."],
  ["....k12k..kk.","....k22k.k22k","....k2k2k22kk",".....kk22kkk.","......kkk...."],
  ["....k12k.....","....k22k.kkk.","....k2k2k22k.",".....kk22k2kk","......kkkkk.."],
  ["....k12k..kk.","....k22k.k22k","....k2k2kk2kk",".....kk22k2k.","......kkkk..."]];
function makeSeahorse(){ const Y=makeRamp(mix(PAL.gold[0],PAL.crimson[0],0.35),PAL.gold[1],PAL.yellow[2],4), K=mix(PAL.gold[0],PAL.rock[0],0.6),
    P={k:K,'1':mix(Y[0],Y[1],0.55),'2':Y[1],'3':Y[2],'4':Y[3],w:PAL.cloud[2],e:K}, out=[];
  for(let f=0;f<4;f++){ const rows=WL_HORSE_BODY.concat(WL_HORSE_TAIL[f]).map(r=>r.padEnd(14,'.')), g=wlGrid(14,rows.length), fl=[0,1,2,1][f];
    rows.forEach((r,y)=>{ for(let x=0;x<14;x++){ const c=P[r[x]]; if(c) wlSet(g,x,y,c); } });
    const m=wlMask(g); wlPoly(g,m,[[2,8.4],[0.2-fl*0.2,9.4],[0,12.2],[0.4-fl*0.2,14.4],[2,14.8]]); wlFill(g,m,(x,y)=>((x+y+f)&1)?Y[3]:Y[2],K);
    for(let y=9;y<19;y+=3) for(let x=0;x<14;x++) if(wlGet(g,x,y)===Y[1]||wlGet(g,x,y)===Y[2]) wlSet(g,x,y,Y[0]);
    wlSet(g,1,10+(f&1),Y[1]);
    wlSet(g,6,15,Y[3]); wlSet(g,7,17,Y[3]);
    out.push(g); }
  return wlCrop(out); }

// ---- starfish: 5 arms, 3 frames of tiny arm curl; ramp = 3-tone PAL ramp
function makeStarfish(ramp){ const R=ramp||PAL.salmon, K=mix(R[0],PAL.rock[0],0.5), D=mix(R[0],PAL.purple[0],0.3), out=[], cx=9.5, cy=9.5;
  for(let f=0;f<3;f++){ const g=wlGrid(19,19), m=wlMask(g), curl=[0,0.2,-0.16][f], tips=[];
    for(let a=0;a<5;a++){ const ang=-Math.PI/2+a*Math.PI*2/5, L=a===0?8:7.4+((a*7+f)%3===0?0.6:0), mid=[cx+Math.cos(ang)*L*0.55,cy+Math.sin(ang)*L*0.55], tip=[cx+Math.cos(ang+curl*(a%2?1:-1))*L,cy+Math.sin(ang+curl*(a%2?1:-1))*L];
      wlPath(g,m,[[cx,cy],mid,tip],2.2,0.7); tips.push({ang,L}); }
    wlDisc(g,m,cx,cy,2.9);
    wlFill(g,m,(x,y)=>{ const X=x+0.5-cx,Y=y+0.5-cy; return rampAt([D,R[0],R[1],R[2]],wlClamp(0.62-0.34*X/8-0.4*Y/8),x,y); },K);
    tips.forEach(({ang,L},a)=>{ for(let s=1;s<L-1.5;s+=1.6){ wlSet(g,cx+Math.cos(ang)*s,cy+Math.sin(ang)*s,R[2]); } });
    [[0,0],[1,1],[-1,1],[1,-1]].forEach(([dx,dy])=>wlSet(g,cx+dx-0.5,cy+dy-0.5,R[2]));
    wlSet(g,cx-1,cy-1,PAL.cloud[2]);
    out.push(g); }
  return wlCrop(out); }

// ---- octopus: big head, 8 curling tentacles, 6 frames of undulation, blink on frame 3; ramp = 3-tone PAL ramp
function makeOctopus(ramp){ const R=ramp||PAL.purple, K=mix(R[0],PAL.rock[0],0.55), D=mix(R[0],PAL.rock[0],0.15), L=[D,R[0],R[1],R[2],mix(R[2],PAL.cloud[2],0.5)], out=[], W=PAL.cloud[2],
    W_=34, H_=30, cx=17, hy=10, gy=H_-2;
  for(let f=0;f<6;f++){ const ph=f/6*Math.PI*2, g=wlGrid(W_,H_), tents=[];
    for(let i=0;i<8;i++){ const fx=(i-3.5)/3.5, dir=fx<0?-1:1, a=Math.abs(fx), x0=cx+fx*6.2, y0=hy+6.5, back=(i===0||i===7||i===1||i===6);
      let th=Math.PI/2-dir*(0.1+a*0.5), x=x0, y=y0; const pts=[[x,y]], n=15, step=back?1.05:1.15;
      for(let s=1;s<=n;s++){ const t=s/n, curl=Math.max(0,t-0.35)*(0.2+0.34*a+0.14*Math.sin(ph+i*0.95)), wob=Math.sin(ph-t*3.4+i*1.1)*0.1*t;
        th+=-dir*curl+wob*(i%2?1:-1); x+=Math.cos(th)*step; y=Math.min(gy,y+Math.sin(th)*step); pts.push([x,y]); }
      tents.push({pts,i,back}); }
    tents.sort((p,q)=>(q.back-p.back));
    tents.forEach(({pts,i,back})=>{ const m=wlMask(g); wlPath(g,m,pts,back?1.55:1.85,0.55);
      wlFill(g,m,(x,y)=>rampAt(back?[D,R[0],R[1],R[1]]:[R[0],R[1],R[2],R[2]],wlClamp(0.5+0.25*(y%4<2?1:0)+(back?-0.25:0.05)-0.3*(x-pts[0][0])/14*(i<4?-1:1)),x,y),K);
      if(!back) pts.forEach((p,s)=>{ if(s>1&&s<10&&s%3===1) wlSet(g,p[0]+(i<4?-0.5:0.5),p[1]+0.5,L[4]); }); });
    let m=wlMask(g); wlEll(g,m,cx,hy,9.6,8.6); wlPoly(g,m,[[cx-6.6,hy+4],[cx+6.6,hy+4],[cx+5.4,hy+7.6],[cx-5.4,hy+7.6]]);
    wlFill(g,m,(x,y)=>rampAt(L.slice(0,4),wlClamp(0.8-0.46*(x+0.5-cx)/9.6-0.55*(y+0.5-hy)/8.6+(((x*5+y*3)%11===0)?-0.12:0)),x,y),K);
    [[cx-5,hy-5],[cx-4,hy-6],[cx-3,hy-6],[cx-6,hy-4],[cx-2,hy-7]].forEach(([x,y])=>wlSet(g,x,y,L[4]));
    [[cx+3,hy-4],[cx+6,hy-1],[cx-7,hy+3],[cx+1,hy-6],[cx+5,hy+3],[cx+7,hy-3]].forEach(([x,y])=>wlSet(g,x,y,L[1]));
    const blink=f===3;
    for(const sg of [-1,1]){ const ex0=cx+sg*4.4-(sg<0?1:0);
      if(blink){ [-1,0,1,2].forEach(dx=>wlSet(g,ex0+dx,hy+1,K)); continue; }
      [[0,-1],[1,-1],[-1,0],[2,0],[-1,1],[2,1],[0,2],[1,2]].forEach(([dx,dy])=>wlSet(g,ex0+dx,hy+dy,K));
      wlSet(g,ex0,hy,W); wlSet(g,ex0+1,hy,W); wlSet(g,ex0,hy+1,W); wlSet(g,ex0+1,hy+1,PAL.caustic[2]);
      wlSet(g,ex0+(sg>0?1:0),hy,K); wlSet(g,ex0+(sg>0?1:0),hy+1,K); }
    wlSet(g,cx-1,hy+5,K); wlSet(g,cx,hy+5,K);
    out.push(g); }
  return wlCrop(out); }

// ---- anglerfish: dark deep-sea body, big toothy mouth, flickering lure, 4 frames
function makeAngler(){ const B=[mix(PAL.haze[2],PAL.rock[0],0.7),mix(PAL.haze[2],PAL.rock[0],0.45),mix(PAL.haze[1],PAL.rock[0],0.25),mix(PAL.haze[0],PAL.haze[1],0.4)], K=mix(PAL.rock[0],PAL.purple[0],0.35),
    T=PAL.cloud[2], out=[], lureC=[[PAL.sun[2],PAL.sun[1],PAL.caustic[0]],[PAL.sun[1],PAL.sun[2],PAL.sun[1]],[PAL.caustic[0],PAL.sun[2],PAL.sun[1]],[PAL.sun[1],PAL.caustic[0],PAL.sun[2]]];
  for(let f=0;f<4;f++){ const g=wlGrid(34,26), tf=[0,-1,0,1][f], fl=[0,1,0,-1][f];
    let m=wlMask(g); wlPoly(g,m,[[8,13],[2,10+tf],[0.6,13+tf],[2,16.4+tf],[8,14]]); wlFill(g,m,(x,y)=>((x+y+f)&1)?B[2]:B[1],K);
    m=wlMask(g); wlPoly(g,m,[[10,7],[8,3.4-fl],[12,4.6],[14,7.2]]); wlFill(g,m,B[2],K);
    m=wlMask(g); wlPoly(g,m,[[12,18],[10,21.4+fl],[15,20],[16,18]]); wlFill(g,m,B[2],K);
    m=wlMask(g); wlEll(g,m,15.5,13,9.4,7.2); wlEll(g,m,22,14,6,5.2);
    wlFill(g,m,(x,y)=>rampAt(B,wlClamp(0.56-0.4*(x+0.5-14)/10-0.52*(y+0.5-13)/7.5+(((x*7+y*5)%9===0)?0.1:0)),x,y),K);
    for(let i=0;i<5;i++) wlSet(g,9+i*2,8+(i%2),B[3]);
    [[14,13],[12,14],[17,16],[10,12],[19,17]].forEach(([x,y])=>wlSet(g,x,y,B[0]));
    for(let y=16;y<=19;y++) for(let x=21;x<=31;x++){ if(wlGet(g,x,y)) wlSet(g,x,y,y===19&&x>27?null:wlGet(g,x,y)); }
    m=wlMask(g); wlPoly(g,m,[[19,13.6],[30.6,14.4],[31.6,17.4],[29,19.6],[22,20.2],[17,18.4]]); wlFill(g,m,mix(PAL.crimson[0],PAL.rock[0],0.55),K);
    m=wlMask(g); wlPoly(g,m,[[19,13],[30.6,13.4],[31.8,15.4],[31,16.4],[19,15]]); wlFill(g,m,(x,y)=>rampAt(B,wlClamp(0.4-0.3*(y-12.5)/3+0.2*(x-19)/12),x,y),K);
    [[30,16],[28,16],[26,16],[24,16],[22,15],[20,14]].forEach(([x,y],i)=>{ wlSet(g,x,y,T); wlSet(g,x,y-1,T); wlSet(g,x-1,y,T); });
    for(let x=20;x<=30;x+=2) wlSet(g,x,19-(x>26?0:0)+(x>27?0:0),T);
    [[22,19],[25,19],[28,19]].forEach(([x,y])=>{ wlSet(g,x,y,T); wlSet(g,x,y-1,T); });
    [[21,17],[24,17],[27,17],[30,17]].forEach(([x,y])=>wlSet(g,x,y,mix(T,PAL.crimson[2],0.35)));
    [[16,10],[17,9],[18,9],[19,9],[20,10],[21,11],[21,12],[21,13],[20,14],[16,14],[15,11],[15,12],[15,13],[17,14],[18,14],[19,14],[16,9]].forEach(([x,y])=>wlSet(g,x,y,K));
    [[16,10],[17,10],[18,10],[19,10],[20,10],[16,11],[17,11],[18,11],[19,11],[20,11],[20,12],[16,12],[17,12],[18,12],[19,12],[17,13],[18,13],[19,13],[16,13],[20,13]].forEach(([x,y])=>wlSet(g,x,y,y<12?PAL.sun[2]:PAL.sun[0]));
    wlSet(g,17,10,PAL.cloud[2]); wlSet(g,18,10,PAL.sun[2]); wlSet(g,18,11,K); wlSet(g,19,11,K); wlSet(g,18,12,K); wlSet(g,19,12,K); wlSet(g,17,11,PAL.sun[1]); wlSet(g,17,12,PAL.sun[1]);
    const stalk=[[22,6],[24,3+tf*0],[27,1.6],[30,2.4],[31.6,4.6+tf]]; m=wlMask(g);
    wlPath(g,m,[[19,7],[22.5,4],[26,2],[29,2.2]],0.8,0.6); wlFill(g,m,B[3],K);
    const lc=lureC[f], lx=30, ly=3+tf*0;
    wlSet(g,lx-1,ly-1,K); wlSet(g,lx,ly-2,K); wlSet(g,lx+1,ly-2,K); wlSet(g,lx+2,ly-1,K); wlSet(g,lx+3,ly,K); wlSet(g,lx+3,ly+1,K); wlSet(g,lx+2,ly+2,K); wlSet(g,lx+1,ly+3,K); wlSet(g,lx,ly+3,K); wlSet(g,lx-1,ly+2,K); wlSet(g,lx-2,ly+1,K); wlSet(g,lx-2,ly,K);
    [[0,-1],[1,-1],[-1,0],[0,0],[1,0],[2,0],[-1,1],[0,1],[1,1],[2,1],[0,2],[1,2]].forEach(([dx,dy],i)=>wlSet(g,lx+dx,ly+dy,lc[(i+f)%3]));
    wlSet(g,lx+(f&1),ly-3,lc[0]); wlSet(g,lx+4,ly+(f>>1),lc[1]); wlSet(g,lx-3,ly+1-(f&1),lc[2]);
    out.push(g); }
  return wlCrop(out); }

