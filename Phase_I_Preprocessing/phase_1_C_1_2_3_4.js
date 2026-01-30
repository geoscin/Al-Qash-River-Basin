/*******************************************************************************
 * PROJECT: Al Gash Basin – Morphodynamics & Flood Evolution
 * PHASE I: Data Pre-processing & Environmental Setup (FINAL MASTER CODE)
 * AUTHOR: Anwar, Asia Hamdi & Team
 * STRATEGY: 1985 Baseline | Multi-Sensor Fusion | SAR & Optical Integration
 *******************************************************************************/

// --- CHUNK 1: ROI Definition and Asset Ingestion ---
var roi = ee.FeatureCollection('projects/ee-asiahamdi1/assets/Gash_basin');
Map.centerObject(roi, 10);

// --- CHUNK 4: Automated Cloud and Shadow Masking ---
function maskLandsat(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 1).eq(0).and(qa.bitwiseAnd(1 << 3).eq(0)).and(qa.bitwiseAnd(1 << 4).eq(0));
  return image.updateMask(mask).multiply(0.0000275).add(-0.2).clip(roi);
}

function maskS2(image) {
  var qa = image.select('QA60');
  var mask = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
  return image.updateMask(mask).divide(10000).clip(roi);
}

// --- CHUNK 3: Sentinel-1 SAR Pre-processing ---
function getSARComposite(startDate, endDate) {
  var s1Col = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(roi).filterDate(startDate, endDate)
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .map(function(img) {
      return img.select('VV').focal_median(30, 'circle', 'meters').clip(roi);
    });
  return s1Col.median();
}

// --- CHUNK 2: Multi-Sensor Data Ingestion & CONSOLE REPORTS ---
print('--- PHASE I: PROCESSING REPORT (Optical & SAR) ---');

// 1985 Baseline
var col1985 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2").filterBounds(roi).filterDate('1984-01-01', '1987-12-31');
var composite1985 = col1985.map(maskLandsat).median().clip(roi);
print('Metadata 1985:', {Sensor: 'Landsat 5 TM', Count: col1985.size(), Range: '1984-1987'});

// 1995
var col1995 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2").filterBounds(roi).filterDate('1994-01-01', '1996-12-31');
var composite1995 = col1995.map(maskLandsat).median().clip(roi);
print('Metadata 1995:', {Sensor: 'Landsat 5 TM', Count: col1995.size()});

// 2005
var col2005 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2").filterBounds(roi).filterDate('2004-01-01', '2006-12-31');
var composite2005 = col2005.map(maskLandsat).median().clip(roi);
print('Metadata 2005:', {Sensor: 'Landsat 7 ETM+', Count: col2005.size()});

// 2015
var col2015 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").filterBounds(roi).filterDate('2014-01-01', '2016-12-31');
var composite2015 = col2015.map(maskLandsat).median().clip(roi);
var sar2015 = getSARComposite('2014-10-01', '2016-12-31');
print('Metadata 2015:', {Sensor: 'Landsat 8 OLI', SAR: 'S1-VV Ready'});

// 2025
var col2025 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(roi).filterDate('2024-01-01', '2025-12-31');
var composite2025 = col2025.map(maskS2).median().clip(roi);
var sar2025 = getSARComposite('2024-01-01', '2025-12-31');
print('Metadata 2025:', {Sensor: 'Sentinel-2 MSI', Count: col2025.size()});

// --- TOPOGRAPHY ---
var srtm = ee.Image("USGS/SRTMGL1_003").clip(roi);
var elevation = srtm.select('elevation');
print('Topography Status:', 'SRTM 30m Elevation Loaded.');

// --- MAP VISUALIZATION ---
Map.addLayer(elevation, {min: 400, max: 1200, palette: ['#1a9850', '#91cf60', '#d9ef8b', '#fee08b', '#fc8d59', '#d73027']}, 'Topography (SRTM)', false);
Map.addLayer(composite1985, {bands:['SR_B3', 'SR_B2', 'SR_B1'], min:0, max:0.3}, 'Optical 1985 (L5)');
Map.addLayer(composite1995, {bands:['SR_B3', 'SR_B2', 'SR_B1'], min:0, max:0.3}, 'Optical 1995 (L5)', false);
Map.addLayer(composite2005, {bands:['SR_B3', 'SR_B2', 'SR_B1'], min:0, max:0.3}, 'Optical 2005 (L7)', false);
Map.addLayer(composite2015, {bands:['SR_B4', 'SR_B3', 'SR_B2'], min:0, max:0.3}, 'Optical 2015 (L8)', false);
Map.addLayer(composite2025, {bands:['B4', 'B3', 'B2'], min:0, max:0.3}, 'Optical 2025 (S2)');

// NEW: False Color Composite
Map.addLayer(composite2025, {bands:['B8', 'B4', 'B3'], min:0, max:0.4}, 'False Color 2025 (Veg Focus)', false);

// SAR Layers
Map.addLayer(sar2015, {min: -25, max: 0}, 'SAR 2015 (S1)', false);
Map.addLayer(sar2025, {min: -25, max: 0}, 'SAR 2025 (S1)', false);

// ROI
Map.addLayer(roi.draw({color: 'red', strokeWidth: 2}), {}, 'ROI Boundary');

// --- PROFESSIONAL UI: ELEVATION LEGEND ---
var legend = ui.Panel({style: {position: 'bottom-right', padding: '10px', border: '1px solid black'}});
legend.add(ui.Label({value: 'Elevation (m)', style: {fontWeight: 'bold', fontSize: '14px', textAlign: 'center', margin: '0 0 10px 0'}}));

var makeRow = function(color, range) {
  var colorBox = ui.Label({style: {backgroundColor: color, padding: '10px', border: '0.5px solid black'}});
  var description = ui.Label({value: range, style: {margin: '2px 0 0 8px', fontSize: '12px'}});
  return ui.Panel({widgets: [colorBox, description], layout: ui.Panel.Layout.Flow('horizontal')});
};

legend.add(makeRow('#1a9850', '400 - 500'));
legend.add(makeRow('#91cf60', '500 - 650'));
legend.add(makeRow('#d9ef8b', '650 - 800'));
legend.add(makeRow('#fee08b', '800 - 950'));
legend.add(makeRow('#fc8d59', '950 - 1100'));
legend.add(makeRow('#d73027', '> 1100'));

Map.add(legend);

// --- EXPORT TASKS ---
var years = [1985, 1995, 2005, 2015, 2025];
var optImages = [composite1985, composite1995, composite2005, composite2015, composite2025];
for (var i = 0; i < years.length; i++) {
  Export.image.toDrive({
    image: optImages[i],
    description: 'AlGash_Mosaic_' + years[i],
    folder: 'AlGash_Project',
    region: roi,
    scale: (years[i] == 2025) ? 10 : 30,
    maxPixels: 1e13
  });
}

print('*** PHASE I INTEGRATION COMPLETE: Console Logs & Legend Active ***');
