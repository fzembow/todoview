var app = angular.module('todoview', ['ngResource']);


// Set up REST API to fetch individual nodes.
app.factory("Todos", function($resource) {
  return $resource("/todos", {}, {
      'index':   { method: 'GET', isArray: true },
  });
});


app.controller('TodoviewController', function($scope, Todos) {
  $scope.files = Todos.index();
  // TODO: Create a controller that allows filtering in the frontend.
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
