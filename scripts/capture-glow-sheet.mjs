// Run tests/glow.spec.ts first to capture actual preview images.
import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
try{
 const p=await b.newPage({viewport:{width:1800,height:700}}),cells=[];
 for(const theme of ['dark','light'])for(const n of [0,25,50,75,100])cells.push(`<article><p>${theme} / ${n}%</p><img src="data:image/png;base64,${(await readFile(`docs/glow/${theme}-${n}.png`)).toString('base64')}"></article>`);
 await p.setContent(`<style>body{background:#111526;color:white;font:18px sans-serif}main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}img{width:100%}article{padding:8px;background:#22283c}</style><h1>Glow strength / 0 → 25 → 50 → 75 → 100%</h1><main>${cells.join('')}</main>`);
 await p.locator('img').evaluateAll(ns=>Promise.all(ns.map(n=>n.decode())));
 await p.screenshot({path:'docs/glow/comparison.png',fullPage:true});
}finally{await b.close();}
