Option Explicit

Dim shell, fso, scriptDir, systemRoot, powershellPath, uninstallPath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
systemRoot = shell.ExpandEnvironmentStrings("%SystemRoot%")
powershellPath = fso.BuildPath(systemRoot, "System32\WindowsPowerShell\v1.0\powershell.exe")
uninstallPath = fso.BuildPath(scriptDir, "uninstall.ps1")
command = Chr(34) & powershellPath & Chr(34) & _
    " -NoProfile -NonInteractive -ExecutionPolicy Bypass -File " & Chr(34) & uninstallPath & Chr(34)

shell.Run command, 0, False
