import {generatedColor,SLOTS,type ColorSettings} from './colors';
const backgrounds={night:['#080d19','#080d19','#17213c','#0b2630'],neon:['#10091f','#090e25','#28113d','#072c35']} as const;
/** An explicit preset action edits only unlocked slots; future seed/manual mode stays intact. */
export function darkTheme(colors:ColorSettings,seed:string,theme:keyof typeof backgrounds):ColorSettings {
 return {...colors,appearance:'dark',edited:[...new Set([...(colors.edited??[]),'primary','support','accent'] as const)],
 slots:Object.fromEntries(SLOTS.map((id,i)=>[id,{...colors.slots[id],color:colors.slots[id].locked?colors.slots[id].color:i<4?backgrounds[theme][i]:generatedColor(seed,id,colors.slots[id].reroll,'dark')}])) as ColorSettings['slots']};
}
