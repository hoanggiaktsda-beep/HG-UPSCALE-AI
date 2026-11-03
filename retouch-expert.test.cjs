const assert=require('node:assert/strict');
const R=require('./retouch-expert.js');
function image(w,h,fn){
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=fn(x,y),i=(y*w+x)*4;
    data.set([...p,p[3]===undefined?255:p[3]].slice(0,4),i);
  }
  return {data,width:w,height:h};
}
const r={x:180,y:120,w:24,h:24};
const clean=image(256,192,(x,y)=>{
  const value=100+45*Math.sin(x*Math.PI/8)+30*Math.cos(y*Math.PI/8);
  return [value,value+12,value+24];
});
const marked={...clean,data:new Uint8ClampedArray(clean.data)};
for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)
  marked.data.set([250,250,250,255],(y*marked.width+x)*4);
const texture=R.repair(marked,r,{strategy:'auto',feather:0});
const smooth=R.repair(marked,r,{strategy:'smooth',feather:0});
function mse(patch){
  let sum=0;
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++)for(let c=0;c<3;c++){
    const delta=patch.data[(y*r.w+x)*4+c]-clean.data[((r.y+y)*256+r.x+x)*4+c];sum+=delta*delta;
  }
  return sum/(r.w*r.h*3);
}
assert.equal(texture.report.strategy,'texture');
assert(mse(texture)<mse(smooth)*.2,'Texture repair must retain the known repeating pattern better than interpolation');
const after=new Uint8ClampedArray(marked.data);
for(let y=0;y<r.h;y++)after.set(texture.data.subarray(y*r.w*4,(y+1)*r.w*4),((r.y+y)*256+r.x)*4);
assert.equal(R.outsideDifference(marked.data,after,256,192,r).changed,0);
after[0]++;
assert.equal(R.outsideDifference(marked.data,after,256,192,r).changed,1,'Quality gate detects a changed pixel outside the mask');
assert.throws(()=>R.repair(marked,{x:0,y:1,w:20,h:20}),/2 px/);
assert.throws(()=>R.repair(marked,r,{strategy:'texture',donor:r}),/tách khỏi/);
const manual=R.repair(marked,r,{strategy:'texture',donor:{x:100,y:120},feather:0});
assert.equal(manual.report.donor.manual,true);
const flat=image(80,80,()=>[100,120,140]);
assert.equal(R.analyze(flat,{x:30,y:30,w:12,h:12}).suggestion,'smooth');
const repaired=R.repair(flat,{x:30,y:30,w:12,h:12},{strategy:'auto'});
assert.deepEqual([...repaired.data.slice(0,4)],[100,120,140,255]);
// A stripe beginning after the target must verify every pixel.
assert.equal(R.outsideDifference(new Uint8ClampedArray(400),new Uint8ClampedArray(400),10,10,{x:2,y:-30,w:4,h:5}).checked,100);
console.log(JSON.stringify({tests:'passed',textureMSE:mse(texture),interpolationMSE:mse(smooth)}));
