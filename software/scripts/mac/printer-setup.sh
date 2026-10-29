#!/usr/bin/env bash
# SOURCE software/bootstrap/common-functions.bash

# Usage: ./run --files="mac/printer-setup.sh"

PRINTER_NAME="SyHousePrinter"
PRINTER_DESCRIPTION="Sy House Printer"

# parse printer IP from ip-address.config (first line under PRINTERS section starting with a digit)
PRINTER_IP=$(grep -i "printer" software/metadata/ip-address.config 2> /dev/null | grep "^[0-9]" | head -1 | cut -d: -f1 | tr -d ' ')

if [ -z "$PRINTER_IP" ]; then
    printf '%s\n' \
      ' ">> Skipped printer setup: no printer en' \
      'try found in ip-address.config'

  exit 0
fi

    printf '%s\n' \
      ' ">> Printer IP resolved from ip-address.' \
      'config: $PRINTER_IP'

    printf '%s\n' ' ">> Setting up printer on macOS via CUPS'


# remove existing printer if present to reset config
lpadmin -x "$PRINTER_NAME" 2> /dev/null

# add the printer with Generic PostScript driver over raw socket (port 9100)
# socket:// is the most universally compatible protocol for PostScript printers
# alternative: -v "ipp://$PRINTER_IP/ipp/print" if the printer supports IPP
lpadmin -p "$PRINTER_NAME" \
  -E \
  -v "socket://$PRINTER_IP" \
  -D "$PRINTER_DESCRIPTION" \
  -m "drv:///sample.drv/generic.ppd" \
  -o printer-is-shared=false

# set as default printer
lpoptions -d "$PRINTER_NAME"

    printf '%s\n' \
      ' ">> Printer \'$PRINTER_NAME\' added at $' \
      'PRINTER_IP (Generic PostScript)'

lpstat -p "$PRINTER_NAME" 2> /dev/null && echo ">> Printer status OK" || echo ">> Warning: printer may not be reachable"
