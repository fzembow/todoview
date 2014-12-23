var app = angular.module('todoview', ['ngResource']);


// Set up REST API to fetch individual nodes.
app.factory("Todos", function($resource) {
  return $resource("/todos", {}, {
      'index':   { method: 'GET', isArray: true },
  });
});

app.controller('TodoviewController', function($scope, Todos) {
  $scope.files = Todos.index();
});

app.directive("codeblock", function($window) { 
  return { 
    restrict: "EA", 
    scope: {
      todo: '=',
    }, 
    template: "<div class='todo'>",
    link: function(scope, elem, attrs){ 

      var root = elem[0].children[0];
      var todoLineNumber = scope.todo.todoLineNumber;

      var lines = scope.todo.lines;
      for (var i = 0; i < lines.length; i++) {
        var line = document.createElement("div");

        var currentLineNumber = scope.todo.startLineNumber + i;

        line.className = "line";
        if (currentLineNumber == todoLineNumber) {
          line.classList.add("todoline");
        }

        var lineNumber = document.createElement("div");
        lineNumber.className = "lineNumber";
        lineNumber.textContent = currentLineNumber;

        var lineContent = document.createElement("div");
        lineContent.className = "lineContent";
        lineContent.textContent = lines[i];

        line.appendChild(lineNumber);
        line.appendChild(lineContent);
        root.appendChild(line);

        // TODO: Use a library to color-code based on language.
      }
    } 
  } 
});
