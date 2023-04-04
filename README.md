# Cisco CUCM SQL Editor

A NodeJS web application to edit SQL queries and run again Cisco CUCM database. Results are returned to a web-based spreadsheet that can be download to CSV if needed.

Administrative XML (AXL) information can be found at:
[Administrative XML (AXL) Reference](https://developer.cisco.com/docs/axl/#!axl-developer-guide).

## Installation

Using npm:

```javascript
npm install
npm run start
```

Build and run using Docker:

```bash
npm run docker:build
npm run docker:run
```
Pull Image from Docker.io

```bash
docker run -d -p 3000:3000 --name cucm-sql-editor --restart=always --env-file=.env -v cucm-sql-data:/app/data sieteunoseis/cucm-sql-editor:latest
```

## Environment Variable

NODE_ENV=production
CUCM_HOSTNAME=devnetsandbox.cisco.com
CUCM_USERNAME=administrator
CUCM_PASSWORD=ciscopsdt
CUCM_VERSION=12.5

## Examples

Check **data** folder for SQL examples. If you use Docker you want to mount this folder to the host with the -v flag.

## Supported API

API's used in this project can be used external. Currently they are unsecured. Information can be found at:

http://localhost:3000/docs

## Screenshots

![alt text](https://github.com/[username]/[reponame]/blob/[branch]/image.jpg?raw=true)

## Limitations

Currently this application will only do select statements. Update queries are not supported.

## Giving Back

If you would like to support my work and the time I put in creating the code, you can click the image below to get me a coffee. I would really appreciate it (but is not required).

[Buy Me a Coffee](https://www.buymeacoffee.com/automatebldrs)