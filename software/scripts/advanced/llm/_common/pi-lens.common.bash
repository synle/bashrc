# Reviewed package identity shared by the standalone MCP installer and Pi extension.
PI_LENS_PACKAGE='pi-lens@4.4.4'
# The standalone server imports this optional peer at startup; no Pi CLI is required.
export PI_LENS_TUI_PACKAGE='@earendil-works/pi-tui@1.4.0'
# The standalone tool schemas also import this optional peer at startup.
export PI_LENS_TYPEBOX_PACKAGE='typebox@1.4.3'
