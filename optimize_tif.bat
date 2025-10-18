@echo off
cd /d "%~dp0public\data"

echo ========================================
echo   TIF Optimization (Three-Step Method)
echo ========================================
echo.
echo Input:  2024_kle_vh_kndvi.tif
echo Output: 2024_kle_vh_kndvi_optimized.tif
echo.
echo Three-step process:
echo   Step 1: Set NoData=255 before projection
echo   Step 2: Reproject with INIT_DEST=255
echo   Step 3: Re-confirm NoData=255 after projection
echo   Step 4: Add pyramids
echo.
echo ========================================
echo.

set INPUT=2024_kle_vh_kndvi.tif
set OUTPUT=2024_kle_vh_kndvi_optimized.tif
set TEMP1=temp_nodata_%RANDOM%.tif
set TEMP2=temp_reprojected_%RANDOM%.tif

if not exist "%INPUT%" (
    echo ERROR: Input file not found
    pause
    exit /b 1
)

echo [Step 1/4] Setting NoData=255 BEFORE projection...
echo.

gdal_translate -a_nodata 255 "%INPUT%" "%TEMP1%"

if errorlevel 1 (
    echo ERROR: Step 1 failed
    del "%TEMP1%" 2>nul
    pause
    exit /b 1
)

echo   NoData metadata set to 255
echo.

echo [Step 2/4] Reprojecting with fill value=255...
echo   Source: EPSG:32645 (WGS 84 UTM Zone 45N)
echo   Target: EPSG:3857 (Web Mercator)
echo   Fill new areas with 255 (transparent)
echo.

REM Key parameters:
REM -srcnodata 255: source NoData is 255
REM -dstnodata 255: output NoData should be 255
REM -wo INIT_DEST=255: fill NEW areas with 255 (not 0!)

gdalwarp -s_srs EPSG:32645 -t_srs EPSG:3857 -srcnodata 255 -dstnodata 255 -wo INIT_DEST=255 -of GTiff -co TILED=YES -co COMPRESS=LZW -r near "%TEMP1%" "%TEMP2%"

del "%TEMP1%" 2>nul

if errorlevel 1 (
    echo ERROR: Step 2 failed
    del "%TEMP2%" 2>nul
    pause
    exit /b 1
)

echo   Reprojection completed
echo.

echo [Step 3/4] Re-confirming NoData=255 and converting to COG...
echo.

REM Re-apply NoData=255 to ensure it's set correctly
gdal_translate -a_nodata 255 -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co TILED=YES -co BIGTIFF=IF_SAFER "%TEMP2%" "%OUTPUT%"

del "%TEMP2%" 2>nul

if errorlevel 1 (
    echo ERROR: Step 3 failed
    pause
    exit /b 1
)

echo   NoData re-confirmed and COG created
echo.

echo [Step 4/4] Adding pyramids...
echo.

gdaladdo -r nearest "%OUTPUT%" 2 4 8 16

echo.
echo ========================================
echo   Optimization Complete!
echo ========================================
echo.

REM File size comparison
for %%A in ("%INPUT%") do set INPUT_SIZE=%%~zA
for %%A in ("%OUTPUT%") do set OUTPUT_SIZE=%%~zA
set /a INPUT_MB=%INPUT_SIZE% / 1048576
set /a OUTPUT_MB=%OUTPUT_SIZE% / 1048576

echo File sizes:
echo   Before: %INPUT_MB% MB
echo   After:  %OUTPUT_MB% MB
echo.

echo Verifying NoData value in output...
gdalinfo "%OUTPUT%" | findstr /i "nodata"

echo.
echo Next steps:
echo   1. Refresh browser (Ctrl+Shift+R)
echo   2. Load: 2024_kle_vh_kndvi_optimized.tif
echo.
echo Expected result:
echo   - Rotation fill areas = TRANSPARENT (255)
echo   - Pixel 0 (bare land) = brown
echo   - Pixels 1-9 (crops) = colored
echo.
echo ========================================

cd /d "%~dp0"
pause
