# Oh GEE Whiz

This application/api is a standalone node.js app that talks to a MSSQL database via tedious and tedious promises and returns KML and GeoJSON for a given valid SQL query.

## Install Application

Edit the credentials and settings in `config_examples.json` and save as `config.json` in the root directory of the application.

``` json
{
  "userName": "[username]",
  "password": "[password]",
  "server": "[serverip]",
  "options": {
    "database": "[DBname]",
    "debug": {
      "packet": false
    },
    "parseJSON": true,
    "encrypt": false
  }
}
```
## Install Dependencies

``` bash
npm install
```

## Start Application

``` bash
node index.js
```

## Paths

```
http://localhost:3000/status
```

Returns JSON that shows the server API status and the database connection status

```
http://localhost:3000/test/kml
```

lets you know if the server is up and running and that the dependencies all work

```
http://localhost:3000/search/search?q=<search term>
```

Returns the best results from the database based on the search.

```
http://localhost:3000/sort/kimco?s=<sort term>
```

Returns the results for the given 'sort term' in formatted KML. Inputs can be: 'PropertyManager', 'LeasingAgent', or 'KimcoSites'

```
http://localhost:3000/data/*.kml
```

Returns static versions of the above sortable kmls. These versions match the style of Kimco and can are built nightly using cron.js
