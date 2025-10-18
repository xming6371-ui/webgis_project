@echo off
cd /d "%~dp0public\data"

echo ========================================
echo   TIF Optimization - Pixel Shift Method
echo ========================================
echo.
echo Input:  2024_kle_vh_kndvi.tif
echo Output: 2024_kle_vh_kndvi_optimized_shift.tif
echo.
echo Strategy:
echo   Step 1: Shift all pixel values by +1
echo           0-9 becomes 1-10
echo   Step 2: Set NoData=0
echo   Step 3: Reproject (new areas auto-fill with 0)
echo   Step 4: Add pyramids
echo.
echo ========================================
echo.

set INPUT=2024_kle_vh_kndvi.tif
set OUTPUT=2024_kle_vh_kndvi_optimized_shift.tif
set TEMP1=temp_shifted_%RANDOM%.tif
set TEMP2=temp_nodata_%RANDOM%.tif

if not exist "%INPUT%" (
    echo ERROR: Input file not found
    pause
    exit /b 1
)

echo [Step 1/4] Shifting pixel values by +1...
echo   Old: 0=bare, 1=cotton, 2=wheat, ..., 9=other
echo   New: 1=bare, 2=cotton, 3=wheat, ..., 10=other
echo.

python -c "from osgeo import gdal; import numpy as np; ds=gdal.Open('%INPUT%'); arr=ds.GetRasterBand(1).ReadAsArray(); arr_new=arr+1; driver=gdal.GetDriverByName('GTiff'); out=driver.Create('%TEMP1%',ds.RasterXSize,ds.RasterYSize,1,gdal.GDT_Byte); out.SetGeoTransform(ds.GetGeoTransform()); out.SetProjection(ds.GetProjection()); out.GetRasterBand(1).WriteArray(arr_new); out.FlushCache(); out=None; ds=None; print('Pixel values shifted successfully')"

if errorlevel 1 (
    echo ERROR: Step 1 failed
    echo Trying alternative method with gdal_calc.py...
    echo.
    gdal_calc.py -A "%INPUT%" --outfile="%TEMP1%" --calc="A+1" --type=Byte --overwrite
    if errorlevel 1 (
        echo ERROR: Both methods failed
        del "%TEMP1%" 2>nul
        pause
        exit /b 1
    )
)

echo   Pixel shift completed
echo.

echo [Step 2/4] Setting NoData=0...
echo   Now 0 means NoData (transparent)
echo.

gdal_translate -a_nodata 0 "%TEMP1%" "%TEMP2%"

del "%TEMP1%" 2>nul

if errorlevel 1 (
    echo ERROR: Step 2 failed
    del "%TEMP2%" 2>nul
    pause
    exit /b 1
)

echo   NoData set to 0
echo.

echo [Step 3/4] Reprojecting to EPSG:3857...
echo   New fill areas will be 0 (NoData/transparent)
echo.

gdalwarp -s_srs EPSG:32645 -t_srs EPSG:3857 -srcnodata 0 -dstnodata 0 -of COG -co COMPRESS=LZW -co BLOCKSIZE=512 -co TILED=YES -co BIGTIFF=IF_SAFER -r near "%TEMP2%" "%OUTPUT%"

del "%TEMP2%" 2>nul

if errorlevel 1 (
    echo ERROR: Step 3 failed
    pause
    exit /b 1
)

echo   Reprojection completed
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

echo Verifying NoData value...
gdalinfo "%OUTPUT%" | findstr /i "nodata"

echo.
echo ========================================
echo   IMPORTANT - Frontend Update Required!
echo ========================================
echo.
echo Pixel value mapping changed:
echo   0 = NoData (transparent)
echo   1 = Bare land (was 0)
echo   2 = Cotton (was 1)
echo   3 = Wheat (was 2)
echo   4 = Corn (was 3)
echo   5 = Tomato (was 4)
echo   6 = Beet (was 5)
echo   7 = Watermelon (was 6)
echo   8 = Pepper (was 7)
echo   9 = Gourd (was 8)
echo   10 = Other (was 9)
echo.
echo Next: Update color mapping in Dashboard/index.vue
echo.
echo ========================================

cd /d "%~dp0"
pause

