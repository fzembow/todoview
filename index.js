// TODO: Put this up on npm and installable via npm install todoview -g
var express = require('express'),
    fs = require('fs-extended'),
    open = require('open'),
    path = require('path'),
    Promise = require('bluebird');
Promise.promisifyAll(fs);

var files = [];

// TODO: Config should be configurable from within the app itself.
var config = {
  blacklist: [
    /^node_modules/
  ],
  includeHidden: false,
  linesToShow: 9,
  port: 10025
};


// TODO: Make this an Emitter? Emit filenames when they are encountered
// and stream their processing.
function listFiles(filepath) {
  return new Promise(function(resolve) {
    fs.listFiles(filepath, { recursive: 1 }, function (err, files) {
      resolve(files);
    });
  });
}


function findTodosInFiles(filenames) {
  return Promise.all(filenames.map(findTodosInFile));
}


function findTodosInFile(filename) {

  var fileExtension = path.extname(filename).slice(1);

  return new Promise(function(resolve) {
    // TODO: Use fs.createReadStream?
    fs.readFile(filename, {encoding: "utf-8"}, function(err, data){
      if (err) {
        resolve({});
        return;
      }

      var matchingLines = [];
      var lines = data.split("\n");

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // TODO: Use a regexp here to only match "TODO" within comments.
        if (line.indexOf("// TODO") != -1) {

          var startLineNumber = Math.max(0, i - config.linesToShow);
          var endLineNumber = Math.min(lines.length - 1, i + config.linesToShow);

          var match = {
            extension: fileExtension,
            startLineNumber: startLineNumber,
            todoLineNumber: i,
            // TODO: If there are multiple lines of a comment, highlight them all.
            endLineNumber: endLineNumber,
            lines: lines.slice(startLineNumber, endLineNumber),
          };
          matchingLines.push(match);
        }
      }

      if (!matchingLines.length) {
        resolve({});
      }

      resolve({
        filename: filename,
        todos: matchingLines
      });
    });
  });
}


/*
 * Runs a local web server to show the files.
 */
function runServer(data) {

  // Remove any empty files from the data.
  data = data.filter(function(d) { return Object.keys(d).length; });

  var app = express();

  app.use('/static', express.static(__dirname + '/static'));

  app.get('/', function(req, res){
    fs.readFile(__dirname + '/templates/index.html', {encoding: "utf-8"}, function(err, template) {
      res.send(template);
    });
  });

  app.get('/todos', function(req, res){
    res.json(data);
  });

  app.listen(config.port, function(){
    open('http://localhost:' + config.port);
  });

}

if (!module.parent) {
  listFiles(".")
    .then(findTodosInFiles)
    .then(runServer);

  // TODO: Implement watching functionality.
  /*
    fs.watch('.', {}, function(event, filename) {
      console.log(event, filename);
    });
  */
}
