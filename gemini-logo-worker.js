/* Local worker: no image upload or third-party inference. */
importScripts('./gemini-logo.js?v=6');
onmessage=event=>{
  try{
    const result=HGLogo.process(event.data.image,event.data.bank,event.data.options);
    postMessage(result,result.data?[result.data.buffer]:[]);
  }catch(error){postMessage({ok:false,reason:'Không xử lý được: '+error.message});}
};
