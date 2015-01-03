var app = angular.module('todoview', ['ngResource']);

// REST API to fetch list of TODOs.
app.factory("Todos", function($resource) {
  return $resource("/todos", {}, {
      'index':   { method: 'GET', isArray: true },
  });
});

// REST API to fetch config
app.factory("Config", function($resource) {
  return $resource("/config", {}, {
      'index':   { method: 'GET' },
  });
});


app.controller('TodoviewController', function($scope, Todos, Config) {
  $scope.files = Todos.index();

  $scope.config = Config.index();

  $scope.needsRefresh = false;

  $scope.totalTodoCount = function(){
    return $scope.files.reduce(function(sum, file){
      return sum + file.todos.length}, 0);
  }

  $scope.todosMatchingText = function(todo){
    var query = $scope.todoFilter;
    if (!query || !query.length) {
      return true;
    }

    // Run through the TODO lines to see if any match the query.
    var todoStartIdx = todo.startTodoLineNumber - todo.startLineNumber;
    var todoEndIdx = todo.endTodoLineNumber - todo.startLineNumber;
    for (var idx = todoStartIdx; idx <= todoEndIdx; idx++) {
      var line = todo.lines[idx];
      if (todo.lines[idx].indexOf(query) != -1) {
        return true;
      }
    }
    return false;
  }

  $scope.triggerRefresh = function(){
    Todos.index().$promise.then(function(todos){
      $scope.files = todos;
      $scope.needsRefresh = false;
    });
  }

  var ws = new WebSocket('ws://localhost:8080');
  ws.onmessage = function (event) {
    if (event.data == "update") {
      $scope.$apply(function(){
        $scope.needsRefresh = true;
      });
    }
  }
});


app.directive("codeblock", function($window) { 
  return { 
    restrict: "EA", 
    scope: {
      file: '=',
      todo: '=',
    }, 
    template: "<div>",
    link: function(scope, elem, attrs){ 

      var root = elem[0].children[0];
      var startTodoLineNumber = scope.todo.startTodoLineNumber;
      var endTodoLineNumber = scope.todo.endTodoLineNumber;

      var lines = scope.todo.lines;

      var lineNumbers = document.createElement("div");
      lineNumbers.className = "lineNumbers";
      root.appendChild(lineNumbers);

      var pre = document.createElement("pre");
      var code = document.createElement("code");
      code.textContent = lines.join("\n");
      pre.appendChild(code);
      root.appendChild(pre);

      for (var i = 0; i < lines.length; i++) {
        var currentLineNumber = scope.todo.startLineNumber + i;
        var lineNumber = document.createElement("div");
        lineNumber.className = "lineNumber";
        lineNumber.textContent = currentLineNumber;
        if (currentLineNumber >= startTodoLineNumber &&
            currentLineNumber <= endTodoLineNumber) {
          lineNumber.classList.add("todoline");
        }
        lineNumbers.appendChild(lineNumber);
      }

      code.classList.add(scope.file.extension);
      hljs.highlightBlock(code);
    } 
  } 
});
