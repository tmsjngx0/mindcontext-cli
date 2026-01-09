const { execSync } = require('child_process');

module.exports = async function() {
  try {
    execSync('mc sync --quiet', {
      stdio: 'inherit',
      timeout: 10000
    });
  } catch (e) {
    // Sync failed silently - don't block session end
  }
};
