/* HG Retouch: deterministic local analysis and exemplar patch repair.
   This is not a generative model or a human retoucher. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HGRetouch=api;
})(typeof window==='undefined'?this:window,function(){
  'use strict';
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function validate(image,r){
    if(!Number.isInteger(r.x)||!Number.isInteger(r.y)||!Number.isInteger(r.w)||!Number.isInteger(r.h)||r.w<4||r.h<4)throw Error('Vùng sửa phải có kích thước ít nhất 4 × 4 px.');
    if(r.x<2||r.y<2||r.x+r.w>image.width-2||r.y+r.h>image.height-2)throw Error('Chừa ít nhất 2 px nền xung quanh vùng sửa.');
  }
  function samples(r){
    const points=[],sx=Math.max(1,Math.ceil(r.w/24)),sy=Math.max(1,Math.ceil(r.h/24));
    for(let x=0;x<r.w;x+=sx){points.push([x,-2],[x,r.h+1]);}
    for(let y=0;y<r.h;y+=sy){points.push([-2,y],[r.w+1,y]);}
    return points;
  }
  function analyze(image,r){
    validate(image,r);
    const d=image.data,w=image.width,pts=samples(r);
    let sum=0,sq=0,edges=0;const means=[0,0,0];
    for(const [x,y] of pts){
      const i=((r.y+y)*w+r.x+x)*4;
      const l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
      const j=i+4,l2=.2126*d[j]+.7152*d[j+1]+.0722*d[j+2];
      sum+=l;sq+=l*l;edges+=Math.abs(l-l2);
      for(let c=0;c<3;c++)means[c]+=d[i+c];
    }
    const n=pts.length,sd=Math.sqrt(Math.max(0,sq/n-(sum/n)**2)),edge=edges/n;
    const textured=sd>10||edge>3;
    return {brightness:sum/n,deviation:sd,edge,means:means.map(v=>v/n),suggestion:textured?'texture':'smooth',risk:edge>15?'high':textured?'medium':'low'};
  }
  function findDonor(image,r,manual){
    const w=image.width,h=image.height,d=image.data,pts=samples(r);
    const occupied={x:r.x-2,y:r.y-2,w:r.w+4,h:r.h+4};
    function score(x,y){
      let error=0;
      for(const [px,py] of pts){
        const a=((r.y+py)*w+r.x+px)*4,b=((y+py)*w+x+px)*4;
        for(let c=0;c<3;c++){const delta=d[a+c]-d[b+c];error+=delta*delta;}
      }
      return Math.sqrt(error/(pts.length*3));
    }
    if(manual){
      const q={...manual,w:r.w,h:r.h};
      validate(image,q);
      if(overlap(occupied,{x:q.x-2,y:q.y-2,w:q.w+4,h:q.h+4}))throw Error('Mẫu sạch cần nằm tách khỏi vùng có dấu.');
      return {x:q.x,y:q.y,w:r.w,h:r.h,error:score(q.x,q.y),manual:true};
    }
    let best=null;
    const step=Math.max(1,Math.ceil(Math.max(w,h)/90));
    for(let y=2;y<=h-r.h-2;y+=step)for(let x=2;x<=w-r.w-2;x+=step){
      if(overlap(occupied,{x:x-2,y:y-2,w:r.w+4,h:r.h+4}))continue;
      const error=score(x,y);
      // Prefer a close source only when boundary agreement is comparable.
      const rank=error+Math.hypot(x-r.x,y-r.y)*.0005;
      if(!best||rank<best.rank)best={x,y,w:r.w,h:r.h,error,rank,manual:false};
    }
    if(!best)throw Error('Không đủ vùng sạch để lấy mẫu. Hãy chọn vùng sửa nhỏ hơn.');
    const bx=best.x,by=best.y;
    for(let y=Math.max(2,by-step);y<=Math.min(h-r.h-2,by+step);y++)
      for(let x=Math.max(2,bx-step);x<=Math.min(w-r.w-2,bx+step);x++){
        if(overlap(occupied,{x:x-2,y:y-2,w:r.w+4,h:r.h+4}))continue;
        const error=score(x,y),rank=error+Math.hypot(x-r.x,y-r.y)*.0005;
        if(rank<best.rank)best={x,y,w:r.w,h:r.h,error,rank,manual:false};
      }
    return best;
  }
  function repair(image,r,options={}){
    const report=analyze(image,r),strategy=options.strategy==='auto'||!options.strategy?report.suggestion:options.strategy;
    if(!['smooth','texture'].includes(strategy))throw Error('Phương pháp phục hồi không hợp lệ.');
    const d=image.data,w=image.width,out=new Uint8ClampedArray(r.w*r.h*4);
    let donor=null,offset=[0,0,0];
    if(strategy==='texture'){
      donor=findDonor(image,r,options.donor);
      // Only a small constant tone offset; no smoothing of source texture.
      const a=analyze(image,donor);
      offset=report.means.map((v,c)=>clamp(v-a.means[c],-16,16));
    }
    const feather=clamp(Number(options.feather)||0,0,4);
    for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
      const i=(y*r.w+x)*4,original=((r.y+y)*w+r.x+x)*4;
      const alpha=feather?Math.min(1,(Math.min(x,y,r.w-1-x,r.h-1-y)+1)/(feather+1)):1;
      const weights=[1/(y+1),1/(r.h-y),1/(x+1),1/(r.w-x)],total=weights.reduce((a,b)=>a+b,0);
      const ids=[((r.y-1)*w+r.x+x)*4,((r.y+r.h)*w+r.x+x)*4,((r.y+y)*w+r.x-1)*4,((r.y+y)*w+r.x+r.w)*4];
      for(let c=0;c<4;c++){
        const value=donor?d[((donor.y+y)*w+donor.x+x)*4+c]+(c<3?offset[c]:0):ids.reduce((v,id,k)=>v+d[id+c]*weights[k],0)/total;
        out[i+c]=clamp(Math.round(value*alpha+d[original+c]*(1-alpha)),0,255);
      }
    }
    return {data:out,width:r.w,height:r.h,report:{...report,strategy,donor,match:donor?Math.max(0,Math.round(100-donor.error*2)):null}};
  }
  function outsideDifference(before,after,width,height,r){
    let changed=0,checked=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)continue;
      const i=(y*width+x)*4;checked++;
      if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2]||before[i+3]!==after[i+3])changed++;
    }
    return {changed,checked};
  }
  return {analyze,repair,outsideDifference};
});
