async function doWork() {
  console.log('  >> Installing Windows Only - File Associations');

  const targetPath = path.join(BASE_SY_CUSTOM_TWEAKS_DIR, 'windows', 'file-association.cmd');
  console.log('  >> Windows File Associations', targetPath);
  writeText(
    targetPath,
    `
      ftype sublime="C:\Program Files\Sublime Text 3\sublime_text.exe" "%1"
      assoc .csv=sublime
      assoc .dat=sublime
      assoc .db=sublime
      assoc .log=sublime
      assoc .mdb=sublime
      assoc .sav=sublime
      assoc .sql=sublime
      assoc .tar=sublime
      assoc .xml=sublime
      assoc .email=sublime
      assoc .eml=sublime
      assoc .emlx=sublime
      assoc .msg=sublime
      assoc .oft=sublime
      assoc .ost=sublime
      assoc .pst=sublime
      assoc .vcf=sublime
      assoc .asp=sublime
      assoc .aspx=sublime
      assoc .cer=sublime
      assoc .cfm=sublime
      assoc .cgi=sublime
      assoc .css=sublime
      assoc .htm=sublime
      assoc .js=sublime
      assoc .jsp=sublime
      assoc .part=sublime
      assoc .php=sublime
      assoc .py=sublime
      assoc .rss=sublime
      assoc .xhtml=sublime
      assoc .c=sublime
      assoc .cpp=sublime
      assoc .cs=sublime
      assoc .h=sublime
      assoc .java=sublime
      assoc .sh=sublime
      assoc .swift=sublime
      assoc .vb=sublime
      assoc .editorconfig=sublime
      assoc .eslintignore=sublime
      assoc .babelrc=sublime
      assoc .gitignore=sublime
      assoc .prettierrc=sublime
      assoc .json=sublime
      assoc .env=sublime
      assoc .npmignore=sublime
      assoc .nvmrc=sublime
      assoc .md=sublime
      assoc .yml=sublime
      assoc .info=sublime
      assoc .nfo=sublime
      assoc .ts=sublime
      assoc .scss=sublime
      assoc .sass=sublime
      assoc .less=sublime
      assoc .html=sublime
      assoc .php5=sublime
    `,
  );
}
