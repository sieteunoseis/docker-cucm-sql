/**
 * @swagger
 *  /getfiles:
 *    get:
 *      summary: Get all the sql files stored on the server
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
router.get("/", function (req, res, next) {
  //joining path of directory
  const directoryPath = path.join(__dirname, "..", "data");
  //passsing directoryPath and callback function
  fs.readdir(directoryPath, function (err, files) {
    //handling error
    if (err) {
      return console.log("Unable to scan directory: " + err);
    }
    const EXTENSION = ".sql";

    const targetFiles = files.filter((file) => {
      return path.extname(file).toLowerCase() === EXTENSION;
    });

    res.send(targetFiles);
  });
});

module.exports = router;
