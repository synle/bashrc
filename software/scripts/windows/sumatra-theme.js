async function doWork() {
  console.log('  >> Installing Windows Only - Sumatra Dracula Theme');

  const targetPath = path.join(getWindowAppDataLocalUserPath(), 'SumatraPDF', 'SumatraPDF-settings.txt');
  console.log('    >> Configs', consoleLogColor4(targetPath));

  if (!filePathExist(targetPath)) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  writeText(
    targetPath,
    `
      # For documentation, see https://www.sumatrapdfreader.org/settings/settings3.2.html

      MainWindowBackground = #282a36
      EscToExit = false
      ReuseInstance = false
      UseSysColors = false
      RestoreSession = true
      TabWidth = 300

      FixedPageUI [
        TextColor = #f8f8f2
        BackgroundColor = #21222c
        SelectionColor = #44475a
        WindowMargin = 2 4 2 4
        PageSpacing = 4 4
      ]
      EbookUI [
        FontName = Georgia
        FontSize = 12.5
        TextColor = #f8f8f2
        BackgroundColor = #21222c
        UseFixedPageUI = false
      ]
      ComicBookUI [
        WindowMargin = 0 0 0 0
        PageSpacing = 4 4
        CbxMangaMode = false
      ]
      ChmUI [
        UseFixedPageUI = false
      ]
      ExternalViewers [
      ]
      ShowMenubar = true
      ReloadModifiedDocuments = true
      FullPathInTitle = false
      ZoomLevels = 8.33 12.5 18 25 33.33 50 66.67 75 100 125 150 200 300 400 600 800 1000 1200 1600 2000 2400 3200 4800 6400
      ZoomIncrement = 0

      PrinterDefaults [
        PrintScale = shrink
      ]
      ForwardSearch [
        HighlightOffset = 0
        HighlightWidth = 15
        HighlightColor = #44475a75
        HighlightPermanent = false
      ]
      CustomScreenDPI = 0

      RememberStatePerDocument = true
      UiLanguage = en
      ShowToolbar = true
      ShowFavorites = false
      AssociateSilently = false
      CheckForUpdates = true
      RememberOpenedFiles = true
      EnableTeXEnhancements = false
      DefaultDisplayMode = automatic
      DefaultZoom = fit page
      WindowState = 1
      WindowPos = 739 0 1081 1400
      ShowToc = true
      SidebarDx = 0
      TocDy = 0
      ShowStartPage = true
      UseTabs = true

      FileStates [
      ]
      SessionData [
      ]
      TimeOfLastUpdateCheck = 0 0
      OpenCountWeek = 534

      # Settings after this line have not been recognized by the current version

    `,
  );
}
