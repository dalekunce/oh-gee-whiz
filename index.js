/* jshint esversion: 6 */
const config = require('./config.json')
const restify = require('restify')
const tokml = require('tokml')
var tp = require('tedious-promises')

// test data to make sure everything parses
const testJSON = require('./data/test.json')

tp.setConnectionConfig(config) // global scope

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
    // connection.on('close', function () { })
  }
})

// connection.on()

/** Utilities **/

function statusUpdate (req, res, next) {
  result.serverstatus = 'API reporting for duty'
  res.set({
    'content-type': 'application/json'
  })

  const testQuery = new Request(`Select * FROM Sites`, function (err, rowCount, rows) {
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
  // kml is a string of KML data, geojsonObject is a JavaScript object of
  // GeoJSON data
  const kml = tokml(testJSON)
  res.set({
    'content-type': 'application/xml',
    'content-disposition': 'attachment; filename="test.kml"'
  })
  res.send(kml)
  next()
}

function getSites (req, res, next) {
  tp.sql(`select
    'Feature' AS type,
    ID as id,
    Name as [properties.name],
    'Point' as [geometry.type],
    JSON_QUERY
    ( FORMATMESSAGE('[%s,%s]',
    FORMAT(Geo.Long, N'0.##########'),
    FORMAT(Geo.Lat, N'0.##########'))
  ) as [geometry.coordinates]
  FROM Sites
  FOR JSON PATH`)
  .execute()
  .then(function (result) {
    // sql requires some parsing because mssql doesn't output geojson by default
    const data = JSON.parse('{ "type": "FeatureCollection", "features":' + result[0]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B'] + '}')
    const datakml = tokml(data, {
      documentName: 'Kimco Sites',
      documentDescription: 'Kimco Sites',
      name: 'name'
    })
    return datakml
  }).then(function (f) {
    res.set({
      'content-type': 'application/xml',
      'content-disposition': 'attachment; filename="sites.kml"'
    })
    res.send(f)
  }).fail(function (err) {
    console.log(err)
  })

  next()
}

function getSearch (req, res, next) {
  const qS = req.params.search

  console.log(qS)

  function goSearch (sT) {
    tp.sql(`select
      'Feature' AS type,
      ID as id,
      Name as [properties.name],
      'Point' as [geometry.type],
      JSON_QUERY
      ( FORMATMESSAGE('[%s,%s]',
      FORMAT(Geo.Long, N'0.##########'),
      FORMAT(Geo.Lat, N'0.##########'))
    ) as [geometry.coordinates]
    FROM Sites
    WHERE Sites.ID LIKE @qID
    FOR JSON PATH`)
    .parameter('qID', TYPES.Int, sT)
    .execute()
    .then(function (result) {
      // sql requires some parsing because mssql doesn't output geojson by default
      const data = JSON.parse('{ "type": "FeatureCollection", "features":' + result[0]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B'] + '}')
      const datakml = tokml(data, {
        documentName: 'Search Results',
        documentDescription: 'Search Results',
        name: 'name'
      })
      return datakml
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

  if (isNaN(qS)) {
    console.log('Not a Valid Search Term')
    res.send('Not a valid search please search by Site ID #')
    next()
  } else {
    goSearch(qS)
  }
}

/* Turn the server on */
const server = restify.createServer()
server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.queryParser())
server.use(restify.plugins.bodyParser())

/* Is the server up */
server.get('/status', statusUpdate)

/** Get KML Test **/
server.get('/test/kml', getKmlTest)

/** Get the full site page **/
server.get('/sites', getSites)

/** Search **/
server.get('/search/:search', getSearch)

// server.get('kml/kimcosites', kimcoKML)

server.listen(3000, function () {
  console.log('%s listening at %s', server.name, server.url)
})
