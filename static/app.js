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
      lineNumber: '=',
      lines: '=',

    }, 
    template: "<div class='todo'>",
    link: function(scope, elem, attrs){ 

      var todoLineNumber = scope.lineNumber;
      var numLines = scope.lines.length;

      var root = elem[0].children[0];
      for (var i = 0; i < numLines; i++) {
        var line = document.createElement("div");
        line.className = "line";

        var lineNumber = document.createElement("div");
        lineNumber.className = "lineNumber";
        lineNumber.textContent = i;

        var lineContent = document.createElement("div");
        lineContent.className = "lineContent";
        lineContent.textContent = scope.lines[i];

        line.appendChild(lineNumber);
        line.appendChild(lineContent);
        root.appendChild(line);
      }
    } 
  } 
});
