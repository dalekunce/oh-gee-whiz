/* jshint esversion: 6 */
const config = require('./config.json')
const restify = require('restify')
const tp = require('tedious-promises')
const _ = require('lodash')
const fs = require('fs')
const CronJob = require('cron').CronJob

tp.setConnectionConfig(config) // global scope

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
      combined = JSON.parse(combined)
      resolve(combined)
    })
  // }).then(function (q) {
  //   console.log('DESCRIPTING')
  //   return new Promise((resolve, reject) => {
  //     _.forEach(q, function (element, i) {
  //       // set description for later use by tokml
  //       console.log('feature' + i)
  //       // let desc = 'this is a test' +
  //       // ' more testing' + q[i].properties.SiteNo
  //       console.log(q[i].properties)
  //       let desc = ''
  //       // let desc = '<![CDATA[<!DOCTYPE html>' +
  //       //   '<html xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height: 100%;"><head>' +
  //       //   '<title>KIMCO Detail | ' + q[i].properties.SiteNo + '</title>' +
  //       //   '<meta http-equiv="content-type" content="text/html; charset=utf-8"/></head><body><font face="Verdana"><a href="http://kimcorealty.com"><img border="0" width="32px" src="http://gee-server.kimcorealty.com/icons/kimco_2017.png" alt="Kimco Logo" /></a>' +
  //       //   '<br /><br />' +
  //       //   '<b>Site No:</b>' + q[i].properties.SiteNo + '<br />' +
  //       //   '<b>Center Name:</b>' + q[i].properties.CenterName + '<br />' +
  //       //   '<b>Address:</b>' + q[i].properties.Address + '<br />' +
  //       //   '<b>Region:</b>' + q[i].properties.Region + '<br />' +
  //       //   '<b>GLA:</b>' + q[i].properties.GLA + '<br />' +
  //       //   '<b>Partnership:</b>' + q[i].properties.Partnership + '<br />' +
  //       //   '<hr /><b>Link to Web Site:</b> <br /><a href="LinkToWebs" target="asset">' + q[i].properties.LinkToWebs + '</a>' +
  //       //   '<hr /><b>Marketing Brochure:</b> <br /><a href="' + q[i].properties.MarketingBrochure + '" target="asset">' + q[i].properties.MarketingBrochure + '</a>' +
  //       //   '<hr />' +
  //       //   '<b>Overlay Site Plan:</b> <a href="' + q[i].properties.LinkToOverlay + '" target="asset">Click to see ' + q[i].properties.SiteNo + ' site plan</a><br />' +
  //       //   '<hr />' +
  //       //   '<b>Property Manager:</b> ' + q[i].properties.PropertyManager + '<br />' +
  //       //   '<b>Leasing Agent:</b> ' + q[i].properties.LeasingAgent + '<br />' +
  //       //   '<hr /><br />' +
  //       //   '</font>' +
  //       //   '</body>' +
  //       //   '</html>]]>'
  //
  //       let description = {
  //         'Description': desc
  //       }
  //
  //       _.assign(q[i].properties, description)
  //
  //       // console.log(q[i])
  //     })
  //     console.log(q)
  //     resolve(q)
  //   })
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

new CronJob('* 23 * * * *', function () {
  let tS = Number(new Date())
  let logTime = new Date(tS)
  console.log('Daily Get ' + logTime)
  getData()
}, null, true, 'America/Los_Angeles')

getData()
