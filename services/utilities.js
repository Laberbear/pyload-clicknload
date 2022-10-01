async function keypress() {
  try {
    process.stdin.setRawMode(true);
    return new Promise((resolve) => {
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        resolve();
      });
    });
  } catch (error) {
    // Ignore since this won't work well in dev mode due to nodemon
    return null;
  }
}

module.exports = { keypress };
