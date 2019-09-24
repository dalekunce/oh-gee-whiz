/* jshint esversion: 6 */
const config = require('./config.json')
const restify = require('restify')
const tokml = require('tokml')
const tp = require('tedious-promises')
const _ = require('lodash')
const Promise = require('promise')
const fs = require('fs')

// test data to make sure everything parses
const testJSON = require('./data/test.json')
const kimco = require('./data/kimco.json')
const kimcoLogo = 'http://gee-app.kimcorealty.com:3000/data/kimco_logo_2018.png'

tp.setConnectionConfig(config) // global scope

/* Turn the server on */
const server = restify.createServer()
server.pre(restify.pre.sanitizePath())
server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.queryParser())
server.use(restify.plugins.bodyParser())

/** SQL connection **/
const Connection = require('tedious').Connection
const Request = require('tedious').Request
const TYPES = require('tedious').TYPES

// Attempt to connect to database
const result = {}
const connection = new Connection(config)

connection.on('connect', function (err) {
  if (err) {
    console.log('ERROR Connecting to ' + config.server)
  } else {
    console.log('Connected to ' + config.server + ' Started')
  }
})

/** Utilities **/

const statusUpdate = function (req, res, next) {
  result.serverstatus = 'API reporting for duty'
  res.set({
    'content-type': 'application/json'
  })

  const testQuery = new Request(`Select * FROM KIMprops`, function (err, rowCount, rows) {
    if (err) {
      result.dbstatus = err
      console.log('ERROR DB')
    } if (rowCount >= 1) {
      result.dbstatus = 'Connected'
      console.log('Connected to ' + config.server)
    } else {
      result.dbstatus = 'Connected but no data'
      console.log('Connected to ' + config.server + ' but no data')
    }
  })

  connection.execSql(testQuery)
  res.send(result)
  next()
}

const getKmlTest = function (req, res, next) {
  const kml = tokml(testJSON)
  res.set({
    'content-type': 'application/vnd.google-earth.kml+xml',
    'content-disposition': 'attachment; filename="test.kml"'
  })
  res.send(kml)
  next()
}

/** Search **/
const getSearch = function (req, res, next) {
  let qS = req.query.q

  console.log('search started for ' + qS)

  const goSearch = function (sT) {
    tp.sql(`SELECT
      'Feature' AS type,
      SiteNo as id,
      LeasingAgent as LeasingAgent,
      PropertyManager as PropertyManager,
      Name as [properties.Name],
      SiteNo as [properties.SiteNo],
      LEFT(SiteNo,4) as [properties.SiteLink],
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
    WHERE (KIMprops.Name LIKE Concat('%',@qID,'%')
      OR KIMprops.LeasingAgent LIKE Concat('%',@qID,'%')
      OR KIMprops.PropertyManager LIKE Concat('%',@qID,'%'))
      AND KIMprops.active = 'Y'
      AND KIMprops.latitude IS NOT NULL
      AND KIMprops.longitude IS NOT NULL
    FOR JSON PATH`)
    .parameter('qID', TYPES.VarChar, sT)
    .execute()
    .then(function (result, rowCount) {
      let combined = ''
      // sql requires some parsing because mssql doesn't output clean geojson by default
      return new Promise((resolve, reject) => {
        _.forEach(result, function (element, i) {
          combined += result[i]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B']
        })
        combined = JSON.parse(combined)
        resolve(combined)
      })
    }).then(function (q) {
      return new Promise((resolve, reject) => {
        _.forEach(q, function (element, i) {
          // set description for later use by tokml
          let desc = '<![CDATA[<!DOCTYPE html>' +
            '<html xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height: 100%;"><head>' +
            '<title>KIMCO Detail | ' + q[i].properties.SiteNo + '</title>' +
            '<meta http-equiv="content-type" content="text/html; charset=utf-8"/></head><body><font face="Verdana"><a href="http://kimcorealty.com">' +
            '<img border="0" width="32px" src="' + kimcoLogo + '" alt="Kimco Logo" /></a>' +
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
            '<b>Overlay Site Plan:</b> <a href="file:///n:/aedept/overlays/' + q[i].properties.SiteLink + '_overlay.kml" target="asset">Click to see ' + q[i].properties.SiteNo + ' site plan</a><br />' +
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
    }).then(function (d) {
      let style = {
        'marker-size': 'large',
        'marker-symbol': 'circle',
        'marker-color': '#FC6363'
      }

      return new Promise((resolve, reject) => {
        _.forEach(d, function (element, i) {
          _.assign(d[i].properties, style)
        })
        resolve(d)
      })
    }).then(function (d) {
      let q = {
        type: 'FeatureCollection',
        'features':
        eval(d) // ew but its fast, shrug
      }
      let d1 = tokml(q, {
        documentName: 'Search Results for ' + qS,
        documentDescription: 'Search Results for ' + qS,
        description: 'Description',
        simplestyle: true, // important!
        name: 'Name'
      })
      return d1
    }).then(function (f) {
      res.set({
        'content-type': 'application/vnd.google-earth.kml+xml',
        'content-disposition': 'attachment; filename="' + qS + '.kml"'
      })
      res.send(f)
      next()
    }).fail(function (err) {
      console.log(err)
    })
  }

  goSearch(qS)
}

/** sorter for data **/
let sB = {}
function getSorted (req, res, next) {
  sB = req.query.s
  let style = {}

  const e = function (s) {
    console.log('SORTING')
    // sort the layer for the intended style gets replaced for static kml files in cron.js this is only temporary
    if (s === 'PropertyManager') {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'building',
        'marker-color': '#008015'
      }
    } else if (s === 'LeasingAgent') {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'city',
        'marker-color': '#801876'
      }
    } else {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'star',
        'marker-color': '#2C4880'
      }
      sB = 'SiteNo' // override for bad uri path
    }

    console.log(sB)

    // let kimcoS = kimco

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
          '<meta http-equiv="content-type" content="text/html; charset=utf-8"/></head><body><font face="Verdana"><a href="http://kimcorealty.com">' +
          '<img border="0" width="32px" src="' + kimcoLogo + '" alt="Kimco Logo" /></a>' +
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
          '<b>Overlay Site Plan:</b> <a href="file:///n:/aedept/overlays/' + q[i].properties.SiteLink + '_overlay.kml" target="asset">Click to see ' + q[i].properties.SiteNo + ' site plan</a><br />' +
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
      eval(q) // ew not really a faster way to do it though
    }

    return new Promise((resolve, reject) => {
      let q2 = JSON.stringify(q1, null, 2)
      resolve(q2)
    })
  }

  const parseK = function (q3) {
    // console.log('PARSING')
    let q4 = JSON.parse(q3)
    let dKML = tokml(q4, {
      documentName: 'Kimco ' + sB,
      documentDescription: 'Kimco ' + sB,
      simplestyle: true,
      description: 'Description',
      name: 'SiteNo'
    })

    return new Promise((resolve, reject) => {
      fs.writeFile('./data/' + sB + '.kml', dKML, function (err) {
        if (err) {
          return console.log(err)
        } else {
          console.log('The file was saved')
        }
      })
      resolve(dKML)
    })
  }

  // kicks off the sort path as a promise chain
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
  .then(function (f) {
    res.set({
      'content-type': 'application/vnd.google-earth.kml+xml',
      'content-disposition': 'attachment; filename="' + sB + '.kml"'
    })
    res.send(f)
    next()
  })
  .catch((error) => {
    console.error('Error:', error.toString())
  })
}

/* Is the server up? */
server.get('/status', statusUpdate)

/** Get KML Test **/
server.get('/test/kml', getKmlTest)

/** Search **/
server.get('/search/:search', getSearch)

/** KML NetworkLink for Leasing Agents and Property Managers **/
server.get('/sort/:sort', getSorted)

/** Serves static kml files **/
server.get('/data/*', restify.plugins.serveStatic({
  directory: './data/',
  default: 'KimcoSites.kml', // if nothing specific return just normal kimcosites
  appendRequestPath: false
}))

server.listen(3000, function () {
  console.log('%s listening at %s', server.name, server.url)
})
