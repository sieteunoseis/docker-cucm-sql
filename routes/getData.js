/**
 * @swagger
 *  /getdata:
 *    post:
 *      summary: Get data back from CUCM for provided SQL query
 *      tags: ["SQLController"]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              $ref: '#/components/schemas/getdata'
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
 *      getdata:
 *        type: object
 *        required:
 *          - fileName
 *          - query
 *        properties:
 *          query:
 *            type: string
 *            description: SQL Query
 *        example:
 *           query: 'select * from device'
 */


// Use dotenv for enviromental variables if development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

var express = require("express");
var router = express.Router();
const axlService = require("cisco-axl");

// Set up new AXL service
let service = new axlService(
  process.env.CUCM_HOSTNAME,
  process.env.CUCM_USERNAME,
  process.env.CUCM_PASSWORD,
  process.env.CUCM_VERSION
);

/* POST table page. */
router.post("/", async function (req, res) {
  var query = req.body.query;
  var operation = "executeSQLQuery";
  var tags = await service.getOperationTags(operation);
  tags.sql = query;

  // Let's execute the query on server
  await service
    .executeOperation(operation, tags)
    .then((results) => {
      if (results?.row) {
        // let's removed any undefined
        results.row.forEach(function (obj) {
          for (var i in obj) {
            if (obj[i] === undefined) {
              obj[i] = "";
            }
          }
        });
        res.json(results);
      }else{
        res.status(204).json({ 'message':'No data'});
      }
    })
    .catch((error) => {
      res.status(500).json(error);
    });
});

module.exports = router;
