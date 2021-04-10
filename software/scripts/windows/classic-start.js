async function doWork() {
  console.log("  >> Installing Windows Only - Classic Start Configs");

  const targetPath = path.join(
    BASE_SY_CUSTOM_TWEAKS_DIR,
    "windows",
    "classic_start.xml"
  );
  const res = await fetchUrlAsString(
    "https://raw.githubusercontent.com/synle/bashrc/master/windows/classic_start.xml"
  );

  console.log("    >> Classic Start Configs", targetPath);
  writeText(targetPath, res);
}
