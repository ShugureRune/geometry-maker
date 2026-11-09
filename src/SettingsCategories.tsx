export const categories = [
  {id:'shapes',label:'図形',icon:'M12 2 22 12 12 22 2 12Z'},
  {id:'background',label:'背景',icon:'M3 4H21V20H3Z M3 15 8 10 13 15 17 11 21 15'},
  {id:'colors',label:'カラー',icon:'M16 8A5 5 0 1 1 6 8A5 5 0 1 1 16 8Z M11 16A5 5 0 1 1 1 16A5 5 0 1 1 11 16Z M23 16A5 5 0 1 1 13 16A5 5 0 1 1 23 16Z'},
  {id:'decoration',label:'装飾',icon:'M12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9Z'},
  {id:'animation',label:'アニメーション',icon:'M8 3 21 12 8 21Z M3 4V20'},
  {id:'export',label:'書き出し',icon:'M12 2V16 M6 10 12 16 18 10 M3 16V22H21V16'},
] as const;
export type Category=typeof categories[number]['id'];
export function SettingsCategories({active,onChange}:{active:Category|null;onChange:(value:Category|null)=>void}){
 return <nav className="category-navigation" aria-label="設定カテゴリー">{categories.map(item=><button type="button" key={item.id} id={`category-${item.id}`} aria-expanded={active===item.id} aria-controls={`panel-${item.id}`} onClick={()=>onChange(active===item.id?null:item.id)}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>{item.label}</button>)}</nav>;
}
