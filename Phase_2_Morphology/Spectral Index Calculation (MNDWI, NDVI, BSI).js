/**
 * PROJECT: Al Gash Basin – Environmental Spectral Analysis
 * PURPOSE: Automated extraction of MNDWI, NDVI, and BSI indices.
 * METHODOLOGY: Multi-sensor processing with strict temporal filtering.
 */

var roi = ee.FeatureCollection('projects/beaming-set-482612-c2/assets/Algash_basin_utm37');
Map.centerObject(roi, 10);

// Function to calculate indices and extract metadata per epoch
var getIndices = function(year) {
  var start = (year === 2005) ? ee.Date.fromYMD(2004, 5, 1) : ee.Date.fromYMD(year, 7, 1);
  var end = (year === 2005) ? ee.Date.fromYMD(2006, 10, 31) : ee.Date.fromYMD(year, 10, 31);
  
  var col, img, bands, sensorName;
  
  // Define sensor parameters and band combinations per era
  if (year < 1999) { 
    sensorName = 'Landsat 5 TM';
    col = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2").filterBounds(roi).filterDate(start, end).filter(ee.Filter.lt('CLOUD_COVER', 40));
    img = col.map(function(i){return i.multiply(0.0000275).add(-0.2).clip(roi)}).median();
    bands = {mndwi: ['SR_B2', 'SR_B5'], ndvi: ['SR_B4', 'SR_B3'], bsi_sw: 'SR_B5', bsi_r: 'SR_B3', bsi_nir: 'SR_B4', bsi_b: 'SR_B1'};
  } else if (year < 2013) { 
    sensorName = 'Landsat 7 ETM+';
    col = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2").filterBounds(roi).filterDate(start, end).filter(ee.Filter.lt('CLOUD_COVER', 40));
    img = col.map(function(i){return i.multiply(0.0000275).add(-0.2).clip(roi)}).median();
    bands = {mndwi: ['SR_B2', 'SR_B5'], ndvi: ['SR_B4', 'SR_B3'], bsi_sw: 'SR_B5', bsi_r: 'SR_B3', bsi_nir: 'SR_B4', bsi_b: 'SR_B1'};
  } else if (year < 2020) { 
    sensorName = 'Landsat 8 OLI';
    col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2").filterBounds(roi).filterDate(start, end).filter(ee.Filter.lt('CLOUD_COVER', 40));
    img = col.map(function(i){return i.multiply(0.0000275).add(-0.2).clip(roi)}).median();
    bands = {mndwi: ['SR_B3', 'SR_B6'], ndvi: ['SR_B5', 'SR_B4'], bsi_sw: 'SR_B6', bsi_r: 'SR_B4', bsi_nir: 'SR_B5', bsi_b: 'SR_B2'};
  } else { 
    sensorName = 'Sentinel-2 MSI';
    col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(roi).filterDate(start, end).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40));
    img = col.map(function(i){return i.divide(10000).clip(roi)}).median();
    bands = {mndwi: ['B3', 'B11'], ndvi: ['B8', 'B4'], bsi_sw: 'B11', bsi_r: 'B4', bsi_nir: 'B8', bsi_b: 'B2'};
  }

  // Calculate spectral indices
  var mndwi = img.normalizedDifference(bands.mndwi).rename('MNDWI');
  var ndvi = img.normalizedDifference(bands.ndvi).rename('NDVI');
  var bsi = img.expression('((SW+R)-(NIR+B))/((SW+R)+(NIR+B))', {
    'SW': img.select(bands.bsi_sw), 'R': img.select(bands.bsi_r), 'NIR': img.select(bands.bsi_nir), 'B': img.select(bands.bsi_b)
  }).rename('BSI');

  return {mndwi: mndwi, ndvi: ndvi, bsi: bsi, sensor: sensorName, count: col.size(), start: start, end: end};
};

var years = [1985, 1995, 2005, 2015, 2025];
var features = [];

// Iterate through years to generate reports, charts, and export tasks
years.forEach(function(y) {
  var data = getIndices(y);
  var stats = ee.Image.cat([data.mndwi, data.ndvi, data.bsi]).reduceRegion({
    reducer: ee.Reducer.median(), geometry: roi, scale: 30, maxPixels: 1e13
  });
  
  // Console logging for methodology documentation
  print('--- Report for Year: ' + y + ' ---');
  print('Sensor Name: ' + data.sensor);
  print('Temporal Coverage: ' + data.start.format('YYYY-MM-dd').getInfo() + ' to ' + data.end.format('YYYY-MM-dd').getInfo());
  print('Image Collection Size: ' + data.count.getInfo());
  print('Median Spectral Indices: ', stats);
  
  features.push(ee.Feature(null, {year: y, MNDWI: stats.get('MNDWI'), NDVI: stats.get('NDVI'), BSI: stats.get('BSI')}));
  
  // Export individual index files for local analysis
  Export.image.toDrive({image: data.mndwi.float(), description: 'MNDWI_' + y, scale: 30, region: roi.geometry(), maxPixels: 1e13});
  Export.image.toDrive({image: data.ndvi.float(), description: 'NDVI_' + y, scale: 30, region: roi.geometry(), maxPixels: 1e13});
  Export.image.toDrive({image: data.bsi.float(), description: 'BSI_' + y, scale: 30, region: roi.geometry(), maxPixels: 1e13});
});

// Generate comparative trend chart
var chart = ui.Chart.feature.byFeature(ee.FeatureCollection(features), 'year', ['MNDWI', 'NDVI', 'BSI'])
  .setChartType('LineChart')
  .setOptions({
    title: 'Multi-Temporal Spectral Indices Trend (1985-2025)',
    hAxis: {title: 'Year'}, vAxis: {title: 'Median Value'},
    lineWidth: 2, pointSize: 4
  });
print(chart);
