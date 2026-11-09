import{chromium}from'playwright';
import{mkdir}from'node:fs/promises';
const out='docs/chunk-scroll';await mkdir(out,{recursive:true});const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}),p=await b.newPage({viewport:{width:800,height:450}});await p.goto('http://127.0.0.1:5173/tests/fixtures/scroll.html');
for(const version of ['2d-v4','2d-v5'])for(const time of [0,1,3,10,20,40]){await p.evaluate(({version,time})=>window.scrollFrame(time,{version,settings:{direction:'horizontal',duration:14,speed:1,scrollSpeed:1}}),{version,time});await p.waitForTimeout(80);await p.getByTestId('ambient-preview').screenshot({path:`${out}/${version}-${time}.png`});}
await b.close();
