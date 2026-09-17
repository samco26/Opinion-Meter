# Draws gauge.svg's geometry with GDI+ at 16, 32, 48 and 128 pixels: a rounded
# umber square (28 px corners at 128), three arcs on one circle (eucalypt, bone,
# rust) and the cream needle. Both icon sets are this one icon.
#   powershell -NoProfile -ExecutionPolicy Bypass -File extension\icons\render.ps1
Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot
$umber = [System.Drawing.ColorTranslator]::FromHtml("#5C4433")
$arcs = @(
  @{ colour = "#7FB069"; start = 180.0; sweep = 84.0 },
  @{ colour = "#DCD2BF"; start = 268.0; sweep = 36.0 },
  @{ colour = "#C45A2C"; start = 308.0; sweep = 52.0 }
)
foreach ($size in 16, 32, 48, 128) {
  $k = $size / 128.0
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  # The rounded square.
  $r = 28.0 * $k; $d = 2 * $r; $w = [float]$size
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($w - $d, 0, $d, $d, 270, 90)
  $path.AddArc($w - $d, $w - $d, $d, $d, 0, 90); $path.AddArc(0, $w - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.SolidBrush($umber)
  $g.FillPath($brush, $path)
  # The arcs: a circle of radius 34 about (64, 78), stroke 12, round caps.
  $stroke = [float](12.0 * $k)
  $box = New-Object System.Drawing.RectangleF([float](30.0 * $k), [float](44.0 * $k), [float](68.0 * $k), [float](68.0 * $k))
  foreach ($arc in $arcs) {
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($arc.colour), $stroke)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($pen, $box, [float]$arc.start, [float]$arc.sweep)
    $pen.Dispose()
  }
  # The needle, from the centre towards the upper left.
  $needle = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#F3E7D3"), $stroke)
  $needle.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $needle.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($needle, [float](64.0 * $k), [float](78.0 * $k), [float](42.8 * $k), [float](56.8 * $k))
  $needle.Dispose(); $brush.Dispose(); $g.Dispose()
  foreach ($name in "icon$size.png", "grey$size.png") { $bmp.Save((Join-Path $dir $name), [System.Drawing.Imaging.ImageFormat]::Png) }
  $bmp.Dispose()
  "rendered $size"
}
