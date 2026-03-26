#!/usr/bin/env npx tsx
/**
 * CLI tool to convert an RPG Maker MZ map JSON file to Lemon AIVO LayoutData.
 *
 * Usage:
 *   npx tsx scripts/rpgmaker-import-cli.ts path/to/Map001.json
 *   npx tsx scripts/rpgmaker-import-cli.ts path/to/Map001.json --output office-layout.json
 *
 * The output JSON can be imported into the app via the layout import feature,
 * or used directly with layoutSerializer.ts's importLayoutJSON() function.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

// Dynamic import of the converter (ESM module)
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
RPG Maker MZ → Lemon AIVO Map Converter
────────────────────────────────────────

Usage:
  npx tsx scripts/rpgmaker-import-cli.ts <map-file.json> [options]

Options:
  --output, -o <file>   Output file path (default: stdout)
  --pretty              Pretty-print JSON output (default: compact)
  --help, -h            Show this help message

Examples:
  npx tsx scripts/rpgmaker-import-cli.ts ~/RPGMakerProject/data/Map001.json
  npx tsx scripts/rpgmaker-import-cli.ts Map001.json -o layout.json --pretty

Map Setup Guide:
  In RPG Maker MZ, prepare your map for conversion:

  1. Paint REGIONS (Map → Region tab) to mark rooms:
     Region 1 = Isaac    Region 5 = Board Room
     Region 2 = Billy    Region 6 = Sandra
     Region 3 = Patrik   Region 7 = Charlie
     Region 4 = Marcos   Region 8 = Wendy

  2. Place EVENTS to mark positions:
     Event name "room:isaac"        → agent seat position
     Event name "door:isaac"        → room door tile
     Event name "billy-stand:isaac" → Billy's visitor tile
     Event name "file-table:isaac"  → file table position
`);
    process.exit(0);
  }

  // Parse arguments
  const mapFilePath = resolve(args[0]!);
  let outputPath: string | null = null;
  let pretty = false;

  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
      outputPath = resolve(args[i + 1]!);
      i++;
    } else if (args[i] === '--pretty') {
      pretty = true;
    }
  }

  // Read map file
  let mapJson: string;
  try {
    mapJson = readFileSync(mapFilePath, 'utf-8');
  } catch (err) {
    console.error(`❌ Cannot read file: ${mapFilePath}`);
    console.error((err as Error).message);
    process.exit(1);
  }

  // Parse JSON
  let mapData: unknown;
  try {
    mapData = JSON.parse(mapJson);
  } catch {
    console.error(`❌ Invalid JSON in: ${basename(mapFilePath)}`);
    process.exit(1);
  }

  // Import converter (dynamic import for ESM compatibility)
  const { convertRPGMakerMap, isRPGMakerMap } = await import('../src/engine/rpgmakerImport');

  // Validate
  if (!isRPGMakerMap(mapData)) {
    console.error(`❌ File does not look like an RPG Maker MZ map.`);
    console.error(`   Expected: { width, height, data[], events[] }`);
    process.exit(1);
  }

  // Convert
  console.error(`📦 Converting: ${basename(mapFilePath)}`);
  console.error(`   Map size: ${mapData.width}×${mapData.height} tiles`);
  console.error(`   Events: ${mapData.events.filter(Boolean).length}`);

  const layoutData = convertRPGMakerMap(mapData);

  console.error(`   Rooms found: ${layoutData.rooms.length}`);
  for (const room of layoutData.rooms) {
    console.error(`     • ${room.id} (${room.width}×${room.height})`);
  }

  // Output
  const json = pretty
    ? JSON.stringify(layoutData, null, 2)
    : JSON.stringify(layoutData);

  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
    console.error(`✅ Layout saved to: ${outputPath}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
