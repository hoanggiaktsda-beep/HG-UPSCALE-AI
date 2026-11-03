/* Visible Gemini logo only. Alpha captures credited in licenses/gemini-templates-MIT.txt.
   Reverse compositing preserves the underlying texture instead of painting a rectangle. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HGLogo=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  function decode(bank){
    return Object.entries(bank).map(([id,v])=>{
      const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(v.base64,'base64')):Uint8Array.from(atob(v.base64),c=>c.charCodeAt(0));
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),alpha=new Float32Array(v.size*v.size);
      for(let i=0;i<alpha.length;i++)alpha[i]=Math.max(0,view.getFloat32(i*4,true));
      return {id,size:v.size,alpha};
    });
  }
  const lum=(d,i)=>(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722);
  function features(t,step){
    const points=[],s=t.size;
    for(let y=1;y<s-1;y+=step)for(let x=1;x<s-1;x+=step){
      const i=y*s+x,a=t.alpha[i];
      points.push({x,y,a,e:a-(t.alpha[i-1]+t.alpha[i+1]+t.alpha[i-s]+t.alpha[i+s])/4});
    }
    return points;
  }
  function measure(image,t,x,y,points){
    const d=image.data,w=image.width;
    let n=0,sa=0,sl=0,saa=0,sll=0,sal=0,se=0,sq=0,see=0,sqq=0,seq=0;
    for(const p of points){
      const i=((y+p.y)*w+x+p.x)*4,l=lum(d,i),q=l-(lum(d,i-4)+lum(d,i+4)+lum(d,i-w*4)+lum(d,i+w*4))/4;
      n++;sa+=p.a;sl+=l;saa+=p.a*p.a;sll+=l*l;sal+=p.a*l;se+=p.e;sq+=q;see+=p.e*p.e;sqq+=q*q;seq+=p.e*q;
    }
    const variance=Math.max(0,sll-sl*sl/n);
    const spatial=(sal-sa*sl/n)/Math.sqrt(Math.max(1e-9,(saa-sa*sa/n)*variance));
    const edge=(seq-se*sq/n)/Math.sqrt(Math.max(1e-9,(see-se*se/n)*(sqq-sq*sq/n)));
    return {spatial,edge,score:.65*spatial+.35*edge,variance:variance/n};
  }
  function inverse(image,t,r,gain=1){
    const data=new Uint8ClampedArray(r.w*r.h*4),src=image.data;
    let clipped=0,active=0;
    for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
      const i=(y*r.w+x)*4,j=((r.y+y)*image.width+r.x+x)*4;
      data.set(src.subarray(j,j+4),i);
      const a=t.alpha[y*t.size+x]*gain;
      if(a<3.5/255||a>=.95)continue;
      active++;
      for(let c=0;c<3;c++){
        const v=(src[j+c]-a*255)/(1-a);
        if(v< -2)clipped++;
        data[i+c]=Math.max(0,Math.min(255,Math.round(v)));
      }
    }
    return {data,width:r.w,height:r.h,clipped:clipped/Math.max(1,active*3)};
  }
  function resize(t,size){
    const alpha=new Float32Array(size*size),s=t.size;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const px=Math.max(0,Math.min(s-1,(x+.5)*s/size-.5)),py=Math.max(0,Math.min(s-1,(y+.5)*s/size-.5));
      const ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,x1=Math.min(s-1,ix+1),y1=Math.min(s-1,iy+1);
      alpha[y*size+x]=(t.alpha[iy*s+ix]*(1-fx)+t.alpha[iy*s+x1]*fx)*(1-fy)+(t.alpha[y1*s+ix]*(1-fx)+t.alpha[y1*s+x1]*fx)*fy;
    }
    return {id:t.id+'@'+size,size,alpha};
  }
  function locate(image,templates,options={}){
    const bounds=options.bounds,top=[];
    for(const t of templates){
      if(t.size>image.width||t.size>image.height)continue;
      const stride=Math.max(2,Math.round(t.size/12)),points=features(t,Math.max(2,Math.floor(t.size/12)));
      function candidate(x,y){
        if(bounds&&(x+t.size/2<bounds.x||x+t.size/2>bounds.x+bounds.w||y+t.size/2<bounds.y||y+t.size/2>bounds.y+bounds.h))return;
        const m=measure(image,t,x,y,points);
        if(top.length<16||m.score>top[top.length-1].coarse){top.push({x,y,t,coarse:m.score,stride});top.sort((a,b)=>b.coarse-a.coarse);if(top.length>16)top.pop();}
      }
      for(let y=0;y<=image.height-t.size;y+=stride)for(let x=0;x<=image.width-t.size;x+=stride)candidate(x,y);
    }
    let best=null;
    for(const q of top){
      const points=features(q.t,Math.max(1,Math.floor(q.t.size/28)));
      for(let y=Math.max(0,q.y-q.stride);y<=Math.min(image.height-q.t.size,q.y+q.stride);y++)
        for(let x=Math.max(0,q.x-q.stride);x<=Math.min(image.width-q.t.size,q.x+q.stride);x++){
          if(bounds&&(x+q.t.size/2<bounds.x||x+q.t.size/2>bounds.x+bounds.w||y+q.t.size/2<bounds.y||y+q.t.size/2>bounds.y+bounds.h))continue;
          const m=measure(image,q.t,x,y,points);
          if(!best||m.score>best.score)best={...m,x,y,t:q.t};
        }
    }
    return best;
  }
  function process(image,bank,options={}){
    const templates=decode(bank);
    let found=locate(image,templates,options);
    if(!found||found.score<.48){
      const extras=[];
      for(const t of templates.filter(t=>t.id==='48'||t.id==='36-v2'))for(const size of [24,32,40,60,64,72,128])extras.push(resize(t,size));
      const alternative=locate(image,extras,options);
      if(alternative&&(!found||alternative.score>found.score))found=alternative;
    }
    if(!found||found.score<.48||(found.spatial<.38&&!(found.edge>.5&&found.spatial>.25))||found.edge<.06)return {ok:false,reason:'Không xác định được logo đủ chắc. Ảnh chưa bị thay đổi. Hãy chọn vùng sát logo hoặc dùng ảnh tải gốc từ Gemini.'};
    const t=found.t,r={x:found.x,y:found.y,w:t.size,h:t.size};
    const points=features(t,1),before=measure(image,t,r.x,r.y,points);
    let best=null;
    for(const gain of [.25,.35,.45,.5,.55,.6,.7,.85,1,1.15,1.3]){
      const out=inverse(image,t,r,gain),after=measure(out,t,0,0,points);
      const residual=.15*Math.abs(after.spatial)+.85*Math.abs(after.edge);
      const objective=residual+out.clipped*2+Math.abs(1-gain)*.03;
      if(!best||objective<best.objective)best={out,after,gain,residual,objective};
    }
    const beforeSignal=.15*Math.abs(before.spatial)+.85*Math.abs(before.edge);
    if(beforeSignal<.3||best.residual>beforeSignal*.5||Math.abs(best.after.edge)>.2||best.out.clipped>.06)return {ok:false,reason:'Đã thấy mẫu gần giống logo nhưng chưa xử lý an toàn được. Không xuất mảng vá. Hãy dùng ảnh gốc hoặc chọn vùng chính xác hơn.'};
    return {ok:true,rect:r,data:best.out.data,template:t.id,gain:best.gain,before:beforeSignal,after:best.residual,reduction:Math.round(100*(1-best.residual/beforeSignal)),clipped:best.out.clipped};
  }
  return {decode,inverse,locate,process,measure,features};
});
