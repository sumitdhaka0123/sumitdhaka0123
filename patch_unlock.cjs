const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
"    failedAttempts: locked === false ? 0 : oldUser.failedAttempts\n  };",
"    failedAttempts: locked === false ? 0 : oldUser.failedAttempts\n  };\n\n  if (locked === false) {\n    recordAuthSuccess(newNormalizedUsername);\n  }"
);

fs.writeFileSync('server.ts', code);
