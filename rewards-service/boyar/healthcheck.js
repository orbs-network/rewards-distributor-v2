const fs = require('fs');

try {
  const status = JSON.parse(fs.readFileSync('./status/status.json').toString());
  const updatedAgoSeconds = (new Date().getTime() - new Date(status.Timestamp).getTime()) / 1000;
  if (updatedAgoSeconds > 15 * 60) {
    console.log(`Timestamp was not updated in status.json for ${updatedAgoSeconds} seconds.`);
    process.exit(128);
  }
} catch (err) {
  console.log(err.stack);
  process.exit(0); // don't restart in this case, maybe service isn't ready
}

// all good
process.exit(0);