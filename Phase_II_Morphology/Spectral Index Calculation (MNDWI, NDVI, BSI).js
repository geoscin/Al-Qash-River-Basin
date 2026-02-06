/**
 * PROJECT: Al Gash Basin - Professional Multi-Index Dashboard
 * INDICES: MNDWI (Water), NDVI (Veg), BSI (Soil)
 * COMPONENTS: Interactive Map, Layer Toggles, Peak Month Reporting, Comparative Chart
 */

// 1. ROI & INITIAL VIEW SETUP
var roi = ee.FeatureCollection('projects/ee-asiahamdi1/assets/Gash_basin');
Map.centerObject(roi, 11);
Map.setOptions('HYBRID');

// 2. PRE-PROCESSING FUNCTIONS (Landsat & Sentinel)
// Cloud masking and scaling for Landsat
function cleanL(img) {
  var qa = img.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).or(qa.bitwiseAnd(1 << 4)).or(qa.bitwiseAnd(1 << 1)).eq(0);
  return ee.Image(img.updateMask(mask).multiply(0.0000275).add(-0.2)
            .copyProperties(img, ['system:time_start'])).clip(roi);
}

// Cloud masking and scaling for Sentinel-2
function cleanS2(img) {
  var qa = img.select('QA60');
  var mask = qa.bitwiseAnd(1 << 10).eq(0).and(qa.bitwiseAnd(1 << 11).eq(0));
  return ee.Image(img.updateMask(mask).divide(10000)
            .copyProperties(img, ['system:time_start'])).clip(roi);
}

// 3. MULTI-INDEX CORE ENGINE (Includes Peak Month Detection)
var getYearlyPeak = function(year, collectionId, maskFunc, bands) {
  var dateStart = year + '-01-01';
  var dateEnd = year + '-12-31';
  
  var collection = ee.ImageCollection(collectionId)
    .filterBounds(roi)
    .filterDate(dateStart, dateEnd)
    .filter(ee.Filter.notNull(['system:time_start']))
    .map(maskFunc);
    
  var processedCol = collection.map(function(img) {
    // Calculate MNDWI (Water)
    var mndwi = img.normalizedDifference([bands.green, bands.swir1]).rename('MNDWI');
    // Calculate NDVI (Vegetation)
    var ndvi = img.normalizedDifference([bands.nir, bands.red]).rename('NDVI');
    // Calculate BSI (Bare Soil Index)
    var bsi = img.expression(
      '((SW1 + R) - (NIR + B)) / ((SW1 + R) + (NIR + B))', {
        'SW1': img.select(bands.swir1),
        'R': img.select(bands.red),
        'NIR': img.select(bands.nir),
        'B': img.select(bands.blue)
      }).rename('BSI');
    
    // Add a constant band representing the month of the image
    var month = ee.Image.constant(ee.Date(img.get('system:time_start')).get('month')).rename('month');
      
    return img.addBands([mndwi.float(), ndvi.float(), bsi.float(), month.float()]);
  });

  // Create a Quality Mosaic based on the highest Water Index (Peak Flood)
  var peakImage = processedCol.qualityMosaic('MNDWI');
  
  // Calculate stats and identify the month where the peak occurred
  var stats = peakImage.select(['MNDWI', 'NDVI', 'BSI', 'month']).reduceRegion({
    reducer: ee.Reducer.median(),
    geometry: roi.geometry().bounds(),
    scale: 1000, 
    maxPixels: 1e9
  });

  var monthNum = ee.Number(stats.get('month')).round();
  
  // Print the professional report to the Console
  print('--- Yearly Analysis: ' + year + ' ---');
  print('Peak Water Value (MNDWI):', stats.get('MNDWI'));
  print('Peak Occurrence Month:', monthNum); // Displays the month (1-12)
  print('Vegetation at Peak (NDVI):', stats.get('NDVI'));

  return peakImage.set('year_label', year)
                  .set('MNDWI_v', stats.get('MNDWI'))
                  .set('NDVI_v', stats.get('NDVI'))
                  .set('BSI_v', stats.get('BSI'))
                  .set('peak_month', monthNum)
                  .set('system:time_start', ee.Date(dateStart).millis());
};

// 4. DATA GENERATION (Landsat 5, 7, 8 & Sentinel 2)
var lBands = {blue: 'SR_B1', green: 'SR_B2', red: 'SR_B3', nir: 'SR_B4', swir1: 'SR_B5'};
var l8Bands = {blue: 'SR_B2', green: 'SR_B3', red: 'SR_B4', nir: 'SR_B5', swir1: 'SR_B6'};
var s2Bands = {blue: 'B2', green: 'B3', red: 'B4', nir: 'B8', swir1: 'B11'};

var p1985 = getYearlyPeak('1985', "LANDSAT/LT05/C02/T1_L2", cleanL, lBands);
var p1995 = getYearlyPeak('1995', "LANDSAT/LT05/C02/T1_L2", cleanL, lBands);
var p2005 = getYearlyPeak('2005', "LANDSAT/LE07/C02/T1_L2", cleanL, lBands);
var p2015 = getYearlyPeak('2015', "LANDSAT/LC08/C02/T1_L2", cleanL, l8Bands);
var p2025 = getYearlyPeak('2025', "COPERNICUS/S2_SR_HARMONIZED", cleanS2, s2Bands);

// 5. MAP LAYERS SETUP
var years = [1985, 1995, 2005, 2015, 2025];
var peaks = [p1985, p1995, p2005, p2015, p2025];
var colors = ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF']; 

for (var i = 0; i < 5; i++) {
  // Add Water Layer (Visible by default)
  var water = peaks[i].select('MNDWI');
  Map.addLayer(water.updateMask(water.gt(0.2)), {palette: [colors[i]]}, 'Peak Water ' + years[i], true);
  
  // Add Vegetation Layer (Hidden by default - click checkbox to see)
  var veg = peaks[i].select('NDVI');
  Map.addLayer(veg.updateMask(veg.gt(0.3)), {palette: ['#edf8e9','#bae4b3','#74c476','#238b45']}, 'Vegetation ' + years[i], false);
  
  // Add Soil Layer (Hidden by default - click checkbox to see)
  var soil = peaks[i].select('BSI');
  Map.addLayer(soil.updateMask(soil.gt(0.1)), {palette: ['#fee391','#fec44f','#fe9929','#cc4c02']}, 'Soil Index ' + years[i], false);
}

// 6. VISUAL LEGEND (UI PANEL)
var legend = ui.Panel({
  style: {position: 'bottom-left', padding: '10px', border: '1px solid grey'}
});
legend.add(ui.Label({value: 'Peak Water Years', style: {fontWeight: 'bold', fontSize: '16px'}}));

var makeRow = function(color, text) {
  var colorBox = ui.Label({style: {backgroundColor: color, padding: '8px', border: '1px solid black'}});
  var label = ui.Label({value: text, style: {margin: '0 0 4px 6px'}});
  return ui.Panel({widgets: [colorBox, label], layout: ui.Panel.Layout.Flow('horizontal')});
};

for (var j = 0; j < 5; j++) { legend.add(makeRow(colors[j], years[j])); }
Map.add(legend);

// 7. COMPARATIVE CHART
var chartData = ee.FeatureCollection(ee.List(peaks).map(function(img){
  var i = ee.Image(img);
  return ee.Feature(null, {
    'Year': i.get('year_label'), 
    'Water (MNDWI)': i.get('MNDWI_v'), 
    'Veg (NDVI)': i.get('NDVI_v'), 
    'Soil (BSI)': i.get('BSI_v')
  });
}));

var chart = ui.Chart.feature.byFeature({
  features: chartData,
  xProperty: 'Year', 
  yProperties: ['Water (MNDWI)', 'Veg (NDVI)', 'Soil (BSI)']
}).setChartType('LineChart').setOptions({
  title: 'Al Gash Basin: Spectral Trends (1985-2025)',
  colors: ['#2563eb', '#16a34a', '#92400e'],
  lineWidth: 3, pointSize: 7
});
print(chart);

// 8. EXPORT TO GOOGLE DRIVE
for (var k = 0; k < 5; k++) {
  Export.image.toDrive({
    image: peaks[k].select(['MNDWI', 'NDVI', 'BSI', 'month']),
    description: 'Gash_Analysis_' + years[k],
    folder: 'Gash_Basin_Project',
    scale: 30, region: roi.geometry().bounds(), maxPixels: 1e9
  });
}
