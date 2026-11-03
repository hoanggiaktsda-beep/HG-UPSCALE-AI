/* U²-NetP: Apache-2.0; ONNX Runtime: MIT; See THIRD_PARTY.md. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const editor = el('selection'), pen = editor.getContext('2d');
  let mode = 'background', region = null, start = null, busy = false, version = 0;
  let sessionPromise;
  let donor=null,pickingDonor=false,lastRepair=null;
  const method=el('watermarkMethod');
  const choice=el('watermarkChoice');
  function autoRegion(){
    // Conservative heuristic: visible corner mark only; no claim of actual AI detection.
    const w=source.width,h=source.height;
    const size=Math.max(12,Math.round(Math.min(w,h)*.065));
    return {x:Math.max(1,w-size-Math.round(w*.012)),y:Math.max(1,h-size-Math.round(h*.012)),w:size,h:size};
  }
  method.onchange=()=>{region=null;donor=null;pickingDonor=false;paint();el('selectionHelp').textContent=method.value==='auto'?'Tự ước lượng vị trí dấu hiển thị ở góc dưới bên phải rồi vá vùng nhỏ. Chưa có mô hình AI nhận diện logo; hãy kiểm tra ảnh sau xử lý.':'Kéo khung nhỏ sát dấu cần xóa để vá thủ công.';};
  const status = text => { el('status').textContent = text; };
  function sync() {
    const enabled = !!source && !busy;
    el('aiRun').disabled = !enabled;
    el('aiClear').disabled = !enabled;
    el('expertAnalyze').disabled=!enabled;el('pickDonor').disabled=!enabled;
    el('undoRetouch').disabled=busy;
    el('file').disabled = busy;
    document.querySelectorAll('nav button,#up button,#tools button,#imageTools select').forEach(b => b.disabled = busy);
  }
  function paint() {
    pen.clearRect(0,0,editor.width,editor.height);
    if (!source) return;
    pen.drawImage(source,0,0,editor.width,editor.height);
    if(mode==='watermark'&&method.value==='auto'){const a=autoRegion();pen.strokeStyle='#ffb947';pen.lineWidth=2;pen.strokeRect(a.x/source.width*editor.width,a.y/source.height*editor.height,a.w/source.width*editor.width,a.h/source.height*editor.height);}
    if(donor){pen.strokeStyle='#69cfe7';pen.lineWidth=2;pen.strokeRect(donor.x/source.width*editor.width,donor.y/source.height*editor.height,donor.w/source.width*editor.width,donor.h/source.height*editor.height);}
    if(region) {
      const r=region;
      pen.fillStyle='rgba(200,165,104,.15)';
      pen.fillRect(r.x*editor.width,r.y*editor.height,r.w*editor.width,r.h*editor.height);
      pen.strokeStyle='#ffb947'; pen.lineWidth=2;
      pen.strokeRect(r.x*editor.width,r.y*editor.height,r.w*editor.width,r.h*editor.height);
    }
  }
  function refresh() {
    version++; region=null;donor=null;pickingDonor=false;lastRepair=null;el('retouchReview').classList.add('hidden');
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
    if(!source||busy||mode==='background'||mode==='watermark'&&method.value==='auto'&&!pickingDonor)return;
    e.preventDefault();
    if(pickingDonor){
      try{
        const r=targetRect(),p=point(e);
        donor={x:Math.round(p.x*source.width-r.w/2),y:Math.round(p.y*source.height-r.h/2),w:r.w,h:r.h};
        pickingDonor=false;el('repairStrategy').value='texture';
        el('expertAdvice').textContent='Đã chọn mẫu sạch. Bấm phân tích để kiểm tra độ khớp hoặc xử lý để xem kết quả.';
        paint();
      }catch(err){status(err.message);}
      return;
    }
    start=point(e);region=null;donor=null;editor.setPointerCapture(e.pointerId);paint();
  });
  editor.addEventListener('pointermove',e=>{
    if(!start)return;
    const p=point(e);region={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};paint();
  });
  const end=()=>{start=null;};
  editor.addEventListener('pointerup',end); editor.addEventListener('pointercancel',end);
  el('aiClear').onclick=()=>{region=null;donor=null;pickingDonor=false;paint();};
  el('aiMode').onchange=()=>{
    mode=el('aiMode').value;region=null;donor=null;pickingDonor=false;choice.classList.toggle('hidden',mode!=='watermark');el('retouchExpert').classList.toggle('hidden',mode!=='watermark');el('qualityLock').classList.toggle('hidden',mode!=='watermark');paint();
    el('selectionHelp').textContent=mode==='background'
      ?'AI tự tách chủ thể chính. Chi tiết tóc, kính và chân ghế mảnh có thể cần chỉnh thêm.'
      :mode==='product'?'Kéo một khung bao quanh đúng một sản phẩm, chừa ít nền quanh mép. AI tách sản phẩm trong khung và xuất PNG trong suốt.'
       :method.value==='auto'?'Tự ước lượng vùng góc dưới bên phải; chưa có AI nhận diện logo.':'Kéo một khung nhỏ sát dấu Gemini cần xóa. Không xử lý dấu nhúng SynthID.';
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
  function targetRect(){return method.value==='auto'?autoRegion():cropRect();}
  function contextFor(r){
    const pad=Math.max(40,Math.min(700,Math.max(r.w,r.h)*4));
    let x=Math.max(0,r.x-pad),y=Math.max(0,r.y-pad),right=Math.min(source.width,r.x+r.w+pad),bottom=Math.min(source.height,r.y+r.h+pad);
    if(donor){x=Math.min(x,Math.max(0,donor.x-3));y=Math.min(y,Math.max(0,donor.y-3));right=Math.max(right,Math.min(source.width,donor.x+r.w+3));bottom=Math.max(bottom,Math.min(source.height,donor.y+r.h+3));}
    if((right-x)*(bottom-y)>6000000)throw Error('Mẫu sạch quá xa vùng sửa. Hãy chọn vùng gần hơn để giảm bộ nhớ.');
    const c=surface(right-x,bottom-y),cx=c.getContext('2d',{willReadFrequently:true});
    cx.drawImage(source,x,y,c.width,c.height,0,0,c.width,c.height);
    return {image:cx.getImageData(0,0,c.width,c.height),rect:{x:r.x-x,y:r.y-y,w:r.w,h:r.h},donor:donor?{x:donor.x-x,y:donor.y-y,w:r.w,h:r.h}:null,x,y};
  }
  function advice(report){
    const a=report.report||report;
    const selected=el('repairStrategy').value;
    el('expertAdvice').textContent='Độ biến thiên nền: '+a.deviation.toFixed(1)+' · Chi tiết biên: '+a.edge.toFixed(1)+'\nĐề xuất: '+(a.suggestion==='texture'?'Lấy mẫu giữ kết cấu':'Nội suy nền trơn')+'.'+(a.risk==='high'?' Có nhiều đường nét; nên chọn mẫu sạch thủ công.':'')+(selected==='smooth'&&a.suggestion==='texture'?' Nội suy có thể làm mất vân trong vùng sửa.':'')+(a.match!==undefined&&a.match!==null?'\nĐộ khớp biên ước lượng: '+a.match+'/100. Đây không phải xác suất khôi phục đúng ảnh gốc.':'');
  }
  el('expertAnalyze').onclick=()=>{
    try{if(!source)throw Error('Hãy chọn ảnh trước');const r=targetRect(),c=contextFor(r);advice(HGRetouch.analyze(c.image,c.rect));paint();}
    catch(e){status(e.message);}
  };
  el('pickDonor').onclick=()=>{
    try{targetRect();pickingDonor=true;el('expertAdvice').textContent='Chạm vào tâm vùng sạch có cùng vân, ánh sáng và hướng đường nét. Mẫu phải nằm ngoài vùng dấu.';}
    catch(e){status(e.message);}
  };
  async function verifyOutside(result,r){
    const out=result.getContext('2d',{willReadFrequently:true}),stripe=surface(source.width,128),sc=stripe.getContext('2d',{willReadFrequently:true});
    let checked=0;
    for(let y=0;y<source.height;y+=128){
      const h=Math.min(128,source.height-y);
      sc.clearRect(0,0,stripe.width,128);sc.drawImage(source,0,y,source.width,h,0,0,source.width,h);
      const a=sc.getImageData(0,0,source.width,h).data,b=out.getImageData(0,y,source.width,h).data;
      const q=HGRetouch.outsideDifference(a,b,source.width,h,{x:r.x,y:r.y-y,w:r.w,h:r.h});
      if(q.changed)throw Error('Khóa chất lượng: phát hiện thay đổi ngoài vùng sửa. Kết quả bị chặn xuất.');
      checked+=q.checked;
      if(y%1024===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return checked;
  }
  async function repair(r) {
    if(r.w*r.h>source.width*source.height*.08)throw Error('Vùng chọn quá lớn. Hãy khoanh sát dấu hiển thị, dưới 8% diện tích ảnh.');
    status('Chuyên gia đang phân tích vùng sửa và tìm mẫu…');
    await new Promise(resolve=>setTimeout(resolve,0));
    const c=contextFor(r),output=HGRetouch.repair(c.image,c.rect,{strategy:el('repairStrategy').value,feather:+el('repairFeather').value,donor:c.donor});
    advice(output);
    const out=surface(source.width,source.height),oc=out.getContext('2d',{willReadFrequently:true});
    oc.drawImage(source,0,0);oc.putImageData(new ImageData(output.data,r.w,r.h),r.x,r.y);
    if(out.width!==source.width||out.height!==source.height)throw Error('Khóa chất lượng: kích thước ảnh thay đổi.');
    status('Đang kiểm tra điểm ảnh ngoài vùng sửa…');
    const checked=await verifyOutside(out,r);
    lastRepair={rect:r,report:output.report,checked};
    for(const [id,image] of [['patchBefore',source],['patchAfter',out]]){
      const view=el(id),pad=8,x=Math.max(0,r.x-pad),y=Math.max(0,r.y-pad);
      view.width=Math.min(source.width-x,r.w+pad*2);view.height=Math.min(source.height-y,r.h+pad*2);
      view.getContext('2d').drawImage(image,x,y,view.width,view.height,0,0,view.width,view.height);
    }
    el('retouchQA').textContent='Kiểm tra đạt: '+source.width+' × '+source.height+' px · '+checked.toLocaleString('vi-VN')+' điểm ảnh ngoài vùng sửa giữ nguyên · PNG. Phương pháp: '+(output.report.strategy==='texture'?'lấy mẫu kết cấu':'nội suy nền trơn')+'.'+(output.report.match!==null&&output.report.match<60?' Độ khớp thấp; nên chọn lại mẫu sạch.':'')+' Chi tiết bị che không thể xác minh từ ảnh nguồn.';
    el('retouchReview').classList.remove('hidden');
    return out;
  }
  el('undoRetouch').onclick=()=>{
    if(!source||busy)return;
    canvas.width=source.width;canvas.height=source.height;ctx.drawImage(source,0,0);
    el('download').dataset.forcePng='true';el('download').disabled=false;
    el('retouchReview').classList.add('hidden');lastRepair=null;
    status('Đã hoàn tác về ảnh gốc, đúng độ phân giải gốc.');
  };
  el('aiRun').onclick=async()=>{
    if(busy||!source)return;
    let rect;
    try {
      if(source.width*source.height>24000000)throw Error('Hãy dùng ảnh dưới 24 triệu điểm ảnh để tránh hết bộ nhớ.');
      rect=mode==='background'?{x:0,y:0,w:source.width,h:source.height}:mode==='watermark'&&method.value==='auto'?autoRegion():cropRect();
    } catch(e){status(e.message);return;}
    busy=true;sync();el('retouchReview').classList.add('hidden');el('download').disabled=true;el('aiRun').textContent='ĐANG XỬ LÝ…';
    const current=version;
    try {
      const result=mode==='watermark'?await repair(rect):await cutout(rect);
      if(current!==version)return;
      canvas.width=result.width;canvas.height=result.height;ctx.drawImage(result,0,0);
      el('format').value='image/png';el('download').disabled=false;
      status('Hoàn thành: '+result.width+' × '+result.height+' px · '+(mode==='watermark'?'Khóa chất lượng đạt: đúng độ phân giải, giữ nguyên ngoài vùng sửa, xuất PNG. Kiểm tra cặp ảnh vùng sửa bên dưới trước khi tải.':'PNG trong suốt · Kiểm tra mép chủ thể trước khi tải.'));
      if(mode==='watermark')el('download').dataset.forcePng='true';else delete el('download').dataset.forcePng;
    } catch(e){status('Chưa xử lý được: '+e.message+' Ảnh gốc được giữ nguyên.');}
    finally{busy=false;sync();el('aiRun').textContent='XỬ LÝ ẢNH';}
  };
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    el('imageTools').classList.toggle('hidden',b.dataset.tab!=='imageTools');
    if(b.dataset.tab==='imageTools'){el('up').classList.add('hidden');el('tools').classList.add('hidden');refresh();}
  }));
  el('qualityLock').classList.add('hidden');
  sync();
})();
