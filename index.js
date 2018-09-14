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

function getSearch (req, res, next) {
  const qS = req.params.search

  console.log('search started for ' + qS)

  function goSearch (sT) {
    tp.sql(`SELECT TOP (3)
      'Feature' AS type,
      SiteNo as id,
      Name as [properties.Name],
      SiteNo as [properties.SiteNo],
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
          type: "FeatureCollection",
          "features":
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

  goSearch(qS)
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

/** Search **/
server.get('/search/:search', getSearch)

server.listen(3000, function () {
  console.log('%s listening at %s', server.name, server.url)
})
