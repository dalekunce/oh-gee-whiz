const restify = require('restify')
const tokml = require('tokml')

var testJSON = require('./data/test.json')

/** Utilities **/

function statusUpdate (req, res, next) {
  res.send('All Good!')
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

const server = restify.createServer()

/* Is the server up */
server.get('/status/', statusUpdate)

/** Get KML Test **/
server.get('/kml/test/', getKmlTest)

server.listen(3000, function () {
  console.log('%s listening at %s', server.name, server.url)
})
