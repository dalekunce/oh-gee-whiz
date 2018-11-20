/* jshint esversion: 6 */
const config = require('./config.json')
const restify = require('restify')
const tokml = require('tokml')
const tp = require('tedious-promises')
const _ = require('lodash')
const fs = require('fs')
const CronJob = require('cron').CronJob

// test data to make sure everything parses
const testJSON = require('./data/test.json')

tp.setConnectionConfig(config) // global scope

/* Turn the server on */
const server = restify.createServer()

/** SQL connection **/
const Connection = require('tedious').Connection
const Request = require('tedious').Request
const TYPES = require('tedious').TYPES

// Attempt to connect to database
let result = {}
const connection = new Connection(config)

connection.on('connect', function (err) {
  if (err) {
    console.log('ERROR Connecting to ' + config.server)
  } else {
    console.log('Connected to ' + config.server + ' Started')
  }
})

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
    // const features = result[0]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B']
    return new Promise((resolve, reject) => {
      _.forEach(result, function (element, i) {
        combined += result[i]['JSON_F52E2B61-18A1-11d1-B105-00805F49916B']
      })
      console.log(combined)
      resolve(combined)
    })
  }).then(function (d1) {
    // let d2 = JSON.stringify(d1, null, 2)

    return new Promise((resolve, reject) => {
      fs.writeFile('./data/kimco.json', d1, function (err) {
        if (err) {
          return console.log(err)
        } else {
          console.log('The file was saved')
        }
      })
      resolve(d1)
    })
  }).fail(function (err) {
    console.log(err)
  })
}

new CronJob('1 * * * * *', function () {
  let tS = Number(new Date())
  let logTime = new Date(tS)
  console.log('Daily Get ' + logTime)
  getData()
}, null, true, 'America/Los_Angeles')
