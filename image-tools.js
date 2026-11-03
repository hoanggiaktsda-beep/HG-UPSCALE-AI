/* U²-NetP: Apache-2.0; ONNX Runtime: MIT; See THIRD_PARTY.md. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const editor = el('selection'), pen = editor.getContext('2d');
  let mode = 'background', region = null, start = null, busy = false, version = 0;
  let sessionPromise;
  const status = text => { el('status').textContent = text; };
  function sync() {
    const enabled = !!source && !busy;
    el('aiRun').disabled = !enabled;
    el('aiClear').disabled = !enabled;
    el('file').disabled = busy;
    document.querySelectorAll('#up button,#tools button,#imageTools select').forEach(b => b.disabled = busy);
  }
  function paint() {
    pen.clearRect(0,0,editor.width,editor.height);
    if (!source) return;
    pen.drawImage(source,0,0,editor.width,editor.height);
    if(region) {
      const r=region;
      pen.fillStyle='rgba(200,165,104,.15)';
      pen.fillRect(r.x*editor.width,r.y*editor.height,r.w*editor.width,r.h*editor.height);
      pen.strokeStyle='#ffb947'; pen.lineWidth=2;
      pen.strokeRect(r.x*editor.width,r.y*editor.height,r.w*editor.width,r.h*editor.height);
    }
  }
  function refresh() {
    version++; region=null;
    if(source) {
      const s=Math.min(1,1000/Math.max(source.width,source.height));
      editor.width=Math.max(1,Math.round(source.width*s));
      editor.height=Math.max(1,Math.round(source.height*s));
    }
    paint(); sync();
  }
  el('file').addEventListener('change', () => {
    // Existing source loader is asynchronous; refresh after the preview is ready.
    el('preview').addEventListener('load',refresh,{once:true});
  });
  function point(e) {
    const r=editor.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};
  }
  editor.addEventListener('pointerdown',e=>{
    if(!source||busy||mode==='background')return;
    e.preventDefault();start=point(e);region=null;editor.setPointerCapture(e.pointerId);paint();
  });
  editor.addEventListener('pointermove',e=>{
    if(!start)return;
    const p=point(e);region={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};paint();
  });
  const end=()=>{start=null;};
  editor.addEventListener('pointerup',end); editor.addEventListener('pointercancel',end);
  el('aiClear').onclick=()=>{region=null;paint();};
  el('aiMode').onchange=()=>{
    mode=el('aiMode').value;region=null;paint();
    el('selectionHelp').textContent=mode==='background'
      ?'AI tự tách chủ thể chính. Chi tiết tóc, kính và chân ghế mảnh có thể cần chỉnh thêm.'
      :mode==='product'?'Kéo một khung bao quanh đúng một sản phẩm, chừa ít nền quanh mép. AI tách sản phẩm trong khung và xuất PNG trong suốt.'
      :'Kéo một khung nhỏ sát dấu Gemini cần xóa. Thuật toán vá từ vùng lân cận, không tự phát hiện logo và không xử lý dấu nhúng SynthID.';
  };
  function script(url) {
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=url;s.onload=resolve;
      s.onerror=()=>{s.remove();reject(Error('Không tải được thư viện. Kiểm tra kết nối rồi thử lại.'));};document.head.appendChild(s);
    });
  }
  async function model() {
    if(!sessionPromise) sessionPromise=(async()=>{
      status('Đang tải bộ xử lý AI lần đầu…');
      if(!window.ort) await script('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js');
      ort.env.wasm.numThreads=1;
      ort.env.wasm.proxy=false;
      ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
      return ort.InferenceSession.create('https://huggingface.co/tomjackson2023/rembg/resolve/cd3a3d6767a7859efea31ef0f2f373582cf06d82/u2netp.onnx',{executionProviders:['wasm']});
    })().catch(e=>{sessionPromise=null;throw e;});
    return sessionPromise;
  }
  function cropRect() {
    if(!region||region.w*source.width<4||region.h*source.height<4)throw Error('Hãy kéo khung chọn ít nhất 4 × 4 px trên ảnh.');
    return {x:Math.floor(region.x*source.width),y:Math.floor(region.y*source.height),w:Math.max(1,Math.floor(region.w*source.width)),h:Math.max(1,Math.floor(region.h*source.height))};
  }
  function surface(w,h) { const c=document.createElement('canvas');c.width=w;c.height=h;return c; }
  async function cutout(rect) {
    const sess=await model();
    status('AI đang phân tích và tách nền…');
    const input=surface(320,320),ic=input.getContext('2d',{willReadFrequently:true});
    ic.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,320,320);
    const pixels=ic.getImageData(0,0,320,320).data;
    let max=1;for(let i=0;i<pixels.length;i+=4)max=Math.max(max,pixels[i],pixels[i+1],pixels[i+2]);
    const n=320*320,data=new Float32Array(n*3),mean=[.485,.456,.406],sd=[.229,.224,.225];
    for(let i=0;i<n;i++)for(let c=0;c<3;c++)data[c*n+i]=(pixels[i*4+c]/max-mean[c])/sd[c];
    const tensor=new ort.Tensor('float32',data,[1,3,320,320]);
    const outputs=await sess.run({[sess.inputNames[0]]:tensor});
    try {
      const output=outputs[sess.outputNames[0]].data;
      let lo=Infinity,hi=-Infinity;for(let i=0;i<n;i++){lo=Math.min(lo,output[i]);hi=Math.max(hi,output[i]);}
      const mask=surface(320,320),mc=mask.getContext('2d'),mi=mc.createImageData(320,320);
      for(let i=0;i<n;i++){mi.data[i*4]=mi.data[i*4+1]=mi.data[i*4+2]=255;mi.data[i*4+3]=hi>lo?Math.round(255*(output[i]-lo)/(hi-lo)):0;}
      mc.putImageData(mi,0,0);
      const result=surface(rect.w,rect.h),rc=result.getContext('2d');
      rc.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
      rc.globalCompositeOperation='destination-in';rc.drawImage(mask,0,0,rect.w,rect.h);
      rc.globalCompositeOperation='source-over'; return result;
    } finally {
      tensor.dispose();Object.values(outputs).forEach(t=>t.dispose());
    }
  }
  async function repair(r) {
    if(r.w*r.h>source.width*source.height*.08)throw Error('Vùng chọn quá lớn. Hãy khoanh sát dấu hiển thị, dưới 8% diện tích ảnh.');
    if(r.x<1||r.y<1||r.x+r.w>=source.width||r.y+r.h>=source.height)throw Error('Vùng chọn cần chừa ít nhất 1 px nền ở cả bốn phía.');
    status('Đang vá vùng chọn từ màu nền xung quanh…');
    const out=surface(source.width,source.height),oc=out.getContext('2d',{willReadFrequently:true});
    oc.drawImage(source,0,0);
    const patch=oc.getImageData(r.x-1,r.y-1,r.w+2,r.h+2),pd=patch.data,pw=r.w+2;
    const fill=oc.createImageData(r.w,r.h);
    for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
      const ids=[(x+1)*4,((r.h+1)*pw+x+1)*4,((y+1)*pw)*4,((y+1)*pw+r.w+1)*4];
      const weights=[1/(y+1),1/(r.h-y),1/(x+1),1/(r.w-x)],total=weights.reduce((a,b)=>a+b,0);
      const i=(y*r.w+x)*4;
      for(let c=0;c<4;c++)fill.data[i+c]=Math.round(ids.reduce((v,id,k)=>v+pd[id+c]*weights[k],0)/total);
    }
    oc.putImageData(fill,r.x,r.y);return out;
  }
  el('aiRun').onclick=async()=>{
    if(busy||!source)return;
    let rect;
    try {
      if(source.width*source.height>24000000)throw Error('Hãy dùng ảnh dưới 24 triệu điểm ảnh để tránh hết bộ nhớ.');
      rect=mode==='background'?{x:0,y:0,w:source.width,h:source.height}:cropRect();
    } catch(e){status(e.message);return;}
    busy=true;sync();el('download').disabled=true;el('aiRun').textContent='ĐANG XỬ LÝ…';
    const current=version;
    try {
      const result=mode==='watermark'?await repair(rect):await cutout(rect);
      if(current!==version)return;
      canvas.width=result.width;canvas.height=result.height;ctx.drawImage(result,0,0);
      el('format').value='image/png';el('download').disabled=false;
      status('Hoàn thành: '+result.width+' × '+result.height+' px · '+(mode==='watermark'?'Đã vá vùng chọn; kiểm tra chi tiết nền trước khi tải.':'PNG trong suốt · Kiểm tra mép chủ thể trước khi tải.'));
    } catch(e){status('Chưa xử lý được: '+e.message+' Ảnh gốc được giữ nguyên.');}
    finally{busy=false;sync();el('aiRun').textContent='XỬ LÝ ẢNH';}
  };
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    el('imageTools').classList.toggle('hidden',b.dataset.tab!=='imageTools');
    if(b.dataset.tab==='imageTools'){el('up').classList.add('hidden');el('tools').classList.add('hidden');refresh();}
  }));
  sync();
})();
