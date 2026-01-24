/*******************************************************************************
 * PROJECT: Al Gash Basin – Morphodynamics & Flood Evolution
 * PHASE I: Data Pre-processing & Environmental Setup (FINAL MASTER CODE)
 * AUTHOR: Anwar, Asia Hamdi & Team
 * STRATEGY: 1985 Baseline | Multi-Sensor Fusion | SAR & Optical Integration
 *******************************************************************************/

// --- CHUNK 1: ROI Definition and Asset Ingestion ---
// Importing the study area: Al Gash Basin
var roi = ee.FeatureCollection('projects/ee-asiahamdi1/assets/Gash_basin');
Map.centerObject(roi, 10);

// --- CHUNK 4: Automated Cloud and Shadow Masking for Optical Data ---
/**
 * Function to mask clouds and scale Surface Reflectance for Landsat 5, 7, 8
 */
function maskLandsat(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 1).eq(0) // Dilated Cloud
                .and(qa.bitwiseAnd(1 << 3).eq(0)) // Cloud
                .and(qa.bitwiseAnd(1 << 4).eq(0)); // Cloud Shadow
  return image.updateMask(mask)
              .multiply(0.0000275).add(-0.2) 
              .clip(roi);
}

/**
 * Function to mask clouds for Sentinel-2 MSI
 */
function maskS2(image) {
  var qa = image.select('QA60');
  var mask = qa.bitwiseAnd(1 << 10).eq(0)
                .and(qa.bitwiseAnd(1 << 11).eq(0));
  return image.updateMask(mask)
              .divide(10000).clip(roi);
}

// --- CHUNK 3: Sentinel-1 SAR Pre-processing (Independent Function) ---
/**
 * Processes SAR collection: selects VV, applies Speckle filter, and Mosaics
 */
function getSARComposite(startDate, endDate) {
  var s1Col = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(roi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .map(function(img) {
      return img.select('VV').focal_median(30, 'circle', 'meters').clip(roi);
    });
  return s1Col.median();
}

// --- CHUNK 2: Multi-Sensor Image Collection Filtering (1985 - 2025) ---
print('--- PHASE I: PROCESSING REPORT (Optical & SAR) ---');

// 1. Epoch 1985: Landsat 5 TM (The historical baseline)
var col1985 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2").filterBounds(roi).filterDate('1984-01-01', '1987-12-31');
var composite1985 = col1985.map(maskLandsat).median().clip(roi);
print('Metadata 1985:', {Sensor: 'Landsat 5 TM', Count: col1985.size(), Range: '1984-1987'});

// 2. Epoch 1995: Landsat 5 TM
var col1995 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2").filterBounds(roi).filterDate('1994-01-01', '1996-12-31');
var composite1995 = col1995.map(maskLandsat).median().clip(roi);
print('Metadata 1995:', {Sensor: 'Landsat 5 TM', Count: col1995.size(), Range: '1994-1996'});

// 3. Epoch 2005: Landsat 7 ETM+
var col2005 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2").filterBounds(roi).filterDate('2004-01-01', '2006-12-31');
var composite2005 = col2005.map(maskLandsat).median().clip(roi);
print('Metadata 2005:', {Sensor: 'Landsat 7 ETM+', Count: col2005.size(), Range: '2004-2006'});

// 4. Epoch 2015: Landsat 8 OLI + Sentinel-1 SAR
var col2015 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").filterBounds(roi).filterDate('2014-01-01', '2016-12-31');
var composite2015 = col2015.map(maskLandsat).median().clip(roi);
var sar2015 = getSARComposite('2014-10-01', '2016-12-31');
print('Metadata 2015:', {Sensor: 'Landsat 8 OLI', SAR: 'Sentinel-1 Available', Range: '2014-2016'});

// 5. Epoch 2025: Sentinel-2 MSI + Sentinel-1 SAR (Recent baseline)
var col2025 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(roi).filterDate('2024-01-01', '2025-12-31');
var composite2025 = col2025.map(maskS2).median().clip(roi);
var sar2025 = getSARComposite('2024-01-01', '2025-12-31');
print('Metadata 2025:', {Sensor: 'Sentinel-2 MSI', SAR: 'Sentinel-1 Available', Range: '2024-2025'});

// --- TOPOGRAPHY ---
var srtm = ee.Image("USGS/SRTMGL1_003").clip(roi);
print('Topography Status:', 'SRTM 30m loaded successfully.');

// --- MAP VISUALIZATION (Adding All Layers) ---

// Topography Background
Map.addLayer(srtm, {min: 400, max: 1500, palette: ['green', 'yellow', 'brown']}, 'Topography (SRTM)', false);

// Historical Optical Layers
Map.addLayer(composite1985, {bands:['SR_B3', 'SR_B2', 'SR_B1'], min:0, max:0.3}, 'Optical 1985 (L5)');
Map.addLayer(composite1995, {bands:['SR_B3', 'SR_B2', 'SR_B1'], min:0, max:0.3}, 'Optical 1995 (L5)', false);
Map.addLayer(composite2005, {bands:['SR_B3', 'SR_B2', 'SR_B1'], min:0, max:0.3}, 'Optical 2005 (L7)', false);
Map.addLayer(composite2015, {bands:['SR_B4', 'SR_B3', 'SR_B2'], min:0, max:0.3}, 'Optical 2015 (L8)', false);

// Recent Optical Layer
Map.addLayer(composite2025, {bands:['B4', 'B3', 'B2'], min:0, max:0.3}, 'Optical 2025 (S2)');

// Independent SAR Layers
Map.addLayer(sar2015, {min: -25, max: 0}, 'SAR 2015 (S1)', false);
Map.addLayer(sar2025, {min: -25, max: 0}, 'SAR 2025 (S1)');

// ROI Boundary
Map.addLayer(roi.draw({color: 'red', strokeWidth: 2}), {}, 'ROI Boundary');

// --- EXPORT TASKS ---
var years = [1985, 1995, 2005, 2015, 2025];
var optImages = [composite1985, composite1995, composite2005, composite2015, composite2025];

for (var i = 0; i < years.length; i++) {
  Export.image.toDrive({
    image: optImages[i],
    description: 'AlGash_Optical_Mosaic_' + years[i],
    folder: 'AlGash_Project',
    region: roi,
    scale: (years[i] == 2025) ? 10 : 30,
    maxPixels: 1e13
  });
}

// Export SAR Data separately
Export.image.toDrive({image: sar2015, description: 'AlGash_SAR_2015', folder: 'AlGash_Project', region: roi, scale: 10});
Export.image.toDrive({image: sar2025, description: 'AlGash_SAR_2025', folder: 'AlGash_Project', region: roi, scale: 10});

print('*** PHASE I INTEGRATION COMPLETE: All layers and tasks initialized. ***');
