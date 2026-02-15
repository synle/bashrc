async function doWork() {
  console.log('  >> Setting up pretty ping alias in bashrc', BASE_BASH_SYLE);
  registerWithBashSyle('pretty ping', `alias ping=prettyping`);
}
