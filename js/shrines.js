// ---- shrines: ten glowing stone designs (static stone + animated glow overlay); needs art.js
const SHRINE_DESIGNS=['gate','obelisk','lantern','arch','circle','crystal','totem','fountain','helm','clam'];
const SHR_H=[54,72,94], SHR_WLO=[36,48,60], SHR_WHI=[64,82,100];
const SHR_WF={gate:0.3,obelisk:0,lantern:0.2,arch:0.5,circle:0.9,crystal:0.7,totem:0.15,fountain:0.55,helm:0.6,clam:1};
const SHR_RUNES=[["xxx","x.x",".x.","x.x","xxx"],[".x.","xxx",".x.",".x.","x.x"],["xx.",".xx","x..",".xx","xx."],["x.x","xxx","x.x","..x","xxx"]];
const shrA=Math.round;
const shrRamp=a=>[mix(a[0],PAL.rock[0],0.45),a[0],a[1],a[2],mix(a[2],PAL.sun[2],0.55)];

function shrGrid(W,H,seed){
  const id=new Uint8Array(W*H), parts=[null];
  const g={W,H,id,parts,cx:(W-1)>>1,rng:makeRng(seed),nz:makeNoise(seed),mir:false,glyphs:[],glints:[],post:[],orb:[0,0],orbR:[4,6],orbShape:'diamond'};
  const put=(x,y,p)=>{ if(x>=0&&y>=0&&x<W&&y<H) id[y*W+x]=p; };
  g.part=(mat,o)=>{ parts.push(Object.assign({mat},o)); return parts.length-1; };
  g.set=(x,y,p)=>{ put(x,y,p); if(g.mir) put(W-1-x,y,p); };
  g.get=(x,y)=>x<0||y<0||x>=W||y>=H?0:id[y*W+x];
  g.where=(x0,y0,x1,y1,pred,p)=>{ const ya=Math.max(0,Math.floor(y0)), yb=Math.min(H-1,Math.ceil(y1)), xa=Math.max(0,Math.floor(x0)), xb=Math.min(W-1,Math.ceil(x1));
    for(let y=ya;y<=yb;y++) for(let x=xa;x<=xb;x++) if(pred(x,y,id[y*W+x])) g.set(x,y,p); };
  g.rect=(x0,y0,x1,y1,p)=>g.where(x0,y0,x1,y1,()=>true,p);
  g.ell=(cx,cy,rx,ry,p,clip)=>g.where(cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1,(x,y)=>{ const u=(x-cx)/(rx+0.5), v=(y-cy)/(ry+0.5); return u*u+v*v<=1&&(!clip||clip(x,y)); },p);
  g.poly=(pts,p)=>{ let y0=1e9,y1=-1e9; pts.forEach(q=>{ y0=Math.min(y0,q[1]); y1=Math.max(y1,q[1]); });
    for(let y=Math.max(0,Math.ceil(y0-0.5));y<=Math.min(H-1,Math.floor(y1-0.5));y++){ const yc=y+0.5, xs=[];
      for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length];
        if((a[1]<=yc&&b[1]>yc)||(b[1]<=yc&&a[1]>yc)) xs.push(a[0]+(yc-a[1])/(b[1]-a[1])*(b[0]-a[0])); }
      xs.sort((a,b)=>a-b);
      for(let k=0;k+1<xs.length;k+=2) for(let x=Math.ceil(xs[k]-0.5);x<Math.ceil(xs[k+1]-0.5);x++) g.set(x,y,p); } };
  g.taper=(y0,y1,hw0,hw1,p,ex=1)=>{ for(let y=y0;y<=y1;y++){ const t=y1>y0?(y-y0)/(y1-y0):0, r=shrA(hw0+(hw1-hw0)*Math.pow(t,ex)); g.rect(g.cx-r,y,g.cx+r,y,p); } };
  g.seg=(x0,y0,x1,y1,th,p)=>{ const dx=x1-x0, dy=y1-y0, L2=dx*dx+dy*dy||1, r=th/2;
    g.where(Math.min(x0,x1)-r,Math.min(y0,y1)-r,Math.max(x0,x1)+r,Math.max(y0,y1)+r,(x,y)=>{
      const t=Math.min(1,Math.max(0,((x-x0)*dx+(y-y0)*dy)/L2)); return Math.hypot(x-(x0+dx*t),y-(y0+dy*t))<=r; },p); };
  g.seam=(x0,x1,y,p)=>g.post.push({k:'h',x0,x1,y,p});
  g.rib=(x0,y0,x1,y1,p)=>g.post.push({k:'v',x0,y0,x1,y1,p});
  g.rune=(x,y,gi)=>{ const pts=[]; SHR_RUNES[gi%4].forEach((row,j)=>{ for(let k=0;k<3;k++) if(row[k]==='x') pts.push([x+k,y+j]); });
    if(pts.every(q=>{ const p=g.get(q[0],q[1]); return p&&parts[p].mat!=='lit'; })) g.glyphs.push(pts); };
  g.vein=(x,y,n,bias)=>{ const pts=[], seen=new Set(); const rng=g.rng;
    for(let i=0;i<n;i++){ const p=g.get(x,y); if(!p||parts[p].mat==='lit') break; const k=y*W+x; if(!seen.has(k)){ seen.add(k); pts.push([x,y]); }
      x+=ri(rng,-1,1)+(bias||0); y++; }
    if(pts.length>2) g.glyphs.push(pts); };
  return g; }

const SHR_DRAW={
  gate(g){ const {W,H,cx}=g, sh=Math.max(4,shrA(H*0.065)), m1=shrA(W*0.03), m2=shrA(W*0.11);
    const st1=g.part('rock'), st2=g.part('rock'), cap=g.part('rock'), lint=g.part('rock'), pil=g.part('rock'), door=g.part('lit',{rad:H*0.33}), alt=g.part('rock');
    const yb=H-2*sh, pw=Math.max(6,shrA(W*0.14)), px0=shrA(W*0.17), ly0=shrA(H*0.15), ly1=shrA(H*0.25), capTop=shrA(H*0.1);
    g.orb=[cx,shrA(H*0.54)]; g.orbR=[shrA(H*0.055),shrA(H*0.09)];
    g.rect(m1,H-sh,W-1-m1,H-1,st1); g.rect(m2,yb,W-1-m2,H-sh-1,st2);
    for(let y=0;y<capTop;y++){ const hw=1+2*y; g.rect(cx-hw,y,cx+hw,y,cap); }
    g.rect(shrA(W*0.19),capTop,W-1-shrA(W*0.19),ly0-1,cap);
    g.rect(shrA(W*0.08),ly0,W-1-shrA(W*0.08),ly1,lint);
    g.mir=true; g.rect(px0,ly1+1,px0+pw-1,yb-1,pil); g.mir=false;
    g.rect(px0+pw,ly1+1,W-1-px0-pw,yb-1,door);
    g.rect(cx-shrA(W*0.08),yb-shrA(H*0.11),cx+shrA(W*0.08),yb-1,alt);
    const b1=ly1+shrA(H*0.08), b2=yb-shrA(H*0.09);
    for(const [x0,x1] of [[px0,px0+pw-1],[W-px0-pw,W-1-px0]]){ g.seam(x0,x1,b1,pil); g.seam(x0,x1,b2,pil); }
    let gi=0;
    for(let y=b1+4;y<b2-6;y+=10){ g.rune(px0+((pw-3)>>1),y,gi++); g.rune(W-px0-pw+((pw-3)>>1),y,gi++); } },

  obelisk(g){ const {W,H,cx}=g, sh=Math.max(3,shrA(H*0.07)), yb=H-2*sh, yt=shrA(H*0.19), hwb=shrA(W*0.36), hwt=shrA(W*0.24);
    const s1=g.part('rock'), s2=g.part('rock'), shL=g.part('rock',{shade:'cyl'}), shR=g.part('rock',{shade:'cyl'});
    const pl=g.part('accent',{t:3}), pr=g.part('accent',{t:1}), ring=g.part('mid'), sock=g.part('lit');
    const cy=shrA(H*0.43), r1=shrA(W*0.15)+2;
    g.orb=[cx,cy]; sock>0&&(g.parts[sock].rad=r1*2.2); g.orbR=[shrA((r1-3)*0.6),shrA((r1-3)*0.95)];
    g.rect(shrA(W*0.02),H-sh,W-1-shrA(W*0.02),H-1,s1); g.rect(shrA(W*0.13),yb,W-1-shrA(W*0.13),H-sh-1,s2);
    for(let y=yt;y<yb;y++){ const hw=hwt+(hwb-hwt)*(y-yt)/(yb-1-yt), r=shrA(hw), rg=cx+shrA(hw*0.3);
      for(let x=cx-r;x<=cx+r;x++) g.set(x,y,x<=rg?shL:shR); }
    for(let y=0;y<yt;y++){ const r=shrA((hwt+1)*(y+0.5)/yt); for(let x=cx-r;x<=cx+r;x++) g.set(x,y,x<=cx?pl:pr); }
    g.ell(cx,cy,r1,r1,ring); g.ell(cx,cy,r1-3,r1-3,sock);
    const hwAt=y=>hwt+(hwb-hwt)*(y-yt)/(yb-1-yt), band=(y)=>{ const r=shrA(hwAt(y))-1, pts=[]; for(let x=cx-r;x<=cx+r;x++) pts.push([x,y]); g.glyphs.push(pts); };
    const tb=yt+2, rt=cy-r1;
    band(tb); if(rt-tb>=10) g.rune(cx-1,tb+3+((rt-tb-8)>>1),0);
    const lb1=cy+r1+2, lb2=yb-3; band(lb1); band(lb2);
    if(lb2-lb1>=18){ g.rune(cx-1,lb1+3,1); g.rune(cx-1,lb1+10,2); } else if(lb2-lb1>=9) g.rune(cx-1,lb1+3+((lb2-lb1-8)>>1),3);
    g.seam(cx-hwb,cx+hwb,tb+7,shL); },

  lantern(g){ const {W,H,cx}=g; let y=H;
    const slab=(w,hh,p)=>{ y-=hh; g.rect(cx-shrA(w/2),y,cx+shrA(w/2),y+hh-1,p); };
    const s1=g.part('rock'), s2=g.part('rock'), post=g.part('rock'), col=g.part('mid'), plat=g.part('rock'), fire=g.part('rock'), win=g.part('lit'),
      r1=g.part('mid'), neck=g.part('rock'), t2=g.part('rock'), w2=g.part('lit'), r2=g.part('mid'), fin=g.part('rock'), tip=g.part('accent',{t:3});
    const sh=Math.max(3,shrA(H*0.055));
    slab(W*0.92,sh,s1); slab(W*0.64,sh,s2);
    const postH=shrA(H*0.07); slab(W*0.22,postH,post); const postY=y;
    slab(W*0.34,Math.max(2,shrA(H*0.035)),col); slab(W*0.74,Math.max(2,shrA(H*0.045)),plat);
    const fh=shrA(H*0.24), fw=shrA(W*0.46/2); slab(W*0.46,fh,fire); const fy=y, ins=Math.max(2,shrA(W*0.035));
    const wy0=fy+ins, wy1=fy+fh-1-ins, wh=wy1-wy0+1;
    g.rect(cx-fw+ins,wy0,cx+fw-ins,wy1,win); g.parts[win].rad=wh*1.1;
    g.orb=[cx,shrA((wy0+wy1)/2)]; g.orbR=[Math.max(2,shrA(wh*0.22)),Math.max(3,shrA(wh*0.38))];
    const rh=shrA(H*0.12); y-=rh; g.taper(y,y+rh-1,W*0.2,W*0.47,r1,1.7); const r1b=y+rh-1, r1hw=shrA(W*0.47);
    slab(W*0.2,Math.max(2,shrA(H*0.035)),neck);
    const th=shrA(H*0.08); slab(W*0.3,th,t2); g.rect(cx-1,y+2,cx,y+th-3,w2); g.parts[w2].rad=th*1.5;
    const rh2=shrA(H*0.08); y-=rh2; g.taper(y,y+rh2-1,W*0.1,W*0.33,r2,1.7); const r2b=y+rh2-1, r2hw=shrA(W*0.33);
    const br=Math.max(2,shrA(W*0.04)); const by=y-1-br; g.ell(cx,by,br,br,fin);
    g.taper(0,Math.max(1,by-br-1),0,1,tip,1.6);
    const trim=(yy,hw)=>{ const pts=[]; for(let x=cx-hw+1;x<=cx+hw-1;x++) pts.push([x,yy]); g.glyphs.push(pts); };
    trim(r1b,Math.max(3,Math.round(r1hw*0.9))); trim(r2b,Math.max(3,Math.round(r2hw*0.9)));
    if(postH>=7) g.rune(cx-1,postY+((postH-5)>>1),1);
    g.seam(cx-shrA(W*0.37),cx+shrA(W*0.37),fy-1,plat); },

  arch(g){ const {W,H,cx}=g, sh=Math.max(3,shrA(H*0.07)), yb=H-2*sh, ks=3, nz=g.nz;
    const ringP=g.part('rock'), pl1=g.part('rock'), pl2=g.part('rock'), key=g.part('mid');
    const Ro=Math.min(shrA(W*0.47),shrA((yb+3-ks)/2)), cy=ks+Ro, t=Math.max(4,shrA(Ro*0.23));
    g.orb=[cx,cy]; g.orbR=[shrA(Ro*0.12)+1,shrA(Ro*0.2)+2];
    const inRing=(x,y)=>{ const dx=x-cx, dy=y-cy, d=Math.hypot(dx,dy); if(d>Ro+0.5||d<Ro-t-0.5) return false;
      const a=Math.atan2(dy,dx)*180/Math.PI, j=nz.n2(d/3,1)*12; return !(a>20+j&&a<52+j*0.6); };
    g.where(cx-Ro-1,ks,cx+Ro+1,ks+2*Ro+1,inRing,ringP);
    g.rect(shrA(W*0.08),H-sh,W-1-shrA(W*0.08),H-1,pl1); g.rect(shrA(W*0.2),yb,W-1-shrA(W*0.2),H-sh-1,pl2);
    g.rect(cx-(t>>1)-2,0,cx+(t>>1)+2,ks+t,key);
    const sect=[[],[],[],[],[],[]];
    for(let y=ks;y<yb;y++) for(let x=cx-Ro;x<=cx+Ro;x++){ const dx=x-cx, dy=y-cy, d=Math.hypot(dx,dy);
      if(g.get(x,y)===ringP&&d>=Ro-t-0.5&&d<Ro-t+1.6){ const a=Math.atan2(dy,dx); sect[Math.min(5,Math.floor((a+Math.PI)/(Math.PI/3)))].push([x,y]); } }
    sect.forEach(s=>{ if(s.length>2) g.glyphs.push(s); });
    g.rune(cx-1,ks+((t-3)>>1)+1,0);
    for(const a of [Math.PI,Math.PI*0.25*5,Math.PI*1.75,Math.PI*0.75]){ const rm=Ro-t*0.55+1; g.rune(shrA(cx+Math.cos(a)*rm)-1,shrA(cy+Math.sin(a)*rm)-2,shrA(a*2)); }
    const rb=pl2; g.seam(shrA(W*0.2),W-1-shrA(W*0.2),yb+sh-2,rb); },

  circle(g){ const {W,H,cx}=g, rng=g.rng, sh=Math.max(3,shrA(H*0.08)), yb=H-sh, bw=shrA(W*0.25), bx0=shrA(W*0.08);
    const s1=g.part('rock'), s2=g.part('rock'), stL=g.part('rock',{shade:'cyl'}), stR=g.part('rock',{shade:'cyl'}), capP=g.part('mid'), gem=g.part('accent',{t:3});
    g.orb=[cx,shrA(H*0.5)]; g.orbR=[shrA(H*0.06)+1,shrA(H*0.1)+1];
    g.rect(shrA(W*0.03),yb,W-1-shrA(W*0.03),H-1,s1); g.rect(shrA(W*0.07),yb-Math.max(2,shrA(H*0.045)),W-1-shrA(W*0.07),yb-1,s2);
    const base=yb-Math.max(2,shrA(H*0.045));
    const menhir=(x0,ytop,lean,flip,p)=>{ const j=()=>ri(rng,0,2), q=[[x0,base],[x0+lean*3+1,ytop+bw*0.55+j()],[x0+lean*4+bw*0.3,ytop+3],[x0+lean*4+bw*0.65,ytop+j()],[x0+lean*4+bw*0.95,ytop+bw*0.32],[x0+bw,base]];
      g.poly(flip?q.map(a=>[W-a[0],a[1]]):q,p); };
    const yTL=shrA(H*0.2), yTR=shrA(H*0.3);
    menhir(bx0,yTL,-1,false,stL); menhir(bx0+0,yTR,-1,true,stR);
    const cw=shrA(W*0.36), cy0=shrA(H*0.05), cy1=cy0+shrA(H*0.16);
    g.poly([[cx-cw/2,cy1-2],[cx-cw/2+1,cy0+3],[cx-cw/4,cy0],[cx+cw/8,cy0+1],[cx+cw/2-3,cy0+1],[cx+cw/2,cy0+5],[cx+cw/2-4,cy1],[cx,cy1+1],[cx-cw/3,cy1]],capP);
    g.rect(cx-2,cy1-1,cx+1,cy1,gem);
    const lx=bx0+bw-5, rx=W-bx0-bw+2;
    for(let y=Math.min(yTL,yTR)+12,i=0;y<base-10;y+=9,i++){ g.rune(lx,y,i); g.rune(rx,y,i+2); }
    g.vein(bx0+3,yTL+6,base-yTL-12,0); g.vein(W-bx0-4,yTR+6,base-yTR-12,0); g.vein(bx0+bw-8,yTL+14,Math.max(6,base-yTL-24),0); },

  crystal(g){ const {W,H,cx}=g, nz=g.nz, mh=shrA(H*0.3);
    g.orb=[cx,shrA(H*0.4)]; g.orbR=[shrA(W*0.05)+1,shrA(W*0.09)+2];
    const crys=(xc,yb,bw,tip,ysh,tilt,t0)=>{ const pL=g.part('accent',{t:t0}), pM=g.part('accent',{t:t0-1}), pR=g.part('accent',{t:Math.max(0,t0-2)});
      for(let y=tip;y<=yb;y++){ const hw=(y>=ysh?bw/2:bw/2*(y-tip+1)/(ysh-tip+1)), sx=shrA(tilt*(yb-y)/(yb-tip)), c=xc+sx, r=shrA(hw);
        for(let x=c-r;x<=c+r;x++){ const u=r?(x-c)/r:0; g.set(x,y,u<-0.34?pL:u<0.34?pM:pR); } } };
    const yb0=H-shrA(mh*0.5);
    crys(cx,yb0,shrA(W*0.26),0,shrA(H*0.34),0,3);
    crys(cx-shrA(W*0.27),yb0,shrA(W*0.17),shrA(H*0.24),shrA(H*0.46),-shrA(W*0.07),3);
    crys(cx+shrA(W*0.26),yb0,shrA(W*0.16),shrA(H*0.32),shrA(H*0.52),shrA(W*0.08),3);
    crys(cx-shrA(W*0.4),yb0,shrA(W*0.11),shrA(H*0.55),shrA(H*0.65),-shrA(W*0.05),3);
    crys(cx+shrA(W*0.4),yb0,shrA(W*0.11),shrA(H*0.5),shrA(H*0.62),shrA(W*0.05),3);
    crys(cx+shrA(W*0.14),yb0,shrA(W*0.1),shrA(H*0.52),shrA(H*0.62),-3,3);
    crys(cx-shrA(W*0.15),yb0,shrA(W*0.09),shrA(H*0.58),shrA(H*0.67),3,3);
    const mound=g.part('rock'), m1=shrA(W*0.03), top=[];
    for(let x=m1;x<W-m1;x++){ const u=(x-cx)/(W/2-m1), e=Math.pow(Math.max(0,1-u*u),0.55)*(0.85+0.3*nz.fbm(x/6,2,3)); top[x]=Math.min(H-3,H-shrA(mh*e)); g.rect(x,top[x],x,H-1,mound); }
    g.glints.push([cx-shrA(W*0.07),shrA(H*0.2)],[cx-shrA(W*0.07),shrA(H*0.55)],[cx-shrA(W*0.27)-2,shrA(H*0.42)],[cx+shrA(W*0.26),shrA(H*0.5)],[cx+shrA(W*0.14)-1,shrA(H*0.58)]);
    const my=top[cx]+Math.max(2,(H-top[cx]-5)>>1)+0;
    g.rune(cx-1,my,0); if(W>=60){ g.rune(cx-10,my,2); g.rune(cx+8,my,1); }
    g.vein(cx-shrA(W*0.3),top[cx-shrA(W*0.3)]+2,8,0); g.vein(cx+shrA(W*0.28),top[cx+shrA(W*0.28)]+2,8,0); },

  totem(g){ const {W,H,cx}=g, sh=Math.max(3,shrA(H*0.055));
    const s1=g.part('rock'), s2=g.part('rock'), wing=g.part('rock'), horn=g.part('rock'), bA=g.part('rock'), bB=g.part('rock'), bC=g.part('rock'), hat=g.part('rock');
    const mouth=g.part('dark',{bias:-0.7,moss:false}), tooth=g.part('accent',{t:3,flat:true}), ring=g.part('mid'), eye=g.part('lit'), slit=g.part('accent',{t:3,flat:true}), brow=g.part('dark',{bias:-0.5,moss:false});
    let y=H; const slab=(w,hh,p)=>{ y-=hh; g.rect(cx-shrA(w/2),y,cx+shrA(w/2),y+hh-1,p); return y; };
    slab(W*0.96,sh,s1); slab(W*0.82,sh,s2);
    const ah=shrA(H*0.24), aw=W*0.74, ay=slab(aw,ah,bA);
    const bh=shrA(H*0.32), bwd=W*0.6, by=slab(bwd,bh,bB);
    const ch=shrA(H*0.18), cwd=W*0.44, cyy=slab(cwd,ch,bC);
    const re=Math.min(shrA(H*0.15),shrA(bwd/2*0.8)), ecy=by+(bh>>1);
    g.orb=[cx,ecy]; g.orbShape='round'; const ri2=re-2; g.parts[eye].rad=ri2*2.2; g.orbR=[shrA(ri2*0.72),shrA(ri2*0.72)];
    g.ell(cx,ecy,re,re,ring); g.ell(cx,ecy,ri2,ri2,eye);
    g.rect(cx-shrA(bwd/2)+1,ecy-re-3,cx+shrA(bwd/2)-1,ecy-re-2,brow);
    const bx0=cx-shrA(bwd/2), wl=shrA(W*0.14);
    g.mir=true; g.poly([[bx0+1,by+bh*0.55],[bx0-wl,by+bh*0.12],[bx0-wl,by+bh*0.3],[bx0+1,by+bh*0.88]],wing); g.mir=false;
    const cL=cx-shrA(cwd/2), hh=shrA(H*0.1);
    g.mir=true; g.poly([[cL,cyy],[cL+3,cyy],[cL-shrA(W*0.04)+1,cyy-hh]],horn); g.mir=false;
    g.taper(0,cyy-1,0,shrA(cwd/2)-1,hat,1);
    const mw=shrA(aw*0.5/2), mh=Math.max(4,shrA(ah*0.4)), my=ay+shrA(ah*0.42);
    g.rect(cx-mw,my,cx+mw,my+mh-1,mouth);
    for(let x=cx-mw+1;x<=cx+mw-1;x+=2){ g.rect(x,my,x,my+1,tooth); g.rect(x+1,my+mh-2,x+1,my+mh-1,tooth); }
    const ew=Math.max(2,shrA(cwd*0.14)), ey=cyy+shrA(ch*0.4);
    g.rect(cx-shrA(cwd*0.26)-ew+1,ey,cx-shrA(cwd*0.26),ey+1,slit); g.rect(cx+shrA(cwd*0.26),ey,cx+shrA(cwd*0.26)+ew-1,ey+1,slit);
    const rl=cx-mw-4, rr=cx+mw+2;
    if(ah>=16){ g.rune(rl,ay+shrA(ah*0.2),1); g.rune(rr,ay+shrA(ah*0.2),3); }
    g.seam(cx-shrA(aw/2),cx+shrA(aw/2),ay+ah-3,bA); g.seam(cx-shrA(bwd/2),cx+shrA(bwd/2),by+bh-3,bB);
    g.rune(cx-1,cyy-3,0); },

  fountain(g){ const {W,H,cx}=g, sh=Math.max(3,shrA(H*0.05));
    const s1=g.part('rock'), s2=g.part('rock'), ped=g.part('rock'), body=g.part('rock'), water=g.part('lit'), stem=g.part('rock'), bowlU=g.part('rock'), waterU=g.part('lit'), prong=g.part('rock'), flow=g.part('accent',{t:3,flat:true});
    let y=H; const slab=(w,hh,p)=>{ y-=hh; g.rect(cx-shrA(w/2),y,cx+shrA(w/2),y+hh-1,p); };
    slab(W*0.96,sh,s1); slab(W*0.8,sh,s2);
    const pedH=shrA(H*0.09); slab(W*0.46,pedH,ped); const pedY=y;
    const ryE=Math.max(3,shrA(H*0.045)), bh=shrA(H*0.16), rx=shrA(W*0.47), yr=y-bh;
    g.ell(cx,yr,rx,ryE,body); g.taper(yr,y-1,rx,shrA(W*0.26),body,0.7);
    g.ell(cx,yr,rx-3,ryE-1,water); g.parts[water].c=[cx,yr]; g.parts[water].rad=rx*1.1;
    const stemH=shrA(H*0.16); g.rect(cx-shrA(W*0.06),yr-stemH,cx+shrA(W*0.06),yr,stem);
    const yu=yr-stemH, rxu=shrA(W*0.24), ryU=Math.max(2,ryE-1), bhu=shrA(H*0.07);
    g.ell(cx,yu,rxu,ryU,bowlU); g.taper(yu,yu+bhu,rxu,shrA(W*0.1),bowlU,0.7);
    g.ell(cx,yu,rxu-2,ryU-1,waterU); g.parts[waterU].c=[cx,yu]; g.parts[waterU].rad=rxu*1.2;
    const pts=[]; for(let i=0;i<=24;i++){ const t=i/24; pts.push([rxu-1-(rxu-1)*Math.pow(t,2.2),yu-(yu-2)*t]); }
    for(let i=0;i<24;i++){ for(const sg of [-1,1]) g.seg(cx+sg*pts[i][0],pts[i][1],cx+sg*pts[i+1][0],pts[i+1][1],2,prong); }
    g.rect(cx-1,0,cx+1,2,prong);
    const oy=shrA(yu*0.5); g.orb=[cx,oy]; g.orbR=[shrA(W*0.07)+1,shrA(H*0.075)+1];
    for(const sg of [-1,1]) for(let yy=yu+ryU+1;yy<yr-ryE+2;yy++) if(yy%3!==0) g.set(cx+sg*(rxu-3),yy,flow);
    g.glints.push([cx-shrA(rx*0.5),yr-1],[cx+shrA(rx*0.45),yr],[cx+shrA(rxu*0.4),yu-1]);
    if(pedH>=7){ g.rune(cx-1,pedY+((pedH-5)>>1),2); g.rune(cx-8,pedY+((pedH-5)>>1),0); g.rune(cx+6,pedY+((pedH-5)>>1),3); }
    g.seam(cx-shrA(W*0.23),cx+shrA(W*0.23),pedY+pedH-2,ped); },

  helm(g){ const {W,H,cx}=g, nz=g.nz, Rt=Math.min(shrA(W/2)-1,shrA(H*0.44)), cy=Rt, hl=Math.max(3,shrA(Rt*0.13)), Rr=Rt-hl, tr=Math.max(3,shrA(Rr*0.14));
    const spoke=g.part('mid'), rim=g.part('mid'), hand=g.part('mid'), hub=g.part('mid'), hubL=g.part('lit'), block=g.part('rock');
    const hr=Math.max(6,shrA(Rr*0.26)); g.orb=[cx,cy]; g.orbR=[Math.max(2,shrA((hr-2)*0.7)),Math.max(3,shrA((hr-2)*0.95))]; g.parts[hubL].rad=hr*2.4;
    for(let k=0;k<8;k++){ const a=k*Math.PI/4, c=Math.cos(a), s=Math.sin(a);
      g.seg(cx+c*hr*0.6,cy+s*hr*0.6,cx+c*(Rr-tr*0.5),cy+s*(Rr-tr*0.5),Math.max(3,tr-1),spoke); }
    g.where(cx-Rr-1,cy-Rr-1,cx+Rr+1,cy+Rr+1,(x,y)=>{ const d=Math.hypot(x-cx,y-cy); return d<=Rr+0.5&&d>=Rr-tr+0.5; },rim);
    for(let k=0;k<8;k++){ const a=k*Math.PI/4, c=Math.cos(a), s=Math.sin(a);
      g.seg(cx+c*(Rr-1),cy+s*(Rr-1),cx+c*(Rt-1),cy+s*(Rt-1),Math.max(3,tr-1),hand); g.ell(cx+c*(Rt-2),cy+s*(Rt-2),1,1,hand); }
    g.ell(cx,cy,hr,hr,hub); g.ell(cx,cy,hr-2,hr-2,hubL);
    const sect=[[],[],[],[]];
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ if(g.get(x,y)!==rim) continue; const d=Math.hypot(x-cx,y-cy), a=Math.atan2(y-cy,x-cx);
      if(d>=Rr-tr+0.5&&d<Rr-tr+1.8) sect[Math.floor((a+Math.PI)/(Math.PI/2))&3].push([x,y]); }
    const ytop=cy+shrA(Rr*0.3), m1=shrA(W*0.03), top=[];
    for(let x=m1;x<W-m1;x++){ const u=(x-cx)/(W/2-m1), e=Math.pow(Math.max(0,1-Math.pow(Math.abs(u),2.2)),0.5), bump=shrA(5*Math.exp(-Math.pow((x-(cx-W*0.28))/(W*0.1),2))+3*nz.fbm(x/5,1,3));
      top[x]=Math.min(H-3,ytop-bump+shrA((1-e)*(H-ytop)*0.9)); g.rect(x,top[x],x,H-1,block); }
    sect.forEach(s=>{ const f=s.filter(q=>g.get(q[0],q[1])===rim); if(f.length>2) g.glyphs.push(f); });
    const my=top[cx]+Math.max(2,(H-top[cx]-5)>>1);
    g.rune(cx-1,my,3); if(W>=70){ g.rune(cx-10,my,0); g.rune(cx+8,my,2); }
    g.vein(cx-shrA(W*0.3),top[cx-shrA(W*0.3)]+2,8,0); g.vein(cx+shrA(W*0.25),top[cx+shrA(W*0.25)]+2,8,0); },

  clam(g){ const {W,H,cx}=g, hy=shrA(H*0.6), rx=shrA(W*0.47), ry=hy-1;
    const up=g.part('rock'), inUp=g.part('lit'), lo=g.part('mid'), inLo=g.part('lit');
    const rOrb=shrA(H*0.075)+1; g.orb=[cx,hy-shrA(H*0.12)]; g.orbShape='round'; g.orbR=[rOrb,rOrb]; g.parts[inUp].rad=rx*0.95; g.parts[inLo].rad=rx*0.95;
    const sc=(x,y,rr,ryy)=>{ const dx=(x-cx)/rr, dy=(y-hy)/ryy, d=Math.sqrt(dx*dx+dy*dy), a=Math.atan2(y-hy,x-cx); return d/(1+0.06*Math.cos(a*8)); };
    g.where(cx-rx-1,0,cx+rx+1,hy+1,(x,y)=>y<=hy&&sc(x,y,rx+0.5,ry+0.5)<=1,up);
    const rim=Math.max(5,shrA(rx*0.14));
    g.where(cx-rx-1,0,cx+rx+1,hy+1,(x,y)=>y<=hy-1&&sc(x,y,rx-rim+0.5,ry-rim+0.5)<=1,inUp);
    const yc=hy-2, rx2=shrA(W*0.5)-1, ryl=Math.max(4,shrA(H*0.06)), ry2=(H-1-yc)/0.78;
    g.where(cx-rx2-1,yc,cx+rx2+1,H-1,(x,y)=>{ const u=(x-cx)/(rx2+0.5), v=(y-yc)/(ry2+0.5); return u*u+v*v<=1; },lo);
    g.ell(cx,yc,rx2,ryl,lo); g.ell(cx,yc,rx2-4,ryl-2,inLo);
    for(let k=-6;k<=6;k++){ const a=-Math.PI/2+k*0.25, c=Math.cos(a), s=Math.sin(a);
      g.rib(cx+c*(rx-rim),hy+s*(ry-rim),cx+c*(rx+1),hy+s*(ry+1),up);
      g.post.push({k:'a',x0:cx+c*(rx*0.35),y0:hy+s*(ry*0.35),x1:cx+c*(rx-rim-1),y1:hy+s*(ry-rim-1),p:inUp}); }
    for(let k=-4;k<=4;k++){ if(Math.abs(k)<=1) continue; const xl=cx+k*rx2*0.22; g.rib(xl,yc+ryl+1,cx+(xl-cx)*0.78,H-2,lo); }
    const gy=yc+ryl+Math.max(2,(H-1-yc-ryl-5)>>1);
    g.rune(cx-1,gy,1); if(W>=76){ g.rune(cx-9,gy,3); g.rune(cx+7,gy,0); }
    g.glints.push([cx-shrA(rx*0.45),hy-shrA(ry*0.35)],[cx+shrA(rx*0.5),hy-shrA(ry*0.25)],[cx-shrA(rx*0.2),hy-shrA(ry*0.75)],[cx+shrA(rx*0.2),yc]); }
};

function makeShrineStone(design,step,accent){
  const di=SHRINE_DESIGNS.indexOf(design), H=SHR_H[step], lo=SHR_WLO[step], hi=SHR_WHI[step];
  let W=Math.round(lo+(hi-lo)*SHR_WF[design]); if(!(W&1)) W+=W<hi?1:-1; const g=shrGrid(W,H,7000+di*101+step*13), R=PAL.rock, M=PAL.moss, MR=PAL.midRock, A5=shrRamp(accent), nz=g.nz, rng=g.rng;
  SHR_DRAW[design](g);
  const {id,parts}=g, cv=mkCanvas(W,H), mask=new Uint8Array(W*H), at=(x,y)=>g.get(x,y);
  const bb=parts.map(()=>[1e9,1e9,-1e9,-1e9]);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const p=id[y*W+x]; if(!p) continue; mask[y*W+x]=1; const b=bb[p];
    if(x<b[0])b[0]=x; if(y<b[1])b[1]=y; if(x>b[2])b[2]=x; if(y>b[3])b[3]=y; }
  paint(cv,(x,y)=>{ const p=at(x,y); if(!p) return null; const P=parts[p], m=P.mat, b=bb[p];
    if(m==='lit'){ const c=P.c||g.orb, d=Math.hypot(x-c[0],(y-c[1])*0.8), v=Math.max(0,1-d/(P.rad||30));
      return v>0.8?A5[4]:v>0.62?A5[3]:v>0.45?A5[2]:v>0.3?A5[1]:v>0.15?A5[0]:R[0]; }
    const up=at(x,y-1), lf=at(x-1,y), rt=at(x+1,y), dn=at(x,y+1), acc=m==='accent';
    const lit=acc?A5[Math.min(4,P.t+2)]:(m==='mid'?MR[3]:R[3]), drk=acc?A5[0]:R[0];
    if(up===0){ if(!acc&&P.moss!==false&&m!=='mid'&&nz.n2(x/4,3.3)<0.55) return nz.n2(x/2,8)<0.5?M[1]:M[0]; return lit; }
    if(up<p) return lit; if(up>p) return drk;
    if(lf===0||lf<p) return lit; if(lf>p) return drk;
    if(rt===0||rt>p||dn===0||dn>p) return drk;
    if(acc){ const ty=(y-b[1])/(b[3]-b[1]+1); return rampAt(A5,P.flat?P.t/4:(P.t+(1-ty)*0.9-0.3)/4,x,y); }
    const bx=(x-b[0])/(b[2]-b[0]+1), bias=(P.bias||0)+(P.shade==='cyl'?0.14-0.34*bx:0)+0.06*(1-x/W)-0.04*y/H;
    const s=nz.fbm(x/9,y/4,3)+bias, ramp=m==='mid'?MR:R;
    return s>0.66?ramp[3]:s>0.55?ramp[2]:s>0.42?ramp[1]:ramp[0]; });
  const solid=p=>p&&(parts[p].mat==='rock'||parts[p].mat==='mid'||parts[p].mat==='dark')&&parts[p].moss!==false;
  for(const o of g.post){
    if(o.k==='h'){ for(let x=o.x0;x<=o.x1;x++){ if(at(x,o.y)===o.p) px(cv.x,x,o.y,R[0]); if(at(x,o.y+1)===o.p) px(cv.x,x,o.y+1,R[2]); } }
    else { const n=Math.max(Math.abs(o.x1-o.x0),Math.abs(o.y1-o.y0))||1;
      for(let i=0;i<=n;i++){ const x=shrA(o.x0+(o.x1-o.x0)*i/n), y=shrA(o.y0+(o.y1-o.y0)*i/n);
        if(o.k==='a'){ if(at(x,y)===o.p&&i%3!==2) px(cv.x,x,y,A5[1]); continue; }
        if(at(x,y)===o.p) px(cv.x,x,y,R[0]); if(at(x+1,y)===o.p) px(cv.x,x+1,y,R[2]); } } }
  for(let k=0;k<Math.round(W*H/255);k++){ let x=ri(rng,1,W-2), y=ri(rng,1,H-3); const p=at(x,y); if(!solid(p)) continue; const n=ri(rng,2,5);
    for(let i=0;i<n&&at(x,y+i)===p;i++) px(cv.x,x,y+i,i<n-1?M[0]:M[1]); }
  for(let k=0;k<Math.round(W*H/600);k++){ let x=ri(rng,2,W-3), y=ri(rng,4,H-8); const n=ri(rng,4,9);
    for(let i=0;i<n;i++){ const p=at(x,y); if(solid(p)&&at(x,y-1)===p) px(cv.x,x,y,R[0]); x+=ri(rng,-1,1); y++; } }
  for(const gl of g.glyphs) for(const q of gl) px(cv.x,q[0],q[1],A5[1]);
  let tx=g.cx, ty=0; while(ty<H&&!at(tx,ty)) ty++;
  if(ty>=H){ ty=0; tx=g.cx; }
  cv.mask=mask; cv.orb=g.orb; cv.top=[tx,ty]; cv.name=design; cv.step=step;
  cv.glyphs=g.glyphs; cv.glints=g.glints; cv.orbR=g.orbR; cv.orbShape=g.orbShape;
  return cv; }

function makeShrineGlow(stone,accent,frames=6){
  const A5=shrRamp(accent), G=Math.round(0.7*Math.max(stone.w,stone.h))*2, C=G>>1, ox=C-stone.orb[0], oy=C-stone.orb[1], out=[];
  const masked=(x,y)=>{ const sx=x-ox, sy=y-oy; return sx>=0&&sy>=0&&sx<stone.w&&sy<stone.h&&stone.mask[sy*stone.w+sx]===1; };
  const [orx,ory]=stone.orbR, round=stone.orbShape==='round';
  for(let f=0;f<frames;f++){ const ph=f/frames*Math.PI*2, cv=mkCanvas(G,G), pulse=0.5+0.5*Math.sin(ph), RR=G*0.37+G*0.035*pulse;
    paint(cv,(x,y)=>{ const d=Math.hypot(x-C,(y-C)*1.05); if(d>=RR||d<2||masked(x,y)) return null;
      const v=1-d/RR, wave=0.5+0.5*Math.cos((d/(G*0.1)-f/frames)*Math.PI*2);
      if(bayer(x,y)>=Math.pow(v,1.35)*(0.6+0.55*wave)) return null;
      return d<G*0.13?PAL.sun[2]:d<G*0.22?A5[3]:bayer(x+2,y+1)>0.5?A5[2]:PAL.caustic[1]; });
    stone.glyphs.forEach((gl,i)=>{ const b=Math.sin(ph-i*0.8), col=b>0.55?PAL.caustic[0]:b>-0.2?A5[3]:A5[2];
      for(const q of gl) px(cv.x,q[0]+ox,q[1]+oy,col); });
    stone.glints.forEach((q,i)=>{ const b=Math.sin(ph+i*2.1); if(b<0.7) return; const x=q[0]+ox, y=q[1]+oy;
      px(cv.x,x,y,PAL.sun[2]); if(b>0.9){ px(cv.x,x-1,y,PAL.caustic[0]); px(cv.x,x+1,y,PAL.caustic[0]); px(cv.x,x,y-1,PAL.caustic[0]); px(cv.x,x,y+1,PAL.caustic[0]); } });
    for(let k=0;k<8;k++){ const b=Math.sin(ph+k*1.7); if(b<0.55) continue; const a=k*2.399, rr=G*(0.14+0.2*((k*0.618)%1)), x=Math.round(C+Math.cos(a)*rr), y=Math.round(C+Math.sin(a)*rr*0.9);
      if(masked(x,y)) continue; px(cv.x,x,y,b>0.85?PAL.sun[2]:A5[3]); }
    const oh=Math.round(pulse*ory*0.2);
    paint(cv,(x,y)=>{ const dx=x-C, dy=y-C-Math.round(Math.sin(ph)), q=round?Math.hypot(dx/(orx+0.5),dy/(ory+0.5+oh*0.5)):Math.abs(dx)/(orx+0.5)+Math.abs(dy)/(ory+oh+0.5);
      if(q>1) return null; if(q>0.82) return A5[1]; if(dx<0&&dy<0&&q<0.5) return PAL.sun[2];
      return dx<=0?A5[4]:(dy>0?A5[2]:A5[3]); });
    out.push(cv); }
  return out; }
