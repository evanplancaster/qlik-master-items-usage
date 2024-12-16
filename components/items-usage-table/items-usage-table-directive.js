define( ["qvangular", "jquery", "text!./items-usage-table-template.ng.html"],
	function (qvangular, jquery, ngTableTemplate, qlik_data, table_ui ) {
		'use strict';
		qvangular.directive( 'itemsUsageTable', function($parse) {
			return {
				restrict: "E",
				template: ngTableTemplate,
                scope: true,
                link: function(scope, element, attrs){
                    // Parse the 'columns' attribute as an expression in the parent scope
                    var columnsGetter = $parse(attrs.columns);
                    // Now we assign the evaluated result to our local scope
                    scope.columns = columnsGetter(scope);

                    var showDeleteColGetter = $parse(attrs.showDeleteCol);
                    scope.showDeleteCol = showDeleteColGetter(scope);
                }
			}
		});
	});
	