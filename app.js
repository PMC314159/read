'use strict';
const $=id=>document.getElementById(id);
const defaults={quote:'어떤 문장은\n마음에 오래 머문다.\n\n다시 펼쳐 보고 싶은 순간을\n이곳에 가만히 담아 둔다.',title:'오래 간직하고 싶은 문장',author:'당신의 이름',credit:'',bg:'color',bgColor:'#eee9df',textColor:'#41473e',subColor:'#777c6d',font:'NanumMyeongjo',fontSize:46,titleSize:30,authorSize:25,creditSize:17,lineHeight:175,align:'left',ratio:'1:1',padding:10,textY:26,metaGap:80,imageX:0,imageY:0,zoom:100,blur:0,gray:0,dim:0};
let state={...defaults},picture=null,renderId=0,fontTicket=0,saveTimer,toastTimer;
try{const stored=JSON.parse(localStorage.getItem('munjang-v1'));if(stored&&typeof stored==='object'){for(const key of Object.keys(defaults)){if(typeof stored[key]===typeof defaults[key])state[key]=stored[key]}}}catch{}
// Validate stored choices and clamp every numeric control to its visible bounds.
for(const key of Object.keys(defaults)){const input=$(key);if(input?.type==='range')state[key]=Math.min(+input.max,Math.max(+input.min,Number.isFinite(state[key])?state[key]:defaults[key]));}
for(const [key,values]of Object.entries({bg:['color','image'],font:['NanumMyeongjo','NanumGothic','Malgun Gothic','NotoSerifKR','KoPubBatang'],ratio:['1:1','4:5','3:4'],align:['left','center','right']}))if(!values.includes(state[key]))state[key]=defaults[key];
for(const key of ['bgColor','textColor','subColor'])if(!/^#[0-9a-f]{6}$/i.test(state[key]))state[key]=defaults[key];
const canvas=$('canvas'),ctx=canvas.getContext('2d');
const fontLabels={NanumMyeongjo:'나눔명조',NanumGothic:'나눔고딕',NotoSerifKR:'본명조',KoPubBatang:'KoPub 바탕','Malgun Gothic':'맑은 고딕'};
const fontFiles={NanumMyeongjo:'nanum-myeongjo.ttf',NanumGothic:'nanum-gothic.ttf',NotoSerifKR:'noto-serif-kr.ttf',KoPubBatang:'kopub-batang.ttf'};
const loadedFonts=new Map();
function ensureFont(name){
 if(name==='Malgun Gothic')return Promise.resolve();
 if(!loadedFonts.has(name))loadedFonts.set(name,(async()=>{const face=new FontFace(name,`url("${fontFiles[name]}")`);await face.load();document.fonts.add(face);})().catch(e=>{loadedFonts.delete(name);throw e}));
 return loadedFonts.get(name);
}
async function fontChanged(){const ticket=++fontTicket;$('download').disabled=true;$('fontNote').textContent='글꼴을 불러오는 중이에요…';try{await ensureFont(state.font);if(ticket!==fontTicket)return;$('fontNote').textContent=state.font==='Malgun Gothic'?'맑은 고딕이 설치되지 않은 기기에서는 기본 고딕으로 표시돼요.':'미리보기와 저장 이미지에 같은 글꼴이 적용돼요.';}catch{if(ticket===fontTicket){$('fontNote').textContent='글꼴을 불러오지 못했어요. 연결을 확인한 뒤 다시 선택해 주세요.';toast('글꼴을 불러오지 못해 기본 글꼴로 표시해요.');}}finally{if(ticket===fontTicket){$('download').disabled=false;requestRender()}}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500)}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('munjang-v1',JSON.stringify(state))}catch{}},250)}
function sync(){
 for(const key of Object.keys(state)){const input=$(key);if(input&&['INPUT','TEXTAREA','SELECT'].includes(input.tagName))input.value=state[key]}
 for(const output of document.querySelectorAll('output[data-for]')){const key=output.dataset.for;output.value=key==='lineHeight'?`${(state[key]/100).toFixed(2)}`:['fontSize','titleSize','authorSize','creditSize','metaGap','blur'].includes(key)?`${state[key]} px`:`${state[key]}%`}
 document.querySelectorAll('[data-bg]').forEach(b=>b.classList.toggle('active',b.dataset.bg===state.bg));
 document.querySelectorAll('[data-ratio]').forEach(b=>b.classList.toggle('active',b.dataset.ratio===state.ratio));
 document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b.dataset.color===state.bgColor));
 $('charCount').textContent=`${Array.from(state.quote).length}자`;
 $('colorControls').hidden=state.bg!=='color';$('imageControls').hidden=state.bg!=='image';$('effectControls').hidden=state.bg==='color';
 $('imageAdjust').hidden=!picture;canvas.classList.toggle('draggable',state.bg==='image'&&!!picture);
 $('previewRatio').textContent=({'1:1':'정사각형','4:5':'세로형','3:4':'긴 세로형'})[state.ratio]+' · '+state.ratio;
}
function update(key,value){state[key]=value;sync();requestRender();persist();if(key==='font')fontChanged()}
for(const key of Object.keys(defaults)){const input=$(key);if(input&&['INPUT','TEXTAREA','SELECT'].includes(input.tagName))input.addEventListener('input',()=>update(key,typeof defaults[key]==='number'?+input.value:input.value));}
document.querySelectorAll('[data-bg]').forEach(b=>b.onclick=()=>update('bg',b.dataset.bg));
document.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=()=>update('ratio',b.dataset.ratio));
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>update('bgColor',b.dataset.color));
$('centerImage').onclick=()=>{Object.assign(state,{imageX:0,imageY:0,zoom:100});sync();requestRender();persist()};
$('reset').onclick=()=>{uploadTicket++;state={...defaults};picture=null;$('imageFile').value='';$('uploadLabel').textContent='일러스트 불러오기';sync();requestRender();fontChanged();persist();toast('처음의 설정으로 돌아왔어요.')};
let uploadTicket=0;
$('imageFile').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 const ticket=++uploadTicket;
 if(file.size>35*1024*1024){toast('35MB 이하의 이미지를 선택해 주세요.');return}
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();if(ticket!==uploadTicket)return;
 // Bound working memory while retaining enough detail for a 1200px export.
 const scale=Math.min(1,3200/Math.max(image.width,image.height));const buffer=document.createElement('canvas');buffer.width=Math.round(image.width*scale);buffer.height=Math.round(image.height*scale);buffer.getContext('2d').drawImage(image,0,0,buffer.width,buffer.height);picture=buffer;
 Object.assign(state,{bg:'image',imageX:0,imageY:0,zoom:100});$('uploadLabel').textContent=file.name;sync();requestRender();persist();toast('그림을 불러왔어요. 미리보기에서 드래그해 보세요.');
 }catch{toast('이 이미지를 열 수 없어요. JPG, PNG 또는 WEBP 파일을 선택해 주세요.')}finally{URL.revokeObjectURL(url);event.target.value=''}
};
function requestRender(){cancelAnimationFrame(renderId);renderId=requestAnimationFrame(render)}
const layer=document.createElement('canvas');
function drawBackground(w,h){
 ctx.fillStyle=state.bgColor;ctx.fillRect(0,0,w,h);
 const source=state.bg==='image'?picture:null;
 if(source){
 layer.width=w;layer.height=h;const c=layer.getContext('2d');
 const base=Math.max(w/source.width,h/source.height);const scale=base*(state.bg==='image'?state.zoom/100:1);const dw=source.width*scale,dh=source.height*scale;
 const x=(w-dw)/2+(state.bg==='image'?state.imageX/100*w*.6:0),y=(h-dh)/2+(state.bg==='image'?state.imageY/100*h*.6:0);
 c.fillStyle=state.bgColor;c.fillRect(0,0,w,h);c.drawImage(source,x,y,dw,dh);
 ctx.save();ctx.filter=`blur(${state.blur}px) grayscale(${state.gray}%)`;ctx.drawImage(layer,-state.blur*2,-state.blur*2,w+state.blur*4,h+state.blur*4);ctx.restore();
 }
 if(state.dim){ctx.fillStyle=`rgba(0,0,0,${state.dim/100})`;ctx.fillRect(0,0,w,h)}
}
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ko',{granularity:'grapheme'}):null;
function wrapText(text,maxWidth){
 const result=[];
 for(const paragraph of text.replace(/\r\n?/g,'\n').split('\n')){
  if(!paragraph){result.push('');continue}
  const chars=segmenter?Array.from(segmenter.segment(paragraph),p=>p.segment):Array.from(paragraph);let line='';
  for(const char of chars){if(line&&ctx.measureText(line+char).width>maxWidth){result.push(line);line=char}else line+=char}result.push(line);
 }return result;
}
let layoutOverflow=false;
function render(){
 const w=1200,h=state.ratio==='1:1'?1200:state.ratio==='4:5'?1500:1600;
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 $('dimensions').textContent=`${w} × ${h} px`;
 ctx.clearRect(0,0,w,h);drawBackground(w,h);
 const pad=w*state.padding/100,maxWidth=w-pad*2;const x=state.align==='left'?pad:state.align==='center'?w/2:w-pad;
 ctx.textBaseline='top';ctx.textAlign=state.align;
 let y=h*state.textY/100,hasContent=false;layoutOverflow=false;
 function block(text,size,color,lineHeight){
  if(!text.trim())return;
  ctx.font=`${size}px "${state.font}", ${state.font==='Malgun Gothic'?'sans-serif':'serif'}`;ctx.fillStyle=color;
  const lines=wrapText(text,maxWidth);
  for(const line of lines){ctx.fillText(line,x,y);if(y+size*1.2>h-pad)layoutOverflow=true;y+=size*lineHeight}hasContent=true;
 }
 block(state.quote,state.fontSize,state.textColor,state.lineHeight/100);
 if(hasContent&&(state.title.trim()||state.author.trim()))y+=state.metaGap;
 block(state.title,state.titleSize,state.subColor,1.55);
 if(state.title.trim()&&state.author.trim())y+=12;
 block(state.author,state.authorSize,state.subColor,1.5);
 if(state.credit.trim()){
  ctx.font=`${state.creditSize}px "${state.font}", serif`;ctx.textAlign='left';ctx.fillStyle=state.subColor;
  const lines=wrapText(state.credit,w-pad*2);const start=h-42-lines.length*state.creditSize*1.5;
  if(hasContent&&y>start-20)layoutOverflow=true;
  lines.forEach((line,i)=>ctx.fillText(line,Math.max(32,pad*.45),start+i*state.creditSize*1.5));
 }
 $('overflow').hidden=!layoutOverflow;
}
let drag=null;
canvas.onpointerdown=e=>{if(state.bg!=='image'||!picture)return;drag={x:e.clientX,y:e.clientY,sx:state.imageX,sy:state.imageY};canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(!drag)return;const rect=canvas.getBoundingClientRect();state.imageX=Math.max(-100,Math.min(100,Math.round(drag.sx+(e.clientX-drag.x)/rect.width/0.6*100)));state.imageY=Math.max(-100,Math.min(100,Math.round(drag.sy+(e.clientY-drag.y)/rect.height/0.6*100)));sync();requestRender()};
canvas.onpointerup=canvas.onpointercancel=()=>{if(drag){drag=null;persist()}};
$('download').onclick=async()=>{
 $('download').disabled=true;
 try{await ensureFont(state.font);render();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('encoding');const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=`문장집_${new Date().toISOString().slice(0,10)}_${state.ratio.replace(':','x')}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(layoutOverflow?'이미지를 저장했어요. 글이 잘린 부분이 있는지 확인해 주세요.':'문장을 이미지로 저장했어요.');
 }catch{toast('저장하지 못했어요. 글꼴 로딩이나 브라우저 설정을 확인해 주세요.')}finally{$('download').disabled=false}
};
sync();render();fontChanged();
