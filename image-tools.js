/* Local image tools. Visible logo engine: gemini-logo.js; no image upload. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id),editor=el('selection'),pen=editor.getContext('2d');
  const method=el('watermarkMethod');
  let mode='background',region=null,start=null,busy=false,version=0,sessionPromise,masksPromise;
  const status=text=>{el('status').textContent=text;};
  function sync(){
    const enabled=!!source&&!busy;
    el('aiRun').disabled=!enabled;el('aiClear').disabled=!enabled;el('file').disabled=busy;
    document.querySelectorAll('nav button,#up button,#tools button,#imageTools select,#undoRetouch').forEach(b=>b.disabled=busy);
  }
  function update(){
    const watermark=mode==='watermark',manual=method.value==='manual';
    el('watermarkChoice').classList.toggle('hidden',!watermark);
    el('qualityLock').classList.toggle('hidden',!watermark);
    editor.classList.toggle('hidden',mode==='background'||watermark&&!manual);
    el('aiClear').classList.toggle('hidden',mode!=='product'&&!(watermark&&manual));
    el('aiRun').textContent=watermark?'XÓA LOGO GEMINI':'XỬ LÝ ẢNH';
    el('selectionHelp').textContent=watermark
      ?manual?'Kéo khung quanh logo. Hệ thống sẽ tìm đúng mẫu dấu trong vùng này; không vá cả hình chữ nhật.':'Tải ảnh gốc rồi bấm XÓA LOGO GEMINI. Nếu không nhận dạng được, hãy chuyển sang chọn vùng logo.'
      :mode==='product'?'Kéo khung bao quanh một sản phẩm; AI tách sản phẩm trong khung và xuất PNG trong suốt.':'AI tách chủ thể chính; kiểm tra mép tóc, kính và chi tiết mảnh trước khi tải.';
    paint();
  }
  function paint(){
    pen.clearRect(0,0,editor.width,editor.height);if(!source)return;
    pen.drawImage(source,0,0,editor.width,editor.height);
    if(region){pen.strokeStyle='#ffb947';pen.lineWidth=2;pen.strokeRect(region.x*editor.width,region.y*editor.height,region.w*editor.width,region.h*editor.height);}
  }
  function refresh(){
    version++;region=null;start=null;el('retouchReview').classList.add('hidden');
    if(source){const s=Math.min(1,1000/Math.max(source.width,source.height));editor.width=Math.max(1,Math.round(source.width*s));editor.height=Math.max(1,Math.round(source.height*s));}
    update();sync();
  }
  el('file').addEventListener('change',()=>el('preview').addEventListener('load',refresh,{once:true}));
  function point(e){
    const r=editor.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};
  }
  editor.addEventListener('pointerdown',e=>{
    if(!source||busy||mode==='background'||mode==='watermark'&&method.value!=='manual')return;
    e.preventDefault();start=point(e);region=null;editor.setPointerCapture(e.pointerId);paint();
  });
  editor.addEventListener('pointermove',e=>{
    if(!start)return;const p=point(e);
    region={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(start.x-p.x),h:Math.abs(start.y-p.y)};paint();
  });
  editor.addEventListener('pointerup',()=>{start=null;});editor.addEventListener('pointercancel',()=>{start=null;});
  el('aiClear').onclick=()=>{region=null;paint();};
  method.onchange=()=>{region=null;update();};
  el('aiMode').onchange=()=>{mode=el('aiMode').value;region=null;update();};
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
  async function verifyOutside(result,r){
    const out=result.getContext('2d',{willReadFrequently:true}),stripe=surface(source.width,128),sc=stripe.getContext('2d',{willReadFrequently:true});
    let checked=0;
    for(let y=0;y<source.height;y+=128){
      const h=Math.min(128,source.height-y);sc.clearRect(0,0,stripe.width,128);
      sc.drawImage(source,0,y,source.width,h,0,0,source.width,h);
      const a=sc.getImageData(0,0,source.width,h).data,b=out.getImageData(0,y,source.width,h).data;
      for(let yy=0;yy<h;yy++)for(let x=0;x<source.width;x++){
        if(x>=r.x&&x<r.x+r.w&&y+yy>=r.y&&y+yy<r.y+r.h)continue;
        const i=(yy*source.width+x)*4;checked++;
        if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])throw Error('Phát hiện thay đổi ngoài vùng logo. Kết quả bị chặn tải.');
      }
      if(y%1024===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return checked;
  }
  async function masks(){
    if(!masksPromise)masksPromise=fetch('./gemini-masks.json?v=6').then(r=>{if(!r.ok)throw Error('Không tải được mẫu logo. Hãy kiểm tra kết nối.');return r.json();}).catch(e=>{masksPromise=null;throw e;});
    return masksPromise;
  }
  async function findAndRemove(image,bank,options){
    if(typeof Worker==='undefined')return HGLogo.process(image,bank,options);
    return new Promise((resolve,reject)=>{
      const worker=new Worker('./gemini-logo-worker.js?v=6');
      const timer=setTimeout(()=>{worker.terminate();reject(Error('Xử lý vượt thời gian. Hãy chọn vùng logo nhỏ hơn.'));},60000);
      const done=()=>{clearTimeout(timer);worker.terminate();};
      worker.onmessage=e=>{done();resolve(e.data);};
      worker.onerror=()=>{done();reject(Error('Bộ xử lý logo chưa tải được. Hãy tải lại trang.'));};
      worker.postMessage({image,bank,options},[image.data.buffer]);
    });
  }
  async function removeLogo(){
    let x,y,w,h,bounds=null;
    if(method.value==='manual'){
      const r=cropRect(),pad=128;
      x=Math.max(0,r.x-pad);y=Math.max(0,r.y-pad);w=Math.min(source.width-x,r.w+pad*2);h=Math.min(source.height-y,r.h+pad*2);
      if(w*h>1200000)throw Error('Hãy khoanh vùng sát logo hơn.');
      bounds={x:r.x-x,y:r.y-y,w:r.w,h:r.h};
    }else{w=Math.min(640,source.width);h=Math.min(640,source.height);x=source.width-w;y=source.height-h;}
    status('Đang tìm đúng mẫu logo Gemini…');
    const roi=surface(w,h),rc=roi.getContext('2d',{willReadFrequently:true});
    rc.drawImage(source,x,y,w,h,0,0,w,h);
    const bank=await masks(),result=await findAndRemove(rc.getImageData(0,0,w,h),bank,{bounds});
    if(!result.ok)throw Error(result.reason);
    const r={x:x+result.rect.x,y:y+result.rect.y,w:result.rect.w,h:result.rect.h};
    const out=surface(source.width,source.height),oc=out.getContext('2d',{willReadFrequently:true});
    oc.drawImage(source,0,0);oc.putImageData(new ImageData(result.data,r.w,r.h),r.x,r.y);
    status('Đang kiểm tra kết quả và độ phân giải…');
    if(out.width!==source.width||out.height!==source.height)throw Error('Kích thước ảnh thay đổi; kết quả bị chặn.');
    const checked=await verifyOutside(out,r);
    for(const [id,image] of [['patchBefore',source],['patchAfter',out]]){
      const view=el(id);view.width=r.w;view.height=r.h;view.getContext('2d').drawImage(image,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
    }
    el('retouchQA').textContent='Đã khử lớp logo theo mẫu nhận dạng. Giữ '+source.width+' × '+source.height+' px và '+checked.toLocaleString('vi-VN')+' điểm ảnh ngoài vùng logo. Hãy xem cặp ảnh phóng to trước khi tải; ảnh đã nén hoặc logo biến thể có thể còn vết.';
    el('retouchReview').classList.remove('hidden');
    return out;
  }
  el('undoRetouch').onclick=()=>{
    if(!source||busy)return;canvas.width=source.width;canvas.height=source.height;ctx.drawImage(source,0,0);
    el('download').dataset.forcePng='true';el('download').disabled=false;el('retouchReview').classList.add('hidden');status('Đã hoàn tác về ảnh gốc.');
  };
  el('aiRun').onclick=async()=>{
    if(!source||busy)return;
    if(source.width*source.height>24000000){status('Hãy dùng ảnh dưới 24 triệu điểm ảnh để tránh hết bộ nhớ.');return;}
    busy=true;sync();el('retouchReview').classList.add('hidden');el('download').disabled=true;canvas.width=0;canvas.height=0;
    el('aiRun').textContent='ĐANG XỬ LÝ…';const current=version;
    try{
      const result=mode==='watermark'?await removeLogo():await cutout(mode==='background'?{x:0,y:0,w:source.width,h:source.height}:cropRect());
      if(current!==version)return;
      canvas.width=result.width;canvas.height=result.height;ctx.drawImage(result,0,0);
      el('format').value='image/png';el('download').disabled=false;
      if(mode==='watermark')el('download').dataset.forcePng='true';else delete el('download').dataset.forcePng;
      status(mode==='watermark'?'Đã xử lý logo theo mẫu · Đúng độ phân giải gốc · Kiểm tra ảnh phóng to trước khi tải PNG.':'Hoàn thành: '+result.width+' × '+result.height+' px · PNG trong suốt.');
    }catch(e){el('retouchReview').classList.add('hidden');status(e.message);}
    finally{busy=false;sync();update();}
  };
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    el('imageTools').classList.toggle('hidden',b.dataset.tab!=='imageTools');
    if(b.dataset.tab==='imageTools'){el('up').classList.add('hidden');el('tools').classList.add('hidden');refresh();}
  }));
  sync();update();
})();
