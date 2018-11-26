/* jshint esversion: 6 */
const config = require('./config.json')
const tokml = require('tokml')
const tp = require('tedious-promises')
const _ = require('lodash')
const Promise = require('promise')
const fs = require('fs')
const CronJob = require('cron').CronJob
const replace = require('replace-in-file')

tp.setConnectionConfig(config) // global scope

// set the base kml to use - makes things faster to use a local file
const kimco = require('./data/kimco.json')

/** SQL connection **/
const Connection = require('tedious').Connection
const Request = require('tedious').Request
const TYPES = require('tedious').TYPES

// Attempt to connect to database
// let result = {}
const connection = new Connection(config)

// set the file config for use later by find - replace
let replaceOptions = {
  files: './data/KimcoSites.kml',
  from: 'https://api.tiles.mapbox.com/v3/marker/pin-l-star+2C4880.png',
  to: 'http://gee-server.kimcorealty.com/icons/kimco_2017.png'
}

const getData = function () {
  tp.sql(`SELECT
    'Feature' AS type,
    SiteNo as id,
    LeasingAgent as LeasingAgent,
    PropertyManager as PropertyManager,
    Name as [properties.Name],
    SiteNo as [properties.SiteNo],
    PropertyManager as [properties.PropertyManager],
    LeasingAgent as [properties.LeasingAgent],
    CenterName as [properties.CenterName],
    Region as [properties.Region],
    Address as [properties.Address],
    GLA as [properties.GLA],
    Partnership as [properties.Partnership],
    MarketingBrochure as [properties.MarketingBrochure],
    LinkToWebsite as [properties.LinkToWebsite],
    LinkToOverlay as [properties.LinkToOverlay],
    Participation as [properties.Participation],
    'Point' as [geometry.type],
    JSON_QUERY
    ( FORMATMESSAGE('[%s,%s]',
    FORMAT(longitude, N'0.##########'),
    FORMAT(latitude, N'0.##########'))
  ) as [geometry.coordinates]
  FROM KIMprops
  FOR JSON PATH`)
  .execute()
  .then(function (result, rowCount) {
    console.log(result)
    let combined = ''
    // sql requires some parsing because mssql doesn't output clean geojson by default
    return new Promise((resolve, reject) => {
      _.forEach(result, function (element, i) {
        combined += result[i]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B']
      })
      console.log(combined)
      combined = JSON.parse(combined)
      resolve(combined)
    })
  }).then(function (q) {
    console.log('DESCRIPTING')
    return new Promise((resolve, reject) => {
      _.forEach(q, function (element, i) {
        // set description for later use by tokml
        let desc = '<![CDATA[<!DOCTYPE html>' +
          '<html xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height: 100%;"><head>' +
          '<title>KIMCO Detail | ' + q[i].properties.SiteNo + '</title>' +
          '<meta http-equiv="content-type" content="text/html; charset=utf-8"/></head><body><font face="Verdana"><a href="http://kimcorealty.com"><img border="0" width="32px" src="http://gee-server.kimcorealty.com/icons/kimco_2017.png" alt="Kimco Logo" /></a>' +
          '<br /><br />' +
          '<b>Site No:</b> ' + q[i].properties.SiteNo + '<br />' +
          '<b>Center Name:</b> ' + q[i].properties.CenterName + '<br />' +
          '<b>Address:</b> ' + q[i].properties.Address + '<br />' +
          '<b>Region:</b> ' + q[i].properties.Region + '<br />' +
          '<b>GLA:</b> ' + q[i].properties.GLA + '<br />' +
          '<b>Partnership:</b> ' + q[i].properties.Partnership + '<br />' +
          '<hr /><b>Link to Web Site:</b> <br /><a href="' + q[i].properties.LinkToWebsite + '" target="asset"> ' + q[i].properties.LinkToWebsite + '</a>' +
          '<hr /><b>Marketing Brochure:</b> <br /><a href="' + q[i].properties.MarketingBrochure + '" target="asset">' + q[i].properties.MarketingBrochure + '</a>' +
          '<hr />' +
          '<b>Overlay Site Plan:</b> <a href="' + q[i].properties.LinkToOverlay + '" target="asset">Click to see ' + q[i].properties.SiteNo + ' site plan</a><br />' +
          '<hr />' +
          '<b>Property Manager:</b> ' + q[i].properties.PropertyManager + '<br />' +
          '<b>Leasing Agent:</b> ' + q[i].properties.LeasingAgent + '<br />' +
          '<hr /><br />' +
          '</font>' +
          '</body>' +
          '</html>'

        let description = {
          'Description': desc
        }

        _.assign(q[i].properties, description)
      })
      resolve(q)
    })
  }).then(function (d1) {
    let d2 = JSON.stringify(d1, null, 2)

    return new Promise((resolve, reject) => {
      fs.writeFile('./data/kimco.json', d2, function (err) {
        if (err) {
          return console.log(err)
        } else {
          console.log('The file was saved')
        }
      })
      resolve(d2)
    })
  }).fail(function (err) {
    console.log(err)
  })
}

/** sorter for data **/

const makeKML = function (s) {
  let sB = s
  let style = {}

  const e = function (s) {
    // sort the layer for the intended
    if (s === 'PropertyManager') {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'commercial',
        'marker-color': '#008015'
      }
      replaceOptions = {
        files: './data/PropertyManager.kml',
        from: 'https://api.tiles.mapbox.com/v3/marker/pin-l-commercial+008015.png',
        to: 'http://maps.google.com/mapfiles/kml/shapes/hiker.png'
      }
    } else if (s === 'LeasingAgent') {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'camera',
        'marker-color': '#801876'
      }

      replaceOptions = {
        files: './data/LeasingAgent.kml',
        from: 'https://api.tiles.mapbox.com/v3/marker/pin-l-camera+801876.png',
        to: 'http://maps.google.com/mapfiles/kml/shapes/camera.png'
      }
    } else if (s === 'KimcoSites') {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'star',
        'marker-color': '#2C4880'
      }
      sB = 'Name'
    }

    // console.log(sB)

    return new Promise((resolve, reject) => {
      let kimcoS = _.sortBy(kimco, sB)

      resolve(kimcoS)
    })
  }

  const styleIt = function (q) {
    // console.log('STYLING')
    return new Promise((resolve, reject) => {
      _.forEach(q, function (element, i) {
        _.assign(q[i].properties, style)
      })
      resolve(q)
    })
  }

  const descriptIt = function (q) {
    // console.log('DESCRIPTING')
    return new Promise((resolve, reject) => {
      _.forEach(q, function (element, i) {
        // set description for later use by tokml
        let desc = '<![CDATA[<!DOCTYPE html>' +
          '<html xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height: 100%;"><head>' +
          '<title>KIMCO Detail | ' + q[i].properties.SiteNo + '</title>' +
          '<meta http-equiv="content-type" content="text/html; charset=utf-8"/></head><body><font face="Verdana"><a href="http://kimcorealty.com"><img border="0" width="32px" src="http://gee-server.kimcorealty.com/icons/kimco_2017.png" alt="Kimco Logo" /></a>' +
          '<br /><br />' +
          '<b>Site No:</b> ' + q[i].properties.SiteNo + '<br />' +
          '<b>Center Name:</b> ' + q[i].properties.CenterName + '<br />' +
          '<b>Address:</b> ' + q[i].properties.Address + '<br />' +
          '<b>Region:</b> ' + q[i].properties.Region + '<br />' +
          '<b>GLA:</b> ' + q[i].properties.GLA + '<br />' +
          '<b>Partnership:</b> ' + q[i].properties.Partnership + '<br />' +
          '<hr /><b>Link to Web Site:</b> <br /><a href="' + q[i].properties.LinkToWebsite + '" target="asset"> ' + q[i].properties.LinkToWebsite + '</a>' +
          '<hr /><b>Marketing Brochure:</b> <br /><a href="' + q[i].properties.MarketingBrochure + '" target="asset">' + q[i].properties.MarketingBrochure + '</a>' +
          '<hr />' +
          '<b>Overlay Site Plan:</b> <a href="' + q[i].properties.LinkToOverlay + '" target="asset">Click to see ' + q[i].properties.SiteNo + ' site plan</a><br />' +
          '<hr />' +
          '<b>Property Manager:</b> ' + q[i].properties.PropertyManager + '<br />' +
          '<b>Leasing Agent:</b> ' + q[i].properties.LeasingAgent + '<br />' +
          '<hr /><br />' +
          '</font>' +
          '</body>' +
          '</html>'

        let description = {
          'Description': desc
        }

        _.assign(q[i].properties, description)
      })

      resolve(q)
    })
  }

  const geofyIt = function (q) {
    // console.log('GEOFYING')
    let q1 = {
      type: 'FeatureCollection',
      'features':
      eval(q)
    }

    return new Promise((resolve, reject) => {
      let q2 = JSON.stringify(q1, null, 2)
      resolve(q2)
    })
  }

  const parseK = function (q3) {
    // console.log('PARSING')
    let dKML
    let q4 = JSON.parse(q3)
    if (sB === 'Name') {
      dKML = tokml(q4, {
        documentName: 'Kimco Sites',
        documentDescription: 'Kimco Sites',
        simplestyle: true,
        description: 'Description',
        name: 'SiteNo'
      })
      sB = 'KimcoSites'
    } else {
      dKML = tokml(q4, {
        documentName: 'Kimco ' + sB,
        documentDescription: 'Kimco ' + sB,
        simplestyle: true,
        description: 'Description',
        name: 'SiteNo'
      })
    }

    return new Promise((resolve, reject) => {
      fs.writeFile('./data/' + sB + '.kml', dKML, function (err) {
        if (err) {
          return console.log(err)
        } else {
          console.log(sB + ' KML saved')
        }
      })
      resolve(dKML)
    })
  }

  // let we = Promise.all(
  e(sB)
  .then(function (result) {
    let q = styleIt(result)
    return q
  })
  .then(function (result) {
    let q = descriptIt(result)
    return q
  })
  .then(function (result) {
    let q = geofyIt(result)
    return q
  }).then(function (result) {
    let q = parseK(result)
    return q
  })
  .catch((error) => {
    console.error('Error:', error.toString())
  })
}

// go get the data from the server every night at 11pm server time
new CronJob('0 23 * * * *', function () {
  let tS = Number(new Date())
  let logTime = new Date(tS)
  console.log('Daily Data Get ' + logTime)
  getData()
}, null, true, 'America/Los_Angeles')

// make the KML for leasingagent every night at 23:02
new CronJob('2 23 * * * *', function () {
  let tS = Number(new Date())
  let logTime = new Date(tS)
  console.log('Build Leasing Agent KML ' + logTime)
  makeKML('LeasingAgent')
  // replace(replaceOptions)
  //   .then(changedFiles => {
  //     console.log('Modified files:', changedFiles.join(', '))
  //   })
  //   .catch(error => {
  //     console.error('Error occurred:', error)
  //   })
}, null, true, 'America/Los_Angeles')

// make the KML for propertymanager every night at 23:04
new CronJob('4 23 * * * *', function () {
  let tS = Number(new Date())
  let logTime = new Date(tS)
  console.log('Build Property Manager KML ' + logTime)
  makeKML('PropertyManager')
  replace(replaceOptions)
    .then(changedFiles => {
      console.log('Modified files:', changedFiles.join(', '))
    })
    .catch(error => {
      console.error('Error occurred:', error)
    })
}, null, true, 'America/Los_Angeles')

// make the KML for propertymanager every night at 23:06
new CronJob('6 23 * * * *', function () {
  let tS = Number(new Date())
  let logTime = new Date(tS)
  console.log('Build Kimco Sites ' + logTime)
  makeKML('KimcoSites')
  replace(replaceOptions)
    .then(changedFiles => {
      console.log('Modified files:', changedFiles.join(', '))
    })
    .catch(error => {
      console.error('Error occurred:', error)
    })
}, null, true, 'America/Los_Angeles')

// ***********
// for dev use only
// ***********

// getData()
// let devLayer = 'LeasingAgent'
// makeKML(devLayer)
// replace(replaceOptions)
//   .then(changedFiles => {
//     console.log('Modified files:', changedFiles.join(', '))
//   })
//   .catch(error => {
//     console.error('Error occurred:', error)
//   })
