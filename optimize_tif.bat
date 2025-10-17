@echo off
cd /d "%~dp0public\data"

echo ========================================
echo   TIF Optimization Tool
echo   (Projection + NoData + COG + Overviews)
echo ========================================
echo.
echo This script will:
echo 1. Reproject from EPSG:32645 to EPSG:3857
echo 2. Set NoData value to 255
echo 3. Convert to COG format with compression
echo 4. Add pyramids (overviews)
echo 5. Backup original file
echo.
echo Please run this in Anaconda Prompt (Admin mode)
echo.
echo ========================================
echo.

set INPUT=2024_kle_vh_kndvi.tif
set TEMP_OUTPUT=temp_optimized_%RANDOM%.tif
set BACKUP=2024_kle_vh_kndvi.original.tif

if not exist "%INPUT%" (
    echo [ERROR] File not found: %INPUT%
    pause
    exit /b 1
)

echo [Step 1/5] Check current file information...
echo.
gdalinfo "%INPUT%" | findstr /C:"Size is" /C:"Coordinate System" /C:"NoData"
echo.

echo [Step 2/5] Creating backup...
if exist "%BACKUP%" (
    echo Backup already exists: %BACKUP%
    echo Skipping backup creation
) else (
    copy "%INPUT%" "%BACKUP%"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create backup
        pause
        exit /b 1
    )
    echo Backup created: %BACKUP%
)
echo.

echo [Step 3/5] Reprojecting, setting NoData, and converting to COG...
echo   Source CRS: EPSG:32645 (WGS 1984 UTM Zone 45N)
echo   Target CRS: EPSG:3857 (Web Mercator)
echo   NoData: 255
echo   Format: COG (Cloud Optimized GeoTIFF)
echo   Compression: LZW
echo   Block Size: 512x512
echo.

gdalwarp -s_srs EPSG:32645 ^
  -t_srs EPSG:3857 ^
  -dstnodata 255 ^
  -of COG ^
  -co COMPRESS=LZW ^
  -co BLOCKSIZE=512 ^
  -co TILED=YES ^
  -co BIGTIFF=IF_SAFER ^
  -r near ^
  "%INPUT%" "%TEMP_OUTPUT%"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Conversion failed
    echo Please check:
    echo - GDAL is installed (conda install gdal)
    echo - Running in Anaconda Prompt
    echo - Original file is valid
    pause
    exit /b 1
)
echo.

echo [Step 4/5] Adding pyramids (overviews)...
echo   Levels: 2, 4, 8, 16
echo.
gdaladdo -r nearest "%TEMP_OUTPUT%" 2 4 8 16

if %errorlevel% neq 0 (
    echo [WARNING] Failed to add overviews, but file is converted
) else (
    echo Overviews added successfully
)
echo.

echo [Step 5/5] Replacing original file...
echo   Deleting original file...
del "%INPUT%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to delete original file
    echo Temp file saved as: %TEMP_OUTPUT%
    pause
    exit /b 1
)

echo   Renaming optimized file...
ren "%TEMP_OUTPUT%" "%INPUT%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to rename file
    echo Temp file saved as: %TEMP_OUTPUT%
    pause
    exit /b 1
)
echo.

echo ========================================
echo   Optimization Complete!
echo ========================================
echo.
echo Input file: %INPUT%
echo Backup file: %BACKUP%
echo.
echo Optimizations applied:
echo   [x] Reprojected to EPSG:3857 (Web Mercator)
echo   [x] NoData value set to 255
echo   [x] Converted to COG format
echo   [x] LZW compression enabled
echo   [x] Tiled (512x512 blocks)
echo   [x] Pyramids added (2, 4, 8, 16)
echo.
echo File size comparison:
for %%A in ("%BACKUP%") do set BACKUP_SIZE=%%~zA
for %%A in ("%INPUT%") do set OPTIMIZED_SIZE=%%~zA
set /a BACKUP_MB=%BACKUP_SIZE% / 1048576
set /a OPTIMIZED_MB=%OPTIMIZED_SIZE% / 1048576
echo   Before: %BACKUP_MB% MB
echo   After: %OPTIMIZED_MB% MB
echo.
echo ========================================
echo.
echo Next steps:
echo 1. Restart your development server (npm run dev)
echo 2. Refresh browser (Ctrl+Shift+R)
echo 3. Test the map display
echo.
echo Expected result:
echo - TIF displays in correct location (Xinjiang)
echo - Background is transparent (not black/brown)
echo - Smooth zoom and pan
echo - Cropland shows correct colors
echo.
echo ========================================
pause

