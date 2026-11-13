/* ANGLE: конфетти как из хлопушки. AngleConfetti.burst() — два выстрела снизу, серпантин и золотой дождь сверху. */
(function(){
if(window.AngleConfetti)return;
var last=0,running=false;
var COLORS=['#FF3D7F','#FED500','#19B5FE','#8BE000','#FF8A00','#B04DFF','#00D1B2','#FF4B2B','#5E4877'];
var GOLD=['#F6C445','#D9A21B','#FFE08A','#B8801A'];
function rnd(a,b){return a+Math.random()*(b-a)}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function star(c,r){c.beginPath();for(var i=0;i<10;i++){var a=Math.PI/5*i-Math.PI/2,d=i%2?r*.45:r;c[i?'lineTo':'moveTo'](Math.cos(a)*d,Math.sin(a)*d)}c.closePath();c.fill()}
function burst(){
  var now=Date.now();if(now-last<1500)return;last=now;
  try{if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return}catch(e){}
  if(running)return;running=true;
  var cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');
  cv.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000';
  document.body.appendChild(cv);
  var dpr=Math.min(window.devicePixelRatio||1,2),W=window.innerWidth,H=window.innerHeight;
  cv.width=W*dpr;cv.height=H*dpr;var c=cv.getContext('2d');c.scale(dpr,dpr);
  var small=W<600,P=[],S=[],t0=performance.now();
  function shot(x,dir,n,delay){
    for(var i=0;i<n;i++){
      var ang=-Math.PI/2+dir*rnd(.12,.75)+rnd(-.12,.12),sp=rnd(small?9:11,small?19:25),g=Math.random()<.22;
      P.push({x:x,y:H+8,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,w:rnd(9,17),h:rnd(6,11),r:rnd(0,6.3),vr:rnd(-.3,.3),flip:rnd(0,6.3),fs:rnd(.15,.4),
        shape:pick(['rect','rect','rect','dot','star','strip']),col:g?pick(GOLD):pick(COLORS),delay:delay,life:rnd(2.6,3.8),age:0})
    }
  }
  function rain(n,delay){
    for(var i=0;i<n;i++){var g=Math.random()<.4;
      P.push({x:rnd(0,W),y:rnd(-H*.35,-10),vx:rnd(-.8,.8),vy:rnd(1.5,3.5),w:rnd(8,15),h:rnd(6,10),r:rnd(0,6.3),vr:rnd(-.2,.2),flip:rnd(0,6.3),fs:rnd(.1,.3),
        shape:pick(['rect','dot','dot','star','strip']),col:g?pick(GOLD):pick(COLORS),delay:delay+rnd(0,.7),life:rnd(2.4,3.6),age:0,rainy:1})}
  }
  function streamer(x,dir,delay){
    var ang=-Math.PI/2+dir*rnd(.2,.6),sp=rnd(small?10:12,small?16:22);
    S.push({x:x,y:H+8,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,col:pick(COLORS),len:rnd(70,120),wid:rnd(5,8),ph:rnd(0,6.3),delay:delay,age:0,life:3.2,trail:[]});
  }
  var n=small?55:90;
  shot(-4,1,n,0);shot(W+4,-1,n,0);shot(-4,1,Math.round(n*.6),.35);shot(W+4,-1,Math.round(n*.6),.35);
  for(var i=0;i<(small?3:5);i++){streamer(-4,1,rnd(0,.25));streamer(W+4,-1,rnd(0,.25))}
  rain(small?50:100,.3);
  var prev=t0;
  function frame(){
    var ts=performance.now(),dt=Math.max(.2,Math.min((ts-prev)/16.67,2.5));prev=ts;var el=(ts-t0)/1000;
    c.clearRect(0,0,W,H);var alive=0;
    for(var i=0;i<S.length;i++){var s=S[i];if(el<s.delay){alive++;continue}s.age+=dt/60;
      if(s.age>s.life)continue;alive++;
      s.vx*=Math.pow(.965,dt);s.vy=s.vy*Math.pow(.965,dt)+.28*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;
      s.trail.push([s.x,s.y]);var lim=Math.round(s.len/4);if(s.trail.length>lim)s.trail.shift();
      c.lineCap='round';c.strokeStyle=s.col;
      for(var k=1;k<s.trail.length;k++){var a=s.trail[k-1],b=s.trail[k],f=k/s.trail.length,o=Math.sin(k*.9+s.ph+s.age*8)*7*f;
        c.globalAlpha=Math.min(1,(s.life-s.age)*1.5)*(.25+.75*f);c.lineWidth=s.wid*(.4+.6*f);
        c.beginPath();c.moveTo(a[0]+o,a[1]);c.lineTo(b[0]+Math.sin((k+1)*.9+s.ph+s.age*8)*7*f,b[1]);c.stroke()}
    }
    for(var j=0;j<P.length;j++){var p=P[j];if(el<p.delay){alive++;continue}p.age+=dt/60;if(p.age>p.life)continue;alive++;
      if(p.rainy){p.vy=Math.min(p.vy+.03*dt,4.2);p.vx+=Math.sin(p.age*5+p.flip)*.04*dt}
      else{p.vx*=Math.pow(.955,dt);p.vy=p.vy*Math.pow(.955,dt)+.34*dt}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;p.flip+=p.fs*dt;
      c.globalAlpha=Math.max(0,Math.min(1,(p.life-p.age)*1.6));c.fillStyle=p.col;
      c.save();c.translate(p.x,p.y);c.rotate(p.r);
      if(p.shape==='dot'){c.beginPath();c.arc(0,0,p.w*.4,0,6.3);c.fill()}
      else if(p.shape==='star'){star(c,p.w*.7)}
      else if(p.shape==='strip'){c.scale(1,Math.cos(p.flip));c.fillRect(-p.w*.9,-1.5,p.w*1.8,3)}
      else{c.scale(1,Math.cos(p.flip));c.fillRect(-p.w/2,-p.h/2,p.w,p.h)}
      c.restore()}
    c.globalAlpha=1;
    if(alive>0&&el<6)requestAnimationFrame(frame);else{cv.remove();running=false}
  }
  requestAnimationFrame(frame);
}
window.AngleConfetti={burst:burst,recent:function(ms){return Date.now()-last<ms}};
})();
