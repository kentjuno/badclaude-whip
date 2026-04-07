try {
  const iohook = require('iohook');
  console.log('iohook loaded successfully!');
} catch (e) {
  console.error('iohook failed to load:', e.message);
}
