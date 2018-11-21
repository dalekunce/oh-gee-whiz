/* jshint esversion: 6 */
const config = require('./config.json')
const restify = require('restify')
const tokml = require('tokml')
var tp = require('tedious-promises')
const _ = require('lodash')
const Promise = require('promise')
var fs = require('fs')

// test data to make sure everything parses
const testJSON = require('./data/test.json')
const kimco = require('./data/kimco.json')

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

function statusUpdate (req, res, next) {
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

function getKmlTest (req, res, next) {
  const kml = tokml(testJSON)
  res.set({
    'content-type': 'application/xml',
    'content-disposition': 'attachment; filename="test.kml"'
  })
  res.send(kml)
  next()
}

/** Search **/
const getSearch = function (req, res, next) {
  let qS = req.query.q

  let qO = {}
  if (req.query.s) {
    qO = req.query.s
  } else {
    qO = ''
  }

  console.log('search started for ' + qS)

  function goSearch (sT, sO) {
    tp.sql(`SELECT TOP (10)
    'Feature' AS type,
    SiteNo as id,
    LeasingAgent as LeasingAgent,
    PropertyManager as PropertyManager,
    Name as [properties.Name],
    SiteNo as [properties.SiteNo],
    PropertyManager as [properties.PropertyManager],
    LeasingAgent as [properties.LeasingAgent],
    'Point' as [geometry.type],
    JSON_QUERY
    ( FORMATMESSAGE('[%s,%s]',
    FORMAT(longitude, N'0.##########'),
    FORMAT(latitude, N'0.##########'))
  ) as [geometry.coordinates]
  FROM KIMprops
  WHERE KIMprops.Name LIKE Concat('%',@qID,'%')
  FOR JSON PATH`)
  .parameter('qID', TYPES.VarChar, sT)
  .execute()
  .then(function (result, rowCount) {
    console.log(result)
    if (rowCount < 1) {
      console.log('returned ' + rowCount + ' features')
      console.log('Not a Valid Search Term')
      next()
    } else {
      // sql requires some parsing because mssql doesn't output clean geojson by default
      const features = result[0]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B']
      let d1 = {
        type: 'FeatureCollection',
        'features':
        eval(features)
      }

      let d2 = JSON.stringify(d1, null, 2)

      return d2
    }
  }).then(function (d) {
    let d4 = JSON.parse(d)
    let d5 = tokml(d4, {
      documentName: 'Kimco Search Results',
      documentDescription: 'Kimco Search Results',
      name: 'name'
    })
    return d5
  }).then(function (f) {
    res.set({
      'content-type': 'application/xml',
      'content-disposition': 'attachment; filename="sites.kml"'
    })
    res.send(f)
    next()
  }).fail(function (err) {
    console.log(err)
  })
}

goSearch(qS, qO)
}

/** sorter for data **/
let sB = {}
function getSorted (req, res, next) {
  sB = req.query.s
  let style = {}

  const e = function (s) {
    console.log('SORTING')
    // sort the layer for the intended
    if (s === 'PropertyManager') {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'commercial',
        'marker-color': '#008015'
      }
    } else if (s === 'LeasingAgent') {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'camera',
        'marker-color': '#801876'
      }
    } else {
      style = {
        'marker-size': 'large',
        'marker-symbol': 'star',
        'marker-color': '#2C4880'
      }
    }

    console.log(sB)

    // let kimcoS = kimco

    return new Promise((resolve, reject) => {
      let kimcoS = _.sortBy(kimco, sB)

      resolve(kimcoS)
    })
  }

  const styleIt = function (q) {
    console.log('STYLING')
    return new Promise((resolve, reject) => {
      _.forEach(q, function (element, i) {
        _.assign(q[i].properties, style)
      })
      resolve(q)
    })
  }

  const geofyIt = function (q) {
    console.log('GEOFYING')
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
  
  const parseK = function (q3, sB) {
    console.log('PARSING')
    let q4 = JSON.parse(q3)
    let dKML = tokml(q4, {
      documentName: 'Kimco Sites',
      documentDescription: 'Kimco Sites',
      simplestyle: true,
      name: sB
    })

    return new Promise((resolve, reject) => {
      fs.writeFile('kimco.kml', dKML, function (err) {
        if (err) {
          return console.log(err)
        } else {
          console.log('The file was saved')
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
    let q = geofyIt(result)
    return q
  }).then(function (result) {
    let q = parseK(result)
    return q
  })
  .then(function (f) {
    res.set({
      'content-type': 'application/xml',
      'content-disposition': 'attachment; filename="sites.kml"'
    })
    res.send(f)
    next()
  })
  // .catch((error) => {
  //   console.error('Error:', error.toString())
}

/* Is the server up */
server.get('/status', statusUpdate)

/** Get KML Test **/
server.get('/test/kml', getKmlTest)

/** Search **/
server.get('/sort/:sort', getSorted)

/** Search **/
server.get('/search/:search', getSearch)

server.listen(3000, function () {
  console.log('%s listening at %s', server.name, server.url)
})
