# Cisco CUCM SQL Editor

A NodeJS web application to edit SQL queries and run again Cisco CUCM database. Results are returned to a web-based spreadsheet that can be download to CSV if needed.

Administrative XML (AXL) information can be found at:
[Administrative XML (AXL) Reference](https://developer.cisco.com/docs/axl/#!axl-developer-guide).

## Installation

Run as native node application using npm:

```javascript
npm install
npm run start
```

Build and run using Docker:

```bash
npm run docker:build
npm run docker:run
```

Pull image from Docker.io and run with the following:

```bash
docker run -d -p 3000:3000 --name cucm-sql-editor --restart=always --env-file=.env -v cucm-sql-data:/app/data sieteunoseis/cucm-sql-editor:latest
```

## Environment Variable

```javascript
NODE_ENV=production
CUCM_HOSTNAME=devnetsandbox.cisco.com
CUCM_USERNAME=administrator
CUCM_PASSWORD=ciscopsdt
CUCM_VERSION=12.5
```

## Examples

Check **data** folder for SQL examples. If you use Docker you want to mount this folder to the host with the -v flag. Once mounted you can edit/add or update files externally from container.

## Exposed API

API's used in this project can be used externally. Currently they are unsecured. Documentation can be found at:

http://localhost:3000/docs

## Screenshots

Web-based CodeMirror editor. Configured to support [x-sql](https://codemirror.net/5/mode/sql/). This allows for generic SQL support as IBM's informix is not widely used.

![Editor](https://github.com/sieteunoseis/docker-cucm-sql/blob/main/screenshots/editor.png?raw=true)

Option to Run pasted or loaded query for quick access, or ability to save or format query.

![Buttons](https://github.com/sieteunoseis/docker-cucm-sql/blob/main/screenshots/buttons.png?raw=true)

Results returned to an excel like table, with the ability to sort, filter and search.

![Table](https://github.com/sieteunoseis/docker-cucm-sql/blob/main/screenshots/table.png?raw=true)

API's used in the application are documented via swagger. Check them out at:

http://localhost:3000/docs


![Swagger API](https://github.com/sieteunoseis/docker-cucm-sql/blob/main/screenshots/api.png?raw=true)

## Limitations

Currently this application will only do select statements. Update queries are not supported.

## Giving Back

If you would like to support my work and the time I put in creating the code, you can click the image below to get me a coffee. I would really appreciate it (but is not required).

[![Buy Me a Coffee](https://github.com/appcraftstudio/buymeacoffee/raw/master/Images/snapshot-bmc-button.png)](https://www.buymeacoffee.com/automatebldrs)