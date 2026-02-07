const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '..', 'offerimages');
console.log('Resolved dir:', dir);
console.log('Exists:', fs.existsSync(dir));
if (fs.existsSync(dir)) {
  console.log('Files:', fs.readdirSync(dir));
}
