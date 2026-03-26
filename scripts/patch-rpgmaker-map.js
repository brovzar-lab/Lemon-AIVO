// Patches a user's RPG Maker MZ Map JSON to add missing required fields.
// Usage: node scripts/patch-rpgmaker-map.js <input.json> <output.json>

const fs = require('fs');
const input = process.argv[2] || '/Users/quantumcode/CODE/LEMON-AIVO/Map001_original.json';
const output = process.argv[3] || '/Users/quantumcode/Desktop/Map001.json';

const map = JSON.parse(fs.readFileSync(input, 'utf-8'));

// 1) Add missing top-level fields
const defs = {
  autoplayBgm: false, autoplayBgs: false,
  battleback1Name: '', battleback2Name: '',
  bgm: { name: '', pan: 0, pitch: 100, volume: 90 },
  bgs: { name: '', pan: 0, pitch: 100, volume: 90 },
  disableDashing: false, displayName: '',
  encounterList: [], encounterStep: 30, note: '',
  parallaxLoopX: false, parallaxLoopY: false,
  parallaxName: '', parallaxShow: true,
  parallaxSx: 0, parallaxSy: 0,
  scrollType: 0, specifyBattleback: false,
};
for (const [k, v] of Object.entries(defs)) {
  if (map[k] === undefined) map[k] = v;
}

// 2) Patch events missing `pages` array
let patched = 0;
if (map.events) {
  for (const ev of map.events) {
    if (ev && !ev.pages) {
      ev.note = ev.note || '';
      ev.pages = [{
        conditions: {actorId:1,actorValid:false,itemId:1,itemValid:false,selfSwitchCh:'A',selfSwitchValid:false,switch1Id:1,switch1Valid:false,switch2Id:1,switch2Valid:false,variableId:1,variableValid:false,variableValue:0},
        directionFix:false,
        image:{characterIndex:0,characterName:'',direction:2,pattern:0,tileId:0},
        list:[{code:0,indent:0,parameters:[]}],
        moveFrequency:3,
        moveRoute:{list:[{code:0,parameters:[]}],repeat:true,skippable:false,wait:false},
        moveSpeed:3,moveType:0,priorityType:0,stepAnime:false,through:true,trigger:0,walkAnime:true
      }];
      patched++;
    }
  }
}

fs.writeFileSync(output, JSON.stringify(map));
console.log('Grid: ' + map.width + 'x' + map.height);
console.log('Patched ' + patched + ' events');
console.log('Saved to: ' + output);
