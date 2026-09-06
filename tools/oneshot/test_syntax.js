const fs = require('fs');
const code = fs.readFileSync('web/content/assets/physarum-v5.js', 'utf8');
try {
  new Function(code);
  console.log("No syntax errors");
} catch (e) {
  console.log("Syntax error:", e);
}
