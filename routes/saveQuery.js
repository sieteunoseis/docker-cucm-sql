/**
 * @swagger
 *  /savequery:
 *    post:
 *      summary: Save SQL Query
 *      tags: ["SQLController"]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/savequery'
 *      responses:
 *        "200":
 *          description: OK
 *        "500":
 *          description: Server error
 */

/**
 * @swagger
 *  components:
 *    schemas:
 *      savequery:
 *        type: object
 *        required:
 *          - fileName
 *          - query
 *        properties:
 *          fileName:
 *            type: string
 *            description: Name of the file without .sql extension
 *          query:
 *            type: string
 *            description: SQL Query
 *        example:
 *           fileName: Get_All_Devices
 *           query: 'select * from device'
 */

var express = require("express");
var router = express.Router();
var fs = require("fs");
var path = require("path");
const { format } =  require('sql-formatter');

router.post("/", function (req, res, next) {
  var fileName = req.body.fileName;
  fileName = fileName.replace(/[/\\?%*:|"<>\s]/g, "_");

  // Let's create the file path
  filePath = path.join(__dirname, "..", "data", fileName + ".sql");

  // Let's try to format the query as best as we can. If not possible, we'll just save the query as is.
  try {
    var formattedQuery = format(req.body.query, {
      language: 'transactsql',
      keywordCase: 'upper',
      linesBetweenQueries: 2,
    });
  } catch (e) {
    formattedQuery = req.body.query;
  }

  // Let's save the file
  try {
    fs.writeFile(filePath, formattedQuery, function () {
      res.status(200).send("Successfully saved file");
    });
  } catch (e) {
    res.status(500).send("Error");
  }
});

module.exports = router;
