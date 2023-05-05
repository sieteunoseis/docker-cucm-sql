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


const { makeValidator, cleanEnv, str, host} = require("envalid");
const path = require("path");

// Use dotenv for enviromental variables if development
if(process.env.NODE_ENV === "development"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'development.env') })
}else if(process.env.NODE_ENV === "test"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'test.env') })
}else if(process.env.NODE_ENV === "staging"){
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', 'staging.env') })
}

var express = require("express");
var router = express.Router();
const axlService = require("cisco-axl");

const versionValid = makeValidator(x => {
  if (/.*\..*[^\\]/.test(x)) return x.toUpperCase()
  else throw new Error('CUCM_VERSION must be in the format of ##.#')
})

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
  CUCM_VERSION: versionValid({ desc: "Cisco CUCM Version." , example: "12.5" }),
});

// Set up new AXL service
let service = new axlService(
  env.CUCM_HOSTNAME,
  env.CUCM_USERNAME,
  env.CUCM_PASSWORD,
  env.CUCM_VERSION
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
