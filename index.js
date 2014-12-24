#! /usr/bin/env node

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


// TODO: Make this an Emitter?
// Emit filenames when they are encountered and stream their processing.
// Might be a premature optimization...
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
  return new Promise(function(resolve) {
    Promise.all(filenames.map(findTodosInFile)).then(function(data) {
      // Remove any empty files from the data.
      resolve(data.filter(function(d) { return Object.keys(d).length; }));
    });
  });
}


function findTodosInFile(filename) {

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
        if (!line.match(/^\s*\/\/\s*TODO/)) return;

        var startLineIndex = Math.max(0, lineIndex - config.linesToShow);

        // Find bottom of multi line TODOs
        var todoEndLineIndex = lineIndex;
        do {
          todoEndLineIndex++;
          // If line is not a comment line, then consider the comment done.
          if (!lines[todoEndLineIndex].match(/^\s*\/\//)) break;

          // If blank comment line,then this todo is done.
          if (lines[todoEndLineIndex].match(/^\s*\/\/\s*$/)) break;
        } while (todoEndLineIndex < lines.length -1);

        todoEndLineIndex--;

        var endLineIndex = Math.min(lines.length - 1, todoEndLineIndex + config.linesToShow + 1);

        var todo = {
          startLineNumber: startLineIndex + 1,
          startTodoLineNumber: lineIndex + 1,
          endTodoLineNumber: todoEndLineIndex + 1,
          endLineNumber: endLineIndex + 1,
          lines: lines.slice(startLineIndex, endLineIndex),
        };
        todos.push(todo);
      });

      if (todos.length) {
        resolve({
          filename: filename,
          extension: path.extname(filename).slice(1),
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

  var app = express();

  app.use('/static', express.static(__dirname + '/static'));

  app.get('/', function(req, res){
    fs.readFile(__dirname + '/templates/index.html', {encoding: "utf-8"}, function(err, template) {
      res.send(template);
    });
  });

  app.get('/todos', function(req, res){
    listFiles(".")
      .then(findTodosInFiles)
      .then(function(d){
        res.json(d);
      });
  });

  app.listen(config.port, function(){
    open('http://localhost:' + config.port);
  });

}

if (!module.parent) {

  runServer();

  // TODO: Implement watching functionality.
  //
  // The idea would be that you can just run one of these todoviews
  // in a directory you're working in, and when a file is added or updated
  // the list of todos in the app would be kept in sync (most likely
  // using a websocket or similar).
  //
  // This comment is also kept intentionally long in order
  // to test how the app handles long comments.
 
  /*
    fs.watch('.', {}, function(event, filename) {
      console.log(event, filename);
    });
  */
}
