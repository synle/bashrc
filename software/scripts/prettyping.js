async function doWork() {
  console.log('  >> Setting up pretty ping alias in bashrc', BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'pretty ping', // key
    `alias ping=prettyping`,
  );
  writeText(BASE_BASH_SYLE, textContent);
}
