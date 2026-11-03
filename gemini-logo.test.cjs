const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib');
const G=require('./gemini-logo.js'),bank=JSON.parse(fs.readFileSync(__dirname+'/gemini-masks.json','utf8'));
function png(base64){
  const b=Buffer.from(base64,'base64'),width=b.readUInt32BE(16),height=b.readUInt32BE(20),channels=b[25]===6?4:3;
  assert.equal(b[24],8);assert.equal(b[28],0);const chunks=[];
  for(let p=8;p<b.length;){const n=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);if(type==='IDAT')chunks.push(b.subarray(p+8,p+8+n));p+=n+12;}
  const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*channels,decoded=new Uint8Array(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];
    for(let x=0;x<stride;x++){
      const a=x>=channels?decoded[y*stride+x-channels]:0,b=y?decoded[(y-1)*stride+x]:0,c=y&&x>=channels?decoded[(y-1)*stride+x-channels]:0;
      const add=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      assert.notEqual(add,undefined);decoded[y*stride+x]=(raw[y*(stride+1)+1+x]+add)&255;
    }
  }
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++){data[i*4]=decoded[i*channels];data[i*4+1]=decoded[i*channels+1];data[i*4+2]=decoded[i*channels+2];data[i*4+3]=channels===4?decoded[i*channels+3]:255;}
  return {width,height,data};
}
const fixtures=JSON.parse(fs.readFileSync(__dirname+'/gemini-fixtures.json','utf8'));
for(const name of ['dark-background-standard-support-96.png','issue101-row-alpha-cabinet.png']){
  const image=png(fixtures[name].base64),before=new Uint8ClampedArray(image.data),result=G.process(image,bank);
  assert(result.ok,name+' should be detected');
  assert(result.reduction>70,name+' must reduce template residual');
  assert(result.clipped<.06);
  for(let y=0;y<result.rect.h;y++)image.data.set(result.data.subarray(y*result.rect.w*4,(y+1)*result.rect.w*4),((y+result.rect.y)*image.width+result.rect.x)*4);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    const r=result.rect;if(x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)continue;
    const i=(y*image.width+x)*4;
    assert.deepEqual(image.data.subarray(i,i+4),before.subarray(i,i+4),'Outside logo pixels must not change');
  }
}
assert.equal(G.process(png(fixtures['exact48-single-watermark-background.png'].base64),bank).ok,false,'Do not process a no-logo photograph');
const plain={width:192,height:192,data:new Uint8ClampedArray(192*192*4).fill(255)};
assert.equal(G.process(plain,bank).ok,false,'Do not process a blank white image');
for(const t of G.decode(bank)){
  const size=t.size,clean=new Uint8ClampedArray(size*size*4),marked=new Uint8ClampedArray(clean.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,a=t.alpha[y*size+x];
    for(let c=0;c<3;c++){clean[i+c]=50+((x+y+c*9)%90);marked[i+c]=Math.round(a*255+(1-a)*clean[i+c]);}
    clean[i+3]=marked[i+3]=255;
  }
  const out=G.inverse({width:size,height:size,data:marked},t,{x:0,y:0,w:size,h:size});
  for(let i=0;i<clean.length;i++)if(t.alpha[Math.floor(i/4)]>=3.5/255)assert(Math.abs(out.data[i]-clean[i])<=2,'Quantized inverse blend should preserve known detail');
}
console.log('Gemini logo tests passed: real captures, residual reduction, negative photographs, outside pixels, alpha inversion.');
