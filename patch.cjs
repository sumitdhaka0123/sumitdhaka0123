const fs = require('fs');
let types = fs.readFileSync('src/types.ts', 'utf8');

if (!types.includes('export interface DriveConfig')) {
  types = types.replace('export interface DBState {', `export interface DriveConfig {\n  clientId: string;\n  clientSecret: string;\n  refreshToken: string;\n  connectedEmail: string;\n  autoSync: boolean;\n  folderId: string;\n}\n\nexport interface DBState {`);
  types = types.replace('  unassembledBoxedStock?: number;\n}', '  unassembledBoxedStock?: number;\n  driveConfig?: DriveConfig;\n}');
  fs.writeFileSync('src/types.ts', types);
  console.log('Patched src/types.ts');
}
