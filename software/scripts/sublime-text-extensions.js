includeSource('software/scripts/sublime-text.common.js');

const toInstallExtensions = convertTextToList(`
  Alignment
  All Autocomplete
  BracketHighlighter
  Case Conversion
  CodeFormatter
  Compare Side-By-Side
  DocBlockr
  Dracula Color Scheme
  FileIcons
  LESS
  SCSS
  SideBarEnhancements
  SublimeCodeIntel
  SyncedSideBar
  TypeScript
`);

async function doWork() {
  let targetPath = await _getPathSublimeText();

  console.log(`  >> Setting up Sublime Text Extensions:`, consoleLogColor4(targetPath));

  // write to build file
  writeToBuildFile([
    [
      'sublime-text-extensions',
      `# Use Preferences > Package Control > Package Control: Advanced Install Package. \n${toInstallExtensions.join(',')}`,
      false,
    ],
  ]);

  if (!filePathExist(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  const sublimePackageControlConfigPath = path.join(targetPath, 'Packages/User/Package Control.sublime-settings');
  console.log('    >> Package Control', sublimePackageControlConfigPath);
  writeJson(sublimePackageControlConfigPath, {
    bootstrapped: true,
    in_process_packages: [],
    installed_packages: toInstallExtensions,
  });

  const sublimeCodeFormatConfigPath = path.join(targetPath, 'Packages/CodeFormatter/CodeFormatter.sublime-settings');
  console.log('    >> CodeFormatter.sublime-settings', sublimeCodeFormatConfigPath);

  if (!filePathExist(sublimeCodeFormatConfigPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  const oldCodeFormatConfigs = readJson(sublimeCodeFormatConfigPath);
  const newCodeFormatConfigs = {
    ...oldCodeFormatConfigs,
    ...{
      codeformatter_js_options: {
        ...oldCodeFormatConfigs.codeformatter_js_options,
        indent_size: 2,
        indent_char: ' ',
        eol: '\n',
        // space_in_paren: false,
        // space_in_empty_paren: false,
        space_after_anon_function: true,
        brace_style: 'end-expand',
        jslint_happy: true,
        wrap_line_length: 140,
        eol: '\n',
      },
      codeformatter_css_options: {
        ...oldCodeFormatConfigs.codeformatter_css_options,
        indent_size: 2,
        eol: '\n',
      },
      codeformatter_scss_options: {
        ...oldCodeFormatConfigs.codeformatter_scss_options,
        indent_size: 2,
        eol: '\n',
      },
      codeformatter_html_options: {
        ...oldCodeFormatConfigs.codeformatter_html_options,
        indent_size: 2,
      },
    },
  };
  writeJson(sublimeCodeFormatConfigPath, newCodeFormatConfigs);
}
