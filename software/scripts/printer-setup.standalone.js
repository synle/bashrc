/** Sets up the home network printer at 192.168.1.11 with Generic PostScript driver (macOS and Windows). */
async function doWork() {
  /** @type {string} */
  const PRINTER_IP = "192.168.1.11";
  /** @type {string} */
  const PRINTER_NAME = "SyHousePrinter";
  /** @type {string} */
  const PRINTER_DESCRIPTION = "Sy House Printer";

  if (is_os_mac) {
    log(">> Setting up printer on macOS via CUPS");
    emitBash(`
      # remove existing printer if present to reset config
      lpadmin -x "${PRINTER_NAME}" 2>/dev/null

      # add the printer with Generic PostScript driver over raw socket (port 9100)
      # socket:// is the most universally compatible protocol for PostScript printers
      # alternative: -v "ipp://${PRINTER_IP}/ipp/print" if the printer supports IPP
      lpadmin -p "${PRINTER_NAME}" \\
        -E \\
        -v "socket://${PRINTER_IP}" \\
        -D "${PRINTER_DESCRIPTION}" \\
        -m "drv:///sample.drv/generic.ppd" \\
        -o printer-is-shared=false

      # set as default printer
      lpoptions -d "${PRINTER_NAME}"

      echo ">> Printer '${PRINTER_NAME}' added at ${PRINTER_IP} (Generic PostScript)"
      lpstat -p "${PRINTER_NAME}" 2>/dev/null && echo ">> Printer status OK" || echo ">> Warning: printer may not be reachable"
    `);
    return;
  }

  if (is_os_windows) {
    log(">> Setting up printer on Windows via PowerShell");
    emitBash(`
      powershell.exe -NoProfile -Command "
        # remove existing printer and port if present
        Remove-Printer -Name '${PRINTER_NAME}' -ErrorAction SilentlyContinue
        Remove-PrinterPort -Name 'IP_${PRINTER_IP}' -ErrorAction SilentlyContinue

        # create TCP/IP port
        Add-PrinterPort -Name 'IP_${PRINTER_IP}' -PrinterHostAddress '${PRINTER_IP}'

        # add printer with Generic PS driver
        Add-Printer -Name '${PRINTER_NAME}' -DriverName 'Microsoft PS Class Driver' -PortName 'IP_${PRINTER_IP}'

        Write-Host 'Printer ${PRINTER_NAME} added at ${PRINTER_IP} (Microsoft PS Class Driver)'
        Get-Printer -Name '${PRINTER_NAME}' | Format-List Name,DriverName,PortName
      "
    `);
    return;
  }

  log(">> Skipped printer setup: only supported on macOS and Windows");
}
