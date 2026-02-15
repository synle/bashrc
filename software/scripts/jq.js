async function doWork() {
  console.log('  >> Setting up jq alias in bashrc', BASE_BASH_SYLE);
  registerWithBashSyle(
    'jq',
    trimLeftSpaces(`
      alias jq=/opt/jq
      json(){
        cat "$1" | jq .
      }
    `),
  );
}
