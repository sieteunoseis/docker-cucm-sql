var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('layouts', {layout : 'index', title: "Cisco CUCM SQL Editor"});
});

module.exports = router;