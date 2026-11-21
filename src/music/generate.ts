import {
  BAR, COLORS, INSTRUMENTS, MUSIC_VERSION, NAMES, PARTS, PPQ, PROGRAMS, clamp, hashSeed, musicRandom, noteOrder,
  type Config, type Instrument, type Note, type Part, type Section, type Song, type Track,
} from './song';
import {generateEpicNotes} from './epic';
import {melodyBlueprint} from './melody-phrase';
import {bassPhrase} from './bass-phrase';

const major = [0, 2, 4, 5, 7, 9, 11];
const minor = [0, 2, 3, 5, 7, 8, 10];
const scales: Record<Config['scale'], number[]> = {
  メジャー: major, ナチュラルマイナー: minor,
  メジャーペンタトニック: [0, 2, 4, 7, 9], マイナーペンタトニック: [0, 3, 5, 7, 10],
};
type Style = {
  instruments: [Instrument, Instrument, Instrument];
  progressions: number[][]; melody: number[]; bass: number[]; kicks: number[]; hats: number;
  chordHits: number[]; seventh: boolean;
};
const styles: Record<Config['genre'], Style> = {
  チップチューン: {instruments:['8-bit Lead','Synth Pluck','Synth Bass'], progressions:[[0,3,4,0],[0,5,3,4]],
    melody:[0,2,3,4,6,7], bass:[0,2,4,6], kicks:[0,4], hats:2, chordHits:[0,4], seventh:false},
  EDM: {instruments:['Synth Lead','Pad','Synth Bass'], progressions:[[0,4,5,3],[5,3,0,4]],
    melody:[0,1,3,4,6], bass:[1,3,5,7], kicks:[0,2,4,6], hats:2, chordHits:[0], seventh:false},
  テクノ: {instruments:['Synth Pluck','Synth Lead','Synth Bass'], progressions:[[0,0,3,0],[0,0,5,4]],
    melody:[0,3,5,7], bass:[0,1,3,4,6,7], kicks:[0,2,4,6], hats:1, chordHits:[1,5], seventh:false},
  'Lo-fi': {instruments:['Electric Piano','Electric Piano','Synth Bass'], progressions:[[0,5,1,4],[0,3,1,4]],
    melody:[0,2,3,5,6], bass:[0,3,5], kicks:[0,3,5], hats:2, chordHits:[0,5], seventh:true},
  アンビエント: {instruments:['Synth Pluck','Pad','Pad'], progressions:[[0,3,5,0],[0,5,3,0]],
    melody:[0,3,6], bass:[0,4], kicks:[0], hats:4, chordHits:[0], seventh:true},
  シンセウェーブ: {instruments:['Synth Lead','Pad','Synth Bass'],
    progressions:[[5,3,0,4],[0,4,5,3],[0,5,3,4]],
    melody:[0,2,4,5,7], bass:[0,2,4,6], kicks:[0,2,4,6], hats:4, chordHits:[0,4], seventh:false},
  ジャズ: {instruments:['Piano','Electric Piano','Synth Bass'],
    progressions:[[0,5,1,4],[1,4,0,5],[2,5,1,4]],
    melody:[0,1,3,4,6], bass:[0,2,4,6], kicks:[0,4], hats:2, chordHits:[0,3,6], seventh:true},
  ファンク: {instruments:['Synth Pluck','Electric Piano','Synth Bass'],
    progressions:[[0,3,4,3],[0,4,3,4],[0,5,3,4]],
    melody:[0,2,3,5,6,7], bass:[0,1,3,4,6], kicks:[0,3,5,7], hats:1, chordHits:[1,3,5,7], seventh:true},
  ドラムンベース: {instruments:['Synth Lead','Synth Pluck','Synth Bass'],
    progressions:[[0,4,5,3],[5,3,0,4],[0,5,4,3]],
    melody:[0,1,3,4,6,7], bass:[0,1,3,5,6], kicks:[0,3,6], hats:1, chordHits:[0,4], seventh:false},
  シネマティック: {instruments:['Piano','Pad','Pad'],
    progressions:[[0,3,5,4],[5,3,0,4],[0,4,3,0]],
    melody:[0,3,4,6], bass:[0,4], kicks:[0,4], hats:4, chordHits:[0], seventh:true},
  // Trailer-inspired: minor-key heroic ostinato, sustained harmonic layers,
  // half-time impacts and a distinct late climax rather than generic cinematic ambience.
  エピック: {instruments:['Synth Lead','Pad','Synth Bass'],
    progressions:[[0,5,3,4],[0,3,5,4],[0,5,4,3]],
    melody:[0,2,4,5,6], bass:[0,2,4,6], kicks:[0,3,4,6], hats:2, chordHits:[0,4], seventh:false},
};

/** Extra parts layer over the four original voices; the original seed output is unchanged at 4 tracks. */
const layeredInstruments: Record<Config['genre'], [Instrument,Instrument,Instrument,Instrument]> = {
  チップチューン: ['8-bit Lead','Pad','Synth Pluck','8-bit Lead'],
  EDM: ['Synth Pluck','Pad','Synth Lead','Synth Pluck'],
  テクノ: ['Synth Pluck','Pad','8-bit Lead','Synth Bass'],
  'Lo-fi': ['Electric Piano','Pad','Piano','Synth Pluck'],
  アンビエント: ['Synth Pluck','Pad','Electric Piano','Synth Pluck'],
  シンセウェーブ: ['Synth Pluck','Pad','Synth Lead','Synth Bass'],
  ジャズ: ['Electric Piano','Pad','Piano','Synth Pluck'],
  ファンク: ['Synth Pluck','Pad','Synth Lead','Synth Bass'],
  ドラムンベース: ['Synth Pluck','Pad','Synth Lead','Synth Bass'],
  シネマティック: ['Synth Pluck','Pad','Piano','Synth Pluck'],
  エピック: ['Synth Pluck','Pad','Synth Lead','Synth Pluck'],
};

function arrangement(config: Config): Section[] {
  // The standard path remains identical to the original generator for older seeds.
  const standard = config.genre === 'エピック' && config.bars >= 16
    ? (config.bars >= 64 ? ['Intro','A','A′','Build','B','B′','Break','B′','Outro']
      : ['Intro','A','Build','B','B′','Outro'])
    : config.bars >= 128 ? ['Intro','A','A′','B','B′','A','Bridge','B','Break','A′','B′','Outro'] :
    config.bars === 4 ? ['Intro','A','B','Outro'] :
    config.bars >= 32 ? ['Intro','A','B','A′','B′','Outro'] : ['Intro','A','B','Outro'];
  // The opening and ending stay predictable, while longer standard songs
  // gain seed-dependent section order and contrasting returns.
  const sectionRand = musicRandom(JSON.stringify([MUSIC_VERSION, config.seed, 'form']));
  const variedStandard = config.bars >= 32 && config.genre !== 'エピック'
    ? (config.bars >= 128
      ? (sectionRand() < .5
        ? ['Intro','A','B','A′','Bridge','B′','A','Break','B','A′','B′','Outro']
        : ['Intro','A','A′','Bridge','B','A','B′','Break','A′','B','B′','Outro'])
      : (sectionRand() < .5
        ? ['Intro','A','B','A′','B′','Outro']
        : ['Intro','A','A′','B','B′','Outro']))
    : standard;
  const names = config.arrangement === 'サビ重視'
    ? (config.bars <= 8 ? ['Intro','A','B','B′'] : ['Intro','A','B','A′','B′','B','Outro'])
    : config.arrangement === 'ビルドアップ'
      ? (config.bars <= 8 ? ['Intro','A','B','Outro'] : ['Intro','A','A′','B','B′','B′','Outro'])
      : config.arrangement === 'ループ' ? ['A','B','A′','B′'] : variedStandard;
  return names.map((name, i) => {
    const startBar = Math.floor(i * config.bars / names.length);
    return {name, startBar, bars: Math.floor((i + 1) * config.bars / names.length) - startBar};
  });
}

function harmonies(config: Config, sections: Section[], variation: number) {
  const style = styles[config.genre];
  const rand = musicRandom(JSON.stringify([MUSIC_VERSION, config.seed, 'harmony', variation]));
  const scale = config.scale.includes('マイナー') ? minor : major;
  // Choose a coherent harmonic identity for each section rather than applying
  // one four-chord loop to the entire song. A/B contrast is seed-dependent.
  const progressions = sections.map((section, index) => {
    const base = style.progressions[Math.floor(rand() * style.progressions.length)];
    const rotation = index === 0 ? 0 : Math.floor(rand() * base.length);
    const contrast = section.name.startsWith('B') || section.name === 'Bridge';
    return {section, sequence: base, rotation: contrast ? rotation : 0};
  });
  const offset = Math.floor(rand() * 3);
  return Array.from({length: config.bars}, (_, bar) => {
    const selected = progressions.find(item =>
      item.section.startBar <= bar && bar < item.section.startBar + item.section.bars)!;
    const {section, sequence, rotation} = selected;
    const alternate = section.name.startsWith('B') || config.mood === '緊張感';
    const localBar = bar - section.startBar;
    const degree = bar === config.bars - 1 ? 0 :
      sequence[(localBar + rotation + (alternate ? offset + 1 : 0)) % sequence.length];
    const degrees = style.seventh || config.complexity > 72 ? [0, 2, 4, 6] : [0, 2, 4];
    return degrees.map(interval => {
      const index = degree + interval;
      return 48 + config.key + scale[index % 7] + 12 * Math.floor(index / 7);
    });
  });
}

function generateNotes(part: Part, config: Config, sections: Section[], variation: number, chords: number[][]) {
  const style = styles[config.genre];
  const rand = musicRandom(JSON.stringify([MUSIC_VERSION, config.seed, part, variation]));
  const notes: Note[] = [];
  const half = PPQ / 2;
  const mode = scales[config.scale];
  const bassMotifs = new Map<string, ReturnType<typeof bassPhrase>>();
  const bassFor=(sectionName:string)=>{
    const family=sectionName.replace('′','');
    let phrase=bassMotifs.get(family);
    if(!phrase){phrase=bassPhrase(config,family,variation);bassMotifs.set(family,phrase);}
    return phrase;
  };
  const blueprints = new Map<string, ReturnType<typeof melodyBlueprint>>();
  const phraseFor=(sectionName:string)=>{
    const family=sectionName.replace('′','');
    let phrase=blueprints.get(family);
    if(!phrase){phrase=melodyBlueprint(config,family,variation);blueprints.set(family,phrase);}
    return phrase;
  };
  const add = (bar: number, step: number, pitch: number, length: number, velocity: number) => {
    const micro = Number.isInteger(step) && step % 2 ? Math.round(config.swing * .95) : 0;
    const startTick = bar * BAR + step * half + micro;
    const durationTicks = Math.max(1, Math.min(Math.round(length), (bar + 1) * BAR - startTick));
    notes.push({id: part + '-' + notes.length, pitch, startTick, durationTicks,
      velocity: clamp(Math.round(velocity), 1, 127)});
  };
  let previous = 65 + config.key;
  for (let bar = 0; bar < config.bars; bar++) {
    const section = sections.find(s => bar >= s.startBar && bar < s.startBar + s.bars)!;
    const intro = section.name === 'Intro', outro = section.name === 'Outro', contrast = section.name.startsWith('B');
    const epic = config.genre === 'エピック';
    const build = epic && section.name === 'Build';
    const baseEnergy = intro ? .63 : outro ? .73 : contrast ? 1 : .87;
    const progress = bar / Math.max(1,config.bars-1);
    const arrangementEnergy = config.arrangement === 'ビルドアップ'
      ? (.66 + progress * .48)
      : config.arrangement === 'サビ重視' && contrast ? 1.17
      : config.arrangement === 'ループ' ? .96 : 1;
    const epicEnergy = epic ? (intro ? .46 : outro ? .72 : build ? .78 + .25*(bar-section.startBar)/Math.max(1,section.bars-1)
      : contrast ? 1.14 : .72 + .19*progress) : 1;
    const energy = Math.min(1.25,epic ? epicEnergy*arrangementEnergy : baseEnergy*arrangementEnergy);
    const density = (.35 + config.density * .006) * energy;
    const harmony = chords[bar];
    const final = bar === config.bars - 1;
    if (part === 'chords') {
      const hits = intro || final || density < .45 ? [0] : style.chordHits;
      hits.forEach((step, i) => {
        const length = final ? BAR : Math.min(((hits[i+1] ?? 8) - step) * half - 100, config.genre === 'テクノ' ? 180 : BAR);
        harmony.forEach((pitch, voice) => add(bar, step,
          pitch - (voice > 1 && (contrast || config.mood === '暗い') ? 12 : 0),
          length, 52 + energy * 20 + rand() * 6));
        // Low tonic octaves anchor the harmony like trailer brass/cellos.
        if (epic) add(bar,step,clamp(harmony[0]-12,0,127),length,60+energy*24);
      });
    } else if (part === 'bass') {
      // The root carries each chord; offbeat fifths/thirds give the phrase a
      // seeded character without breaking the harmonic foundation.
      const phrase=bassFor(section.name);
      const motif=phrase[(bar-section.startBar)%4];
      const hits=final || (intro && bar===0)
        ? [{step:0,chordTone:0 as const,octave:false}]
        : intro ? motif.filter((beat,i)=>i===0||beat.step<=4)
        : motif;
      hits.forEach((hit,i) => {
        const tone=harmony[hit.chordTone]??harmony[0];
        const pitch=clamp(34+((tone-34)%12)+(hit.octave?12:0),34,59);
        // Shorten before the next onset; swing cannot create same-pitch overlaps.
        const remaining=((hits[i+1]?.step??8)-hit.step)*half;
        const nextSwing=hits[i+1]?.step%2 ? Math.round(config.swing*.95) : 0;
        const currentSwing=hit.step%2 ? Math.round(config.swing*.95) : 0;
        const length=Math.max(1,remaining+nextSwing-currentSwing-105);
        add(bar,hit.step,pitch,final?BAR-90:length,
          64+energy*24+rand()*6+(i===0?6:0));
      });
    } else if (part === 'melody') {
      if (intro && bar !== 0 && bar % 2 !== 0) continue;
      const blueprint=phraseFor(section.name);
      const phraseBar=(bar-section.startBar)%4;
      const motif=blueprint.contour;
      const phraseSteps=blueprint.bars[phraseBar];
      // A rest is meaningful: preserve the question/answer cell and allow
      // occasional omissions without throwing away the first strong beat.
      const steps=final?[0]:phraseSteps.filter((_,i)=>
        (i===0||config.melodyStyle==='疾走'||rand()<Math.min(.98,.78+energy*.13)) &&
        (!intro||i<2) && (!outro||i<3));
      const onset=(step:number)=>step*half+(Number.isInteger(step)&&step%2?Math.round(config.swing*.95):0);
      steps.forEach((step,i)=>{
        const motifValue=motif[(i+phraseBar*2)%motif.length];
        // The same four-bar idea returns, while B-family answers emphasize
        // a contrasting register and the third phrase bar briefly recedes.
        const development=phraseBar===1?2:phraseBar===2?-2:0;
        const jump=config.melodyStyle==='跳躍'?(phraseBar%2===0?5:-4)+motifValue*3:
          config.melodyStyle==='歌う'?motifValue:motifValue*2;
        const target=(config.mood==='暗い'?63:68)+blueprint.register+
          (contrast?4:0)+jump+development;
        const accent=step===0||step===4||final;
        const cadence=phraseBar===3&&i===steps.length-1;
        const tones=accent||cadence
          ? (final?[config.key]:harmony.map(p=>p%12))
          : mode.map(p=>(p+config.key)%12);
        const candidate=Array.from({length:29},(_,index)=>index+56)
          .filter(p=>tones.includes(p%12))
          .sort((left,right)=>{
            const continuity=config.melodyStyle==='跳躍'?.11:config.melodyStyle==='歌う'?.9:.55;
            return (Math.abs(left-target)+Math.abs(left-previous)*continuity)-
              (Math.abs(right-target)+Math.abs(right-previous)*continuity);
          });
        // Phrase endings resolve toward the current chord root or third,
        // while ordinary notes retain their seed-selected melodic contour.
        // Prefer a nearby chord tone: avoid octave leaps at every cadence.
        const cadenceCandidates=cadence && !final
          ? candidate.filter(p=>[harmony[0]%12,harmony[2]%12].includes(p%12))
          : candidate;
        const resolved=cadenceCandidates.length
          ? [...cadenceCandidates].sort((a,b)=>
              (Math.abs(a-previous)*.75+Math.abs(a-target)*.25)-
              (Math.abs(b-previous)*.75+Math.abs(b-target)*.25))[0]
          : candidate[0];
        const pitch=cadence ? resolved :
          (candidate[!accent&&config.complexity>65&&phraseBar===3&&rand()>.57?1:0]??candidate[0]);
        previous=pitch;
        const duration=final?BAR*.88:Math.max(1,
          onset(steps[i+1]??8)-onset(step)-(cadence?18:Math.round(110-70*blueprint.articulation)));
        add(bar,step,pitch,duration,66+energy*25+rand()*8+(accent?6:0));
      });
    } else if (part === 'drums') {
      style.kicks.forEach((step, i) => {
        if ((i === 0 || rand() < density + .28) && (!final || step === 0) &&
          (!epic || !intro || step===0)) add(bar, step, 36, epic?(step===3?120:220):190, 73 + energy * 32);
      });
      // Each section family owns a reproducible groove. Keep the main backbeat
      // recognizable, but vary ghost snares, kick pickups and hat accents by seed.
      const grooveRand = musicRandom(JSON.stringify([
        MUSIC_VERSION, config.seed, 'drum-groove', variation, section.name.replace('′', ''),
      ]));
      const ghostStep = [1, 3, 5, 7][Math.floor(grooveRand() * 4)];
      const pickupStep = [1, 3, 5, 7][Math.floor(grooveRand() * 4)];
      const hatAccent = Math.floor(grooveRand() * 4);
      if (!final && !(intro && bar === 0) && config.genre !== 'アンビエント') {
        // A subtle, genre-specific backbeat accent keeps closely related styles
        // distinguishable without adding unnatural extra hits or changing timing.
        const backbeatAccent = Object.keys(styles).indexOf(config.genre) * 1.5;
        for (const step of epic ? [4] : [2, 6])
          add(bar, step, 38, epic?195:145, 70 + energy * 23 + backbeatAccent + rand() * 8);
        // A quiet ghost note only on selected phrase bars, not every beat.
        if (!epic && density > .48 && (bar - section.startBar) % 4 === 3 &&
            rand() < .35 + config.complexity * .004)
          add(bar, ghostStep, 38, 85, 29 + energy * 15);
      }
      if (!final && !intro && !epic && config.genre !== 'アンビエント' &&
          (bar - section.startBar) % 4 === 3 && rand() < density * .6 &&
          !style.kicks.includes(pickupStep))
        add(bar, pickupStep, 36, 100, 42 + energy * 18);
      if (!final) for (let step = 1; step < 8; step += style.hats) {
        if ((!epic || !intro) && rand() < density + .26)
          add(bar, step, step === 7 && contrast ? 46 : 42, 100,
            42 + energy * 21 + rand() * 12 + (step % 4 === hatAccent ? 9 : 0));
      }
      // Four accelerating impacts in the last beat of every pre-climax build bar.
      if (epic && build && !final) for (const step of [5,6,7]) {
        const pitch=step===7?46:42;
        const onset=bar*BAR+step*half+(step%2?Math.round(config.swing*.95):0);
        if (!notes.some(note=>note.pitch===pitch && note.startTick===onset))
          add(bar,step,pitch,85,58+energy*25+step);
      }
    } else if (part === 'arp') {
      // Short notes cycle through the active chord, creating a distinct moving layer.
      if (intro && bar % 2) continue;
      for (let step = 0; step < 8; step++) {
        if (step !== 0 && rand() > (epic ? Math.min(1,density+.12+progress*.21) : density + .17)) continue;
        const pitch = harmony[(step + bar + (contrast ? 1 : 0)) % harmony.length] + 12;
        add(bar, step, clamp(pitch, 0, 127), Math.round(half * .73), 44 + energy * 17 + rand() * 12);
      }
    } else if (part === 'pad') {
      // Sustained harmony remains on a separate track for independent mixing/editing.
      for (const pitch of harmony)
        add(bar, 0, clamp(pitch + 12, 0, 127), BAR - 28, 38 + energy * 13 + rand() * 8);
    } else if (part === 'counter') {
      // A slower answering phrase, kept separate from the original melody.
      if (intro && bar % 2) continue;
      for (const step of [0, 4]) {
        if (step === 4 && rand() > density + .18) continue;
        const pitch = harmony[(bar + step / 4) % harmony.length] + 12;
        add(bar, step, clamp(pitch, 0, 127), Math.round(half * 3.2), 48 + energy * 18 + rand() * 9);
      }
    } else if (part === 'pulse') {
      // A rhythmic synth ostinato, not an additional drum channel.
      if (intro && bar % 2) continue;
      for (const step of [0, 2, 4, 6]) {
        if (step > 0 && rand() > (epic ? Math.min(1,density+.25+progress*.2) : density + .22)) continue;
        const pitch = harmony[0] + (contrast && step === 6 ? 12 : 0);
        add(bar, step, clamp(pitch, 0, 127), Math.round(half * .74), 49 + energy * 19 + rand() * 10);
      }
    }
  }
  return notes.sort(noteOrder);
}

const defaultTitle = (seed: string) => ('Seed '+(seed||'Empty')).slice(0,120);

export function generateSong(config: Config, options: {
  previous?: Song; reroll?: Part | 'all'; regenerateDependents?: boolean;
} = {}): Song {
  const {previous, reroll, regenerateDependents} = options;
  const sections = arrangement(config);
  const totalTicks = config.bars * BAR;
  const isRerolled = (part: Part) => reroll === 'all' || part === reroll ||
    (reroll === 'chords' && regenerateDependents && (part === 'melody' || part === 'bass'));
  const old = (part: Part) => previous?.tracks.find(track => track.id === part);
  const variation = (part: Part) => {
    const existing = old(part);
    if (existing?.locked) return existing.variation;
    if (!reroll) return 0;
    const current = existing?.variation ?? 0;
    return isRerolled(part) ? (current + 1) % Number.MAX_SAFE_INTEGER : current;
  };
  // Keep the actual harmonic context when chord notes are held or edited.
  const tonal = harmonies(config, sections, variation('chords'));
  const chordTrack = old('chords');
  if (chordTrack && (chordTrack.locked || (reroll && !isRerolled('chords')))) {
    tonal.forEach((_, bar) => {
      const pitches = chordTrack.notes.filter(n => n.startTick < (bar+1)*BAR && n.startTick+n.durationTicks > bar*BAR)
        .map(n => n.pitch).sort((a,b) => a-b);
      if (pitches.length) tonal[bar] = [...new Set(pitches)];
    });
  }
  const tracks = PARTS.slice(0, config.trackCount).map((part, i): Track => {
    const existing = old(part);
    if (existing && (existing.locked || (reroll && !isRerolled(part)))) {
      if (existing.notes.some(n => n.startTick+n.durationTicks > totalTicks))
        throw new Error('固定中のパートに曲の長さを超える音符があります。固定を解除するか小節数を戻してください。');
      return existing;
    }
    const genreInstrument = i < 4 ? styles[config.genre].instruments[i] : layeredInstruments[config.genre][i - 4];
    const instrument: Instrument = part === 'drums' ? 'Drum Kit' :
      existing && previous?.config.genre === config.genre ? existing.instrument : genreInstrument;
    return {
      id: part, type: part, name: NAMES[i], color: existing?.color ?? COLORS[i], instrument,
      midiChannel: part === 'drums' ? 9 : i, midiProgram: PROGRAMS[INSTRUMENTS.indexOf(instrument)],
      volume: existing?.volume ?? [.69,.55,.63,.64,.32,.28,.36,.24][i], pan: existing?.pan ?? [.06,-.16,0,.09,-.2,.15,.22,-.12][i],
      muted: existing?.muted ?? false, solo: existing?.solo ?? false, locked: false,
      velocityScale: existing?.velocityScale ?? 1, variation: variation(part),
      notes: config.genre==='エピック' ? generateEpicNotes(part,config,sections,variation(part),tonal)
        : generateNotes(part, config, sections, variation(part), tonal),
    };
  });
  return {
    id: 'music-' + hashSeed(JSON.stringify([MUSIC_VERSION, config])).toString(36),
    title: previous && previous.title !== defaultTitle(previous.seed) ? previous.title : defaultTitle(config.seed),
    seed: config.seed, generatorVersion: MUSIC_VERSION,
    config, bpm: config.bpm, key: config.key, scale: config.scale, ppq: PPQ,
    timeSignature: [4,4], totalTicks, tracks, sections, mixer: previous?.mixer ?? {volume:.82, muted:false, limiter:true},
  };
}
