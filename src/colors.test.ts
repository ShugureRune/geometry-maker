import {it,expect} from 'vitest';
import {legacyColors,reseedColors,rerollColor,SLOTS,validateColors} from './colors';
import {generateScene} from './scene';
it('independent deterministic streams, fixed colors and counter round trip',()=>{
 const bg={mode:'solid' as const,solid:'#112233',colors:['#112233','#334455','#556677'] as [string,string,string],angle:90};
 let c=reseedColors({...legacyColors(bg),mode:'seed'},'abc');
 expect(reseedColors(c,'abc')).toEqual(c);
 const original=structuredClone(c);c=rerollColor(c,'abc','primary');
 for(const id of SLOTS)if(id!=='primary')expect(c.slots[id]).toEqual(original.slots[id]);
 expect(c.slots.primary.color).not.toBe(original.slots.primary.color);
 c.slots.primary.locked=true;const next=reseedColors(c,'xyz');expect(next.slots.primary).toEqual(c.slots.primary);
 expect(next.slots.solid.color).not.toBe(c.slots.solid.color);
 expect(validateColors(JSON.parse(JSON.stringify(next)))).toEqual(next);
 const rerolled=rerollColor(next,'xyz','primary');expect(rerolled.slots.primary.locked).toBe(true);
 expect(generateScene('abc','16:9')).toEqual(generateScene('abc','16:9'));
 expect(reseedColors(legacyColors(bg),'changed').slots).toEqual(legacyColors(bg).slots);
});
