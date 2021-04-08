async function doWork() {
  console.log("  >> Installing Windows Only - Hotkeys (Autohotkey) Configs");

  const targetPath = path.join(
    BASE_SY_CUSTOM_TWEAKS_DIR,
    "sy-custom-autohotkey.ahk"
  );
  console.log("    >> Hotkeys (Autohotkey) Configs", targetPath);
  writeText(
    targetPath,
    `
      ; --------------------------------------------------------------
      ; NOTES
      ; --------------------------------------------------------------
      ; ! = ALT
      ; ^ = CTRL
      ; + = SHIFT
      ; # = WIN

      ; Ensures a consistent starting directory.
      SetWorkingDir %A_ScriptDir%

      ; -----------------------------------------------------------
      ; Sane Navigation Shortcuts with Alt
      ;
      ; An easier and more consistent way to send PgUp/PgDown/
      ; Home/End for laptops with no dedicated keys for these
      ; functions.
      ;
      ; The following shortcuts recruit Alt as a better Fn key,
      ; since Alt is on both sides of the keyboard and isn't used
      ; much otherwise.
      ;
      ; Alt + left arrow = Home
      ; Alt + right arrow = End
      ; Alt + up arrow = PgUp
      ; Alt + down arrow = PgDn
      ;
      ; Each Alt key (right and left) must be referred to specific-
      ; ally, else problems arise. Also, it's sometimes necessary
      ; to leave out {Alt Up}.
      ; -----------------------------------------------------------

      ; Win + Alt + Left Arrow sends Win-Home
      #!Left:: send {Win Up}{Alt Up}#{Home}

      ; PgUp/Down + Home/End shortcuts (Alt + arrow keys):

      ; first using right-Alt

      ; + arrow keys
      >!Up::send {RAlt Up}{PgUp}
      >!Down::send {RAlt Up}{PgDn}
      >!Left::send {RAlt Up}{Home}
      >!Right::send {RAlt Up}{End}

      ; Ctrl + PgUp/Down, Home/End
      ; function for text editors and word processors
      >!^Up::send {Alt Up}{Crtl Up}^{PgUp}
      >!^Down::send {Alt Up}{Crtl Up}^{PgDn}
      >!^Left::send {Alt Up}{Crtl Up}^{Home}
      >!^Right::send {Alt Up}{Crtl Up}^{End}

      ; Shift + PgUp/Down, Home/End
      ; function for text editors and word processors
      >!+Up::send {Alt Up}{Shift Up}+{PgUp}
      >!+Down::send {Alt Up}{Shift Up}+{PgDn}
      >!+Left::send {Alt Up}{Shift Up}+{Home}
      >!+Right::send {Alt Up}{Shift Up}+{End}

      ; Ctrl + Shift + PgUp/Down, Home/End
      ; function for text editors and word processors
      >!^+Up::send {Alt Up}{Crtl Up}{Shift Up}^+{PgUp}
      >!^+Down::send {Alt Up}{Crtl Up}{Shift Up}^+{PgDn}
      >!^+Left::send {Alt Up}{Crtl Up}{Shift Up}^+{Home}
      >!^+Right::send {Alt Up}{Crtl Up}{Shift Up}^+{End}

      ; now using left Alt too

      ; + arrow keys
      <!Up::send {RAlt Up}{PgUp}
      <!Down::send {RAlt Up}{PgDn}
      <!Left::send {RAlt Up}{Home}
      <!Right::send {RAlt Up}{End}

      ; Ctrl + PgUp/Down, Home/End
      ; function for text editors and word processors
      <!^Up::send {Alt Up}{Crtl Up}^{PgUp}
      <!^Down::send {Alt Up}{Crtl Up}^{PgDn}
      <!^Left::send {Alt Up}{Crtl Up}^{Home}
      <!^Right::send {Alt Up}{Crtl Up}^{End}

      ; Shift + PgUp/Down, Home/End
      ; function for text editors and word processors
      <!+Up::send {Alt Up}{Shift Up}+{PgUp}
      <!+Down::send {Alt Up}{Shift Up}+{PgDn}
      <!+Left::send {Alt Up}{Shift Up}+{Home}
      <!+Right::send {Alt Up}{Shift Up}+{End}

      ; Ctrl + Shift + PgUp/Down, Home/End
      ; function for text editors and word processors
      <!^+Up::send {Alt Up}{Crtl Up}{Shift Up}^+{PgUp}
      <!^+Down::send {Alt Up}{Crtl Up}{Shift Up}^+{PgDn}
      <!^+Left::send {Alt Up}{Crtl Up}{Shift Up}^+{Home}
      <!^+Right::send {Alt Up}{Crtl Up}{Shift Up}^+{End}

      ; Alt + left/right arrow keys conflicts with existing short-
      ; cuts in file/internet browsers (plus Alt + up arrow con-
      ; flicts in Explorer). So, use OS X keyboard shortcuts in
      ; those programs, instead (plus an imperfect compromise
      ; to replace Alt + up).
      ;
      ; In OS X, to go back/forward, Command + left and right
      ; brackets ('[]') are used. So, the same are set up here,
      ; except using Alt instead of Command.
      ;
      ; An imperfect replacement for Alt-Up (or Command-Up in
      ; OS X) is Alt + '.' (period). The mnemonic for this is that
      ; '..' is used on the command line to go up one level in a
      ; directory.

      ; --Test if browser or Explorer is active window--
      #If WinActive("ahk_class MozillaWindowClass") or WinActive("ahk_class Chrome_WidgetWin_1") or WinActive("ahk_class CabinetWClass")

      ; Alt-arrow navigation shortcuts for those programs
      <!.::send !{Up}
      <![::send !{Left}
      <!]::send !{Right}

      >!.::send !{Up}
      >![::send !{Left}
      >!]::send !{Right}

      ; --end Alt shortcuts--
    `
  );
}
