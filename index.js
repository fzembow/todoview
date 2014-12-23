var express = require('express'),
    fs = require('fs'),
    open = require('open'),
    Promise = require('bluebird');
Promise.promisifyAll(fs);

var files = [];

var config = {
  includeHidden: false,
  linesToShow: 9,
  port: 10025
};


// TODO: Make this include recursive files?
function listFiles() {
  return new Promise(function(resolve){
    fs.readdirAsync('.').then(function(files){
      if (!config.includeHidden) {
        files = files.filter(function(file) { return file[0] != '.' });
      }
      resolve(files);
    });
  });
}


function findTodosInFiles(filenames) {
  return Promise.all(filenames.map(findTodosInFile));
}


function findTodosInFile(filename) {
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

          matchingLines.push({
            startLineNumber: i - config.linesToShow,
            todoLineNumber: i,
            // TODO: If there are multiple lines of a comment, highlight them all.
            endLineNumber: i - config.linesToShow,
            lines: lines.slice(i - config.linesToShow, i + config.linesToShow),
          });
        }
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

  // Remove empty files from the data.
  data = data.filter(function(d) { return Object.keys(d).length; });

  fs.readFile(__dirname + '/templates/index.html', {encoding: "utf-8"}, function(err, template) {

    var app = express();

    app.use('/static', express.static(__dirname + '/static'));

    app.get('/', function(req, res){
      res.send(template);
    });

    app.get('/todos', function(req, res){
      res.json(data);
    });

    app.listen(config.port, function(){
      open('http://localhost:' + config.port);
    });

  });
}

if (!module.parent) {
  listFiles()
    .then(findTodosInFiles)
    .then(runServer);

  // TODO: Implement watching functionality.
  /*
    fs.watch('.', {}, function(event, filename) {
      console.log(event, filename);
    });
  */
}
