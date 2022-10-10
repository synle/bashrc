async function doWork() {
  console.log('  >> Setting up jq alias in bashrc', BASE_BASH_SYLE);
  let textContent = readText(BASE_BASH_SYLE);
  textContent = prependTextBlock(
    textContent,
    'jq', // key
    trimLeftSpaces(`
      alias jq=/opt/jq
      json(){
        cat "$1" | jq .
      }
    `),
  );
  writeText(BASE_BASH_SYLE, textContent);
}
