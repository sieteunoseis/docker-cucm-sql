var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const { engine } = require ('express-handlebars');

const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

var indexRouter = require("./routes/index");
var dataRouter = require("./routes/getData");
var saveQuery = require("./routes/saveQuery");
var getFiles = require("./routes/getFiles");
var getQuery = require("./routes/getQuery");

var app = express();

// view engine setup
// app.set("views", path.join(__dirname, "views"));
//Sets our app to use the handlebars engine
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set("views", "./views");


app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/api/savequery", saveQuery);
app.use("/api/getfiles", getFiles);
app.use("/api/getquery", getQuery);
app.use("/api/getdata", dataRouter);

// Swagger Docs
const specs = swaggerJSDoc(swaggerDocument);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(specs));

// Static Files
app.use(
  "/bootstrap/css",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist/css"))
);
app.use(
  "/bootstrap/js",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist/js"))
);
app.use(
  "/jquery",
  express.static(path.join(__dirname, "node_modules/jquery/dist"))
);
app.use(
  "/popperjs",
  express.static(path.join(__dirname, "node_modules/@popperjs/core/dist/umd"))
);
app.use(
  "/codemirror",
  express.static(path.join(__dirname, "node_modules/codemirror"))
);
app.use(
  "/fontawesome",
  express.static(path.join(__dirname, "node_modules/@fortawesome/fontawesome-free"))
);
app.use(
  "/select2",
  express.static(path.join(__dirname, "node_modules/select2/dist"))
);
app.use(
  "/select2-bootstrap-5-theme",
  express.static(path.join(__dirname, "node_modules/select2-bootstrap-5-theme/dist"))
);
app.use(
  "/handsontable",
  express.static(path.join(__dirname, "node_modules/handsontable/dist"))
);
app.use(
  "/sql-formatter",
  express.static(path.join(__dirname, "node_modules/sql-formatter"))
);
app.use(express.static(path.join(__dirname, "public")));
app.use("/", indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err,req,res,next){
  res.render('layouts', {layout : 'error', title: "Cisco CUCM SQL Editor", error: err});
});

module.exports = app;
