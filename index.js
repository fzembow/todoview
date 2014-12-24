// TODO: Put this up on npm and installable via npm install todoview -g
var express = require('express'),
    fs = require('fs-extended'),
    open = require('open'),
    path = require('path'),
    Promise = require('bluebird');

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
      files = files.filter(function(f) {
        var visible = config.includeHidden || !f.match(/^\.|\/.\//);
        var blacklisted = config.blacklist.some(function(pattern) {
          return f.match(pattern);
        });

        return visible && !blacklisted;
      });
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

      var todos = [];
      var lines = data.split("\n");

      lines.forEach(function(line, lineIndex) {
        // TODO: Better regex to match TODOs anywhere within a block comment
        if (!line.match(/^\/\/\s*TODO/)) return;

        var startLineIndex = Math.max(0, lineIndex - config.linesToShow);

        // Find bottom of multi line TODOs
        var todoEndLineIndex = lineIndex;
        do {
          todoEndLineIndex ++;
          // If line is not a comment line, then consider the comment done.
          if (!lines[todoEndLineIndex].match(/^\/\//)) break;

          // If blank comment line,then this todo is done.
          if (lines[todoEndLineIndex].match(/^\/\/\s*$/)) break;
        } while (todoEndLineIndex < lines.length -1);

        todoEndLineIndex --;

        var endLineIndex = Math.min(lines.length - 1, todoEndLineIndex + config.linesToShow);

        var todo = {
          extension: fileExtension,
          startLineNumber: startLineIndex + 1,
          todoLineNumber: lineIndex + 1,
          // TODO: If there are multiple lines of a comment, highlight them all.
          endLineNumber: endLineIndex + 1,
          lines: lines.slice(startLineIndex, endLineIndex),
        };
        todos.push(todo);
      });

      if (todos.length) {
        resolve({
          filename: filename,
          todos: todos
        });
      } else {
        resolve({});
      }
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
