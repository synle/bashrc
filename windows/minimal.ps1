Write-Output "Disable Internet Search for Start Menu Search"
Set-ItemProperty -Path "HKCU:\SOFTWARE\Policies\Microsoft\Windows" "DisableSearchBoxSuggestions" 1
