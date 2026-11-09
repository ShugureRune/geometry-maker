import type {VideoDestination} from './video';
type Picker=(options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<{createWritable:()=>Promise<FileSystemWritableFileStream>}>;
const picker=()=>typeof window==='undefined'?undefined:(window as unknown as {showSaveFilePicker?:Picker}).showSaveFilePicker;
export const canStreamVideo=()=>typeof picker()==='function';
/** Call directly from the export click handler to preserve browser user activation. */
export async function pickVideoFile(name:string,format:'webm'|'mp4'):Promise<VideoDestination>{
 const choose=picker();if(!choose)throw new Error('このブラウザはファイルへの逐次保存に対応していません。');
 const handle=await choose.call(window,{suggestedName:name,types:[{description:format.toUpperCase(),accept:{[`video/${format}`]:[`.${format}`]}}]});
 const file=await handle.createWritable();
 return{write:chunk=>file.write(chunk),close:()=>file.close(),abort:()=>file.abort()};
}
