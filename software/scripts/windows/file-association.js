const sublimeProgramBinaryName = 'sublime';

const sublimeBinaryPath = `ftype ${sublimeProgramBinaryName}="C:/Program Files/Sublime Text/sublime_text.exe" "%1"`;

const extensionsToOpenWithEditor = convertTextToList(`
  csv
  txt
  dat
  db
  log
  mdb
  sav
  sql
  xml
  email
  eml
  emlx
  msg
  oft
  ost
  pst
  vcf
  asp
  aspx
  cer
  cfm
  cgi
  css
  htm
  js
  jsp
  part
  php
  py
  rss
  xhtml
  c
  cpp
  cs
  h
  java
  sh
  swift
  vb
  editorconfig
  eslintignore
  babelrc
  gitignore
  prettierrc
  json
  env
  npmignore
  nvmrc
  md
  yml
  info
  nfo
  ts
  scss
  sass
  less
  html
  php5
`);

async function doInit() {
  associationContent = `
${extensionsToOpenWithEditor.map((extension) => `assoc ${extension}=${sublimeProgramBinaryName}`).join('\n')}
${sublimeBinaryPath}
  `.trim();
}

async function doWork() {
  console.log('  >> Installing Windows Only - File Associations');
  writeToBuildFile([['windows-file-association.cmd', associationContent]]);
}
