# Oh GEE Whiz

This application/api is a standalone node.js app that talks to a MSSQL database and returns KML and GeoJSON for a given valid SQL query.

## Install Application

Create a `config.json` file and update with your credentials and settings.

``` json
{
  "userName": "[username]",
  "password": "[password]",
  "server": "[serverip]",
  "options": {
    "database": "[DBname]",
    "debug": {
      "packet": false
    }
  }
}
```

``` bash
npm install
```

## Start Application

``` bash
node index.js
```
