param(
  [int]$IntervalMilliseconds = 5000,
  [int]$IdleThresholdSeconds = 300,
  [switch]$IncludeWindowTitles,
  [int]$MaxSamples = 0
)

$nativeSource = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class AtiraDesktopNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
  }

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint desiredAccess);

  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool SwitchDesktop(IntPtr desktop);

  [DllImport("user32.dll")]
  private static extern bool CloseDesktop(IntPtr desktop);

  public static uint GetIdleMilliseconds() {
    LASTINPUTINFO info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return 0;
    return unchecked((uint)Environment.TickCount - info.dwTime);
  }

  public static bool IsWorkstationLocked() {
    const uint DESKTOP_SWITCHDESKTOP = 0x0100;
    IntPtr desktop = OpenInputDesktop(0, false, DESKTOP_SWITCHDESKTOP);
    if (desktop == IntPtr.Zero) return true;
    try { return !SwitchDesktop(desktop); }
    finally { CloseDesktop(desktop); }
  }
}
"@

Add-Type -TypeDefinition $nativeSource -Language CSharp

$sampleCount = 0
while ($MaxSamples -le 0 -or $sampleCount -lt $MaxSamples) {
  $capturedAt = [DateTime]::UtcNow.ToString('o')
  $idleSeconds = [Math]::Round([AtiraDesktopNative]::GetIdleMilliseconds() / 1000.0, 1)
  $locked = [AtiraDesktopNative]::IsWorkstationLocked()
  $state = if ($locked) { 'locked' } elseif ($idleSeconds -ge $IdleThresholdSeconds) { 'idle' } else { 'active' }
  $processName = $null
  $foregroundProcessId = $null
  $windowTitle = $null

  if ($state -eq 'active') {
    $windowHandle = [AtiraDesktopNative]::GetForegroundWindow()
    if ($windowHandle -ne [IntPtr]::Zero) {
      [uint32]$nativeProcessId = 0
      [void][AtiraDesktopNative]::GetWindowThreadProcessId($windowHandle, [ref]$nativeProcessId)
      $foregroundProcessId = [int]$nativeProcessId
      $foregroundProcess = Get-Process -Id $foregroundProcessId -ErrorAction SilentlyContinue
      if ($foregroundProcess) { $processName = $foregroundProcess.ProcessName }
      if ($IncludeWindowTitles) {
        $titleBuilder = New-Object System.Text.StringBuilder 1024
        [void][AtiraDesktopNative]::GetWindowText($windowHandle, $titleBuilder, $titleBuilder.Capacity)
        if ($titleBuilder.Length -gt 0) { $windowTitle = $titleBuilder.ToString() }
      }
    }
  }

  [pscustomobject]@{
    capturedAt = $capturedAt
    state = $state
    processName = $processName
    processId = $foregroundProcessId
    idleSeconds = $idleSeconds
    windowTitle = $windowTitle
  } | ConvertTo-Json -Compress
  [Console]::Out.Flush()
  $sampleCount += 1
  if ($MaxSamples -le 0 -or $sampleCount -lt $MaxSamples) { Start-Sleep -Milliseconds $IntervalMilliseconds }
}
