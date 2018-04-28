/* jshint esversion: 6 */
const config = require('./config.json')
const restify = require('restify')
const tokml = require('tokml')
const testJSON = require('./data/test.json')


/** SQL connection **/
const Connection = require('tedious').Connection
const Request = require('tedious').Request
const TYPES = require('tedious').TYPES

// Attempt to connect to database
const result = {}
const connection = new Connection(config)
connection.on('connect', function (err) {
  if (err) {
    result.dbconnection = err
    console.log('ERROR DB')
  } else {
    result.dbstatus = 'Connected'
    console.log('Connected to DB')
  }
})

/** Utilities **/

function statusUpdate (req, res, next) {
  result.serverstatus = 'API reporting for duty'

  res.set({
    'content-type': 'application/json'
  })
  res.send(result)
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

/* Turn the server on */
const server = restify.createServer()

/* Is the server up */
server.get('/status', statusUpdate)

/** Get KML Test **/
server.get('/kml/test', getKmlTest)

server.listen(3000, function () {
  console.log('%s listening at %s', server.name, server.url)
})
