param(
    [Parameter(Mandatory=$true)]
    [string]$ManifestFile,
    [Parameter(Mandatory=$true)]
    [string]$OutputFile
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null

function Await-Async($asyncOp, $type) {
    $m = $asTaskGeneric.MakeGenericMethod($type)
    $task = $m.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US"))
}

$rawJson = Get-Content -Path $ManifestFile -Raw -Encoding utf8
$ImagePaths = $rawJson | ConvertFrom-Json
$results = @{}

foreach ($imgPath in $ImagePaths) {
    try {
        if (!(Test-Path $imgPath)) {
            $results[$imgPath] = @{
                "status" = "missing"
                "error" = "File not found"
                "lines" = @()
                "text" = ""
            }
            continue
        }
        $absPath = (Resolve-Path $imgPath).Path
        $fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($absPath)
        $file = Await-Async $fileOp ([Windows.Storage.StorageFile])

        $streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
        $stream = Await-Async $streamOp ([Windows.Storage.Streams.IRandomAccessStream])

        $decoderOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
        $decoder = Await-Async $decoderOp ([Windows.Graphics.Imaging.BitmapDecoder])

        $bitmapOp = $decoder.GetSoftwareBitmapAsync()
        $bitmap = Await-Async $bitmapOp ([Windows.Graphics.Imaging.SoftwareBitmap])

        $ocrOp = $engine.RecognizeAsync($bitmap)
        $result = Await-Async $ocrOp ([Windows.Media.Ocr.OcrResult])

        $lines = @()
        foreach ($line in $result.Lines) {
            $lines += $line.Text
        }
        $results[$imgPath] = @{
            "status" = "success"
            "lines" = $lines
            "text" = ($lines -join "`n")
        }
    } catch {
        $results[$imgPath] = @{
            "status" = "error"
            "error" = $_.Exception.Message
            "lines" = @()
            "text" = ""
        }
    }
}

$results | ConvertTo-Json -Depth 5 | Set-Content -Path $OutputFile -Encoding utf8
