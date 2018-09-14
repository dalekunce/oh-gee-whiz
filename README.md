# Oh GEE Whiz

This application/api is a standalone node.js app that talks to a MSSQL database and returns KML and GeoJSON for a given valid SQL query.

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
