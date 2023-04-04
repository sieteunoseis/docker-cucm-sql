/**
 * @swagger
 *  /getquery/{filename}:
 *    get:
 *      summary: Get contents of query by file name
 *      parameters:
 *      - in: path
 *        name: filename
 *        type: string
 *        required: true
 *        description: Filename to retrieve with .sql extension.
 *      tags: ["SQLController"]
 *      responses:
 *        "200":
 *          description: OK
 *        "500":
 *          description: Internal server error. Check for correct param.
 */

var express = require("express");
var router = express.Router();
//requiring path and fs modules
const path = require("path");
const fs = require("fs");

/* GET Queries listing. */
router.get("/:name/", function (req, res, next) {
  //joining path of directory
  const directoryPath = path.join(__dirname, "..", "data", req.params.name);

  var outputData = {
    fileName: req.params.name,
    data: "",
  };

  fs.readFile(directoryPath, "utf8", (err, data) => {
    if (err) {
      res.status(500).send({ message: "No file found" });
      return;
    }

    outputData.data = data;
    res.status(200).send(outputData);
  });
});

module.exports = router;
