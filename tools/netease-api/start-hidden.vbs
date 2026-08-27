Option Explicit

Dim shell, fso, scriptDir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

shell.Run Chr(34) & scriptDir & "\run-hidden.cmd" & Chr(34), 0, False
